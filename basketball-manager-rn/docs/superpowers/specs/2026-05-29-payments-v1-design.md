# Payments v1 — Individual Coach Subscriptions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Monetize the app with a freemium model — 1 team + 8 matches free, unlimited access for Pro subscribers at €1.99/month or €16.99/year. Payments via Stripe web checkout (avoids 30% Apple/Google fees).

**Architecture:** Firestore `users/{uid}` stores subscription status, updated by a Stripe webhook Cloud Function. A `useSubscription()` hook provides access state to all screens. `matchCount` on each team document tracks usage. Three paywall trigger points gate team creation, match creation, and premium features. A standalone HTML page on Firebase Hosting handles Stripe Checkout.

**Tech Stack:** React Native / Expo SDK 55, Firebase Firestore, Firebase Cloud Functions v1 (europe-west3), Stripe (existing account), Firebase Hosting.

---

## Plans

| | Free | Pro |
|---|---|---|
| Teams | 1 | Unlimited |
| Matches per team | 8 | Unlimited |
| Match matrix + attendance | ✅ | ✅ |
| Offline support | ❌ | ✅ |
| FBCV sync | ❌ | ✅ |
| Price | €0 | €1.99/mes · €16.99/año |

**Notes:**
- Offline and FBCV sync are Pro-only — they give single-team coaches a reason to subscribe even before hitting the 8-match limit.
- New users have no `subscription` field — treated as `free` by default.
- Cancelled Pro reverts to `free` at `currentPeriodEnd`.
- 8-match limit applies per team (not globally). A free user with 1 team gets 8 matches for that team.

---

## Firestore Schema Changes

### `users/{userId}` (new fields)

```js
{
  // Only present if user has ever subscribed or attempted payment
  subscription: {
    status: 'free' | 'pro',              // 'pro' only while active
    stripeCustomerId: 'cus_xxx',         // set when Stripe customer created
    stripeSubscriptionId: 'sub_xxx',     // set when subscription active
    currentPeriodEnd: 'YYYY-MM-DDTHH:MM:SSZ',  // ISO string, pro only
    cancelAtPeriodEnd: false,            // true if user cancelled but period not expired
  }
}
```

Missing `subscription` field = `free`. The hook always returns a safe default.

### `teams/{teamId}` (new field)

```js
{
  matchCount: 0,  // total matches ever created for this team (never decremented)
}
```

Incremented by 1 every time a new match is added via `addMatch()` in `useMatches`. Used to enforce the 8-match free tier limit.

---

## New Files

### `src/hooks/useSubscription.js`

Reads `users/{userId}` in real-time via `onSnapshot`. Returns:

```js
{
  isPro: boolean,           // true if status === 'pro' AND currentPeriodEnd > now
  status: 'free' | 'pro',  // raw status
  currentPeriodEnd: Date | null,
  cancelAtPeriodEnd: boolean,
  loading: boolean,
}
```

```js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../constants/firebase';
import { useAuth } from './useAuth';

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState({ isPro: false, status: 'free', currentPeriodEnd: null, cancelAtPeriodEnd: false, loading: true });

  useEffect(() => {
    if (!user) {
      setState({ isPro: false, status: 'free', currentPeriodEnd: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const sub = snap.data()?.subscription;
      if (!sub || sub.status !== 'pro') {
        setState({ isPro: false, status: 'free', currentPeriodEnd: null, cancelAtPeriodEnd: false, loading: false });
        return;
      }
      const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
      const isPro = sub.status === 'pro' && (!periodEnd || periodEnd > new Date());
      setState({
        isPro,
        status: isPro ? 'pro' : 'free',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
        loading: false,
      });
    });
    return unsub;
  }, [user]);

  return state;
}
```

### `src/utils/openSubscribePage.js`

Opens the subscribe web page in the device browser. Passes the user UID so the page can pre-fill the Stripe session.

```js
import { Linking } from 'react-native';

const BASE_URL = 'https://basketmanager-ed370.web.app';

export function openSubscribePage(userId, plan = 'monthly') {
  const url = `${BASE_URL}/subscribe?uid=${userId}&plan=${plan}`;
  Linking.openURL(url);
}
```

### `src/components/PaywallModal.js`

Reusable bottom-sheet modal shown at all 3 paywall trigger points. Props:

```jsx
// Props: { visible, onClose, reason: 'team_limit' | 'match_limit' | 'feature', featureName? }
```

Shows:
- Title + description specific to the reason
- Two plan cards: Free (current) vs Pro (€1.99/mes · €16.99/año)
- "Hazte Pro" button → calls `openSubscribePage(userId)`
- "Ahora no" to dismiss

---

## Modified Files

### `src/hooks/useMatches.js`

`addMatch()` must increment `matchCount` on the team document after successfully creating the match:

```js
import { increment } from 'firebase/firestore';

// At the end of addMatch(), after addDoc succeeds:
const docRef = await addDoc(collection(db, 'matches'), { ...matchData });
await updateDoc(doc(db, 'teams', matchData.teamId), { matchCount: increment(1) });
return docRef.id;
```

The limit check (`matchCount >= 8`) is NOT done inside this hook — it is done at the screen level before calling `addMatch()`, where both the team state and subscription state are already available.

### `src/hooks/useTeams.js`

No changes needed. The team limit check (`teams.length >= 1`) is done at the screen level before calling `addTeam()`.

### `src/screens/TeamsListScreen.js`

- Import `useSubscription` and `PaywallModal`
- When "Añadir Equipo" is pressed: if `!isPro && teams.length >= 1`, show `PaywallModal` with `reason='team_limit'` instead of opening the create modal
- Show `matchCount / 8` usage indicator on each team card in free plan (e.g., "5/8 partidos")

### `src/screens/MatchListScreen.js`

- Import `useSubscription` and `PaywallModal`
- When "Nuevo Partido" is pressed: check `!isPro && team.matchCount >= 8` → show `PaywallModal` with `reason='match_limit'`
- Show remaining match count badge when `!isPro` (e.g., "3 partidos restantes")

### `src/screens/TeamDetailScreen.js`

- Same paywall check for "Nuevo Partido" button
- Federation sync buttons: if `!isPro` → show `PaywallModal` with `reason='feature'` and `featureName='Sincronización FBCV'`

### `src/screens/SettingsScreen.js`

New "Plan" section showing:
- Free: "Plan gratuito · 1 equipo · 8 partidos" + "Ver planes Pro" button
- Pro: "Plan Pro · Activo hasta {date}" + optional "Cancelado, activo hasta {date}" if `cancelAtPeriodEnd`
- "Gestionar suscripción" button → opens `basketmanager-ed370.web.app/manage?uid={userId}` (Stripe Customer Portal)

---

## Backend: Cloud Function — Stripe Webhook

**File:** `basketball-manager/functions/index.js` (add alongside existing `onAttendanceUpdate`)

**Endpoint:** HTTP function at `/stripeWebhook` (region: `europe-west3`)

**Events handled:**
- `checkout.session.completed` → set `subscription.status = 'pro'`, store `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`
- `customer.subscription.updated` → update `currentPeriodEnd`, `cancelAtPeriodEnd`
- `customer.subscription.deleted` → set `status = 'free'`, clear subscription fields
- `invoice.payment_failed` → set `status = 'free'` (grace period optional)

The webhook reads `userId` from `session.metadata.userId` (set when creating the Checkout session).

Stripe webhook secret stored as Firebase environment config: `stripe.webhook_secret`.

---

## Backend: Firebase Hosting — Subscribe Page

**File:** `basketball-manager/subscribe.html`

Standalone HTML page (like the existing `attendance.html`) that:
1. Reads `?uid=` and `?plan=` from URL params
2. On load: calls a Firebase Cloud Function `createCheckoutSession` with `{ userId, plan }`
3. The function creates a Stripe Checkout Session with:
   - `metadata: { userId }`
   - `success_url`: `https://basketmanager-ed370.web.app/subscribe-success.html`
   - `cancel_url`: back to subscribe page
4. Redirects to Stripe Checkout URL

**File:** `basketball-manager/subscribe-success.html`

Simple confirmation page: "¡Ya eres Pro! Vuelve a la app para disfrutar de todas las funciones." with a deep link button back to the app.

**Firebase Hosting rewrites** (add to `firebase.json`):
```json
{ "source": "/subscribe", "destination": "/subscribe.html" },
{ "source": "/subscribe-success", "destination": "/subscribe-success.html" }
```

---

## Backend: Cloud Function — createCheckoutSession

HTTP function (europe-west3) called from `subscribe.html`:

```js
exports.createCheckoutSession = functions
  .region('europe-west3')
  .https.onRequest(async (req, res) => {
    const { userId, plan } = req.body;
    const priceId = plan === 'yearly'
      ? functions.config().stripe.price_yearly   // €16.99/year
      : functions.config().stripe.price_monthly; // €1.99/month

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      success_url: 'https://basketmanager-ed370.web.app/subscribe-success',
      cancel_url: `https://basketmanager-ed370.web.app/subscribe?uid=${userId}&plan=${plan}`,
    });
    res.json({ url: session.url });
  });
```

Stripe secret key stored as `stripe.secret_key` in Firebase config.

---

## Stripe Setup (manual, pre-implementation)

Before implementing, do these in the Stripe Dashboard:
1. Create Product "partits. Pro"
2. Create two Prices: €1.99/month (recurring) and €16.99/year (recurring)
3. Note the Price IDs (`price_xxx`) — needed for Cloud Function config
4. Set up webhook endpoint pointing to the deployed Cloud Function URL
5. Note the webhook signing secret

---

## V2 Preview: Clubs

Not in scope for v1 but the architecture supports it cleanly:

- New `clubs/{clubId}` collection: `{ name, adminUid, memberUids[], subscription: {...} }`
- `useSubscription()` will check user's own subscription **or** membership in a club with `status: 'pro'`
- Club admin manages members via a new "Mi Club" section in Settings
- Separate Stripe product at €9.99/month flat for up to 10 coaches
- Club admin pays; all members get Pro access

---

## Scope Boundaries

- No Apple IAP or Google Play Billing (payments via web only)
- No free trial period (the 8-match free tier IS the trial)
- No promo codes in v1 (Stripe supports them but out of scope)
- No invoice/receipt management in the app (Stripe Customer Portal handles this)
- Deleting a match does NOT decrement `matchCount` (prevents gaming the limit)
- `matchCount` is only incremented, never decremented
