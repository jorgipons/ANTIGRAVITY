import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';

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

    const q = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
    
    // Using onSnapshot for real-time updates like the web version
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamsData = [];
      snapshot.forEach((doc) => {
        teamsData.push({ id: doc.id, ...doc.data() });
      });
      setTeams(teamsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const addTeam = async (teamData) => {
    if (!user) return null;
    try {
      const docRef = await addDoc(collection(db, 'teams'), {
        ...teamData,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        players: [],
        ruleset: 'fbcv_8p'
      });
      return docRef.id;
    } catch (e) {
      console.error("Error adding team: ", e);
      throw e;
    }
  };

  const updateTeam = async (teamId, updates) => {
    try {
      const teamRef = doc(db, 'teams', teamId);
      await updateDoc(teamRef, updates);
    } catch (e) {
      console.error("Error updating team: ", e);
      throw e;
    }
  };

  const deleteTeam = async (teamId) => {
    try {
      // First, get and delete all matches for this team to prevent orphans
      const matchesQ = query(collection(db, 'matches'), where('teamId', '==', teamId));
      const matchesSnapshot = await getDocs(matchesQ);
      const deletePromises = [];
      
      matchesSnapshot.forEach((matchDoc) => {
        deletePromises.push(deleteDoc(doc(db, 'matches', matchDoc.id)));
      });
      
      await Promise.all(deletePromises);
      
      // Then delete the team itself
      await deleteDoc(doc(db, 'teams', teamId));
    } catch (e) {
      console.error("Error deleting team: ", e);
      throw e;
    }
  };

  return { teams, loading, addTeam, updateTeam, deleteTeam };
}
