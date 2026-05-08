import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';
import { useTeams } from './useTeams';

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

    // Ideally we'd have ownerId in matches, but for now we fetch and filter
    const q = query(collection(db, 'matches'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = [];
      snapshot.forEach((doc) => {
        const data = doc.id && { id: doc.id, ...doc.data() };
        if (data && teamIds.includes(data.teamId)) {
          // Find team name for better calendar display
          const team = teams.find(t => t.id === data.teamId);
          matchesData.push({ ...data, teamName: team?.name || 'Equipo' });
        }
      });
      matchesData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setMatches(matchesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching all matches:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, teams, teamsLoading]);

  return { matches, loading: loading || teamsLoading };
}
