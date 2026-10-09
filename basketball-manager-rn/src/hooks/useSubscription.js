import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';

const FREE_STATE = {
  isPro: false, status: 'free', currentPeriodEnd: null,
  cancelAtPeriodEnd: false, loading: false,
  clubId: null, isClubMember: false, isClubAdmin: false,
};

export function useSubscription() {
  const { user } = useAuth();
  const [userSlice, setUserSlice] = useState({
    ownIsPro: false, ownPeriodEnd: null, ownCancelAtPeriodEnd: false,
    clubId: null, loading: true,
  });
  const [clubSlice, setClubSlice] = useState({
    clubIsPro: false, adminUid: null,
  });

  // Listener 1: users/{uid}
  useEffect(() => {
    if (!user) {
      setUserSlice({ ownIsPro: false, ownPeriodEnd: null, ownCancelAtPeriodEnd: false, clubId: null, loading: false });
      setClubSlice({ clubIsPro: false, adminUid: null });
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data() || {};
      const sub = data.subscription;
      const clubId = data.clubId || null;
      if (!sub || sub.status !== 'pro') {
        setUserSlice({ ownIsPro: false, ownPeriodEnd: null, ownCancelAtPeriodEnd: false, clubId, loading: false });
        return;
      }
      const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
      const ownIsPro = sub.status === 'pro' && (!periodEnd || periodEnd > new Date());
      setUserSlice({ ownIsPro, ownPeriodEnd: periodEnd, ownCancelAtPeriodEnd: sub.cancelAtPeriodEnd || false, clubId, loading: false });
    });
    return unsub;
  }, [user]);

  // Listener 2: clubs/{clubId} — only active when user has a clubId
  useEffect(() => {
    if (!userSlice.clubId) {
      setClubSlice({ clubIsPro: false, adminUid: null });
      return;
    }
    const unsub = onSnapshot(doc(db, 'clubs', userSlice.clubId), (snap) => {
      if (!snap.exists()) {
        setClubSlice({ clubIsPro: false, adminUid: null });
        return;
      }
      const data = snap.data();
      const sub = data.subscription;
      const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
      const clubIsPro = sub?.status === 'pro' && (!periodEnd || periodEnd > new Date());
      setClubSlice({ clubIsPro, adminUid: data.adminUid || null });
    });
    return unsub;
  }, [userSlice.clubId]);

  if (userSlice.loading) {
    return { ...FREE_STATE, loading: true };
  }

  const isPro = userSlice.ownIsPro || clubSlice.clubIsPro;
  const isClubAdmin = !!userSlice.clubId && user?.uid === clubSlice.adminUid;

  return {
    isPro,
    status: isPro ? 'pro' : 'free',
    currentPeriodEnd: userSlice.ownPeriodEnd,
    cancelAtPeriodEnd: userSlice.ownCancelAtPeriodEnd,
    loading: false,
    clubId: userSlice.clubId,
    isClubMember: !!userSlice.clubId,
    isClubAdmin,
  };
}
