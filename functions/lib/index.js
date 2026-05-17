import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { firebaseApp, firestoreDb, firestoreDatabaseId } from './db.js';
import { paystackWebhook, createPaystackCheckout } from './paystack.js';
export { paystackWebhook, createPaystackCheckout };
const adminBootstrapEmail = defineString('ADMIN_BOOTSTRAP_EMAIL', { default: '' });
/**
 * One-time bootstrap: if the signed-in user's email matches ADMIN_BOOTSTRAP_EMAIL,
 * grant custom claim `admin: true` and set Firestore `users/{uid}.role` to `admin`.
 */
export const claimAdminIfEligible = onCall(async (request) => {
    firebaseApp();
    if (!request.auth?.uid || !request.auth.token.email) {
        throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const allow = adminBootstrapEmail.value().trim().toLowerCase();
    if (!allow) {
        throw new HttpsError('failed-precondition', 'ADMIN_BOOTSTRAP_EMAIL is not configured on the Functions project');
    }
    const email = request.auth.token.email.toLowerCase();
    if (email !== allow) {
        throw new HttpsError('permission-denied', 'Not eligible for admin claim');
    }
    await getAuth(firebaseApp()).setCustomUserClaims(request.auth.uid, { admin: true });
    const ref = firestoreDb().collection('users').doc(request.auth.uid);
    const snap = await ref.get();
    if (!snap.exists) {
        await ref.set({
            uid: request.auth.uid,
            email: request.auth.token.email,
            name: request.auth.token.name || 'Admin',
            role: 'admin',
            createdAt: Date.now(),
        });
    }
    else {
        await ref.set({ role: 'admin' }, { merge: true });
    }
    return { ok: true };
});
/** Server-side notifications when a student creates an enrollment (bypasses client notification rules). */
export const onEnrollmentCreatedNotify = onDocumentCreated({
    document: 'enrollments/{enrollmentId}',
    database: firestoreDatabaseId.value(),
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const d = snap.data();
    const db = firestoreDb();
    const batch = db.batch();
    const n1 = db.collection('notifications').doc();
    batch.set(n1, {
        userId: d.studentId,
        title: 'Enrollment received',
        message: `You enrolled in ${d.courseTitle}.`,
        type: 'session',
        read: false,
        timestamp: Date.now(),
    });
    const n2 = db.collection('notifications').doc();
    batch.set(n2, {
        userId: d.mentorId,
        title: 'New enrollment',
        message: `${d.studentName} enrolled in ${d.courseTitle}.`,
        type: 'session',
        read: false,
        timestamp: Date.now(),
    });
    await batch.commit();
});
