# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm start          # Expo dev server (choose platform interactively)
npm run android    # Launch on Android emulator/device
npm run ios        # Launch on iOS simulator
npm run web        # Launch in browser

# No test suite or linter configured
```

## Architecture

### Navigation Flow (`src/navigation/RootNavigation.js`)
- Unauthenticated → `LoginScreen` (Google OAuth)
- Authenticated bottom tabs: **TeamsTab** (`TeamsListScreen`) | **SettingsTab** (`SettingsScreen`)
- Stack pushes from Teams tab: `TeamDetail` → `MatchList` → `MatchMatrix`
- `Calendar` screen accessible from authenticated stack
- `MatchAttendance` is publicly accessible via deep link `basketballmanager://match/:teamId/:matchId`

### State Management
No global state library. Each screen subscribes directly to Firestore via custom hooks:
- `useAuth` — Firebase auth state
- `useTeams` — CRUD + real-time listener for teams owned by current user
- `useMatches(teamId)` — CRUD + real-time listener for a specific team's matches; sorts by date in memory (no Firestore `orderBy`)
- `useAllMatches` — cross-team aggregation for the calendar view
- `usePushNotifications(user)` — registers Expo push token in `userTokens` collection

### Firestore Data Model
- `teams`: `{ name, ownerId, players[], ruleset, federationId?, roles? }`
  - `players[]`: array of `{ id, name, number, role }` embedded in the team document
  - `roles`: optional map of custom roles from the PWA, with Tailwind class strings
- `matches`: `{ teamId, opponent, date, time, callTime, location, isHome, state, currentPeriod, history{}, attendance{}, players[], injuries[], score?, result?, federationMatchId? }`
  - `history`: `{ [periodNumber]: [{id, role}] }` — array format; legacy object-map format is normalized on read in `MatchMatrixScreen`
  - `attendance`: `{ [playerId]: { status, timestamp } }` — status is `'available'` | `'unavailable'` | `'unknown'`

### Key Business Logic

**Pasarela Ruleset** (`src/constants/ruleset.js`): FBCV regulation for youth basketball. 8 periods total, checkpoint at period 6. Each player must play min 2, max 3 periods in the first 6, and must rest min 2 periods. `validatePlayerSelection` enforces this in real-time; `getPlayerStatusClasses` returns `'valid'` | `'error'` | `'empty'` for color coding.

**MatchMatrixScreen** (`src/screens/MatchMatrixScreen.js`): The core coaching screen. Displays players × periods grid with ruleset validation colors. Has three view modes (matrix, compact, list) and a free-edit toggle that bypasses ruleset validation. Responsive: `SCREEN_WIDTH > 600` switches to tablet layout. Synchronizes header and body horizontal scroll.

**Federation Sync** (`src/utils/federation.js`): Fetches from FBCV API (`esb.optimalwayconsulting.com`). Responses are base64-encoded UTF-8 JSON. Two functions: `importFederationMatches` (imports schedule with 3 modes: `smart`/`next`/`total`) and `syncWithFederation` (fetches team metadata + standings).

**Roles** (`src/constants/roles.js`): 6 default positions (base, escolta, alero, alapivot, pivot, receptor). `getRoleConfig(team, roleKey)` falls back gracefully — custom PWA roles use Tailwind class strings (`text-blue-600`, `bg-blue-50`) that are converted to hex on read.

**Sharing** (`src/utils/sharing.js`): Generates WhatsApp-ready match info text in Spanish or Valencian. Attendance public link points to the PWA at `jorgipons.github.io/ANTIGRAVITY/basketball-manager/`.

### Platform-Specific Code
- Auth: `@react-native-google-signin/google-signin` on native vs `expo-auth-session` on web
- Clipboard: `expo-clipboard` with `Platform.OS` guards
- Push notifications: `expo-notifications` (no-op on web)
- Deep linking: configured in `RootNavigation.js` — update `'https://tu-dominio.com'` prefix when deploying

## Language
UI strings and code comments are in **Spanish/Valencian**. Variable/function names are in English.
