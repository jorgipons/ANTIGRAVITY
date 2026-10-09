import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';
import { useTeams } from './useTeams';
import { cacheCollection, getCachedCollection } from '../utils/offlineCache';

export function useAllMatches() {
  const { user } = useAuth();
  const { teams, loading: teamsLoading } = useTeams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || teamsLoading) return;

    if (teams.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const teamIds = teams.map(t => t.id);
    const cacheKey = `${user.uid}:allMatches`;

    // 1. Carga caché inmediatamente — siempre resuelve el loading
    getCachedCollection(cacheKey).then(cached => {
      if (cached && cached.length > 0) setMatches(cached);
      setLoading(false);
    });

    // 2. Listener Firestore — filtra por teamId en servidor (max 30 equipos por límite Firestore)
    const q = query(collection(db, 'matches'), where('teamId', 'in', teamIds));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = [];
      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (teamIds.includes(data.teamId)) {
          const team = teams.find(t => t.id === data.teamId);
          matchesData.push({ ...data, teamName: team?.name || 'Equipo' });
        }
      });
      matchesData.sort((a, b) => new Date(b.date) - new Date(a.date));
      // Ignorar snapshots vacíos del caché interno de Firestore (arranque offline sin memoria)
      if (!snapshot.metadata.fromCache || matchesData.length > 0) {
        setMatches(matchesData);
        cacheCollection(cacheKey, matchesData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching all matches (offline?):", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, teams, teamsLoading]);

  return { matches, loading: loading || teamsLoading };
}
