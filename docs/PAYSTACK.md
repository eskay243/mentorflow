# Paystack integration

Cloud Functions in [`functions/src/paystack.ts`](../functions/src/paystack.ts) implement:

1. **`createPaystackCheckout`** (callable) — Initializes a Paystack transaction for an enrollment owned by the signed-in student. Amount is the course price in NGN (converted to kobo for Paystack).
2. **`paystackWebhook`** (HTTPS) — Verifies `x-paystack-signature` (HMAC SHA512 of the raw body), then on `charge.success` writes a `payments` document (id = Paystack reference, idempotent) and updates the enrollment (`totalPaid`, `commissionEarned`, `status: active`).

## Setup

1. Deploy Functions: `firebase deploy --only functions` from the repo root.
2. Set the secret **`PAYSTACK_SECRET_KEY`** (Dashboard → Paystack → Settings → API Keys → Secret key):

   ```bash
   firebase functions:secrets:set PAYSTACK_SECRET_KEY
   ```

3. In Paystack Dashboard → **Settings → Webhooks**, add the URL of `paystackWebhook` (shown after deploy, e.g. `https://<region>-<project>.cloudfunctions.net/paystackWebhook`).
4. Ensure **metadata** includes `enrollmentId` and `studentId` (the callable already sends these).

## Local development

Use the Firebase emulator suite if you need offline testing; wire the client to the emulator Functions host when appropriate.
