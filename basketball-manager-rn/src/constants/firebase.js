import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAAbaUEbPjltfQrDethVojxoxD1gj4AC0w",
  authDomain: "basketmanager-ed370.firebaseapp.com",
  projectId: "basketmanager-ed370",
  storageBucket: "basketmanager-ed370.firebasestorage.app",
  messagingSenderId: "177594386006",
  appId: "1:177594386006:web:8eef1b258c8dc6b395ddf7",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export default app;
