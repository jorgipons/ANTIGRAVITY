import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';

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

    const q = query(
      collection(db, 'matches'), 
      where('teamId', '==', teamId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matchesData = [];
      snapshot.forEach((doc) => {
        matchesData.push({ id: doc.id, ...doc.data() });
      });
      // Sort matches in memory descending by date
      matchesData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setMatches(matchesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching matches:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, teamId]);

  const addMatch = async (matchData) => {
    if (!user) return null;
    try {
      const newMatchInfo = {
        ...matchData,
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
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'matches'), newMatchInfo);
      return docRef.id;
    } catch (e) {
      console.error("Error adding match: ", e);
      throw e;
    }
  };

  const updateMatch = async (matchId, updates) => {
    try {
      const matchRef = doc(db, 'matches', matchId);
      await updateDoc(matchRef, updates);
    } catch (e) {
      console.error("Error updating match: ", e);
      throw e;
    }
  };

  const deleteMatch = async (matchId) => {
    try {
      await deleteDoc(doc(db, 'matches', matchId));
    } catch (e) {
      console.error("Error deleting match: ", e);
      throw e;
    }
  };

  return { matches, loading, addMatch, updateMatch, deleteMatch };
}
