import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';
import { cacheCollection, getCachedCollection, cacheDoc, enqueueCreate, enqueueWrite, enqueueDelete } from '../utils/offlineCache';

export function useMatches(teamId) {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !teamId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${teamId}:matches`;

    // 1. Carga caché inmediatamente — siempre resuelve el loading
    getCachedCollection(cacheKey).then(cached => {
      if (cached && cached.length > 0) setMatches(cached);
      setLoading(false);
    });

    // 2. Listener Firestore
    const q = query(collection(db, 'matches'), where('teamId', '==', teamId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      // Ignorar snapshots vacíos del caché interno de Firestore (arranque offline sin memoria)
      if (!snapshot.metadata.fromCache || matchesData.length > 0) {
        setMatches(matchesData);
        cacheCollection(cacheKey, matchesData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching matches (offline?):", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, teamId]);

  const addMatch = async (matchData) => {
    if (!user) return null;

    // Genera ID localmente — no necesita red
    const newDocRef = doc(collection(db, 'matches'));
    const newId = newDocRef.id;

    const newMatch = {
      ...matchData,
      id: newId,
      teamId,
      state: 'pending',
      currentPeriod: 1,
      history: {},
      injuries: [],
      attendance: {},
      callTime: '',
      matchDay: '',
      departureTime: '',
      transportType: 'car',
      departureLocation: '',
      returnTime: '',
      observations: '',
      createdAt: new Date().toISOString(),
    };

    // Actualización optimista inmediata
    setMatches(prev => {
      const updated = [newMatch, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date));
      cacheCollection(`${teamId}:matches`, updated);
      return updated;
    });
    cacheDoc('matches', newId, newMatch);

    // Intenta Firestore; si falla, encola solo el partido
    // (matchCount no se puede serializar como FieldValue — se recalculará al sincronizar)
    try {
      await setDoc(newDocRef, newMatch);
      await updateDoc(doc(db, 'teams', teamId), { matchCount: increment(1) });
    } catch {
      await enqueueCreate(`matches/${newId}`, newMatch);
      // increment() no es serializable — encola el valor absoluto para sincronizar
      await enqueueWrite(`teams/${teamId}`, { matchCount: matches.length + 1 });
    }

    return newId;
  };

  const updateMatch = async (matchId, updates) => {
    // Optimistic update
    setMatches(prev => {
      const updated = prev.map(m => m.id === matchId ? { ...m, ...updates } : m)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      cacheCollection(`${teamId}:matches`, updated);
      return updated;
    });
    try {
      await updateDoc(doc(db, 'matches', matchId), updates);
    } catch {
      await enqueueWrite(`matches/${matchId}`, updates);
    }
  };

  const deleteMatch = async (matchId) => {
    // Optimistic removal
    setMatches(prev => {
      const updated = prev.filter(m => m.id !== matchId);
      cacheCollection(`${teamId}:matches`, updated);
      return updated;
    });
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      await updateDoc(doc(db, 'teams', teamId), { matchCount: increment(-1) });
    } catch {
      await enqueueDelete(`matches/${matchId}`);
    }
  };

  return { matches, loading, addMatch, updateMatch, deleteMatch };
}
