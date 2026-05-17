# Compliance and data practices (summary)

This document is a **high-level** checklist for operating MentorFlow. It is not legal advice.

## KYC and identity

- Mentor and student KYC fields are stored in Firestore on the `users` collection (`kycStatus`, `kycData`). Restrict access in product flows and retain only what you need.
- Define retention: how long ID images and bank details are kept after account closure, and who may access them (typically admins only, via audited tools).

## Payments

- Treat Paystack (or any provider) **webhooks** as the source of truth for successful charges. Client-side “payment succeeded” states must not be trusted for ledger updates (see [`docs/PAYSTACK.md`](./PAYSTACK.md)).

## Terms and privacy

- Replace placeholder copy on the login screen with links to your real **Terms of Service** and **Privacy Policy** when you go to production.
- Disclose use of Firebase (Google), Paystack, analytics (if any), and cross-border transfers if applicable.

## Access control

- Prefer **custom claims** and Firestore `role` for admin, and avoid embedding long-lived bootstrap emails in client code.
- See [`docs/ADMIN_SETUP.md`](./ADMIN_SETUP.md) for admin bootstrap.
