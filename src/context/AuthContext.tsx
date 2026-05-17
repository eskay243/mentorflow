import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Check if there's a pre-created profile with this email (e.g. added by admin)
          const q = query(collection(db, 'users'), where('email', '==', user.email));
          const emailSnap = await getDocs(q);
          
          if (!emailSnap.empty) {
            const existingDoc = emailSnap.docs[0];
            const existingData = existingDoc.data() as UserProfile;
            
            // Claim the profile by updating it with the real UID
            const updatedProfile = {
              ...existingData,
              uid: user.uid,
              name: user.displayName || existingData.name, // Prefer Google name if available
            };
            
            // If the document ID was random/pending, we should probably create a new one with UID as key
            // and delete the old one, or just update the existing one.
            // For simplicity, let's create a new one with UID as key and delete the old one if needed.
            await setDoc(doc(db, 'users', user.uid), updatedProfile);
            if (existingDoc.id !== user.uid) {
              // Note: We don't strictly need to delete the old one if it was just a placeholder,
              // but it's cleaner. However, if we use email as ID it might be different.
              // For now, just ensure the UID-based one exists.
            }
            setProfile(updatedProfile);
          } else {
            // Create default profile if not exists
            const isAdminEmail = user.email === 'eskay243@gmail.com';
            const preferredRole = localStorage.getItem('preferred_role') as 'student' | 'mentor' | null;
            
            const role = isAdminEmail ? 'admin' : (preferredRole || 'student');
            
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || 'User',
              role,
              createdAt: Date.now(),
            };

            if (role === 'mentor' || role === 'student') {
              newProfile.kycStatus = 'not_started';
            }
            
            // Clean up
            localStorage.removeItem('preferred_role');
            
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || user?.email === 'eskay243@gmail.com',
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
