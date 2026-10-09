# Unified Premium State on the Web App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web app agree with the mobile app about who is Premium, route its checkout through the existing `/subscribe` page, and show a warning modal before anyone reaches the payment gateway.

**Architecture:** The web app drops the Firestore Stripe Extension. It gains the same two-listener rule the mobile app uses in `useSubscription` — `users/{uid}` plus `clubs/{clubId}` — combined by one `resolvePremium` effect into a single `premium` object. Checkout and management become absolute links to `/subscribe` and `/manage`. A new `PremiumModal` intercepts every path that previously jumped straight to Stripe.

**Tech Stack:** Vanilla React via Babel standalone inside a single HTML file, Firebase Firestore (modular JS SDK v12), Tailwind CDN. No build step, no bundler.

**Spec:** `docs/superpowers/specs/2026-10-09-premium-unificado-web-design.md`

## Global Constraints

- **Every change lives in `basketball-manager/index.html`.** No other file is modified.
- **This project has no test suite, linter or CI.** Replace the usual test steps with the manual browser checks written into each task.
- **Serve the app with `npx firebase serve --only hosting` from `basketball-manager/`** (default `http://localhost:5000`). Opening `index.html` from the filesystem is not valid: the `/subscribe` and `/manage` rewrites come from `firebase.json`, and Firebase Auth needs an http origin.
- **External URLs must be absolute**, built from `const SUBSCRIBE_BASE = 'https://basketmanager-ed370.web.app';`. The app is also served from GitHub Pages, where a relative `/subscribe` returns 404.
- **The Premium rule must stay byte-for-byte equivalent to `basketball-manager-rn/src/hooks/useSubscription.js:68`:** `isPro = ownIsPro || clubIsPro`, where each side requires `status === 'pro'` and a `currentPeriodEnd` that is absent or in the future.
- **Spanish UI strings, English identifiers**, per the repo convention.
- **Free tier limits:** 1 team, 8 matches per team.
- **Prices in copy:** `€1.99/mes` and `€16.99/año`. No price ID may appear in `index.html` after Task 2.

## Review Focus

These are the conditions the spec implies but that no task's main flow exercises. Each has a check folded into the task that owns the code.

1. **Premium flashes the upsell while listeners load.** A paying user opening the app must never see the banner or a limit, not even for a frame — `premium.loading` gates both. *(Task 1, Step 8)*
2. **`clubId` pointing at a deleted or unreadable club.** Must degrade to "own subscription only" and never throw. *(Task 1, Step 9)*
3. **An expired `currentPeriodEnd`.** A subscription whose period ended is free, not Pro, on both the user and the club document. *(Task 1, Step 10)*
4. **The app served from GitHub Pages.** Both outbound links must resolve there, which is the whole reason they are absolute. *(Task 2, Step 4)*
5. **A failing `matchCount` write.** Offline or denied permissions must not block the user from creating or deleting the match itself. *(Task 4, Step 8)*

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `basketball-manager/index.html` | Modify | Everything: listeners, `resolvePremium`, `PremiumModal`, triggers, limits, `matchCount`, manage link |

Line numbers below refer to the file as it stands at commit `439ad53`. They shift as you work — always confirm by searching for the quoted code rather than trusting the number.

---

### Task 1: Premium source of truth

**Files:**
- Modify: `basketball-manager/index.html:5116` (state), `:5415-5432` (listener), and the 13 references to `subscription`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `premium` — an object `{ isPro: boolean, loading: boolean, source: 'own' | 'club' | 'manual' | null }`, in scope of the root `App` component. Every later task reads `premium.isPro` and `premium.loading`.

- [ ] **Step 1: Replace the subscription state declaration**

Find line 5116:

```js
            const [subscription, setSubscription] = useState(undefined); // undefined = loading, null = free, 'active' = premium
```

Replace with:

```js
            // Premium state — mirrors src/hooks/useSubscription.js in the mobile app.
            // Any change to this rule must be applied there too.
            const [premium, setPremium] = useState({ isPro: false, loading: true, source: null });
            const [ownSub, setOwnSub] = useState({ isPro: false, clubId: null, source: null, loading: true });
            const [clubSub, setClubSub] = useState({ isPro: false });
```

- [ ] **Step 2: Replace the Stripe Extension listener with listener A**

Find lines 5415-5432, the whole `useEffect` that opens `collection(db, 'customers', user.uid, 'subscriptions')`. Delete it entirely — including the `setTimeout` of 400 ms — and put this in its place:

```js
            // Listener A — the coach's own subscription
            useEffect(() => {
                if (!user) {
                    setOwnSub({ isPro: false, clubId: null, source: null, loading: false });
                    return;
                }
                const unsubscribe = onSnapshot(
                    doc(db, 'users', user.uid),
                    (snap) => {
                        const data = snap.data() || {};
                        const sub = data.subscription;
                        const end = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
                        const isPro = sub?.status === 'pro' && (!end || end > new Date());
                        setOwnSub({
                            isPro,
                            clubId: data.clubId || null,
                            source: isPro ? (sub.source || 'own') : null,
                            loading: false,
                        });
                    },
                    () => setOwnSub({ isPro: false, clubId: null, source: null, loading: false })
                );
                return () => unsubscribe();
            }, [user]);
```

- [ ] **Step 3: Add listener B for club-granted Premium**

Immediately after listener A:

```js
            // Listener B — Premium granted by the coach's club. Only mounted when there is one.
            useEffect(() => {
                if (!ownSub.clubId) {
                    setClubSub({ isPro: false });
                    return;
                }
                const unsubscribe = onSnapshot(
                    doc(db, 'clubs', ownSub.clubId),
                    (snap) => {
                        if (!snap.exists()) { setClubSub({ isPro: false }); return; }
                        const sub = snap.data().subscription;
                        const end = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
                        setClubSub({ isPro: sub?.status === 'pro' && (!end || end > new Date()) });
                    },
                    () => setClubSub({ isPro: false })
                );
                return () => unsubscribe();
            }, [ownSub.clubId]);
```

- [ ] **Step 4: Add the resolvePremium effect**

Immediately after listener B:

```js
            // resolvePremium — combines both listeners into the single value the UI reads.
            useEffect(() => {
                if (ownSub.loading) {
                    setPremium({ isPro: false, loading: true, source: null });
                    return;
                }
                const isPro = ownSub.isPro || clubSub.isPro;
                setPremium({
                    isPro,
                    loading: false,
                    source: ownSub.isPro ? ownSub.source : (clubSub.isPro ? 'club' : null),
                });
            }, [ownSub, clubSub]);
```

- [ ] **Step 5: Update the three component prop signatures**

Line 827 — `DesktopSidebar`: replace the `subscription` parameter with `premium`.

```js
        const DesktopSidebar = ({ navigate, view, signOut, premium, isOnline, startTutorial, isAdmin, teams = [], matches = [] }) => {
```

Line 927 — `TopBar`:

```js
        const TopBar = ({ navigate, view, signOut, premium, isOnline, startTutorial, isAdmin }) => {
```

Line 2968 — `TeamsListView`: replace only `subscription` with `premium`. **Keep `startCheckout`.** It is still the banner's handler until Task 3 replaces it with the modal; removing it here would break the "Desbloquear equipos" button and leave the app broken between tasks.

```js
        const TeamsListView = ({ teams, matches, navigate, addDoc, collection, db, doc, premium, startCheckout }) => {
```

- [ ] **Step 6: Update the three prop pass-throughs**

Line 5511: `subscription={subscription}` → `premium={premium}`
Line 5515: `subscription={subscription}` → `premium={premium}`
Line 5529: `subscription={subscription}` → `premium={premium}`. Leave `startCheckout={startCheckout}` exactly as it is; Task 3 removes it.

- [ ] **Step 7: Update the five conditional reads**

Lines 909, 960 and 5567 all test `subscription === 'active' || subscription === 'trialing'`. Each becomes `premium.isPro`. For example line 909:

```js
                        {premium.isPro && (
```

and line 5567:

```js
                                    {premium.isPro ? (
```

Line 3040, the banner, tests `subscription === null`. It becomes — note the `loading` guard, which is Review Focus item 1:

```js
                        {!premium.isPro && !premium.loading && (
```

Line 2984, the guard inside `createTeam`, becomes:

```js
                            if (teams.length >= 1 && !premium.isPro && !premium.loading) {
```

Line 3010 is a `useEffect` dependency array containing `subscription`. Replace that entry with `premium.isPro`.

Line 5479 reads `subscription === undefined` as a loading gate:

```js
            if (authLoading || (user && premium.loading)) return (
```

- [ ] **Step 8: Verify no stale references remain, then check the loading gate**

Run from the repo root:

```bash
grep -n "subscription" basketball-manager/index.html
```

Expected: only matches inside the new listeners (`data.subscription`, `snap.data().subscription`) and the word in Spanish copy. No `subscription ===`, no `setSubscription`, no `subscription={`.

Then serve the app and sign in as a user whose `users/{uid}.subscription.status` is `pro`:

```bash
cd basketball-manager && npx firebase serve --only hosting
```

Expected: the Premium banner **never appears, not even for a frame**, on a hard reload. If it flashes, the `!premium.loading` guard in Step 7 is missing somewhere.

- [ ] **Step 9: Check the broken-club path**

In the Firebase console set `users/{uid}.clubId` to a club id that does not exist, e.g. `no-such-club`, on a user with no subscription of their own.

Expected: the app loads normally and shows the free state. No uncaught error in the console. Remove the field afterwards.

- [ ] **Step 10: Check the expired-period path**

Set on the same user:

```
subscription: { status: 'pro', currentPeriodEnd: '2020-01-01T00:00:00.000Z' }
```

Expected: the user is treated as **free** — banner visible, limits enforced. Then set `currentPeriodEnd` to a future date and confirm Premium returns. Repeat both on a `clubs/{clubId}` document to confirm listener B applies the same rule.

- [ ] **Step 11: Commit**

```bash
git add basketball-manager/index.html
git commit -m "refactor(web): read Premium from users/{uid} and clubs/{clubId}"
```

---

### Task 2: Checkout and subscription management links

This task only **adds**. Nothing is deleted until Task 3, so that the app keeps working at every commit.

**Files:**
- Modify: `basketball-manager/index.html:5464` (new helpers), `:909-913` (sidebar badge), `:5511` (prop)

**Interfaces:**
- Consumes: `premium` from Task 1.
- Produces: `SUBSCRIBE_BASE` (string constant), `goToSubscribe()` and `goToManage()` — both take no arguments, read `user.uid` from scope and navigate away via `window.location.assign`. Task 3 calls `goToSubscribe` from the modal CTA.

- [ ] **Step 1: Add the two navigation helpers**

Insert immediately **after** the existing `startCheckout` function, which ends at line 5464. Leave `startCheckout` in place for now:

```js
            // Both pages live behind Firebase Hosting rewrites, which do not exist on
            // GitHub Pages — so these URLs must stay absolute.
            const SUBSCRIBE_BASE = 'https://basketmanager-ed370.web.app';

            const goToSubscribe = () => {
                if (!user?.uid) return;
                window.location.assign(`${SUBSCRIBE_BASE}/subscribe?uid=${encodeURIComponent(user.uid)}`);
            };

            const goToManage = () => {
                if (!user?.uid) return;
                window.location.assign(`${SUBSCRIBE_BASE}/manage?uid=${encodeURIComponent(user.uid)}`);
            };
```

- [ ] **Step 2: Add the manage link to the sidebar**

In `DesktopSidebar`, find the Premium badge updated in Task 1 at line 909 and add a button underneath it, inside the same conditional block:

```js
                        {premium.isPro && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(255,215,0,0.1)' }}>
                                    <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="crown" class="w-4 h-4"></i>' }} style={{ color: '#FFD700' }}></span>
                                    <span className="text-xs font-bold" style={{ color: '#FFD700' }}>Premium</span>
                                </div>
                                <button
                                    onClick={onManage}
                                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                    style={{ color: 'rgba(255,255,255,0.55)' }}
                                >
                                    Gestionar suscripción
                                </button>
                            </div>
                        )}
```

Add `onManage` to the `DesktopSidebar` signature from Task 1 Step 5:

```js
        const DesktopSidebar = ({ navigate, view, signOut, premium, isOnline, startTutorial, isAdmin, teams = [], matches = [], onManage }) => {
```

And pass it at line 5511:

```js
                    {view !== 'public-match' && <DesktopSidebar navigate={navigate} view={view} signOut={signOut} premium={premium} isOnline={isOnline} startTutorial={startTutorial} isAdmin={isAdmin} teams={teams} matches={matches} onManage={goToManage} />}
```

- [ ] **Step 3: Verify the manage link**

Serve the app, signed in as a Pro user. Expected: "Gestionar suscripción" appears under the Premium badge in the desktop sidebar, and clicking it lands on `basketmanager-ed370.web.app/manage?uid=<your uid>`. As a free user it must not appear.

- [ ] **Step 4: Verify the links from GitHub Pages**

Open the deployed GitHub Pages copy of the app, or temporarily serve the folder from a path-prefixed static server. Confirm the outbound links still point at `https://basketmanager-ed370.web.app/...` and are not rewritten relative to the Pages path. This is the whole reason they are absolute.

- [ ] **Step 5: Commit**

```bash
git add basketball-manager/index.html
git commit -m "feat(web): add /subscribe and /manage navigation helpers"
```

---

### Task 3: PremiumModal and its triggers

**Files:**
- Modify: `basketball-manager/index.html` — new component near the other view components, plus `:3031` (`+` button), `:3040-3053` (banner), `:2984-2987` (`createTeam` guard)

**Interfaces:**
- Consumes: `premium` (Task 1), `goToSubscribe` (Task 2).
- Produces: `PremiumModal` component with props `{ reason, onClose, onSubscribe }`; `premiumModal` state shaped `{ open: boolean, reason: string }`; `openPremiumModal(reason)` where `reason` is one of `'team_limit' | 'match_limit' | 'upgrade'`. Task 5 calls `openPremiumModal('match_limit')`.

- [ ] **Step 1: Add the PremiumModal component**

Place it just before `const TeamsListView = ` (line 2968):

```js
        const PREMIUM_REASONS = {
            team_limit: {
                title: 'Solo 1 equipo en el plan gratuito',
                description: 'Necesitas el plan Pro para gestionar más de un equipo.',
            },
            match_limit: {
                title: 'Has usado los 8 partidos incluidos',
                description: 'El plan gratuito incluye 8 partidos por equipo. Hazte Pro para partidos ilimitados.',
            },
            upgrade: {
                title: 'Pásate a Premium',
                description: 'Gestión de equipos ilimitados, estadísticas avanzadas y más.',
            },
        };

        const FREE_FEATURES = ['1 equipo', '8 partidos incluidos', 'Matriz y convocatoria completas'];
        const PRO_FEATURES = ['Equipos ilimitados', 'Partidos ilimitados', 'Sincronización FBCV automática', 'Futuras funciones premium'];

        const PremiumModal = ({ reason, onClose, onSubscribe }) => {
            const info = PREMIUM_REASONS[reason] || PREMIUM_REASONS.upgrade;

            useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, []);

            return (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
                    onClick={onClose}
                >
                    <div
                        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full sm:max-w-md shadow-2xl relative animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400" title="Cerrar">
                            <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="x" class="w-5 h-5"></i>' }}></span>
                        </button>

                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 text-[11px] font-black tracking-widest mb-3">PRO</span>
                        <h3 className="text-xl font-black text-slate-800 mb-1.5">{info.title}</h3>
                        <p className="text-sm text-slate-500 mb-5">{info.description}</p>

                        <div className="flex gap-2.5 mb-5">
                            <div className="flex-1 rounded-2xl p-3.5 bg-slate-50 border border-slate-200">
                                <p className="text-[9px] font-black tracking-widest text-slate-400 mb-1">GRATIS</p>
                                <p className="text-2xl font-black text-slate-800">€0</p>
                                <ul className="mt-2.5 space-y-1.5">
                                    {FREE_FEATURES.map(f => (
                                        <li key={f} className="text-xs text-slate-500">{f}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex-1 rounded-2xl p-3.5 bg-slate-900 border border-slate-900">
                                <p className="text-[9px] font-black tracking-widest text-orange-400 mb-1">PRO</p>
                                <p className="text-2xl font-black text-white">€1.99<span className="text-xs font-normal text-white/50">/mes</span></p>
                                <p className="text-[11px] text-white/40">o €16.99/año</p>
                                <ul className="mt-2.5 space-y-1.5">
                                    {PRO_FEATURES.map(f => (
                                        <li key={f} className="text-xs text-white/80">{f}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <button
                            onClick={onSubscribe}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black text-base shadow-lg active:scale-95 transition-all"
                        >
                            Activar Premium · €1.99/mes
                        </button>
                        <button onClick={onClose} className="w-full py-2.5 mt-2 text-sm font-semibold text-slate-400">
                            Ahora no
                        </button>
                    </div>
                </div>
            );
        };
```

- [ ] **Step 2: Add the modal state and opener to the root component**

Next to the other `useState` calls around line 5119:

```js
            const [premiumModal, setPremiumModal] = useState({ open: false, reason: 'upgrade' });
            const openPremiumModal = (reason = 'upgrade') => setPremiumModal({ open: true, reason });
            const closePremiumModal = () => setPremiumModal({ open: false, reason: 'upgrade' });
```

- [ ] **Step 3: Render the modal**

Just before the `{checkoutLoading && (` overlay at line 5578, which Step 9 removes:

```js
                    {premiumModal.open && (
                        <PremiumModal
                            reason={premiumModal.reason}
                            onClose={closePremiumModal}
                            onSubscribe={() => { closePremiumModal(); goToSubscribe(); }}
                        />
                    )}
```

- [ ] **Step 4: Swap startCheckout for openPremiumModal in TeamsListView**

Signature at line 2968 — drop `startCheckout`, add `openPremiumModal`:

```js
        const TeamsListView = ({ teams, matches, navigate, addDoc, collection, db, doc, premium, openPremiumModal }) => {
```

Render at line 5529 — same swap:

```js
                            {view === 'teams-list' && <TeamsListView teams={teams} matches={matches} navigate={navigate} addDoc={addDoc} collection={collection} db={db} deleteDoc={deleteDoc} doc={doc} premium={premium} openPremiumModal={openPremiumModal} />}
```

- [ ] **Step 5: Make the banner open the modal**

At line 3048, the banner button currently calls `startCheckout`, which no longer exists:

```js
                                <button onClick={() => openPremiumModal('upgrade')} className="px-4 py-2 bg-white text-blue-600 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-all">
                                    Desbloquear equipos
                                </button>
```

- [ ] **Step 6: Gate the + button**

Replace the `onClick` at line 3031:

```js
                                    onClick={() => {
                                        if (!premium.isPro && !premium.loading && teams.length >= 1) {
                                            openPremiumModal('team_limit');
                                            return;
                                        }
                                        setShowForm(!showForm);
                                    }}
```

- [ ] **Step 7: Turn the createTeam guard into a safety net**

Replace lines 2984-2988:

```js
                            if (teams.length >= 1 && !premium.isPro && !premium.loading) {
                                openPremiumModal('team_limit');
                                return;
                            }
```

The toast and the `startCheckout()` call both go. The user is told by the modal, not by a toast followed by a redirect.

- [ ] **Step 8: Delete startCheckout and its state**

Nothing calls it any more. Remove the whole function, lines 5440-5464, and the state declaration at line 5117:

```js
            const [checkoutLoading, setCheckoutLoading] = useState(false);
```

- [ ] **Step 9: Delete the Stripe loading overlay**

Remove the whole block starting at line 5578:

```js
                    {checkoutLoading && (
```

through its closing `)}`. It ends just after the `<p>` that reads "Te estamos redirigiendo a la pasarela segura de Stripe...".

- [ ] **Step 10: Verify the Extension is fully unwired**

```bash
grep -n "price_1T0gwQ\|checkout_sessions\|checkoutLoading\|startCheckout" basketball-manager/index.html
```

Expected: no output at all. The hardcoded price ID is now gone from the repo; prices live only in the Cloud Functions config.

- [ ] **Step 11: Verify the three entry points**

Serve the app as a free user with exactly one team.

| Action | Expected |
|---|---|
| Click `+` | Modal opens with "Solo 1 equipo en el plan gratuito". The create form does **not** appear behind it. |
| Click "Desbloquear equipos" | Modal opens with "Pásate a Premium". No redirect to Stripe. |
| Click "Ahora no", the X, or the backdrop | Modal closes, nothing navigates, no team created. |
| Click "Activar Premium · €1.99/mes" | Lands on `/subscribe?uid=<uid>` showing the monthly and annual options. |

Then as a Pro user: clicking `+` opens the create form directly and the banner is absent.

- [ ] **Step 12: Commit**

```bash
git add basketball-manager/index.html
git commit -m "feat(web): warn before checkout with a PremiumModal"
```

---

### Task 4: Maintain matchCount

**Files:**
- Modify: `basketball-manager/index.html:61` and `:96` (expose `increment`), `:429` (helper), `:3279` (create), `:1348` (federation import), `:1294` and `:3602` (delete)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `bumpMatchCount(teamId, delta)` — an `async` helper returning `Promise<void>` that never rejects. **Defined at the top level of the Babel script, not inside a component**, so that `TeamDetailView`, `MatchSetupView` and `EditMatchView` can all call it without prop plumbing. Task 5 relies on the counter it maintains.

This task exists because the web app has never maintained `matchCount`, while the mobile app increments it in `useMatches.js:85`. That is why the mobile 8-match limit can be bypassed from the web today.

**Read this before starting.** This file bridges two script blocks. The `<script type="module">` at line 59 imports the Firestore SDK and re-exports what it needs onto `window.firebaseMethods` (line 95); the `<script type="text/babel">` at line 347 destructures from there. **`increment` is in neither.** It must be added in both places before it can be used.

- [ ] **Step 1: Add increment to the SDK import**

Line 61. Append `increment` to the import list:

```js
    import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, where, enableIndexedDbPersistence, getDocs, setDoc, getDoc, increment } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
```

- [ ] **Step 2: Expose increment on the bridge**

Line 96, inside `window.firebaseMethods`:

```js
            collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, orderBy, where, getDocs, setDoc, getDoc, increment,
```

- [ ] **Step 3: Add the helper at Babel-script top level**

Immediately after `const db = window.db;` at line 429:

```js
        // The mobile app gates on teams/{id}.matchCount (useMatches.js:85), so the web app
        // must keep it accurate. Declared at top level so every view can call it.
        // A failure here must never block the match operation itself.
        const bumpMatchCount = async (teamId, delta) => {
            if (!teamId || !delta) return;
            const { doc: fsDoc, updateDoc: fsUpdate, increment: fsIncrement } = window.firebaseMethods;
            try {
                await fsUpdate(fsDoc(window.db, 'teams', teamId), { matchCount: fsIncrement(delta) });
            } catch (err) {
                console.warn('No se pudo actualizar matchCount:', err);
            }
        };
```

The aliases avoid shadowing the `doc` and `updateDoc` that individual components destructure locally.

- [ ] **Step 4: Verify increment is wired through**

```bash
grep -n "increment" basketball-manager/index.html
```

Expected: exactly three regions — the import at line 61, the bridge at line 96, and `bumpMatchCount`. Load the app and confirm the console shows no "increment is not a function" error.

- [ ] **Step 5: Increment on single match creation**

Line 3279, inside `MatchSetupView`:

```js
                        const docRef = await addDoc(collection(db, 'matches'), matchData);
                        await bumpMatchCount(matchData.teamId, 1);
```

- [ ] **Step 6: Increment on federation import**

Line 1348, inside `TeamDetailView`. The loop creates one match per new fixture; the surrounding function already keeps an `updated` tally, so add a `created` one beside it and bump once after the loop — one write instead of one per match.

Before the loop, next to the existing `let updated = 0;`:

```js
                        let created = 0;
```

Inside the `if (!existing) { ... }` branch, right after the `addDoc` that spreads `...federatedMatch`:

```js
                                created += 1;
```

After the loop closes, before the function reports its result:

```js
                        if (created > 0) await bumpMatchCount(team.id, created);
```

- [ ] **Step 7: Decrement on deletion**

Line 1294, inside `TeamDetailView`:

```js
                        deleteDoc(doc(db, 'matches', match.id))
                            .then(() => bumpMatchCount(match.teamId, -1))
                            .catch(err => alert('Error: ' + err.message));
```

Line 3602, inside `EditMatchView`:

```js
                            await deleteDoc(doc(db, 'matches', match.id));
                            await bumpMatchCount(match.teamId, -1);
```

- [ ] **Step 8: Verify, including the failure path**

Serve the app. Open the Firebase console on a team document and watch `matchCount`.

| Action | Expected |
|---|---|
| Create a match from the web | `matchCount` goes up by exactly 1 |
| Delete it | `matchCount` goes back down by 1 |
| Import 3 new fixtures from the FBCV | `matchCount` goes up by exactly 3, in a single write |

Then the failure path, which is Review Focus item 5: open DevTools, switch the network to offline, and delete a match. Expected: the deletion is queued by Firestore and the UI does not break; a warning appears in the console but no error dialog, and the app stays usable.

- [ ] **Step 9: Commit**

```bash
git add basketball-manager/index.html
git commit -m "fix(web): maintain teams/{id}.matchCount so the mobile limit holds"
```

---

### Task 5: Match limit and the x/8 counter

**Files:**
- Modify: `basketball-manager/index.html` — `TeamsListView` team cards, and the match creation entry point at `:3279`

**Interfaces:**
- Consumes: `premium` (Task 1), `openPremiumModal` (Task 3), `bumpMatchCount` (Task 4).
- Produces: nothing later tasks depend on. This is the last task.

- [ ] **Step 1: Add the real-count helper**

Next to `getSelectedTeam` at line 5466:

```js
            // Gate on the real number of matches rather than the stored counter, so the
            // limit is right even on teams whose matchCount drifted before Task 4 landed.
            const realMatchCount = (teamId) => matches.filter(m => m.teamId === teamId).length;
```

- [ ] **Step 2: Self-heal a drifted counter**

Extend the helper so that evaluating the limit also repairs a wrong stored value:

```js
            const checkMatchLimit = (team) => {
                const real = realMatchCount(team.id);
                if ((team.matchCount || 0) !== real) {
                    updateDoc(doc(db, 'teams', team.id), { matchCount: real })
                        .catch(err => console.warn('No se pudo corregir matchCount:', err));
                }
                return !premium.isPro && !premium.loading && real >= 8;
            };
```

- [ ] **Step 3: Pass the gate into MatchSetupView**

Line 3279 lives inside `MatchSetupView`, which already receives `team` but knows nothing about Premium. Extend its signature:

```js
        const MatchSetupView = ({ team, navigate, addDoc, collection, db, checkMatchLimit, openPremiumModal }) => {
```

And its render at line 5533:

```js
                            {view === 'match-setup' && <MatchSetupView team={getSelectedTeam()} navigate={navigate} addDoc={addDoc} collection={collection} db={db} updateDoc={updateDoc} doc={doc} checkMatchLimit={checkMatchLimit} openPremiumModal={openPremiumModal} />}
```

- [ ] **Step 4: Gate match creation**

Inside `MatchSetupView`, immediately before the `addDoc` at line 3279:

```js
                        if (checkMatchLimit(team)) {
                            openPremiumModal('match_limit');
                            return;
                        }
```

- [ ] **Step 5: Show the counter on team cards**

Inside the team card in `TeamsListView`, under the player count:

```js
                                {!premium.isPro && !premium.loading && (
                                    <p className="text-[11px] font-semibold text-slate-400">
                                        {Math.min(matches.filter(m => m.teamId === team.id).length, 8)}/8 partidos
                                    </p>
                                )}
```

- [ ] **Step 6: Verify**

As a free user on a team with 7 matches:

| Action | Expected |
|---|---|
| Look at the team card | Shows `7/8 partidos` |
| Create one more | Succeeds, card shows `8/8 partidos` |
| Try to create another | Modal opens with "Has usado los 8 partidos incluidos". No match is created. |
| Set the user to `pro` in Firestore | The counter disappears and matches can be created freely |

Then the drift repair: set `teams/{id}.matchCount` to a deliberately wrong value such as `99`, reload, and open the match creation screen. Expected: the stored value is corrected to the real count, and the limit behaves according to the real count rather than the 99.

- [ ] **Step 7: Run the full spec checklist**

Work through all ten checks in the spec's Section 5 end to end, in a single session, on both the web app and the mobile app. The point of this task is that the two now agree — check number 5 in particular, where flipping the Firestore flag must change both.

- [ ] **Step 8: Commit**

```bash
git add basketball-manager/index.html
git commit -m "feat(web): enforce the 8-match free limit with a x/8 counter"
```
