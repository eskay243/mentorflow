import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';

export const firestoreDatabaseId = defineString('FIRESTORE_DATABASE_ID', {
  default: 'ai-studio-238d26de-4714-463b-bde1-d7c512df601d',
});

export function firebaseApp() {
  if (!getApps().length) {
    initializeApp();
  }
  return getApp();
}

export function firestoreDb() {
  const id = firestoreDatabaseId.value().trim();
  if (!id || id === '(default)') {
    return getFirestore(firebaseApp());
  }
  return getFirestore(firebaseApp(), id);
}
