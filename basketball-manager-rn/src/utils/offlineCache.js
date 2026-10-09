// src/utils/offlineCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

const DOC_PREFIX = 'offline:doc:';
const COL_PREFIX = 'offline:col:';
const QUEUE_KEY  = 'offline:queue';

// ── Document cache ────────────────────────────────────────────────────────────

export async function cacheDoc(collection, docId, data) {
  try {
    await AsyncStorage.setItem(`${DOC_PREFIX}${collection}:${docId}`, JSON.stringify(data));
  } catch { /* storage full */ }
}

export async function getCachedDoc(collection, docId) {
  try {
    const raw = await AsyncStorage.getItem(`${DOC_PREFIX}${collection}:${docId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Collection cache ──────────────────────────────────────────────────────────

export async function cacheCollection(key, items) {
  try {
    await AsyncStorage.setItem(`${COL_PREFIX}${key}`, JSON.stringify(items));
  } catch { /* storage full */ }
}

export async function getCachedCollection(key) {
  try {
    const raw = await AsyncStorage.getItem(`${COL_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Write queue ───────────────────────────────────────────────────────────────
// Cada entrada: { op: 'update'|'create', docPath, data, timestamp }

export async function enqueueWrite(docPath, updates) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ op: 'update', docPath, data: updates, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full */ }
}

export async function enqueueCreate(docPath, data) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ op: 'create', docPath, data, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full */ }
}

export async function enqueueDelete(docPath) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ op: 'delete', docPath, data: null, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full */ }
}

export async function getPendingCount() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw).length : 0;
  } catch { return 0; }
}

export async function flushPendingWrites(db) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return 0;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);

    // Agrupa updates del mismo doc en orden cronológico; preserva creates por separado
    const creates = sorted.filter(e => e.op === 'create');
    const updates  = sorted.filter(e => e.op === 'update');

    const byPath = {};
    for (const entry of updates) {
      byPath[entry.docPath] = { ...byPath[entry.docPath], ...entry.data };
    }

    let flushed = 0;
    const failed = [];

    // 1. Creates (el doc debe existir antes de poder actualizarlo)
    for (const entry of creates) {
      try {
        const [col, docId] = entry.docPath.split('/');
        await setDoc(doc(db, col, docId), entry.data);
        flushed++;
      } catch {
        failed.push(entry);
      }
    }

    // 2. Updates
    for (const [docPath, data] of Object.entries(byPath)) {
      try {
        const [col, docId] = docPath.split('/');
        await updateDoc(doc(db, col, docId), data);
        flushed++;
      } catch {
        failed.push(...queue.filter(e => e.op !== 'create' && e.op !== 'delete' && e.docPath === docPath));
      }
    }

    // 3. Deletes (al final, por si dependen de updates previos)
    const deletes = sorted.filter(e => e.op === 'delete');
    for (const entry of deletes) {
      try {
        const [col, docId] = entry.docPath.split('/');
        await deleteDoc(doc(db, col, docId));
        flushed++;
      } catch {
        failed.push(entry);
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
    return flushed;
  } catch { return 0; }
}
