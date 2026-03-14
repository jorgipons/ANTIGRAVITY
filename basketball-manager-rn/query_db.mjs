import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAbaUEbPjltfQrDethVojxoxD1gj4AC0w",
  authDomain: "basketmanager-ed370.firebaseapp.com",
  projectId: "basketmanager-ed370",
  storageBucket: "basketmanager-ed370.firebasestorage.app",
  messagingSenderId: "177594386006",
  appId: "1:177594386006:web:8eef1b258c8dc6b395ddf7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching finished matches...");
  const matchesSnap = await getDocs(query(collection(db, 'matches'), where('state', '==', 'finished'), limit(2)));
  console.log("Finished Matches count:", matchesSnap.size);
  matchesSnap.forEach(doc => {
      const m = doc.data();
      console.log("Match:", m.opponent);
      console.log("- id:", doc.id);
      console.log("- keys:", Object.keys(m).join(', '));
      console.log("- players length:", m.players?.length);
      console.log("- history:", JSON.stringify(m.history));
      console.log("- attendance:", JSON.stringify(m.attendance));
  });
  process.exit(0);
}
run().catch(console.error);
