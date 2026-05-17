import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, app, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isMentor: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function trySyncAdminClaim(user: User): Promise<void> {
  const key = `admin_claim_attempted_${user.uid}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  try {
    const fn = httpsCallable(getFunctions(app), 'claimAdminIfEligible');
    await fn({});
    await user.getIdToken(true);
  } catch {
    /* Not eligible, Functions not deployed, or network error */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tokenAdmin, setTokenAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void (async () => {
        setUser(firebaseUser);
        if (!firebaseUser) {
          setProfile(null);
          setTokenAdmin(false);
          setLoading(false);
          return;
        }

        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
          const emailSnap = await getDocs(q);

          if (!emailSnap.empty) {
            const existingDoc = emailSnap.docs[0];
            const existingData = existingDoc.data() as UserProfile;
            const updatedProfile = {
              ...existingData,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || existingData.name,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile);
            setProfile(updatedProfile);
          } else {
            const preferredRole = localStorage.getItem('preferred_role') as
              | 'student'
              | 'mentor'
              | null;
            const role = preferredRole || 'student';

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              role,
              createdAt: Date.now(),
            };

            if (role === 'mentor' || role === 'student') {
              newProfile.kycStatus = 'not_started';
            }

            localStorage.removeItem('preferred_role');
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        }

        await trySyncAdminClaim(firebaseUser);
        const afterClaim = await getDoc(docRef);
        if (afterClaim.exists()) {
          setProfile(afterClaim.data() as UserProfile);
        }
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        setTokenAdmin(tokenResult.claims.admin === true);
        setLoading(false);
      })();
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || tokenAdmin,
    isMentor: profile?.role === 'mentor',
    isStudent: profile?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
