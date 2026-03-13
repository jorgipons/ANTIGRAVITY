import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
export const auth = getAuth(app);
export default app;
