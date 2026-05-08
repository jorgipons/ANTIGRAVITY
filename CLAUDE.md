# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Monorepo for **Gestor Basket Pasarela** — a basketball team management system for coaches following FBCV (Valencian Basketball Federation) "Pasarela" regulations. Three projects share the same Firebase backend (`basketmanager-ed370`):

| Directory | Tech | Purpose |
|---|---|---|
| `basketball-manager/` | Vanilla JS PWA | Original web app (GitHub Pages) |
| `basketball-manager-rn/` | Expo (React Native) | Mobile app (iOS/Android/Web) |
| `basketball-trainer/` | Vanilla JS | Training drill planner |

## Development Commands

```bash
# React Native app (primary active development)
cd basketball-manager-rn
npm start              # Expo dev server
npm run android        # Android emulator/device
npm run ios            # iOS simulator
npm run web            # Web browser

# No test suite, linter, or CI pipeline configured
```

## Architecture — React Native App (`basketball-manager-rn/`)

### Navigation (RootNavigation.js)
- Unauthenticated: `LoginScreen` (Google OAuth)
- Authenticated tabs: `TeamsListScreen` → `TeamDetailScreen` → `MatchListScreen` → `MatchMatrixScreen`
- Public deep link: `basketballmanager://match/:teamId/:matchId` → `MatchAttendanceScreen`
- `CalendarScreen` aggregates matches across all user teams

### State Management
No Redux/Zustand. Custom hooks with Firestore `onSnapshot` real-time listeners:
- `useAuth` — Firebase auth state
- `useTeams` — CRUD + real-time for teams owned by current user
- `useMatches` — CRUD + real-time for matches of a specific team
- `useAllMatches` — Cross-team match aggregation (calendar)
- `usePushNotifications` — Expo push token registration

### Firebase Collections
- `teams` — `{ name, ownerId, players[], ruleset, federationId? }`
- `matches` — `{ teamId, opponent, date, time, history{}, attendance{}, players[] }`
- `userTokens` — Push notification tokens

### Key Business Logic
- **Pasarela ruleset** (`constants/ruleset.js`): 8 periods, checkpoint at period 6, min 2 / max 3 play in first 6, min 2 rest. Validation drives the color-coded matrix in `MatchMatrixScreen`.
- **Federation sync** (`utils/federation.js`): Imports matches from FBCV API (`esb.optimalwayconsulting.com`) with smart duplicate detection.
- **Roles** (`constants/roles.js`): Basketball positions (base, escolta, alero, ala-pivot, pivot, receptor) with colors. Teams can have custom roles from the PWA.

### Patterns
- All data flows through Firebase — no local-only state for persisted data
- Modal-based create/edit workflows inside screens (not separate routes)
- Platform-aware code: `Platform.OS` checks for web vs native (auth, clipboard, notifications)
- Responsive: `Dimensions.get('window').width > 600` for tablet adaptations in MatchMatrixScreen

## Web PWA (`basketball-manager/`)

Single-page vanilla JS app. No build step — edit files directly. Deployed to GitHub Pages at `jorgipons.github.io/ANTIGRAVITY/basketball-manager/`. Shares Firestore collections with the RN app (same data model). Key file is `SubstitutionView.js` for the match matrix.

## Language

The app UI and code comments are in **Spanish**. Variable names and function names are in English.
