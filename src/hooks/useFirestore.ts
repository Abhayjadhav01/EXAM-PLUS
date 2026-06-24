import { useState, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { AnalysisResult } from '../types';

export function useFirestore() {
  const [isLoading, setIsLoading] = useState(false);

  const logAction = useCallback(async (action: string, details?: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'logs'), {
        uid: user.uid,
        action,
        details: details || '',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to log action", err);
    }
  }, []);

  const saveAnalysis = useCallback(async (analysis: AnalysisResult) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'analyses'), {
        ...analysis,
        uid: user.uid,
        createdAt: serverTimestamp()
      });
      await logAction('analysis_saved', analysis.subject);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'analyses');
    }
  }, [logAction]);

  const loadHistory = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return [];
    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'analyses'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'analyses');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteAnalysis = useCallback(async (id: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'analyses', id));
      await logAction('analysis_deleted', id);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'analyses');
    }
  }, [logAction]);

  return {
    isLoading,
    logAction,
    saveAnalysis,
    loadHistory,
    deleteAnalysis
  };
}
