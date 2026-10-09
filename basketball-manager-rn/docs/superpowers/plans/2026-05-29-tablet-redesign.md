# Tablet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a professional tablet experience by replacing simple element scaling with real layout changes — persistent sidebar in landscape, 2-column grids, and split-panel screens.

**Architecture:** A shared `useLayout` hook provides `IS_TABLET`, `IS_LANDSCAPE`, and `IS_TABLET_LANDSCAPE` to all screens. In tablet landscape, `RootNavigation` renders a persistent sidebar (flex row with `AppDrawer`) alongside the main navigator. Each screen adds tablet-specific layout using these flags. All changes are guarded behind breakpoint checks so mobile is unaffected.

**Tech Stack:** React Native, Expo, `useWindowDimensions`, react-navigation v6 (`@react-navigation/native`), existing `src/theme/tokens.js`.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/hooks/useLayout.js` | Create | Shared breakpoint hook |
| `src/components/AppDrawer.js` | Modify | Add `persistent` prop for sidebar-as-view mode |
| `src/navigation/RootNavigation.js` | Modify | Flex-row wrapper + persistent sidebar in tablet landscape |
| `src/screens/TeamsListScreen.js` | Modify | 2-column FlatList + hide hamburger in tablet landscape |
| `src/screens/MatchListScreen.js` | Modify | 2-column flex-wrap list + hide hamburger in tablet landscape |
| `src/screens/TeamDetailScreen.js` | Modify | Two-column layout in tablet landscape + hide hamburger |
| `src/screens/MatchMatrixScreen.js` | Modify | Right info panel in tablet landscape + hide hamburger |
| `src/screens/CalendarScreen.js` | Modify | Split calendar+list view in tablet landscape + hide hamburger |
| `src/screens/SettingsScreen.js` | Modify | Centered max-width + hide hamburger in tablet landscape |

---

## Task 1: useLayout hook

**Files:**
- Create: `src/hooks/useLayout.js`

No test suite — verify by importing in a screen and checking the values in the web browser at different widths.

- [ ] **Step 1: Create the hook file**

```js
// src/hooks/useLayout.js
import { useWindowDimensions } from 'react-native';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const IS_TABLET = width > 600;
  const IS_LANDSCAPE = width > height;
  const IS_TABLET_LANDSCAPE = IS_TABLET && IS_LANDSCAPE;
  return { IS_TABLET, IS_LANDSCAPE, IS_TABLET_LANDSCAPE, width, height };
}
```

- [ ] **Step 2: Verify it runs in the web browser**

Run `npm run web` in `basketball-manager-rn/`. Open browser, open DevTools → no errors in console related to `useLayout`.

---

## Task 2: AppDrawer — persistent mode

**Files:**
- Modify: `src/components/AppDrawer.js`

The drawer currently always renders as a `Modal`. We need it to support a `persistent` prop that renders a plain `View` instead (for the sidebar-in-layout case). When NOT persistent and in tablet landscape, it returns null (the persistent sidebar from RootNavigation is shown instead).

- [ ] **Step 1: Import useLayout in AppDrawer**

At the top of `src/components/AppDrawer.js`, after the existing imports, add:

```js
import { useLayout } from '../hooks/useLayout';
```

- [ ] **Step 2: Add `persistent` param and early returns**

Inside `AppDrawer({ visible, onClose, navigation })`, add `persistent = false` to the params and the two early returns BEFORE the existing `if (!rendered) return null;`:

```js
export default function AppDrawer({ visible, onClose, navigation, persistent = false }) {
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const { IS_TABLET_LANDSCAPE } = useLayout();

  const { teams, loading: teamsLoading } = useTeams();
  const { matches } = useAllMatches();
  // ... rest of existing state unchanged ...

  // Persistent sidebar mode — plain View, no animation, no modal
  if (persistent) {
    return (
      <View style={styles.persistentSidebar}>
        <LinearGradient
          colors={['#1E4A8F', '#122850']}
          style={[styles.drawerInner, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Grid bg */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgPattern id="dgp" width="14" height="14" patternUnits="userSpaceOnUse">
                  <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
                </SvgPattern>
              </Defs>
              <SvgRect width="100%" height="100%" fill="url(#dgp)" opacity={0.05} />
            </Svg>
          </View>
          {sidebarContent()}
        </LinearGradient>
      </View>
    );
  }

  // In tablet landscape, the persistent sidebar (rendered by RootNavigation) is shown.
  // This instance (opened from a screen as a modal) should render nothing.
  if (IS_TABLET_LANDSCAPE && !persistent) {
    return null;
  }

  // Modal mode — existing code follows unchanged
  if (!rendered) return null;
  return (
    <Modal ...>
      ...
    </Modal>
  );
```

- [ ] **Step 3: Extract sidebar content into a `sidebarContent()` function**

The JSX inside `<LinearGradient>` in the modal version is duplicated in the persistent version. Extract it into a function defined inside the component (closure, so it has access to all state/handlers):

```js
  const sidebarContent = () => (
    <>
      {/* Brand */}
      <View style={styles.brandSection}>
        <Image
          source={require('../../assets/icon-white.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>
            partits<Text style={{ color: T.orange }}>.</Text>
          </Text>
          <Text style={styles.brandSub}>Gestor Basket</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Mis Equipos */}
      <TouchableOpacity style={styles.navItem} onPress={() => navTo('TeamsTab')}>
        <View style={styles.navIconBox}>
          <Home color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Mis Equipos</Text>
      </TouchableOpacity>

      {/* Team cards */}
      {!teamsLoading && teams.map(team => {
        const nextMatch = nextMatchByTeam[team.id];
        const formattedDate = nextMatch
          ? new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
          : null;
        return (
          <TouchableOpacity key={team.id} style={styles.teamCard} onPress={() => navTo('TeamDetail', { teamId: team.id })} activeOpacity={0.75}>
            <View style={styles.teamCardHeader}>
              <View style={styles.teamDot} />
              <Text style={styles.teamCardName} numberOfLines={1}>{team.name}</Text>
            </View>
            {nextMatch ? (
              <>
                <Text style={styles.teamCardMatchText} numberOfLines={1}>
                  {nextMatch.isHome ? '🏠' : (nextMatch.transportType === 'car' ? '🚗' : '🚌')} {nextMatch.opponent} · {formattedDate} · {nextMatch.time}h
                </Text>
                <View style={styles.teamCardActions}>
                  <TouchableOpacity
                    style={styles.teamCardBtn}
                    onPress={() => navTo('MatchAttendance', { matchId: nextMatch.id, teamId: team.id })}
                  >
                    <Users size={12} color="rgba(255,255,255,0.65)" strokeWidth={1.8} />
                    <Text style={styles.teamCardBtnText}>Asistencia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.teamCardBtn, styles.teamCardBtnAccent]}
                    onPress={() => navTo('MatchMatrix', { matchId: nextMatch.id, teamId: team.id })}
                  >
                    <Play size={11} color={T.orange} strokeWidth={2} fill={T.orange} />
                    <Text style={[styles.teamCardBtnText, { color: T.orange }]}>Partido</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.teamCardEmpty}>Sin partidos próximos</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('Calendar')}>
        <View style={styles.navIconBox}>
          <Calendar color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Calendario</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('Help')}>
        <View style={styles.navIconBox}>
          <HelpCircle color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Cómo usar</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('SettingsTab')}>
        <View style={styles.navIconBox}>
          <Settings color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Ajustes</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
        <View style={[styles.navIconBox, styles.logoutIconBox]}>
          <LogOut color={T.neg} size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      </TouchableOpacity>
    </>
  );
```

Replace the JSX inside the existing `<LinearGradient>` in the Modal section with `{sidebarContent()}`.

- [ ] **Step 4: Add `persistentSidebar` style**

In the `StyleSheet.create({...})` at the bottom of AppDrawer, add:

```js
persistentSidebar: {
  width: DRAWER_WIDTH,
  height: '100%',
},
```

- [ ] **Step 5: Verify in web browser**

Run `npm run web`. Resize browser to > 600px wide AND landscape (wider than tall). The sidebar should appear fixed on the left. Resize to portrait — sidebar should disappear (hidden by the `IS_TABLET_LANDSCAPE && !persistent` guard, while the persistent one from RootNavigation is not yet wired in — that's Task 3).

---

## Task 3: RootNavigation — layout-aware wrapper

**Files:**
- Modify: `src/navigation/RootNavigation.js`

- [ ] **Step 1: Add imports**

```js
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { View } from 'react-native';
import { useLayout } from '../hooks/useLayout';
import AppDrawer from '../components/AppDrawer';
```

(AppDrawer is not currently imported in RootNavigation — add it.)

- [ ] **Step 2: Add hook calls in the `RootNavigation` component**

Inside `export default function RootNavigation()`, before the `useEffect`:

```js
const { IS_TABLET_LANDSCAPE } = useLayout();
const navigationRef = useNavigationContainerRef();
```

- [ ] **Step 3: Replace the return statement**

Replace the existing `return (...)` in `RootNavigation` with:

```js
  if (!isReady) return null;

  return (
    <View style={{ flex: 1, flexDirection: IS_TABLET_LANDSCAPE ? 'row' : 'column' }}>
      {IS_TABLET_LANDSCAPE && (
        <AppDrawer
          persistent
          visible={true}
          onClose={() => {}}
          navigation={navigationRef}
        />
      )}
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          initialState={initialState}
          onStateChange={handleStateChange}
        >
          <AppNavigator />
        </NavigationContainer>
      </View>
    </View>
  );
```

- [ ] **Step 4: Verify in web browser**

Run `npm run web`. Resize to tablet landscape (e.g. 900×600px). The sidebar should appear on the left as a persistent column, and the main app content on the right. Navigating from sidebar items should work. Resize to portrait — sidebar disappears and the app renders full-width.

---

## Task 4: TeamsListScreen — 2-column grid + hide hamburger

**Files:**
- Modify: `src/screens/TeamsListScreen.js`

- [ ] **Step 1: Add useLayout import and hook call**

At the top of `TeamsListScreen.js`, add:
```js
import { useLayout } from '../hooks/useLayout';
```

Inside `export default function TeamsListScreen()`, add near the top:
```js
const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
```

- [ ] **Step 2: Hide hamburger button in tablet landscape**

Find the `<TouchableOpacity ref={menuBtnRef} style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>` in the header. Wrap it:

```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity ref={menuBtnRef} style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
    <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Update the FlatList for 2-column tablet layout**

Find the `<FlatList` (around line 254). Replace it with:

```jsx
<FlatList
  key={IS_TABLET ? 'tablet' : 'mobile'}
  data={teams}
  keyExtractor={(item) => item.id}
  renderItem={renderTeamCard}
  numColumns={IS_TABLET ? 2 : 1}
  contentContainerStyle={styles.listContainer}
  showsVerticalScrollIndicator={false}
/>
```

The `key` prop forces a remount when `numColumns` changes (required by React Native).

- [ ] **Step 4: Update renderTeamCard to support 2-column flex**

Find the `renderTeamCard` function (around line 170–202). The outer `TouchableOpacity` needs `flex: 1` in tablet mode. Update it:

```jsx
const renderTeamCard = ({ item }) => (
  <TouchableOpacity
    style={[styles.teamCard, IS_TABLET && styles.teamCardTablet]}
    onPress={() => navigation.navigate('TeamDetail', { teamId: item.id })}
    activeOpacity={0.88}
  >
    {/* rest of card content unchanged */}
  </TouchableOpacity>
);
```

Add the tablet card style in `StyleSheet.create`:

```js
teamCardTablet: {
  flex: 1,
  margin: 6,
},
```

Also adjust `listContainer` to add horizontal padding for the grid:

```js
listContainer: {
  padding: 12,
},
```

- [ ] **Step 5: Suppress AppDrawer in tablet landscape**

The `<AppDrawer>` at line 230 is already handled by the `IS_TABLET_LANDSCAPE && !persistent` guard in Task 2 (returns null). No change needed here.

- [ ] **Step 6: Verify in web browser**

Run `npm run web`. At > 600px wide: teams should render in 2 columns. At < 600px: single column. At tablet landscape: hamburger is hidden and sidebar is persistent (from Task 3).

---

## Task 5: MatchListScreen — 2-column list + hide hamburger

**Files:**
- Modify: `src/screens/MatchListScreen.js`

MatchListScreen uses a `ScrollView` with manual `.map()`, not a FlatList. For 2-column, we use `flexWrap: 'wrap'` on the upcoming and played match lists.

- [ ] **Step 1: Add useLayout import and hook call**

```js
import { useLayout } from '../hooks/useLayout';
```

Inside `export default function MatchListScreen()`, add:
```js
const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
```

- [ ] **Step 2: Hide hamburger button in tablet landscape**

Find the `<TouchableOpacity ref={menuBtnRef} style={s.backBtn} onPress={() => setDrawerOpen(true)}>` inside the header. Wrap it:

```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity ref={menuBtnRef} style={s.backBtn} onPress={() => setDrawerOpen(true)}>
    <Menu color="#fff" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Wrap upcoming "other matches" list in 2-column container on tablet**

Find the `{upcomingOthers.map(m => (` block inside the "Partidos programados" section (around line 379). Replace the outer `View` wrapping that `.map()`:

```jsx
{upcomingOthers.length > 0 && (
  <View style={{ paddingHorizontal: 14, marginTop: 18 }}>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>Partidos programados</Text>
    </View>
    <View style={IS_TABLET ? s.twoColGrid : null}>
      {upcomingOthers.map(m => (
        <TouchableOpacity
          key={m.id}
          style={[s.upcomingRow, IS_TABLET && s.upcomingRowTablet]}
          onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId })}
          activeOpacity={0.7}
        >
          {/* existing content unchanged */}
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

- [ ] **Step 4: Wrap played matches list in 2-column container on tablet**

Find the `{playedMatches.map(m => {` block inside "Últimos resultados". Wrap the outer container with the 2-column grid, and add the tablet card style to the `TouchableOpacity` that has `style={s.playedRow}`:

```jsx
<View style={IS_TABLET ? s.twoColGrid : null}>
  {playedMatches.map(m => {
    // ... existing derived variables (won, sc, ourScore, etc.) unchanged ...
    return (
      <TouchableOpacity
        key={m.id}
        style={[s.playedRow, IS_TABLET && s.twoColCard]}
        onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId })}
        activeOpacity={0.7}
      >
        {/* existing content unchanged */}
      </TouchableOpacity>
    );
  })}
</View>
```

Add `twoColCard` to the styles:
```js
twoColCard: {
  width: '50%',
  paddingRight: 6,
},
```

- [ ] **Step 5: Add 2-column styles**

In the `StyleSheet.create` at the bottom of MatchListScreen, add:

```js
twoColGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
},
upcomingRowTablet: {
  width: '50%',
  paddingRight: 6,
},
```

For played match cards, find their style name (look for the TouchableOpacity wrapping played matches) and add a similar `width: '50%'` tablet variant.

- [ ] **Step 6: Verify in web browser**

Run `npm run web`. At tablet width (>600px): upcoming and played match cards should flow in 2 columns. Mobile unchanged.

---

## Task 6: TeamDetailScreen — two-column layout (landscape tablet)

**Files:**
- Modify: `src/screens/TeamDetailScreen.js`

The main `ScrollView` (line 426) contains all sections stacked vertically. In tablet landscape, we split into two columns: left = players, right = fed card + next match + matches.

- [ ] **Step 1: Add useLayout import and hook call**

```js
import { useLayout } from '../hooks/useLayout';
```

Inside `export default function TeamDetailScreen()`, add:
```js
const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
```

- [ ] **Step 2: Hide hamburger button in tablet landscape**

Find the `<TouchableOpacity ... onPress={() => setDrawerOpen(true)}>` with the `<Menu>` icon in the header (around line 400). Wrap it:

```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity ref={menuBtnRef} style={styles.headerIconBtn} onPress={() => setDrawerOpen(true)}>
    <Menu color="rgba(255,255,255,0.7)" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Replace the main ScrollView with a layout-aware container**

The current structure (line 426+) is:
```jsx
<ScrollView ref={scrollRef} style={styles.container} ...>
  {/* Fed card */}
  {/* Next match card */}
  {/* Matches section */}
  {/* Players section */}
</ScrollView>
```

Replace with a conditional layout:

```jsx
{IS_TABLET_LANDSCAPE ? (
  /* Two-column layout for tablet landscape */
  <View style={styles.twoColContainer}>
    {/* Left column: Players */}
    <ScrollView style={styles.twoColLeft} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      <View ref={playersSectRef} style={styles.sectionRow} onLayout={(e) => setPlayersSectionY(e.nativeEvent.layout.y)}>
        <Text style={styles.sectionTitle}>Jugadores ({sortedPlayers.length})</Text>
        <TouchableOpacity ref={addPlayerBtnRef} onPress={() => openPlayerModal()} style={styles.addLinkBtn}>
          <Plus color={T.orange} size={16} />
          <Text style={styles.addLinkText}>Añadir</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.playersGrid}>
        {sortedPlayers.map(item => {
          const roleConf = getRoleConfig(team, item.role || 'receptor');
          return (
            <View key={item.id} style={styles.playerCard}>
              <View style={styles.playerNumBox}>
                <Text style={styles.playerNum}>{item.number}</Text>
              </View>
              <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.playerRoleDot, { backgroundColor: roleConf?.bg }]}>
                <Text style={[styles.playerRoleText, { color: roleConf?.color }]}>{roleConf?.label?.[0]}</Text>
              </View>
              <TouchableOpacity onPress={() => openPlayerModal(item)} style={styles.playerEditBtn}>
                <Edit2 color={T.borderHard} size={15} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </ScrollView>

    {/* Right column: Fed card + Next match + Matches */}
    <ScrollView style={styles.twoColRight} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
      {/* Federation Card */}
      {team.federationId && (
        <View ref={fedCardRef} style={[styles.fedCard, syncMenuVisible && { zIndex: 1000, elevation: 10 }]}>
          {/* existing fed card content unchanged */}
        </View>
      )}

      {/* Next match card */}
      {nextMatch && (
        <TouchableOpacity
          style={styles.nextMatchCard}
          onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
          activeOpacity={0.85}
        >
          {/* existing next match content unchanged */}
        </TouchableOpacity>
      )}

      {/* Matches Section */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Partidos</Text>
        <TouchableOpacity style={styles.addLinkBtn} onPress={() => navigation.navigate('MatchList', { teamId })}>
          <Plus color={T.orange} size={16} />
          <Text style={styles.addLinkText}>Nuevo Partido</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.matchesSection}>
        {/* existing matches section content unchanged */}
      </View>
    </ScrollView>
  </View>
) : (
  /* Single column layout — existing ScrollView */
  <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false} ...>
    {/* existing content unchanged */}
  </ScrollView>
)}
```

- [ ] **Step 4: Add two-column styles**

In the `StyleSheet.create` at the bottom of TeamDetailScreen, add:

```js
twoColContainer: {
  flex: 1,
  flexDirection: 'row',
},
twoColLeft: {
  flex: 1,
  borderRightWidth: 1,
  borderRightColor: T.border,
},
twoColRight: {
  flex: 1,
},
```

- [ ] **Step 5: Portrait tablet — wider max-width**

In the single-column path, the existing `ScrollView` content can be centered. Wrap the `contentContainerStyle` to add max-width on tablet portrait:

```js
contentContainerStyle={[styles.contentContainer, IS_TABLET && !IS_TABLET_LANDSCAPE && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}
```

- [ ] **Step 6: Verify in web browser**

Run `npm run web`. At tablet landscape (>600px wide, wider than tall): two-column layout with players on left, team config on right. At portrait tablet: single column, centered with max-width. At mobile: unchanged.

---

## Task 7: MatchMatrixScreen — right info panel (landscape tablet)

**Files:**
- Modify: `src/screens/MatchMatrixScreen.js`

In tablet landscape, the matrix takes the left 65% of the screen and a new info panel takes the right 35%. The panel shows: current period, score (local state), injuries, and quick player stats.

- [ ] **Step 1: Replace direct useWindowDimensions with useLayout**

At the top of `MatchMatrixScreen.js`, the screen already uses `useWindowDimensions`. Update to use `useLayout` as the single source of truth:

```js
import { useLayout } from '../hooks/useLayout';
```

Replace:
```js
const { width: SCREEN_WIDTH } = useWindowDimensions();
const IS_TABLET = SCREEN_WIDTH > 600;
```

With:
```js
const { IS_TABLET, IS_TABLET_LANDSCAPE, width: SCREEN_WIDTH } = useLayout();
```

- [ ] **Step 2: Adjust COLUMN_WIDTH for tablet landscape split**

The current COLUMN_WIDTH uses `SCREEN_WIDTH`. In tablet landscape, the matrix only gets 65% of the screen. Update:

```js
const MATRIX_WIDTH = IS_TABLET_LANDSCAPE ? SCREEN_WIDTH * 0.65 : SCREEN_WIDTH;
const NAME_COLUMN_WIDTH = IS_TABLET ? 180 : 140;
const COLUMN_WIDTH = (IS_TABLET || isLibre)
  ? Math.floor((MATRIX_WIDTH - NAME_COLUMN_WIDTH) / (totalPeriods + 1))
  : 44;
```

- [ ] **Step 3: Add score local state**

Below the existing `useState` declarations (around line 108), add:

```js
const [score, setScore] = useState({ home: '', away: '' });
```

- [ ] **Step 4: Hide hamburger in tablet landscape**

Find `<TouchableOpacity ref={menuBtnRef} style={styles.backBtn} onPress={() => setDrawerOpen(true)}>` (around line 1043). Wrap it:

```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity ref={menuBtnRef} style={styles.backBtn} onPress={() => setDrawerOpen(true)}>
    <Menu color="#fff" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 5: Wrap matrixWrapper in a row for tablet landscape**

Find the `{/* ══ Matrix ══ */}` section (around line 1108). Replace:

```jsx
{/* ══ Matrix ══════════════════════════════════════════════════ */}
<View style={styles.matrixWrapper}>
  {/* ... existing matrix content ... */}
</View>
```

With:

```jsx
{/* ══ Matrix + right panel ══════════════════════════════════ */}
<View style={IS_TABLET_LANDSCAPE ? styles.matrixRow : null}>
  <View style={[styles.matrixWrapper, IS_TABLET_LANDSCAPE && { flex: 0.65 }]}>
    {/* existing matrix content unchanged */}
  </View>

  {IS_TABLET_LANDSCAPE && (
    <View style={styles.rightPanel}>
      {/* Current period */}
      <View style={styles.rpSection}>
        <Text style={styles.rpLabel}>PERIODO ACTUAL</Text>
        <View style={styles.rpPeriodRow}>
          <Text style={styles.rpPeriodNum}>{match.currentPeriod || 1}</Text>
          <Text style={styles.rpPeriodOf}>/ {totalPeriods}</Text>
        </View>
      </View>

      <View style={styles.rpDivider} />

      {/* Score */}
      <View style={styles.rpSection}>
        <Text style={styles.rpLabel}>MARCADOR</Text>
        <View style={styles.rpScoreRow}>
          <View style={styles.rpScoreBox}>
            <Text style={styles.rpScoreTeam} numberOfLines={1}>
              {match.isHome ? (team?.name || 'Local').split(' ')[0] : 'Rival'}
            </Text>
            <TextInput
              style={styles.rpScoreInput}
              value={score.home}
              onChangeText={v => setScore(s => ({ ...s, home: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              maxLength={3}
              placeholder="0"
              placeholderTextColor={T.textFaint}
            />
          </View>
          <Text style={styles.rpScoreSep}>–</Text>
          <View style={styles.rpScoreBox}>
            <Text style={styles.rpScoreTeam} numberOfLines={1}>
              {match.isHome ? 'Rival' : (team?.name || 'Visitante').split(' ')[0]}
            </Text>
            <TextInput
              style={styles.rpScoreInput}
              value={score.away}
              onChangeText={v => setScore(s => ({ ...s, away: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              maxLength={3}
              placeholder="0"
              placeholderTextColor={T.textFaint}
            />
          </View>
        </View>
      </View>

      <View style={styles.rpDivider} />

      {/* Player quick stats */}
      <View style={styles.rpSection}>
        <Text style={styles.rpLabel}>MINUTOS JUGADOS</Text>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {sortedPlayers.map(p => {
            const periodsPlayed = [...Array(totalPeriods)].filter((_, i) => {
              const periodArray = match.history[i + 1] || [];
              return periodArray.some(e => (typeof e === 'object' ? e.id : e) === p.id);
            }).length;
            const roleConf = getRoleConfig(team, p.role || 'receptor');
            return (
              <View key={p.id} style={styles.rpPlayerRow}>
                <View style={[styles.rpRoleChip, { backgroundColor: roleConf?.bg }]}>
                  <Text style={[styles.rpRoleChipText, { color: roleConf?.color }]}>
                    {roleConf?.label?.[0]}
                  </Text>
                </View>
                <Text style={styles.rpPlayerName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rpPlayerPeriods}>{periodsPlayed}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Injuries */}
      {match.injuries && match.injuries.length > 0 && (
        <>
          <View style={styles.rpDivider} />
          <View style={styles.rpSection}>
            <Text style={styles.rpLabel}>LESIONES</Text>
            {match.injuries.map((inj, i) => (
              <Text key={i} style={styles.rpInjuryText} numberOfLines={1}>⚠ {inj.name || inj.playerId}</Text>
            ))}
          </View>
        </>
      )}
    </View>
  )}
</View>
```

- [ ] **Step 6: Add right panel styles**

In `createStyles(COLUMN_WIDTH, NAME_COLUMN_WIDTH, IS_TABLET)` at the bottom of the file, add these styles:

```js
matrixRow: {
  flex: 1,
  flexDirection: 'row',
},
rightPanel: {
  flex: 0.35,
  backgroundColor: T.white,
  borderLeftWidth: 1,
  borderLeftColor: T.border,
  paddingTop: 12,
  paddingBottom: 12,
},
rpSection: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  flex: 1,
},
rpLabel: {
  fontFamily: T.fontSemi,
  fontSize: 9,
  color: T.textFaint,
  letterSpacing: 0.8,
  marginBottom: 8,
},
rpDivider: {
  height: 1,
  backgroundColor: T.border,
  marginHorizontal: 16,
},
rpPeriodRow: {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 4,
},
rpPeriodNum: {
  fontFamily: T.fontBlack,
  fontSize: 48,
  color: T.orange,
  lineHeight: 52,
},
rpPeriodOf: {
  fontFamily: T.fontReg,
  fontSize: 16,
  color: T.textSub,
},
rpScoreRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
rpScoreBox: {
  flex: 1,
  alignItems: 'center',
},
rpScoreTeam: {
  fontFamily: T.fontSemi,
  fontSize: 9,
  color: T.textSub,
  letterSpacing: 0.4,
  marginBottom: 4,
},
rpScoreInput: {
  fontFamily: T.fontBlack,
  fontSize: 36,
  color: T.ink,
  textAlign: 'center',
  borderBottomWidth: 2,
  borderBottomColor: T.border,
  width: 70,
  paddingVertical: 4,
},
rpScoreSep: {
  fontFamily: T.fontBlack,
  fontSize: 28,
  color: T.textFaint,
},
rpPlayerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  paddingVertical: 4,
},
rpRoleChip: {
  width: 18,
  height: 18,
  borderRadius: 4,
  alignItems: 'center',
  justifyContent: 'center',
},
rpRoleChipText: {
  fontFamily: T.fontBlack,
  fontSize: 9,
},
rpPlayerName: {
  flex: 1,
  fontFamily: T.fontReg,
  fontSize: 12,
  color: T.text,
},
rpPlayerPeriods: {
  fontFamily: T.fontBlack,
  fontSize: 14,
  color: T.ink,
  minWidth: 20,
  textAlign: 'right',
},
rpInjuryText: {
  fontFamily: T.fontReg,
  fontSize: 12,
  color: T.neg,
  paddingVertical: 3,
},
```

- [ ] **Step 7: Verify in web browser**

Run `npm run web`. At tablet landscape (>600px, landscape): matrix on left ~65%, right info panel visible on the right with period number, score inputs, and player stats. At portrait tablet: no right panel, matrix takes full width.

---

## Task 8: CalendarScreen — split view (landscape tablet)

**Files:**
- Modify: `src/screens/CalendarScreen.js`

In tablet landscape, show the calendar on the left and the match list for the selected day on the right. On mobile/portrait, keep the existing scrollable layout.

- [ ] **Step 1: Add useLayout import, hook call, and selectedDay state**

```js
import { useLayout } from '../hooks/useLayout';
```

Inside `export default function CalendarScreen()`, add:
```js
const { IS_TABLET_LANDSCAPE } = useLayout();
const [selectedDay, setSelectedDay] = useState(null);
```

- [ ] **Step 2: Hide hamburger in tablet landscape**

Find the menu button `<TouchableOpacity ref={menuBtnRef} onPress={() => setDrawerOpen(true)}>`. Wrap it:
```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity ref={menuBtnRef} onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
    <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Add `onDayPress` to CalendarView**

The CalendarView component receives `matches` and `onMatchPress`. Check `src/components/CalendarView.js` — it renders day cells as touchables. We need to know which day is pressed.

In CalendarScreen, pass an `onDayPress` callback to CalendarView:
```jsx
<CalendarView
  matches={matches}
  onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
  onDayPress={(dayStr) => setSelectedDay(dayStr)}
/>
```

Then in `src/components/CalendarView.js`, find where day cells are rendered as `TouchableOpacity`. Add `onPress` to call `onDayPress?.(dayStr)` when a day is tapped.

- [ ] **Step 4: Compute matchesForSelectedDay**

In CalendarScreen, add a `useMemo`:
```js
const matchesForSelectedDay = React.useMemo(() => {
  if (!selectedDay || !matches) return [];
  return matches.filter(m => m.date === selectedDay);
}, [selectedDay, matches]);
```

- [ ] **Step 5: Replace the content area with a conditional split layout**

The current content area is a `ScrollView` (around line 60). Replace with:

```jsx
{loading ? (
  <View style={styles.centerContainer}>
    <ActivityIndicator size="large" color={T.orange} />
  </View>
) : IS_TABLET_LANDSCAPE ? (
  /* Split view for tablet landscape */
  <View style={styles.splitContainer}>
    {/* Left panel: calendar */}
    <View style={styles.splitLeft}>
      <View ref={calendarViewRef}>
        <CalendarView
          matches={matches}
          onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
          onDayPress={(dayStr) => setSelectedDay(dayStr)}
        />
      </View>
    </View>

    {/* Right panel: matches for selected day */}
    <ScrollView style={styles.splitRight} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      {selectedDay ? (
        <>
          <Text style={styles.splitDayTitle}>
            {new Date(selectedDay + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {matchesForSelectedDay.length === 0 ? (
            <Text style={styles.splitEmptyText}>Sin partidos este día.</Text>
          ) : (
            matchesForSelectedDay.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.matchCard}
                onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                activeOpacity={0.75}
              >
                <View style={styles.dateBox}>
                  <Text style={styles.dateDay}>{new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric' })}</Text>
                  <Text style={styles.dateMon}>{new Date(m.date).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</Text>
                  <Text style={styles.dateTime}>{m.time || '--:--'}h</Text>
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchTeamName}>{m.teamName}</Text>
                  <Text style={styles.matchOpponent}>vs {m.opponent}</Text>
                </View>
                <View style={[styles.homePill, m.isHome ? styles.homePillHome : styles.homePillAway]}>
                  <Text style={[styles.homePillText, m.isHome ? styles.homePillTextHome : styles.homePillTextAway]}>
                    {m.isHome ? 'CASA' : 'VIS'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.splitDayTitle}>Próximos Partidos</Text>
          {upcomingMatches.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.matchCard}
              onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
              activeOpacity={0.75}
            >
              <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric' })}</Text>
                <Text style={styles.dateMon}>{new Date(m.date).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</Text>
                <Text style={styles.dateTime}>{m.time || '--:--'}h</Text>
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.matchTeamName}>{m.teamName}</Text>
                <Text style={styles.matchOpponent}>vs {m.opponent}</Text>
              </View>
              <View style={[styles.homePill, m.isHome ? styles.homePillHome : styles.homePillAway]}>
                <Text style={[styles.homePillText, m.isHome ? styles.homePillTextHome : styles.homePillTextAway]}>
                  {m.isHome ? 'CASA' : 'VIS'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  </View>
) : (
  /* Mobile / portrait — existing ScrollView unchanged */
  <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    {/* existing content unchanged */}
  </ScrollView>
)}
```

- [ ] **Step 6: Add split-view styles**

In `StyleSheet.create` at the bottom, add:

```js
splitContainer: {
  flex: 1,
  flexDirection: 'row',
},
splitLeft: {
  width: 380,
  borderRightWidth: 1,
  borderRightColor: T.border,
},
splitRight: {
  flex: 1,
},
splitDayTitle: {
  fontFamily: T.fontBold,
  fontSize: 18,
  color: T.text,
  marginBottom: 16,
  textTransform: 'capitalize',
},
splitEmptyText: {
  fontFamily: T.fontReg,
  fontSize: 14,
  color: T.textFaint,
  marginTop: 8,
},
```

- [ ] **Step 7: Verify in web browser**

Run `npm run web`. At tablet landscape: calendar on left, match list on right. Tap a calendar day — right panel updates to show that day's matches. No day selected → shows upcoming matches. At mobile/portrait: original scrollable layout.

---

## Task 9: SettingsScreen — centered max-width + hide hamburger

**Files:**
- Modify: `src/screens/SettingsScreen.js`

This is the simplest task — just center the content with a max-width on tablet, and hide the hamburger.

- [ ] **Step 1: Add useLayout import and hook call**

```js
import { useLayout } from '../hooks/useLayout';
```

Inside `export default function SettingsScreen()`, add:
```js
const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
```

- [ ] **Step 2: Hide hamburger in tablet landscape**

Find `<TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>`. Wrap it:
```jsx
{!IS_TABLET_LANDSCAPE && (
  <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
    <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Add max-width wrapper to the content area**

Find `<View style={styles.container}>` (line 36). Replace with:
```jsx
<View style={[styles.container, IS_TABLET && styles.containerTablet]}>
```

Add the tablet style in `StyleSheet.create`:
```js
containerTablet: {
  maxWidth: 600,
  alignSelf: 'center',
  width: '100%',
},
```

- [ ] **Step 4: Verify in web browser**

Run `npm run web`. At > 600px: settings content is centered with max-width. At mobile: full-width unchanged.
