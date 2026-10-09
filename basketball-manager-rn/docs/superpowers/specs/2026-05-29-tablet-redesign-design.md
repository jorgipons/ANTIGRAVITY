# Tablet Redesign Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the app a professional tablet experience by replacing simple element scaling with real layout changes that take advantage of the larger screen.

**Architecture:** Two breakpoints — `IS_TABLET` (width > 600) and `IS_LANDSCAPE` (width > height) — combined into `IS_TABLET_LANDSCAPE` for the deepest layout changes. A shared `useLayout` hook centralizes these values. Navigation gains a persistent sidebar in tablet landscape. Key screens switch to two-column or grid layouts.

**Tech Stack:** React Native, Expo, useWindowDimensions, react-navigation (bottom tabs + stack), existing theme tokens in `src/theme/tokens.js`.

---

## Breakpoints & Hook

**File:** `src/hooks/useLayout.js` (new file)

```js
import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const IS_TABLET = width > 600;
  const IS_LANDSCAPE = width > height;
  const IS_TABLET_LANDSCAPE = IS_TABLET && IS_LANDSCAPE;
  return { IS_TABLET, IS_LANDSCAPE, IS_TABLET_LANDSCAPE, width, height };
}
```

All components import from this hook instead of computing their own breakpoints. `MatchMatrixScreen` already uses `useWindowDimensions` directly — it should be migrated to use this hook for consistency.

---

## AppDrawer — Persistent Sidebar (landscape tablet)

**File:** `src/components/AppDrawer.js`

**Behavior:**
- `IS_TABLET_LANDSCAPE = true` → sidebar is always rendered, no Modal wrapper, fixed left position, width 260px
- `IS_TABLET_LANDSCAPE = false` → existing modal drawer behavior (no changes)
- The sidebar content (brand, team cards, nav items) is identical in both modes

**Layout impact:** When the sidebar is persistent, the main navigation container must offset its content by 260px to the left. This is handled in `src/navigation/RootNavigation.js` by wrapping the navigator in a `View` with `marginLeft: IS_TABLET_LANDSCAPE ? 260 : 0` and rendering `<AppDrawer>` outside the navigator.

**Sidebar structure in persistent mode:**
- No `Modal`, no backdrop, no slide animation
- `View` with `width: 260`, `height: '100%'` — flex child in the row layout of RootNavigation
- Same `LinearGradient` and content as the modal version
- No close button (no need to dismiss)

---

## RootNavigation — Layout-aware wrapper

**File:** `src/navigation/RootNavigation.js`

- Import `useLayout` and render the persistent sidebar alongside the navigator when `IS_TABLET_LANDSCAPE`
- The root `View` uses `flexDirection: 'row'`: sidebar on left, navigator on right (flex: 1)
- In non-tablet-landscape, render nothing extra — AppDrawer is opened via hamburger button as today

---

## TeamsListScreen — 2-column grid

**File:** `src/screens/TeamsListScreen.js`

**Current:** Single-column `FlatList` of team cards.

**Tablet change:** `numColumns={IS_TABLET ? 2 : 1}` on the FlatList. Cards get `flex: 1` and a fixed `margin` so they fill the columns evenly. Card content unchanged.

**Portrait tablet:** 2 columns.
**Landscape tablet:** 2 columns (sidebar takes 260px, remaining width split in 2).

---

## MatchListScreen — 2-column grid

**File:** `src/screens/MatchListScreen.js`

**Current:** Single-column list of match cards.

**Tablet change:** `numColumns={IS_TABLET ? 2 : 1}`. Match cards get `flex: 1`. Each card shows: rival, date, time, home/away indicator, attendance status badge, match state chip. No new data is needed — all fields are already in the match object.

---

## TeamDetailScreen — Two-column layout (landscape tablet)

**File:** `src/screens/TeamDetailScreen.js`

**Current:** Vertical scroll with: player list section → team config section (name, roles) → federation section.

**Tablet landscape change:** Side-by-side layout using a `View` with `flexDirection: 'row'`:
- **Left column** (flex 1): Player list with add/edit player controls
- **Right column** (flex 1): Team config (name, roles) + federation section

**Portrait tablet:** Single column, same as mobile but with wider max-width (centered, `maxWidth: 680`, `alignSelf: 'center'`).

---

## MatchMatrixScreen — Side panel (landscape tablet)

**File:** `src/screens/MatchMatrixScreen.js`

**Current:** Full-width matrix with header stats above. Already has IS_TABLET scaling.

**Tablet landscape change:** Split into two panels side by side:
- **Left panel** (flex ~0.65): The existing matrix (header + scroll grid), unchanged logic
- **Right panel** (flex ~0.35): Match info sidebar with:
  - Current period indicator (large, tappable to advance period)
  - Score display (editable inputs for home/away score — stored in component state, not Firestore)
  - Injury list: players marked as injured for this match
  - Quick stats: each player's total periods played so far in this match

The right panel reads data that is already computed in the screen (player periods, injuries) — no new Firestore calls needed. Score is local state (not persisted).

**Portrait tablet:** Current IS_TABLET scaling remains, no panel split.

---

## CalendarScreen — Split view (landscape tablet)

**File:** `src/screens/CalendarScreen.js`

**Current:** Full-width calendar grid, tapping a day scrolls down to a match list below.

**Tablet landscape change:** Side-by-side layout:
- **Left panel** (fixed ~380px): Calendar grid, always visible
- **Right panel** (flex 1): Match list for the selected day (currently shown inline below calendar)

Selected day highlights and navigation stay the same. The right panel shows "Selecciona un día" when no day is active.

**Portrait tablet:** Single column, same as mobile.

---

## SettingsScreen — Centered max-width

**File:** `src/screens/SettingsScreen.js`

**Current:** Full-width content, stretches on tablet.

**Tablet change:** Wrap content in a `View` with `maxWidth: 600` and `alignSelf: 'center'`. No layout split needed — settings content is short and form-like.

---

## Scope boundaries

- **No changes to mobile layout** — all changes are behind `IS_TABLET` or `IS_TABLET_LANDSCAPE` guards
- **No new Firestore reads** — all data shown in new panels/columns is already fetched by the screen
- **Score in MatchMatrixScreen right panel is local state** — not persisted (out of scope)
- **MatchAttendanceScreen excluded** — it's a public page accessed via deep link, different audience
- **LoginScreen excluded** — shown before auth, no tablet-specific needs
