import { createHmac, timingSafeEqual } from 'node:crypto';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { firestoreDb } from './db.js';

const paystackSecretKey = defineSecret('PAYSTACK_SECRET_KEY');

type PaystackWebhookBody = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    metadata?: { enrollmentId?: string; studentId?: string };
    customer?: { email?: string };
  };
};

/**
 * Paystack webhook: verify `x-paystack-signature` (HMAC SHA512 of raw body),
 * then on `charge.success` record a payment and update the enrollment ledger.
 * Configure the HTTPS URL in the Paystack dashboard after deploy.
 */
export const paystackWebhook = onRequest(
  { secrets: [paystackSecretKey], cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      res.status(400).send('Missing raw body');
      return;
    }
    const secret = paystackSecretKey.value();
    const signature = req.get('x-paystack-signature');
    if (!signature) {
      res.status(401).send('Missing signature');
      return;
    }
    const digest = createHmac('sha512', secret).update(rawBody).digest('hex');
    let sigBuf: Buffer;
    let hashBuf: Buffer;
    try {
      sigBuf = Buffer.from(signature, 'hex');
      hashBuf = Buffer.from(digest, 'hex');
    } catch {
      res.status(401).send('Invalid signature');
      return;
    }
    if (sigBuf.length !== hashBuf.length || !timingSafeEqual(sigBuf, hashBuf)) {
      res.status(401).send('Invalid signature');
      return;
    }

    let body: PaystackWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as PaystackWebhookBody;
    } catch {
      res.status(400).send('Invalid JSON');
      return;
    }

    if (body.event === 'charge.success' && body.data?.reference) {
      const db = firestoreDb();
      const enrollmentId = body.data.metadata?.enrollmentId;
      const studentId = body.data.metadata?.studentId;
      const amountKobo = body.data.amount ?? 0;
      const amount = amountKobo / 100;

      if (enrollmentId && studentId) {
        const paystackRef = body.data.reference;
        const paymentRef = db.collection('payments').doc(paystackRef);
        const paymentSnap = await paymentRef.get();
        if (paymentSnap.exists) {
          res.status(200).json({ received: true, duplicate: true });
          return;
        }

        const enrollRef = db.collection('enrollments').doc(enrollmentId);
        const enrollSnap = await enrollRef.get();
        if (enrollSnap.exists) {
          const enroll = enrollSnap.data()!;
          const commissionRate = (await db.collection('courses').doc(enroll.courseId as string).get()).data()
            ?.commissionRate as number | undefined;
          const rate = typeof commissionRate === 'number' ? commissionRate : 0;
          const commissionEarned = Math.round(amount * rate * 100) / 100;
          const batch = db.batch();
          batch.set(paymentRef, {
            enrollmentId,
            studentId,
            amount,
            date: Date.now(),
            status: 'success',
            paystackReference: paystackRef,
          });
          batch.update(enrollRef, {
            totalPaid: FieldValue.increment(amount),
            commissionEarned: FieldValue.increment(commissionEarned),
            status: 'active',
          });
          await batch.commit();
        } else {
          logger.warn('paystackWebhook: enrollment not found', { enrollmentId });
        }
      } else {
        logger.warn('paystackWebhook: missing metadata', { enrollmentId, studentId });
      }
    }

    res.status(200).json({ received: true });
  },
);

/**
 * Callable: start a Paystack transaction for the student's enrollment (full course price in NGN).
 * Client redirects the browser to `authorizationUrl`. Webhook finalizes `payments` + `enrollments`.
 */
export const createPaystackCheckout = onCall(
  { secrets: [paystackSecretKey] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const enrollmentId = request.data?.enrollmentId as string | undefined;
    const callbackUrl = request.data?.callbackUrl as string | undefined;
    if (!enrollmentId) {
      throw new HttpsError('invalid-argument', 'enrollmentId is required');
    }

    const db = firestoreDb();
    const enrSnap = await db.collection('enrollments').doc(enrollmentId).get();
    if (!enrSnap.exists) {
      throw new HttpsError('not-found', 'Enrollment not found');
    }
    const enr = enrSnap.data()!;
    if (enr.studentId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Not your enrollment');
    }

    const courseSnap = await db.collection('courses').doc(String(enr.courseId)).get();
    if (!courseSnap.exists) {
      throw new HttpsError('failed-precondition', 'Course missing');
    }
    const price = Number(courseSnap.data()?.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new HttpsError('failed-precondition', 'Invalid course price');
    }

    const email = request.auth.token.email;
    if (!email) {
      throw new HttpsError('failed-precondition', 'Email required for checkout');
    }

    const secret = paystackSecretKey.value();
    const amountKobo = Math.round(price * 100);

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: 'NGN',
        metadata: {
          enrollmentId,
          studentId: request.auth.uid,
        },
        callback_url: callbackUrl,
      }),
    });

    const json = (await initRes.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!json.status || !json.data?.authorization_url) {
      throw new HttpsError('internal', json.message || 'Paystack initialize failed');
    }

    return {
      authorizationUrl: json.data.authorization_url,
      reference: json.data.reference,
    };
  },
);
