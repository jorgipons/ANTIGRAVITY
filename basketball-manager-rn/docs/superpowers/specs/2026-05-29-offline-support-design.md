# Offline Support Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the app to function without internet during games — editing the match matrix, confirming attendance, and editing players — and automatically sync changes when connectivity is restored.

**Architecture:** A `writeDoc` helper replaces all direct `updateDoc` calls. It writes to Firestore when online, and queues to AsyncStorage when offline. On reconnect, the queue is flushed in order. A `useNetworkStatus` hook provides real-time connectivity state. Cached Firestore documents (match, team) serve as fallback when reads fail offline.

**Tech Stack:** React Native, Expo SDK 55, `@react-native-async-storage/async-storage` (already installed), `@react-native-community/netinfo` (new dependency), Firebase JS SDK v12.

**Primary use case:** WiFi-only tablet taken to games with no cellular data. Coach uses MatchMatrixScreen and MatchAttendanceScreen offline; syncs when back on WiFi.

---

## New Dependency

```
@react-native-community/netinfo
```

Install with: `npm install @react-native-community/netinfo`

This library provides a real-time network state listener (`NetInfo.addEventListener`) compatible with Expo SDK 55 managed workflow on Android, iOS, and web.

---

## New Files

### `src/hooks/useNetworkStatus.js`

Exposes `{ isOnline, pendingCount }`. Subscribes to `NetInfo` for real-time connectivity. When transitioning from offline → online, calls `flushPendingWrites(db)` from `offlineCache` and shows the sync toast.

```js
import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../constants/firebase';
import { flushPendingWrites, getPendingCount } from '../utils/offlineCache';

export function useNetworkStatus({ onSyncComplete } = {}) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let wasOnline = true;

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      if (online && !wasOnline) {
        const count = await flushPendingWrites(db);
        if (count > 0 && onSyncComplete) onSyncComplete(count);
        setPendingCount(0);
      } else if (!online) {
        const count = await getPendingCount();
        setPendingCount(count);
      }
      wasOnline = online;
    });

    return unsubscribe;
  }, [onSyncComplete]);

  return { isOnline, pendingCount };
}
```

---

### `src/utils/offlineCache.js`

Provides:
- `cacheDoc(key, data)` — saves a Firestore document to AsyncStorage
- `getCachedDoc(key)` — retrieves a cached document; returns null if not found
- `enqueueWrite(docPath, updates)` — adds a pending write to the queue
- `flushPendingWrites(db)` — processes all queued writes against Firestore; returns count of successfully flushed writes; removes flushed entries; leaves failed entries for next retry
- `getPendingCount()` — returns current queue length

**AsyncStorage keys:**
- `offline:doc:{collection}:{docId}` — cached document (e.g. `offline:doc:matches:abc123`)
- `offline:queue` — JSON array of `{ docPath, updates, timestamp }`

**Conflict resolution:** When flushing, if multiple queue entries target the same `docPath`, they are merged in chronological order (earliest first) before applying, so the most recent value wins for each field.

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';

const DOC_PREFIX = 'offline:doc:';
const QUEUE_KEY = 'offline:queue';

export async function cacheDoc(collection, docId, data) {
  await AsyncStorage.setItem(`${DOC_PREFIX}${collection}:${docId}`, JSON.stringify(data));
}

export async function getCachedDoc(collection, docId) {
  const raw = await AsyncStorage.getItem(`${DOC_PREFIX}${collection}:${docId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function enqueueWrite(docPath, updates) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({ docPath, updates, timestamp: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getPendingCount() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw).length : 0;
}

export async function flushPendingWrites(db) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  const queue = JSON.parse(raw);
  if (queue.length === 0) return 0;

  // Merge entries with same docPath in order
  const byPath = {};
  for (const entry of queue.sort((a, b) => a.timestamp - b.timestamp)) {
    byPath[entry.docPath] = { ...byPath[entry.docPath], ...entry.updates };
  }

  let flushed = 0;
  const failed = [];
  for (const [docPath, updates] of Object.entries(byPath)) {
    try {
      const [collection, docId] = docPath.split('/');
      await updateDoc(doc(db, collection, docId), updates);
      flushed++;
    } catch {
      // Keep originals for retry
      failed.push(...queue.filter(e => e.docPath === docPath));
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
  return flushed;
}
```

---

### `src/utils/writeDoc.js`

A single helper that replaces all direct `updateDoc` calls in screens. Attempts Firestore write; on failure, enqueues for later sync. Also updates the local AsyncStorage cache immediately so the cached state stays fresh.

```js
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { enqueueWrite, cacheDoc, getCachedDoc } from './offlineCache';

export async function writeDoc(collection, docId, updates) {
  // Update cache immediately (merge into existing cached doc)
  const cached = await getCachedDoc(collection, docId);
  if (cached) {
    const merged = deepMergeUpdates(cached, updates);
    await cacheDoc(collection, docId, merged);
  }

  try {
    await updateDoc(doc(db, collection, docId), updates);
  } catch {
    await enqueueWrite(`${collection}/${docId}`, updates);
  }
}

// Resolves dot-notation keys (e.g. 'history.1') into nested merge
function deepMergeUpdates(base, updates) {
  const result = { ...base };
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes('.')) {
      const [top, ...rest] = key.split('.');
      result[top] = deepMergeUpdates(result[top] || {}, { [rest.join('.')]: value });
    } else {
      result[key] = value;
    }
  }
  return result;
}
```

---

### `src/components/OfflineBanner.js`

Two visual states managed by a single component:

1. **Offline banner** — shown persistently when `isOnline === false`. Displays at the top of the screen (below the header). Dark amber background, WiFi-off icon, text: `Sin conexión · Los cambios se guardarán al reconectar`.

2. **Sync toast** — shown briefly (3 seconds) after `onSyncComplete` fires. Green background, check icon, text: `✓ {count} cambio(s) sincronizado(s)`. Auto-dismisses.

```jsx
// Props: { isOnline: boolean, syncMessage: string | null, onSyncDismiss: () => void }
```

The component uses `Animated` for a slide-in from top. Height is ~40px. It sits above the screen's scrollable content area (below the `<LinearGradient>` header).

---

## Modified Files

### `src/screens/MatchMatrixScreen.js`

**Load flow:**
1. `onSnapshot` fires → update `match` state + call `cacheDoc('matches', matchId, data)` on every update
2. If `onSnapshot` error callback fires → attempt `getCachedDoc('matches', matchId)` → if found, set `match` state from cache + set `loadedFromCache = true`
3. If `getDoc('teams', teamId)` fails → attempt `getCachedDoc('teams', teamId)`

**Write flow:** Replace all `updateDoc(doc(db, 'matches', matchId), {...})` calls with `writeDoc('matches', matchId, {...})`.

The screen has approximately 12 `updateDoc` calls. All are replaced. No logic change — only the function called.

**Offline UI:** Add `useNetworkStatus({ onSyncComplete })` at the top. Render `<OfflineBanner>` between the header and the matrix content.

**`onSyncComplete` handler:**
```js
const [syncMessage, setSyncMessage] = useState(null);
const handleSyncComplete = useCallback((count) => {
  setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
  setTimeout(() => setSyncMessage(null), 3000);
}, []);
```

---

### `src/screens/MatchAttendanceScreen.js`

**Load flow:** Same pattern — cache team + match on load, fallback to cache on error.

**Write flow:** Replace the single `updateDoc` for attendance with `writeDoc('matches', match.id, { attendance: newAttendance })`.

The existing error-revert logic (`setMatch({ ...match, attendance: currentAttendance })`) is removed — `writeDoc` handles the failure path.

**Offline UI:** Same `useNetworkStatus` + `OfflineBanner`.

---

### `src/screens/TeamDetailScreen.js`

**Load flow:** Cache team document on `getDoc` success. On error, fallback to `getCachedDoc`.

**Write flow:** TeamDetailScreen stores team in local `useState` (loaded via `getDoc` on mount, not `onSnapshot`). The `updateTeam()` from `useTeams` only writes to Firestore — it does not update local state.

Replace every `await updateTeam(teamId, updates)` call with two steps:
1. Optimistic local state update: `setTeam(prev => ({ ...prev, ...updates }))` (already done in most handlers)
2. Firestore write: `await writeDoc('teams', teamId, updates)` (replaces `await updateTeam(teamId, updates)`)

The team document uses a flat `players` array field (no dot-notation), so writes are straightforward: `writeDoc('teams', teamId, { players: newPlayersArray })`.

**Offline UI:** Same pattern.

---

## Scope Boundaries

- **Calendar and MatchListScreen**: read-only screens; no offline write support needed. They will show stale/empty data when offline (acceptable).
- **Federation sync**: requires network by definition; disabled/hidden when offline.
- **Push notifications**: no change; they require network to register.
- **Authentication**: already persisted via AsyncStorage; login state survives offline.
- **Creating new matches/teams**: excluded — requires Firestore `addDoc` which cannot be queued without a real document ID. Coach is expected to create matches while online before the game.
- **Deleting matches/teams**: excluded from offline queue. Delete operations while offline are rejected with an Alert.

---

## Installation Step

Before any code changes, install the dependency:
```bash
npm install @react-native-community/netinfo
```

Verify it appears in `package.json` dependencies. No Expo config plugin needed for this library in Expo SDK 55 managed workflow.
