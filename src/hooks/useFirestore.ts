import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  limit,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';

export type UseFirestoreCollectionOptions = {
  /** Caps documents returned (helps cost and UI performance on large collections). */
  maxDocs?: number;
};

export function useFirestoreCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options: UseFirestoreCollectionOptions = {},
) {
  const { maxDocs } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    setLoading(true);
    const qc: QueryConstraint[] = [...constraints];
    if (typeof maxDocs === 'number' && maxDocs > 0) {
      qc.push(limit(maxDocs));
    }
    const q = query(collection(db, collectionName), ...qc);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as T);
        });
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionName);
      },
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(constraints), maxDocs, refreshKey]);

  return { data, loading, error, refresh };
}
