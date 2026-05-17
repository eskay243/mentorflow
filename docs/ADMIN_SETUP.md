# Admin access (custom claims)

Hard-coded admin emails were removed from the app and Firestore rules. An account is treated as **admin** when either:

1. The Firestore document `users/{uid}` has `role: "admin"`, or  
2. The Firebase Auth **custom claim** `admin` is `true` (`request.auth.token.admin` in rules).

## First-time bootstrap (recommended)

1. Deploy Cloud Functions (see repository root `functions/`).
2. Configure the Functions **string parameter** `ADMIN_BOOTSTRAP_EMAIL` to the exact email that should become the first admin (see [Firebase environment configuration](https://firebase.google.com/docs/functions/config-env)). Example when deploying:

   ```bash
   firebase deploy --only functions
   ```

   Set `ADMIN_BOOTSTRAP_EMAIL` via the Firebase console (Functions → your function → parameters / secrets UI) or your team’s standard params workflow for the `claimAdminIfEligible` callable.

3. Sign in once with that account. The client calls the callable **`claimAdminIfEligible`**, which sets the `admin` custom claim and merges `role: "admin"` on `users/{uid}`.

4. Remove or clear **`ADMIN_BOOTSTRAP_EMAIL`** after bootstrap so the callable cannot be abused, or restrict invocation with App Check / additional checks.

## Manual alternative (no Functions)

In the Firebase console, edit Firestore document **`users/{uid}`** and set **`role`** to **`admin`** for your user’s UID. Rules already honor Firestore `role == 'admin'`. Custom claims are optional in that path.

## Firestore database ID

If you use a **non-default** Firestore database, set the Functions parameter **`FIRESTORE_DATABASE_ID`** to that database id (defaults in this repo match `firebase-applet-config.json`).
