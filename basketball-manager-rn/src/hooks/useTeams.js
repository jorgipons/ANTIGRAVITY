import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';
import { cacheCollection, getCachedCollection, cacheDoc, enqueueCreate, enqueueWrite, enqueueDelete } from '../utils/offlineCache';

export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${user.uid}:teams`;

    // 1. Carga caché inmediatamente — siempre resuelve el loading
    getCachedCollection(cacheKey).then(cached => {
      if (cached && cached.length > 0) setTeams(cached);
      setLoading(false);
    });

    // 2. Listener Firestore — actualiza cuando haya red
    const q = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ignorar snapshots vacíos del caché interno de Firestore (arranque offline sin memoria):
      // si fromCache=true y no hay datos, la caché de AsyncStorage es más fiable
      if (!snapshot.metadata.fromCache || teamsData.length > 0) {
        setTeams(teamsData);
        cacheCollection(cacheKey, teamsData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams (offline?):", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const addTeam = async (teamData) => {
    if (!user) return null;

    const newDocRef = doc(collection(db, 'teams'));
    const newId = newDocRef.id;

    const newTeam = {
      ...teamData,
      id: newId,
      ownerId: user.uid,
      createdAt: new Date().toISOString(),
      players: [],
      ruleset: 'fbcv_8p',
    };

    // Actualización optimista inmediata
    setTeams(prev => {
      const updated = [...prev, newTeam];
      cacheCollection(`${user.uid}:teams`, updated);
      return updated;
    });
    cacheDoc('teams', newId, newTeam);

    try {
      await setDoc(newDocRef, newTeam);
    } catch {
      await enqueueCreate(`teams/${newId}`, newTeam);
    }

    return newId;
  };

  const updateTeam = async (teamId, updates) => {
    // Optimistic update en estado y caché de colección
    setTeams(prev => {
      const updated = prev.map(t => t.id === teamId ? { ...t, ...updates } : t);
      if (user) cacheCollection(`${user.uid}:teams`, updated);
      return updated;
    });
    try {
      await updateDoc(doc(db, 'teams', teamId), updates);
    } catch {
      await enqueueWrite(`teams/${teamId}`, updates);
    }
  };

  const deleteTeam = async (teamId) => {
    // Optimistic removal
    setTeams(prev => {
      const updated = prev.filter(t => t.id !== teamId);
      if (user) cacheCollection(`${user.uid}:teams`, updated);
      return updated;
    });
    try {
      // ownerId exigido por las reglas para poder listar.
      const matchesQ = query(
        collection(db, 'matches'),
        where('ownerId', '==', user.uid),
        where('teamId', '==', teamId)
      );
      const matchesSnapshot = await getDocs(matchesQ);
      await Promise.all(matchesSnapshot.docs.map(d => deleteDoc(doc(db, 'matches', d.id))));
      await deleteDoc(doc(db, 'teams', teamId));
    } catch {
      // Cola: equipo + partidos del caché de colección
      await enqueueDelete(`teams/${teamId}`);
      const cachedMatches = await getCachedCollection(`${teamId}:matches`);
      for (const m of (cachedMatches || [])) {
        await enqueueDelete(`matches/${m.id}`);
      }
    }
  };

  return { teams, loading, addTeam, updateTeam, deleteTeam };
}
