// src/utils/writeDoc.js
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { enqueueWrite, cacheDoc, getCachedDoc } from './offlineCache';

export async function writeDoc(collection, docId, updates) {
  // Keep the AsyncStorage cache fresh immediately (don't wait for Firestore round-trip)
  const cached = await getCachedDoc(collection, docId);
  if (cached) {
    const merged = applyUpdates(cached, updates);
    await cacheDoc(collection, docId, merged);
  }

  try {
    await updateDoc(doc(db, collection, docId), updates);
  } catch {
    // Write failed (offline or transient error) — queue for later
    await enqueueWrite(`${collection}/${docId}`, updates);
  }
}

// Applies dot-notation update keys (e.g. 'history.1') into a nested object
function applyUpdates(base, updates) {
  const result = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes('.')) {
      const [top, ...rest] = key.split('.');
      result[top] = applyUpdates(result[top] || {}, { [rest.join('.')]: value });
    } else {
      result[key] = value;
    }
  }
  return result;
}
