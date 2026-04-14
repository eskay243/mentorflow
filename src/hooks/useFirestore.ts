import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';

export function useFirestoreCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, collectionName), ...constraints);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionName);
      }
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(constraints)]);

  return { data, loading, error };
}
