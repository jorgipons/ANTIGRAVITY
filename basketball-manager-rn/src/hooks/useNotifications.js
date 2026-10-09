import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { db } from '../constants/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const PREF_KEY = '@partits_notif_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NotificationsContext = createContext({ notifEnabled: true, toggleNotifications: () => {} });

export function NotificationsProvider({ user, children }) {
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const notifListenerRef = useRef();
  const responseListenerRef = useRef();

  // Leer preferencia guardada al montar
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then(val => {
      if (val === 'false') setNotifEnabled(false);
      setLoaded(true);
    });
  }, []);

  // Registrar/eliminar token cuando cambia la preferencia o el usuario
  useEffect(() => {
    if (!loaded || !user) return;

    if (notifEnabled) {
      registerForPushNotificationsAsync().then(token => {
        if (token) saveToken(user.uid, token);
      });
    } else {
      removeToken(user.uid);
    }

    notifListenerRef.current = Notifications.addNotificationReceivedListener(() => {});
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [user, notifEnabled, loaded]);

  const toggleNotifications = useCallback(async (enabled) => {
    setNotifEnabled(enabled);
    await AsyncStorage.setItem(PREF_KEY, String(enabled));
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifEnabled, toggleNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function saveToken(userId, token) {
  try {
    await setDoc(doc(db, 'userTokens', userId), {
      token,
      updatedAt: new Date().toISOString(),
      platform: Platform.OS,
    }, { merge: true });
  } catch (e) {
    console.error('Error saving push token', e);
  }
}

async function removeToken(userId) {
  try {
    await deleteDoc(doc(db, 'userTokens', userId));
  } catch { /* ya no existía */ }
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    });
  }

  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.error('Error getting push token:', e);
    return null;
  }
}
