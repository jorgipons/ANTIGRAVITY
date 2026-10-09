import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';

export function useClub(clubId) {
  const [state, setState] = useState({ club: null, loading: true });

  useEffect(() => {
    if (!clubId) {
      setState({ club: null, loading: false });
      return;
    }
    const unsub = onSnapshot(doc(db, 'clubs', clubId), (snap) => {
      setState({
        club: snap.exists() ? { id: snap.id, ...snap.data() } : null,
        loading: false,
      });
    });
    return unsub;
  }, [clubId]);

  return state;
}
