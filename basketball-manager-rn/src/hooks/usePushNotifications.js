import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { db } from '../constants/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const usePushNotifications = (user) => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!user) return; // Only request token if user is logged in

    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      if (token) saveTokenToFirestore(user.uid, token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('User interacted with notification:', response);
      // const data = response.notification.request.content.data;
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  const saveTokenToFirestore = async (userId, token) => {
    try {
      const tokenRef = doc(db, 'userTokens', userId);
      const docSnap = await getDoc(tokenRef);
      
      const tokenData = {
        token: token,
        updatedAt: new Date().toISOString(),
        platform: Platform.OS,
      };

      await setDoc(tokenRef, tokenData, { merge: true });
      console.log('Push token saved to Firestore');
    } catch (error) {
      console.error('Error saving push token', error);
    }
  };

  return { expoPushToken, notification };
};

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    try {
      // projectId is required for Expo Go and EAS Build
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      console.log("Expo Push Token:", token.data);
      return token.data;
    } catch (e) {
        console.error("Error getting Expo push token:", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
