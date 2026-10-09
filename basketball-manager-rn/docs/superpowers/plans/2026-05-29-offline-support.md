# Offline Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow MatchMatrixScreen, MatchAttendanceScreen, and TeamDetailScreen to function without internet, queuing writes to AsyncStorage and syncing automatically when WiFi returns.

**Architecture:** `offlineCache.js` manages AsyncStorage read/write for documents and a write queue. `writeDoc.js` replaces all `updateDoc` calls — it writes to Firestore when online, queues to AsyncStorage when offline. `useNetworkStatus.js` monitors connectivity and flushes the queue on reconnect. `OfflineBanner.js` shows a persistent banner when offline and a toast after sync.

**Tech Stack:** React Native / Expo SDK 55, `@react-native-async-storage/async-storage` (already installed), `@react-native-community/netinfo` (new), Firebase JS SDK v12.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/offlineCache.js` | Create | AsyncStorage cache + write queue helpers |
| `src/utils/writeDoc.js` | Create | Drop-in replacement for `updateDoc` calls |
| `src/hooks/useNetworkStatus.js` | Create | Real-time connectivity + auto-flush on reconnect |
| `src/components/OfflineBanner.js` | Create | Offline banner + sync toast UI |
| `src/screens/MatchAttendanceScreen.js` | Modify | Cache load/fallback, `writeDoc` for attendance |
| `src/screens/TeamDetailScreen.js` | Modify | Cache load/fallback, `writeDoc` for team writes |
| `src/screens/MatchMatrixScreen.js` | Modify | Cache load/fallback, `writeDoc` for all 15 writes, OfflineBanner |

---

## Task 1: Install netinfo dependency

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

Run from `basketball-manager-rn/`:
```
npm install @react-native-community/netinfo
```

- [ ] **Step 2: Verify installation**

Open `package.json` and confirm `@react-native-community/netinfo` appears in `dependencies`.

---

## Task 2: Create offlineCache.js

**Files:**
- Create: `src/utils/offlineCache.js`

- [ ] **Step 1: Create the file**

```js
// src/utils/offlineCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';

const DOC_PREFIX = 'offline:doc:';
const QUEUE_KEY = 'offline:queue';

export async function cacheDoc(collection, docId, data) {
  try {
    await AsyncStorage.setItem(
      `${DOC_PREFIX}${collection}:${docId}`,
      JSON.stringify(data)
    );
  } catch { /* storage full — silently ignore */ }
}

export async function getCachedDoc(collection, docId) {
  try {
    const raw = await AsyncStorage.getItem(`${DOC_PREFIX}${collection}:${docId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function enqueueWrite(docPath, updates) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ docPath, updates, timestamp: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full — silently ignore */ }
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

    // Merge entries with the same docPath in chronological order
    const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);
    const byPath = {};
    for (const entry of sorted) {
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
        // Keep originals so next retry can re-merge
        failed.push(...queue.filter(e => e.docPath === docPath));
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
    return flushed;
  } catch { return 0; }
}
```

- [ ] **Step 2: Verify no syntax errors**

Read the file back and confirm all braces/brackets are balanced.

---

## Task 3: Create writeDoc.js

**Files:**
- Create: `src/utils/writeDoc.js`

This helper is called instead of `updateDoc(doc(db, collection, docId), updates)` throughout the app.

- [ ] **Step 1: Create the file**

```js
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
```

- [ ] **Step 2: Verify no syntax errors**

Read the file back and check for balanced brackets.

---

## Task 4: Create useNetworkStatus.js

**Files:**
- Create: `src/hooks/useNetworkStatus.js`

- [ ] **Step 1: Create the file**

```js
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
```

- [ ] **Step 2: Verify no syntax errors**

Read the file back and confirm it's syntactically valid.

---

## Task 5: Create OfflineBanner.js

**Files:**
- Create: `src/components/OfflineBanner.js`

- [ ] **Step 1: Create the file**

```jsx
// src/components/OfflineBanner.js
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { T } from '../theme/tokens';

export default function OfflineBanner({ isOnline, syncMessage }) {
  const slideAnim = useRef(new Animated.Value(-44)).current;

  const shouldShow = !isOnline || !!syncMessage;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -44,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [shouldShow]);

  if (!shouldShow) return null;

  const isSync = !!syncMessage;

  return (
    <Animated.View
      style={[
        styles.banner,
        isSync ? styles.bannerSync : styles.bannerOffline,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.bannerText}>
        {isSync ? syncMessage : 'Sin conexión · Los cambios se guardarán al reconectar'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bannerOffline: {
    backgroundColor: '#92400E', // dark amber
  },
  bannerSync: {
    backgroundColor: T.posDark || '#15803D',
  },
  bannerText: {
    fontFamily: T.fontSemi,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
```

- [ ] **Step 2: Check T.posDark exists**

Open `src/theme/tokens.js` and verify `T.posDark` is defined. If it's not, replace `T.posDark || '#15803D'` with just `'#15803D'` in the style.

- [ ] **Step 3: Verify no syntax errors**

Read the file back and confirm it's valid.

---

## Task 6: Integrate offline into MatchAttendanceScreen

**Files:**
- Modify: `src/screens/MatchAttendanceScreen.js`

**What changes:**
- Add `useNetworkStatus` + `OfflineBanner`
- Cache team + match on successful load; fallback to cache on error
- Replace `updateDoc` in `updateAttendance` with `writeDoc`
- Remove the error-revert logic (no longer needed — `writeDoc` handles failures)

- [ ] **Step 1: Add new imports**

At the top of `src/screens/MatchAttendanceScreen.js`, after the existing imports, add:

```js
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';
```

Also remove `updateDoc` from the firebase/firestore import line (since it's no longer used directly):

Change:
```js
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
```
To:
```js
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
```

- [ ] **Step 2: Add useNetworkStatus hook and syncMessage state**

Inside `export default function MatchAttendanceScreen()`, after the existing `useState` declarations, add:

```js
const [syncMessage, setSyncMessage] = useState(null);
const handleSyncComplete = React.useCallback((count) => {
  setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
  setTimeout(() => setSyncMessage(null), 3000);
}, []);
const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });
```

- [ ] **Step 3: Update the load effect to cache data and fallback offline**

Find the `useEffect` that loads team and match data (around line 41–56). Replace it with:

```js
useEffect(() => {
  if (!matchId || !teamId) { setLoading(false); return; }

  // Load team — try Firestore, fallback to cache
  getDoc(doc(db, 'teams', teamId)).then(docSnap => {
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      setTeam(data);
      cacheDoc('teams', teamId, data);
    }
  }).catch(async () => {
    const cached = await getCachedDoc('teams', teamId);
    if (cached) setTeam(cached);
  });

  // Load match — try Firestore listener, fallback to cache on error
  const matchRef = doc(db, 'matches', matchId);
  const unsubscribe = onSnapshot(matchRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      setMatch(data);
      cacheDoc('matches', matchId, data);
    }
    setLoading(false);
  }, async () => {
    // Firestore listener failed (offline) — load from cache
    const cached = await getCachedDoc('matches', matchId);
    if (cached) setMatch(cached);
    setLoading(false);
  });
  return unsubscribe;
}, [matchId, teamId]);
```

- [ ] **Step 4: Replace updateDoc in updateAttendance with writeDoc**

Find the `updateAttendance` function (around line 58–75). Replace it with:

```js
const updateAttendance = async (playerId, status) => {
  if (!match || isPublic) return;
  const currentAttendance = match.attendance || {};
  let newAttendance;
  if (status === null) {
    const { [playerId]: _removed, ...rest } = currentAttendance;
    newAttendance = rest;
  } else {
    newAttendance = { ...currentAttendance, [playerId]: { status, timestamp: new Date().toISOString() } };
  }
  // Optimistic UI update
  setMatch({ ...match, attendance: newAttendance });
  // Write to Firestore (or queue if offline)
  await writeDoc('matches', match.id, { attendance: newAttendance });
};
```

Note: the `try/catch` with revert (`setMatch({ ...match, attendance: currentAttendance })`) is removed — `writeDoc` silently queues on failure so the optimistic state is correct.

- [ ] **Step 5: Add OfflineBanner to the render**

Find the `return (` inside the main render (after loading/error guards). The screen starts with `<SafeAreaView>` wrapping `<LinearGradient>` header, then `<ScrollView>`. Add `<OfflineBanner>` between the header and the scrollview:

```jsx
return (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
      {/* existing header content unchanged */}
    </LinearGradient>

    <OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* existing scrollview content unchanged */}
    </ScrollView>
    {/* rest of screen unchanged */}
  </SafeAreaView>
);
```

- [ ] **Step 6: Verify in web browser**

Run `npm run web`. Open the attendance screen for a match. Open DevTools → Network → set to "Offline". Tap to mark a player as available. Confirm the UI updates (optimistic). Set Network back to "Online". Confirm `OfflineBanner` disappears and a green toast appears briefly.

---

## Task 7: Integrate offline into TeamDetailScreen

**Files:**
- Modify: `src/screens/TeamDetailScreen.js`

**What changes:**
- Add `useNetworkStatus` + `OfflineBanner`
- Cache team on load; fallback to cache on error
- Replace all `updateTeam(teamId, updates)` calls with `writeDoc('teams', teamId, updates)`

- [ ] **Step 1: Add new imports**

At the top of `src/screens/TeamDetailScreen.js`, after existing imports, add:

```js
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';
```

- [ ] **Step 2: Add useNetworkStatus hook and syncMessage state**

Inside `export default function TeamDetailScreen()`, after the existing state declarations, add:

```js
const [syncMessage, setSyncMessage] = useState(null);
const handleSyncComplete = React.useCallback((count) => {
  setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
  setTimeout(() => setSyncMessage(null), 3000);
}, []);
const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });
```

- [ ] **Step 3: Update the team load effect to cache and fallback**

Find the `useEffect` that calls `fetchTeam` (around line 93). Update the `fetchTeam` function inside it:

```js
useEffect(() => {
  const fetchTeam = async () => {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        const data = { id: teamDoc.id, ...teamDoc.data() };
        setTeam(data);
        cacheDoc('teams', teamId, data);
      }
    } catch {
      // Firestore failed — try cache
      const cached = await getCachedDoc('teams', teamId);
      if (cached) {
        setTeam(cached);
      } else {
        Alert.alert('Error', 'No se pudo cargar el equipo');
      }
    } finally {
      setLoading(false);
    }
  };
  fetchTeam();
}, [teamId]);
```

- [ ] **Step 4: Replace all updateTeam calls with writeDoc**

There are 6 `updateTeam` call sites. Replace each one — the local `setTeam` call that follows each `updateTeam` can stay unchanged (it's the optimistic update):

**Site 1** (add player, around line 131):
```js
// Before:
await updateTeam(teamId, { players: newPlayers });
setTeam({ ...team, players: newPlayers });
// After:
setTeam({ ...team, players: newPlayers });
await writeDoc('teams', teamId, { players: newPlayers });
```

**Site 2** (edit player, around line 146):
```js
// Before:
await updateTeam(teamId, { players: newPlayers });
setTeam({ ...team, players: newPlayers });
// After:
setTeam({ ...team, players: newPlayers });
await writeDoc('teams', teamId, { players: newPlayers });
```

**Site 3** (save team config, around line 184):
```js
// Before:
await updateTeam(teamId, { name: teamForm.name, roles: sorted, federationId: teamForm.federationId, mode: teamForm.mode });
setTeam({ ...team, name: teamForm.name, roles: sorted, federationId: teamForm.federationId, mode: teamForm.mode });
// After:
const configUpdates = { name: teamForm.name, roles: sorted, federationId: teamForm.federationId, mode: teamForm.mode };
setTeam({ ...team, ...configUpdates });
await writeDoc('teams', teamId, configUpdates);
```

**Site 4** (federation sync data, around line 226):
```js
// Before:
await updateTeam(teamId, { federationData: res.data });
setTeam(prev => ({ ...prev, federationData: res.data }));
// After:
setTeam(prev => ({ ...prev, federationData: res.data }));
await writeDoc('teams', teamId, { federationData: res.data });
```

**Site 5** (update standing, around line 269):
```js
// Before:
await updateTeam(teamId, { federationData: standRes.data });
setTeam(prev => ({ ...prev, federationData: standRes.data }));
// After:
setTeam(prev => ({ ...prev, federationData: standRes.data }));
await writeDoc('teams', teamId, { federationData: standRes.data });
```

Note: Federation sync (Sites 4 and 5) requires network by definition. These calls will simply enqueue and flush on reconnect, which is acceptable behavior.

After all 5 replacements, `updateTeam` is no longer called. Remove it from the `useTeams()` destructure:

```js
// Before:
const { updateTeam, deleteTeam } = useTeams();
// After:
const { deleteTeam } = useTeams();
```

- [ ] **Step 5: Add OfflineBanner to the render**

Find the main `return (` in the screen. The header is a `<LinearGradient>` with `<StatusBar>` before it. Add `<OfflineBanner>` immediately after the closing `</LinearGradient>` of the header, before the `IS_TABLET_LANDSCAPE ? ...` conditional layout:

```jsx
{/* Header */}
<LinearGradient ...>
  {/* existing header content unchanged */}
</LinearGradient>

<OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

{IS_TABLET_LANDSCAPE ? (
  /* two-column layout */
) : (
  /* single column */
)}
```

- [ ] **Step 6: Verify in web browser**

Run `npm run web`. Open a team detail screen. Offline: edit a player (name or number). Confirm UI updates optimistically. Back online: confirm green toast appears.

---

## Task 8: Integrate offline into MatchMatrixScreen

**Files:**
- Modify: `src/screens/MatchMatrixScreen.js`

**What changes:**
- Add `useNetworkStatus` + `OfflineBanner`
- Cache team + match on load; fallback to cache on error
- Replace all 15 `updateDoc` calls targeting `matches` with `writeDoc`

- [ ] **Step 1: Add new imports**

At the top of `src/screens/MatchMatrixScreen.js`, after existing imports, add:

```js
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';
```

Also remove `updateDoc` from the firebase/firestore import line (it's no longer called directly):

Change:
```js
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc, deleteField } from 'firebase/firestore';
```
To:
```js
import { doc, onSnapshot, getDoc, deleteDoc, deleteField } from 'firebase/firestore';
```

- [ ] **Step 2: Add useNetworkStatus hook and syncMessage state**

Inside `export default function MatchMatrixScreen()`, after the existing state declarations (after line 110, where `const [score, setScore] = useState(...)` is), add:

```js
const [syncMessage, setSyncMessage] = useState(null);
const handleSyncComplete = React.useCallback((count) => {
  setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
  setTimeout(() => setSyncMessage(null), 3000);
}, []);
const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });
```

- [ ] **Step 3: Update team load to cache and fallback**

Find the `getDoc` call for teams (around line 181):

```js
// Find this:
getDoc(doc(db, 'teams', teamId)).then(docSnap => {
  if (docSnap.exists()) setTeam({ id: docSnap.id, ...docSnap.data() });
});

// Replace with:
getDoc(doc(db, 'teams', teamId)).then(docSnap => {
  if (docSnap.exists()) {
    const data = { id: docSnap.id, ...docSnap.data() };
    setTeam(data);
    cacheDoc('teams', teamId, data);
  }
}).catch(async () => {
  const cached = await getCachedDoc('teams', teamId);
  if (cached) setTeam(cached);
});
```

- [ ] **Step 4: Update match onSnapshot to cache and fallback**

Find the `onSnapshot` call for matches (around line 186). The success callback ends with `setMatch({ id: snap.id, ...data })` on one line followed by `setLoading(false)`. The error callback calls `Alert.alert`.

Make two targeted changes:

**Change A** — add `cacheDoc` call immediately after `setMatch` on line ~218:
```js
// Before (these two lines already exist):
setMatch({ id: snap.id, ...data });
// --- (nothing here) ---
setLoading(false);

// After (add one line between them):
setMatch({ id: snap.id, ...data });
cacheDoc('matches', matchId, { id: snap.id, ...data });
setLoading(false);
```

**Change B** — replace the error callback (lines ~221-224) with a cache fallback:
```js
// Before:
}, (err) => {
  console.error('Error listening to match:', err);
  Alert.alert('Error', 'No se pudo cargar el partido');
  setLoading(false);
});

// After:
}, async (err) => {
  console.error('Error listening to match (offline?):', err);
  const cached = await getCachedDoc('matches', matchId);
  if (cached) {
    setMatch(cached);
  } else {
    Alert.alert('Error', 'No se pudo cargar el partido');
  }
  setLoading(false);
});
```

**Do not touch** any other code in the success callback (history normalization, timer restoration).

- [ ] **Step 5: Replace all 15 updateDoc calls with writeDoc**

Search for every `updateDoc(doc(db, 'matches', match.id), ` or `updateDoc(doc(db, 'matches', matchId), ` in the file. Replace each one.

**Pattern:** Replace:
```js
await updateDoc(doc(db, 'matches', match.id), { ...someUpdates });
```
With:
```js
await writeDoc('matches', match.id, { ...someUpdates });
```

And replace:
```js
await updateDoc(doc(db, 'matches', matchId), { ...someUpdates });
```
With:
```js
await writeDoc('matches', matchId, { ...someUpdates });
```

The 15 locations are at lines: 310, 348, 379, 399, 417, 537, 613, 632, 673, 698, 762, 796, 811, 827, 866.

**Do not change** any `deleteDoc` or `deleteField` calls — those are not replaced.

After all replacements, confirm `updateDoc` no longer appears anywhere in the file (except possibly in the import line which should now be removed per Step 1).

- [ ] **Step 6: Add OfflineBanner to the render**

Find the main render return. The structure is:
```jsx
<SafeAreaView ...>
  <View style={{ flex: 1, backgroundColor: T.bg }}>
    <LinearGradient ...>  {/* header */}
    </LinearGradient>
    {/* ══ Matrix + right panel ══ */}
    <View style={IS_TABLET_LANDSCAPE ? styles.matrixRow : null}>
```

Add `<OfflineBanner>` between the header `</LinearGradient>` and the matrix wrapper `<View>`:

```jsx
<SafeAreaView style={{ flex: 1, backgroundColor: T.ink2 }} edges={['top']}>
  <View style={{ flex: 1, backgroundColor: T.bg }}>

    <LinearGradient ...>
      {/* existing header content unchanged */}
    </LinearGradient>

    <OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

    {/* ══ Matrix + right panel ══ */}
    <View style={IS_TABLET_LANDSCAPE ? styles.matrixRow : null}>
```

- [ ] **Step 7: Verify in web browser**

Run `npm run web`. Open a match matrix. DevTools → Network → Offline. Toggle a player into a period. Confirm:
- UI updates immediately (optimistic `setMatch` still fires)
- The offline banner appears
- No "Error" Alert dialogs

Set Network → Online. Confirm:
- Banner disappears
- Green toast appears with sync count

---

## Self-review notes for implementers

- `writeDoc` never throws — the try/catch in each screen's handler will still execute its `finally` block normally
- `cacheDoc` and `enqueueWrite` silently catch errors (storage full) — they never bubble up to crash the app  
- The `useNetworkStatus` hook uses a `ref` for `wasOnline` to avoid re-subscribing NetInfo on every render
- `flushPendingWrites` merges all queue entries for the same document before flushing, so even 50 cell taps become a single Firestore write on reconnect
- `deleteDoc` calls (match/team deletion) are NOT replaced — deletes while offline are rejected by the existing `Alert.alert` error handling
