# Unified Premium State on the Web App — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the web app (`basketball-manager/index.html`) agree with the React Native app about who is Premium, route its checkout through the same `/subscribe` page, and show a warning modal before sending anyone to the payment gateway — so paying becomes an option inside the warning, not an automatic redirect.

**Architecture:** The web app drops the Firestore Stripe Extension entirely. It gains the same two-listener rule the mobile app already uses in `useSubscription` — `users/{uid}` for the coach's own subscription plus `clubs/{clubId}` for club-granted Pro — isolated in a single `resolvePremium()` function. Checkout and subscription management become absolute links to the existing `/subscribe` and `/manage` pages. A new `PremiumModal` component intercepts every path that previously jumped straight to Stripe.

**Tech Stack:** Vanilla React via Babel standalone in a single HTML file, Firebase Firestore (modular JS SDK v12), Tailwind CDN. No build step.

---

## The problem this fixes

The two clients read Premium state from different places and neither can see the other's:

| | Where payment writes | Where the client reads |
|---|---|---|
| Web (`index.html`) | Stripe Extension → `customers/{uid}/checkout_sessions` | `customers/{uid}/subscriptions`, `status` in `active`/`trialing` (line 5417) |
| Mobile (`useSubscription.js`) | CF `createCheckoutSession` → `stripeWebhook` | `users/{uid}.subscription`, `status === 'pro'` (`functions/index.js:165`) |

Consequences today, before any change:

1. Anyone who pays on the web is Premium on the web and **free on mobile**. The reverse is also true.
2. The mobile 8-match limit can be bypassed by creating matches from the web, because the web never maintains the `matchCount` field the mobile increments (`useMatches.js:85`).

There are **no paying subscribers yet**, so no migration is required. This is the cheapest moment to unify.

---

## Decisions taken during design

| Question | Decision |
|---|---|
| Where does the shared rule live? | Mirrored in each client, isolated in one function per client, documented here as the contract. A shared module is impractical (Metro vs browser ESM); a server-resolved entitlement is disproportionate for two clients. |
| Does the web honour club-granted Pro? | Yes. Same rule as mobile: own subscription **OR** active club subscription. |
| Does the web get the 8-match limit? | Yes, including maintaining `matchCount` for the mobile's benefit. |
| Does the web get subscription management? | Yes, a link to the existing `/manage` page. |

---

## Section 1 — Premium source of truth

Replace the listener at `index.html:5415-5432`.

**Listener A — `users/{uid}`**
- `ownIsPro` = `subscription.status === 'pro'` AND (`subscription.currentPeriodEnd` absent OR still in the future).
- Also yields `clubId` (`data.clubId || null`).

**Listener B — `clubs/{clubId}`**, mounted only when `clubId` is set.
- `clubIsPro` = same status and expiry check on the club document.
- If the document is missing or unreadable, `clubIsPro` is `false`. Never throws.

**`resolvePremium()`** combines them:

```js
isPro = ownIsPro || clubIsPro
source = ownIsPro ? 'own' : (clubIsPro ? 'club' : null)
```

This mirrors `src/hooks/useSubscription.js:68` exactly. Any future change to the rule must be applied to both.

**State shape.** The tri-state `subscription` variable (`undefined` loading / `null` free / `'active'`) is replaced by:

```js
premium = { isPro: boolean, loading: boolean, source: 'own' | 'club' | 'manual' | null }
```

All **13** current references to `subscription` must be updated:

| Lines | Kind |
|---|---|
| `827`, `927`, `2968` | Component prop signatures (`DesktopSidebar`, `TopBar`, `TeamsListView`) |
| `5511`, `5515`, `5529` | Prop pass-through from the root component |
| `909`, `960`, `3040`, `5479`, `5567` | Actual conditional reads |
| `2984` | The team-limit guard in `createTeam` |
| `3010` | A `useEffect` dependency array |

Mapping:
- `subscription === 'active' || subscription === 'trialing'` → `premium.isPro`
- `subscription === null` → `!premium.isPro && !premium.loading`

**Delete** the 400 ms `setTimeout` at `5424-5426`. It papers over a race that only existed because the Extension writes the subscription document asynchronously after checkout; reading `users/{uid}` directly removes it.

**`source` exists for the forthcoming admin panel**, so a manually granted Pro can be told apart from a Stripe one and the webhook can avoid clobbering it.

---

## Section 2 — Checkout and subscription management

**Remove:** `startCheckout` (`5440`), the `checkoutLoading` state (`5117`), its setters (`5441`, `5454`, `5460`) and the loading overlay (`5578`). The hardcoded `price_1T0gwQKPQKkc3mVNhH05plnK` (`5445`) disappears with them; prices then live only in the Cloud Functions config.

`startCheckout` is also plumbed as a prop into `TeamsListView` — declared at `2968`, passed at `5529`. Both must be removed along with it; the banner and the `+` button call the modal instead.

**Add two helpers:**

```js
const SUBSCRIBE_BASE = 'https://basketmanager-ed370.web.app';
goToSubscribe() → window.location.assign(`${SUBSCRIBE_BASE}/subscribe?uid=${uid}`)
goToManage()    → window.location.assign(`${SUBSCRIBE_BASE}/manage?uid=${uid}`)
```

**URLs must be absolute.** The `/subscribe` and `/manage` rewrites exist only in Firebase Hosting (`firebase.json`). The web app is also served from GitHub Pages, where a relative `/subscribe` would 404. This matches `src/utils/openSubscribePage.js:3`, which uses the same base.

**Manage entry point:** next to the existing "Premium" badge in the sidebar user area (`index.html:909-913`), visible only when `premium.isPro`.

---

## Section 3 — PremiumModal

A new component in `index.html`, mirroring `src/components/PaywallModal.js`:

- PRO badge, title and description driven by `reason`.
- Two plan cards: **GRATIS €0** (1 equipo, 8 partidos incluidos, matriz y convocatoria completas) and **PRO €1.99/mes · o €16.99/año** (equipos ilimitados, partidos ilimitados, sincronización FBCV, futuras funciones premium).
- Primary CTA **"Activar Premium · €1.99/mes"** → `goToSubscribe()`.
- Secondary **"Ahora no"**, plus an X and backdrop click.

Reasons and their copy. `team_limit` and `match_limit` reuse the mobile strings verbatim from `PaywallModal.js:11-24`; `upgrade` is new, because the mobile has no equivalent entry point (its banner does not exist):

| `reason` | Title | Source |
|---|---|---|
| `team_limit` | Solo 1 equipo en el plan gratuito | verbatim from mobile |
| `match_limit` | Has usado los 8 partidos incluidos | verbatim from mobile |
| `upgrade` | Pásate a Premium | new, reuses the web banner's existing wording |

**Triggers:**

| Where | `reason` | Behaviour |
|---|---|---|
| Banner button "Desbloquear equipos" (`3048`) | `upgrade` | Opens the modal instead of calling `startCheckout` |
| `+` button (`3031`) when `!isPro && teams.length >= 1` | `team_limit` | Opens the modal and does **not** toggle `showForm` |
| Match creation when `!isPro && realMatchCount >= 8` | `match_limit` | Opens the modal, no match created |

The guard in `createTeam` (`2984-2987`) stops showing a toast and calling `startCheckout`. It remains as a safety net that opens the modal, covering the case where the form was already open.

---

## Section 4 — Limits and the match counter

**Gating uses the real count.** The web already holds every match in `matches` state (`5410`). The limit is evaluated against `matches.filter(m => m.teamId === team.id).length`, not against the stored field. The limit is therefore correct from day one with no migration.

**The stored field is still maintained**, so the mobile app stays correct:
- On match create: `updateDoc(doc(db,'teams',teamId), { matchCount: increment(1) })`
- On match delete: `increment(-1)`
- On FBCV import, which creates several at once: `increment(N)` where N is the number actually created.

**Self-healing.** When the limit is evaluated and the stored `matchCount` disagrees with the real count, write the real value. Teams whose counter drifted because matches were created from the web before this change repair themselves with normal use.

**Counter in the UI.** Team cards show `x/8 partidos` when `!premium.isPro`, matching `TeamsListScreen.js:211`.

---

## Section 5 — Loading, errors and verification

**Loading.** While `premium.loading` is true, the Premium banner is hidden and no limit is enforced. This avoids both failure modes: showing the upsell to someone who already pays, and blocking someone before we know they are Pro.

**Errors.** A missing or unreadable club document degrades to "own subscription only". A failed `matchCount` update must not block match creation — the gate reads the real count anyway.

**Verification is manual.** The project has no test suite or linter; the existing plans verify by running the app. Checklist:

1. Free user, 1 team: the `+` button opens the modal and does not open the form.
2. Free user: "Desbloquear equipos" opens the modal, not Stripe.
3. Modal: "Ahora no", the X and the backdrop all close it without navigating.
4. Modal: "Activar Premium" lands on `/subscribe` with the correct `uid`.
5. Set `users/{uid}.subscription.status = 'pro'` by hand in Firestore → limits disappear **in both apps**, banner gone, manage link visible.
6. Set it back to `free` → limits return in both apps.
7. Club member whose `clubs/{clubId}.subscription.status = 'pro'` sees Premium on the web.
8. Create a match from the web → `teams/{id}.matchCount` increases; delete it → it decreases.
9. Free team with 8 matches: creating the 9th from the web opens the modal.
10. Open the web app from the GitHub Pages URL and confirm both links still resolve.

**Rollback.** Everything lives in `basketball-manager/index.html` and no Firestore schema changes. Reverting the commit fully undoes it.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `basketball-manager/index.html` | Modify | All of the above: listeners, `resolvePremium`, `PremiumModal`, triggers, limits, `matchCount`, manage link |

No other file changes. The Cloud Functions, `/subscribe`, `/manage` and the mobile app are already correct and stay untouched.

---

## Out of scope

- **FBCV sync is not gated behind Premium on the web**, while the mobile app does gate it (`TeamDetailScreen`). A real inconsistency, deliberately left alone — not requested.
- **The Stripe Extension itself** is not uninstalled from the Firebase project. This change only stops the web app from using it. Removing the extension and the orphaned `customers/` collection is a separate cleanup.
- **The admin panel.** A read-only one already exists in the web app: `AdminDashboardView`, reached from the `admin-dashboard` view, gated by the `users/{uid}.isAdmin` flag (`index.html:5276`). It lists all users and teams with stats and performs no writes — its props are `{ navigate, db, collection, getDocs, query, where }`, with no `updateDoc` or `setDoc`. Extending it to manage subscriptions and grant or revoke Pro by hand is separate, architectural work. This design only reserves `premium.source` so a manual grant can be distinguished from a Stripe one.
