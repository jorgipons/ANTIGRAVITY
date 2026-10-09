// src/hooks/useNetworkStatus.js
import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../constants/firebase';
import { flushPendingWrites, getPendingCount } from '../utils/offlineCache';

export function useNetworkStatus({ onSyncComplete } = {}) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const wasOnlineRef = useRef(true);
  const onSyncCompleteRef = useRef(onSyncComplete);

  // Keep ref current without re-subscribing NetInfo listener
  useEffect(() => {
    onSyncCompleteRef.current = onSyncComplete;
  }, [onSyncComplete]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      if (online && !wasOnlineRef.current) {
        // Just came back online — flush the queue
        const count = await flushPendingWrites(db);
        setPendingCount(0);
        if (count > 0 && onSyncCompleteRef.current) {
          onSyncCompleteRef.current(count);
        }
      } else if (!online) {
        const count = await getPendingCount();
        setPendingCount(count);
      }
      wasOnlineRef.current = online;
    });

    return unsubscribe;
  }, []); // Empty deps — stable because we use refs for callbacks

  return { isOnline, pendingCount };
}
