# Clubs v2 — Group Subscriptions Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a club admin to pay a single subscription that gives Pro access to all their coaches (up to 10/20/30 depending on tier). Individual coach subscriptions are paused while inside a club.

**Architecture:** New `clubs/{clubId}` Firestore collection. `useSubscription()` gains a second real-time listener for the user's club (if any). Four Cloud Functions handle club lifecycle. Stripe checkout reuses the same web-page pattern as v1 with club-specific price IDs. All membership changes are done via Cloud Functions (atomic Firestore transactions).

**Tech Stack:** React Native / Expo SDK 55, Firebase Firestore, Firebase Cloud Functions v1 (europe-west3), Stripe Node SDK, Firebase Hosting.

---

## Pricing

| Tier | Capacity | Monthly | Annual (−20%) |
|---|---|---|---|
| Individual Pro | — | €1.99/mes | €16.99/año |
| Club Small | Admin + 10 coaches | €9.99/mes | €95.99/año |
| Club Medium | Admin + 20 coaches | €17.99/mes | €172.99/año |
| Club Large | Admin + 30 coaches | €24.99/mes | €239.99/año |

- Admin's seat is free — does not count toward the tier limit.
- `memberUids[]` stores only invited coaches (not the admin). Capacity check: `memberUids.length < tierLimit`.
- Tier upgrades are allowed at any time. Downgrades are blocked if current member count exceeds the lower tier's limit.
- No annual pricing for clubs in v2 upgrade flow — admin can only upgrade tier (Small→Medium→Large); plan type (monthly/annual) is chosen at club creation.

---

## Firestore Schema

### `clubs/{clubId}` (new collection)

```js
{
  name: 'CB Benidorm',
  adminUid: 'uid-admin',
  memberUids: ['uid1', 'uid2'],       // does NOT include adminUid
  inviteCode: 'PARTITS-XK4F',         // unique, uppercase, generated at creation
  tier: 'small' | 'medium' | 'large', // maps to 10 / 20 / 30 member limit
  subscription: {
    status: 'free' | 'pro',
    stripeCustomerId: 'cus_xxx',
    stripeSubscriptionId: 'sub_xxx',
    currentPeriodEnd: 'YYYY-MM-DDTHH:MM:SSZ',
    cancelAtPeriodEnd: false,
  }
}
```

Tier limits:
```js
const TIER_LIMITS = { small: 10, medium: 20, large: 30 };
```

### `users/{uid}` (new field)

```js
{
  clubId: 'club-id-xxx' | null   // null = not in any club
}
```

Set when joining a club, cleared when leaving or being removed. Admin's own `clubId` is set to the club they created.

---

## Subscription Logic — `useSubscription` update

`useSubscription` currently listens to `users/{uid}`. It is extended to open a second `onSnapshot` listener on `clubs/{clubId}` when `users/{uid}.clubId` is set.

```js
// Pseudocode — isPro resolution
isPro = ownSubscription.isPro
     || (clubSubscription.status === 'pro' && clubSubscription.currentPeriodEnd > new Date())
```

New fields returned by the hook:

```js
{
  isPro: boolean,
  status: 'free' | 'pro',
  currentPeriodEnd: Date | null,
  cancelAtPeriodEnd: boolean,
  loading: boolean,
  // NEW:
  clubId: string | null,        // the club this user belongs to (or is admin of)
  isClubMember: boolean,        // true if Pro comes from a club subscription
  isClubAdmin: boolean,         // true if this user is the adminUid of their club
}
```

`isClubMember` and `isClubAdmin` allow SettingsScreen to show the correct UI section without extra Firestore reads.

### Individual plan pause behavior

When a user with an active individual Pro subscription joins a club:
- Their individual Stripe subscription continues billing (it is NOT cancelled server-side).
- `isPro` remains true — it now comes from the club.
- If the user leaves the club, `isPro` falls back to their individual subscription (if still active).
- There is no server-side suspension of individual subscriptions — the client simply resolves `isPro` from whichever source is active.

---

## Cloud Functions

All functions in `europe-west3`. New functions appended to `basketball-manager/functions/index.js`.

### `createClub` (HTTP)

Called by the app when an admin creates a new club.

**Request body:** `{ userId, name, tier, plan }` — `plan` is `'monthly'` or `'yearly'`

**Logic:**
1. Verify `userId` exists and is not already in a club (`users/{userId}.clubId` must be null).
2. Generate a unique `inviteCode`: uppercase alphanumeric, 10 chars, prefixed with `PARTITS-` (e.g. `PARTITS-XK4F2B`). Check uniqueness with a Firestore query.
3. Create `clubs/{clubId}` document with `adminUid = userId`, `memberUids = []`, `inviteCode`, `tier`, `subscription.status = 'free'`.
4. Set `users/{userId}.clubId = clubId`.
5. Return `{ clubId, inviteCode }` — the client then opens `club-subscribe.html?uid={userId}&clubId={clubId}&tier={tier}&plan={plan}` to complete payment.

### `joinClub` (HTTP)

Called by a coach who enters an invite code.

**Request body:** `{ userId, inviteCode }`

**Logic (Firestore transaction):**
1. Query `clubs` where `inviteCode == inviteCode` — get the club doc.
2. If not found: return 404 `{ error: 'Código inválido' }`.
3. If `club.subscription.status !== 'pro'`: return 403 `{ error: 'El club no tiene suscripción activa' }`.
4. If `club.memberUids.length >= TIER_LIMITS[club.tier]`: return 403 `{ error: 'El club está lleno' }`.
5. If `userId === club.adminUid`: return 400 `{ error: 'Ya eres el administrador de este club' }`.
6. If user already in `memberUids`: return 400 `{ error: 'Ya eres miembro de este club' }`.
7. If `users/{userId}.clubId` is already set to a different club: return 400 `{ error: 'Ya perteneces a otro club' }`.
8. Atomic transaction: add `userId` to `club.memberUids` + set `users/{userId}.clubId = club.id`.
9. Return `{ clubId: club.id, clubName: club.name }`.

### `leaveClub` (HTTP)

Called by a member leaving voluntarily.

**Request body:** `{ userId, clubId }`

**Logic (Firestore transaction):**
1. Fetch `clubs/{clubId}`. Verify `userId` is in `memberUids` (not admin — admin cannot leave, they must delete the club).
2. Atomic transaction: remove `userId` from `memberUids` + set `users/{userId}.clubId = null`.
3. Return `{ success: true }`.

### `removeMember` (HTTP)

Called by the admin to expel a member.

**Request body:** `{ adminId, clubId, memberId }`

**Logic (Firestore transaction):**
1. Fetch `clubs/{clubId}`. Verify `adminId === club.adminUid`.
2. Verify `memberId` is in `memberUids`.
3. Atomic transaction: remove `memberId` from `memberUids` + set `users/{memberId}.clubId = null`.
4. Return `{ success: true }`.

### `createClubCheckoutSession` (HTTP)

Same pattern as `createCheckoutSession` from v1 but for club tier prices.

**Request body:** `{ userId, clubId, tier, plan }`

**Logic:**
1. Verify `userId === clubs/{clubId}.adminUid`.
2. Resolve `priceId` from `tier + plan` combination (6 price IDs from Firebase config).
3. Create Stripe Checkout Session with `metadata: { clubId }`, `success_url: /club-subscribe-success`.
4. Return `{ url }`.

### `stripeWebhook` (existing — extended)

The existing webhook detects whether the event is for a user or a club by checking `metadata`:
- If `metadata.userId` → writes to `users/{userId}.subscription` (existing behavior).
- If `metadata.clubId` → writes to `clubs/{clubId}.subscription` (new behavior).

All four event types (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`) handle the club path identically to the user path but targeting the club document.

`findByCustomerId` is extended to also search `clubs` collection when no user is found in `users`.

---

## Firebase Hosting — New Pages

### `club-subscribe.html`

URL params: `?uid={userId}&clubId={clubId}&tier={tier}&plan={plan}`

Shows the 3 tiers (Small / Medium / Large) with monthly and annual prices. Highlights the current tier if upgrading. On button click calls `createClubCheckoutSession`. Same visual style as `subscribe.html`.

### `club-subscribe-success.html`

Success confirmation: "¡Tu club está activo! Comparte el código de invitación con tus entrenadores." Deep link back to app.

### `firebase.json` rewrites (2 new entries)

```json
{ "source": "/club-subscribe", "destination": "/club-subscribe.html" },
{ "source": "/club-subscribe-success", "destination": "/club-subscribe-success.html" },
```

---

## UI — SettingsScreen

The existing "PLAN" section gains three new conditional states based on `useSubscription`:

### State 1: No club, no Pro (existing — unchanged)
Plan Gratuito row + "Ver plan Pro" button + new "¿Tienes un código de club?" text button that opens the Join Club modal.

### State 2: No club, individual Pro (existing — unchanged)
Plan Pro row + "Gestionar" button. No club-related UI.

### State 3: Club Admin
```
PLAN
[Club Small · CB Benidorm]          [Gestionar →]
Código: PARTITS-XK4F  [Copiar]

MIEMBROS (3/10)
  #  Nombre             [Expulsar]
  1  Jordi Pons
  2  Marc García        [×]
  3  Ana Torres         [×]

[Cambiar tier →]   [Invitar con código]
```
- "Gestionar →" opens `manage.html` (Stripe Customer Portal).
- "Cambiar tier →" opens `club-subscribe.html?uid=...&clubId=...&currentTier=small`.
- Member count badge shows `memberUids.length / TIER_LIMITS[tier]`.
- Expel button calls `removeMember` CF with confirmation dialog.

### State 4: Club Member
```
PLAN
Miembro de CB Benidorm · Pro activo
Activo hasta DD/MM/YYYY

[Salir del club]
```
- "Salir del club" shows a confirmation modal: "Si sales perderás el acceso Pro (a menos que tengas un plan individual activo). ¿Continuar?" → calls `leaveClub` CF.

---

## UI — Join Club Modal

Accessible from SettingsScreen State 1 ("¿Tienes un código de club?"). A bottom-sheet modal with:
- Text input for the invite code (uppercase, auto-format `PARTITS-XXXX`)
- "Unirse" button → calls `joinClub` CF
- Clear error messages for: código inválido, club lleno, club sin suscripción activa

---

## New Files

| File | Purpose |
|---|---|
| `src/hooks/useClub.js` | Real-time listener for `clubs/{clubId}` — returns `{ club, loading }`. Used by SettingsScreen admin view to get member list. |
| `src/components/JoinClubModal.js` | Bottom-sheet modal with invite code input field |
| `basketball-manager/club-subscribe.html` | Club tier selection and Stripe checkout page |
| `basketball-manager/club-subscribe-success.html` | Post-payment confirmation |

## Modified Files

| File | Change |
|---|---|
| `src/hooks/useSubscription.js` | Add second listener for club subscription; add `clubId`, `isClubMember`, `isClubAdmin` to return value |
| `src/screens/SettingsScreen.js` | Add Club Admin and Club Member states; add Join Club trigger |
| `basketball-manager/functions/index.js` | Add `createClub`, `joinClub`, `leaveClub`, `removeMember`, `createClubCheckoutSession`; extend `stripeWebhook` |
| `basketball-manager/functions/package.json` | No changes needed (stripe already installed) |
| `basketball-manager/firebase.json` | Add 2 new rewrites |

---

## Scope Boundaries

- Admin cannot leave a club — they must contact support to dissolve it (out of scope for v2).
- No club-level data visibility — each coach's teams/matches remain private.
- No promo codes or free trials for club plans.
- No downgrade path if member count exceeds the lower tier — UI blocks it with a message.
- Export/import of data deferred to v3.
- Individual Stripe subscriptions are NOT cancelled server-side when joining a club — the client resolves `isPro` from whichever source is active.
- `inviteCode` is permanent — no code rotation in v2.
- A user can only belong to one club at a time.
