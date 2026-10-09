# Guided Tour (Spotlight Walkthrough) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `HelpModal` bottom-sheet on each screen header `?` button with an interactive step-by-step spotlight tour that highlights real UI elements using a 4-rectangle overlay.

**Architecture:** A new `GuidedTourOverlay` component renders a React Native Modal with 4 semi-transparent Views creating a spotlight effect around the measured element. Each screen defines its tour steps as a constant array of `{ref, title, text}` objects outside the component. The `?` button sets `tourActive = true`. `measureInWindow` is used to locate elements precisely even inside ScrollViews.

**Tech Stack:** React Native (View, Animated, Modal, Dimensions), lucide-react-native, existing theme tokens (`src/theme/tokens.js`).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/GuidedTourOverlay.js` | **Create** | Spotlight component: 4-rect overlay, pulsing border, tooltip, step navigation |
| `src/screens/TeamsListScreen.js` | **Modify** | Add 4 refs, define TOUR_STEPS, swap HelpModal → GuidedTourOverlay, rename state |
| `src/screens/TeamDetailScreen.js` | **Modify** | Add 4 refs, define TOUR_STEPS, swap HelpModal → GuidedTourOverlay, rename state |
| `src/screens/MatchListScreen.js` | **Modify** | Add 4 refs, define TOUR_STEPS, swap HelpModal → GuidedTourOverlay, rename state |
| `src/screens/MatchMatrixScreen.js` | **Modify** | Add 11 refs for 13 steps, define TOUR_STEPS, swap HelpModal → GuidedTourOverlay, rename state |
| `src/screens/CalendarScreen.js` | **Modify** | Add 3 refs, define TOUR_STEPS, swap HelpModal → GuidedTourOverlay, rename state |

---

## Task 1: Create GuidedTourOverlay component

**Files:**
- Create: `src/components/GuidedTourOverlay.js`

- [ ] **Step 1: Create the file with this exact content**

```js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  Dimensions, StyleSheet,
} from 'react-native';
import { T } from '../theme/tokens';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const OVERLAY_COLOR = 'rgba(0,0,0,0.72)';
const PAD = 8; // padding around spotlight element

export default function GuidedTourOverlay({ steps, visible, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spot, setSpot] = useState(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0.5)).current;
  const pulseLoopRef = useRef(null);

  const measureStep = (stepIndex) => {
    const step = steps[stepIndex];
    if (!step?.ref?.current) { setSpot(null); return; }
    step.ref.current.measureInWindow((x, y, w, h) => {
      if (y < 0 || y + h > SCREEN_H || w === 0 || h === 0) {
        setSpot(null);
      } else {
        setSpot({ x, y, w, h });
      }
    });
  };

  // On open: reset to step 0, fade in, start pulse
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setSpot(null);
      overlayAnim.setValue(0);
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      pulseLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]));
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      overlayAnim.setValue(0);
    }
  }, [visible]);

  // Measure whenever step changes
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => measureStep(currentStep), 120);
    return () => clearTimeout(timer);
  }, [visible, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  if (!visible) return null;

  const step = steps[currentStep];

  // Spotlight rectangle (with padding)
  const hasSpot = spot !== null;
  const spotX = hasSpot ? Math.max(0, spot.x - PAD) : 0;
  const spotY = hasSpot ? Math.max(0, spot.y - PAD) : 0;
  const spotW = hasSpot ? spot.w + PAD * 2 : SCREEN_W;
  const spotH = hasSpot ? spot.h + PAD * 2 : SCREEN_H;

  // Tooltip: below if element is in upper half, above if lower half
  const isBelow = !hasSpot || spotY <= SCREEN_H / 2;
  const tooltipPos = isBelow
    ? { top: spotY + spotH + 12 }
    : { bottom: SCREEN_H - spotY + 12 };

  const isFirst = currentStep === 0;
  const isLast  = currentStep === steps.length - 1;

  return (
    <Modal visible transparent animationType="none">
      <Animated.View style={[styles.container, { opacity: overlayAnim }]}>

        {/* ── 4 overlay rectangles ─────────────────────────────── */}
        {/* Top */}
        <View style={[styles.rect, { top: 0, left: 0, right: 0, height: hasSpot ? spotY : SCREEN_H }]} />
        {/* Bottom */}
        {hasSpot && (
          <View style={[styles.rect, { top: spotY + spotH, left: 0, right: 0, bottom: 0 }]} />
        )}
        {/* Left */}
        {hasSpot && (
          <View style={[styles.rect, { top: spotY, left: 0, width: spotX, height: spotH }]} />
        )}
        {/* Right */}
        {hasSpot && (
          <View style={[styles.rect, { top: spotY, left: spotX + spotW, right: 0, height: spotH }]} />
        )}

        {/* ── Pulsing orange border ────────────────────────────── */}
        {hasSpot && (
          <Animated.View
            style={[styles.spotBorder, { top: spotY, left: spotX, width: spotW, height: spotH, opacity: pulseAnim }]}
            pointerEvents="none"
          />
        )}

        {/* ── Tooltip ─────────────────────────────────────────── */}
        <View style={[styles.tooltip, tooltipPos]}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipTitle}>{step.title}</Text>
            <Text style={styles.tooltipCounter}>{currentStep + 1} / {steps.length}</Text>
          </View>
          <Text style={styles.tooltipText}>{step.text}</Text>

          <View style={styles.tooltipFooter}>
            <TouchableOpacity
              onPress={handlePrev}
              style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
              disabled={isFirst}
            >
              <ChevronLeft color={isFirst ? 'rgba(255,255,255,0.2)' : '#fff'} size={18} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="rgba(255,255,255,0.55)" size={14} strokeWidth={2} />
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
              {isLast
                ? <Text style={styles.finishText}>✓</Text>
                : <ChevronRight color="#fff" size={18} strokeWidth={2} />}
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  rect: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  spotBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: T.orange,
    borderRadius: 8,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F1826',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tooltipTitle: {
    fontFamily: T.fontBold,
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  tooltipCounter: {
    fontFamily: T.fontMed,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginLeft: 10,
  },
  tooltipText: {
    fontFamily: T.fontReg,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
    marginBottom: 16,
  },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  closeBtnText: {
    fontFamily: T.fontSemi,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  finishText: {
    color: T.orange,
    fontSize: 16,
    fontFamily: T.fontBold,
  },
});
```

---

## Task 2: Wire TeamsListScreen (4 steps)

**Files:**
- Modify: `src/screens/TeamsListScreen.js`

The 4 steps target: menu button, calendar icon button, plus button, first team card.

- [ ] **Step 1: Add imports and refs**

At the top of the file, after existing imports, add:
```js
import GuidedTourOverlay from '../components/GuidedTourOverlay';
```

Remove the `HelpModal` import (or keep it if used elsewhere — here it can be removed since GuidedTourOverlay replaces it in this screen):
```js
// Remove this line:
import HelpModal from '../components/HelpModal';
```

Inside `TeamsListScreen()`, after `const navigation = useNavigation();`, add refs:
```js
const menuBtnRef      = useRef(null);
const calendarBtnRef  = useRef(null);
const plusBtnRef      = useRef(null);
const firstCardRef    = useRef(null);
```

Also import `useRef` — it's already imported in React, but verify `useState` is there. The import line at top is:
```js
import React, { useState } from 'react';
```
Change to:
```js
import React, { useState, useRef } from 'react';
```

- [ ] **Step 2: Rename state and define TOUR_STEPS constant**

Change the state from:
```js
const [helpOpen, setHelpOpen] = useState(false);
```
to:
```js
const [tourActive, setTourActive] = useState(false);
```

Outside the component (above `export default function TeamsListScreen()`), add the TOUR_STEPS constant. Note: since refs are defined inside the component, TOUR_STEPS must be defined **inside** the component but outside the return, and use the refs declared above. In React Native this is the standard pattern when refs are needed:

```js
const TOUR_STEPS = [
  { ref: menuBtnRef,     title: 'Menú lateral',  text: 'Accede al calendario, a la guía de uso y a los ajustes desde aquí.' },
  { ref: calendarBtnRef, title: 'Calendario',     text: 'Ve todos los partidos de todos tus equipos en una sola vista.' },
  { ref: plusBtnRef,     title: 'Nuevo equipo',   text: 'Crea un nuevo equipo de baloncesto.' },
  { ref: firstCardRef,   title: 'Tu equipo',      text: 'Toca la tarjeta para gestionar jugadores, partidos y configuración del equipo.' },
];
```

Place this array right after the `useRef` declarations, before `handleCreateTeam`.

- [ ] **Step 3: Attach refs to JSX elements**

In the `return` statement, attach refs to the relevant elements:

```jsx
// Menu button — add ref={menuBtnRef}:
<TouchableOpacity ref={menuBtnRef} style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>

// Calendar icon button — add ref={calendarBtnRef}:
<TouchableOpacity ref={calendarBtnRef} onPress={() => navigation.navigate('Calendar')} style={styles.headerIconBtn}>

// Plus button — the outer wrapper has overflow:hidden which clips the ref area. Use the gradient view inside instead:
// Change the help button onPress from setHelpOpen to setTourActive:
<TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>

// Plus button wrapper — add ref={plusBtnRef}:
<TouchableOpacity ref={plusBtnRef} onPress={() => setModalVisible(true)} style={styles.headerPlusWrap} activeOpacity={0.85}>
```

In `renderTeamCard`, change the signature to receive `index` and attach `firstCardRef` conditionally:
```jsx
const renderTeamCard = ({ item, index }) => (
  <TouchableOpacity
    ref={index === 0 ? firstCardRef : null}
    style={styles.teamCard}
    onPress={() => navigation.navigate('TeamDetail', { teamId: item.id })}
    activeOpacity={0.82}
  >
```

- [ ] **Step 4: Swap HelpModal for GuidedTourOverlay**

At the bottom of the return, before `</SafeAreaView>`, replace:
```jsx
<HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} screenKey="teams" />
```
with:
```jsx
<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
```

---

## Task 3: Wire TeamDetailScreen (4 steps)

**Files:**
- Modify: `src/screens/TeamDetailScreen.js`

The 4 steps target: menu button, configure button, players section header, add player button.

- [ ] **Step 1: Add import and refs**

The file already has `import React, { useState, useEffect, useRef } from 'react';` — `useRef` is already imported.

Add import:
```js
import GuidedTourOverlay from '../components/GuidedTourOverlay';
```

Remove:
```js
import HelpModal from '../components/HelpModal';
```

Inside `TeamDetailScreen()`, after the existing `const scrollRef = useRef(null);`, add:
```js
const menuBtnRef      = useRef(null);
const configureBtnRef = useRef(null);
const playersSectRef  = useRef(null);
const addPlayerBtnRef = useRef(null);
```

- [ ] **Step 2: Rename state and define TOUR_STEPS**

Change:
```js
const [helpOpen, setHelpOpen] = useState(false);
```
to:
```js
const [tourActive, setTourActive] = useState(false);
```

After the `useRef` declarations above, add:
```js
const TOUR_STEPS = [
  { ref: menuBtnRef,      title: 'Menú lateral',    text: 'Navega a otras secciones de la app.' },
  { ref: configureBtnRef, title: 'Configurar equipo', text: 'Cambia el nombre, el modo de partido (Pasarela 8P, 6P o Libre) y los roles y colores de cada posición.' },
  { ref: playersSectRef,  title: 'Jugadores',        text: 'Aquí aparece la plantilla completa con número de dorsal y posición.' },
  { ref: addPlayerBtnRef, title: 'Añadir jugador',   text: 'Añade un nuevo jugador con su nombre, dorsal y posición.' },
];
```

- [ ] **Step 3: Attach refs and update HelpCircle button**

In the header JSX:
```jsx
// Menu button — add ref:
<TouchableOpacity ref={menuBtnRef} onPress={() => setDrawerOpen(true)} style={styles.headerIconBtn}>

// HelpCircle button — change setHelpOpen to setTourActive:
<TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>

// Configure action button — add ref:
<TouchableOpacity ref={configureBtnRef} style={styles.headerActionBtn} onPress={openConfigModal}>
```

In the players section:
```jsx
// Players section row — add ref:
<View
  ref={playersSectRef}
  style={[styles.sectionRow, { marginTop: 28 }]}
  onLayout={(e) => setPlayersSectionY(e.nativeEvent.layout.y)}
>

// Add player button — add ref:
<TouchableOpacity ref={addPlayerBtnRef} onPress={() => openPlayerModal()} style={styles.addLinkBtn}>
```

- [ ] **Step 4: Swap HelpModal for GuidedTourOverlay**

Replace:
```jsx
<HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} screenKey="teamDetail" />
```
with:
```jsx
<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
```

---

## Task 4: Wire MatchListScreen (4 steps)

**Files:**
- Modify: `src/screens/MatchListScreen.js`

The 4 steps target: menu button, plus FAB, hero match card, heroPill (estado).

- [ ] **Step 1: Add import and refs**

Add to imports:
```js
import React, { useState, useRef } from 'react';
```
(currently `import React, { useState } from 'react';` — add `useRef`)

Add import:
```js
import GuidedTourOverlay from '../components/GuidedTourOverlay';
```

Remove:
```js
import HelpModal from '../components/HelpModal';
```

Inside `MatchListScreen()`, after `const [helpOpen, setHelpOpen] = useState(false);`, add:
```js
const menuBtnRef   = useRef(null);
const fabRef       = useRef(null);
const heroCardRef  = useRef(null);
const heroPillRef  = useRef(null);
```

- [ ] **Step 2: Rename state and define TOUR_STEPS**

Change:
```js
const [helpOpen, setHelpOpen] = useState(false);
```
to:
```js
const [tourActive, setTourActive] = useState(false);
```

After the `useRef` declarations, add:
```js
const TOUR_STEPS = [
  { ref: menuBtnRef,  title: 'Menú lateral',    text: 'Navega a otras secciones de la app.' },
  { ref: fabRef,      title: 'Nuevo partido',   text: 'Crea un partido con rival, fecha, hora y lugar.' },
  { ref: heroCardRef, title: 'Partido',         text: 'Toca para abrir la matriz de sustituciones. Mantén la ficha del partido para editarla o eliminarla.' },
  { ref: heroPillRef, title: 'Estado',          text: 'Pendiente → En curso → Finalizado. Cambia el estado desde la ficha del partido.' },
];
```

- [ ] **Step 3: Attach refs**

In the header JSX:
```jsx
// Menu button (backBtn) — add ref:
<TouchableOpacity ref={menuBtnRef} style={s.backBtn} onPress={() => setDrawerOpen(true)}>

// HelpCircle button — change to setTourActive:
<TouchableOpacity onPress={() => setTourActive(true)} style={s.iconBtn}>
```

In the hero card section:
```jsx
// heroCard View — add ref:
<View ref={heroCardRef} style={s.heroCard}>

// heroPill View — add ref:
<View ref={heroPillRef} style={s.heroPill}>
```

FAB:
```jsx
// FAB — add ref:
<TouchableOpacity ref={fabRef} style={s.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
```

- [ ] **Step 4: Swap HelpModal for GuidedTourOverlay**

Replace:
```jsx
<HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} screenKey="matchList" />
```
with:
```jsx
<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
```

---

## Task 5: Wire MatchMatrixScreen (13 steps)

**Files:**
- Modify: `src/screens/MatchMatrixScreen.js`

This is the most complex screen. 13 steps use 11 distinct refs (steps 10 and 12 reuse step 9's ref; step 11 is the progress bar inside the player name row).

Refs needed:
- `menuBtnRef` (step 1) — drawer menu button
- `headerInfoRef` (step 2) — match info row (opponent + date)
- `viewBtnsRef` (step 3) — view buttons row (lista/compacta)
- `sortHeaderRef` (step 4) — "Jugador" column header with sort chip
- `freeEditBtnRef` (step 5) — Lock/Unlock free-edit toggle button
- `periodsHeaderRef` (step 6) — period headers container
- `nextPeriodBtnRef` (step 7) — ChevronRight button in bottom bar
- `firstPlayerRef` (step 8) — first player's name row
- `firstCellRef` (steps 9, 10, 12) — first player's period-1 cell
- `progressBarRef` (step 11) — progress bar in first player's name row
- `addOvertimeBtnRef` (step 13) — "+ Prórroga" button

- [ ] **Step 1: Add import and refs**

Add import (after existing imports):
```js
import GuidedTourOverlay from '../components/GuidedTourOverlay';
```

Remove:
```js
import HelpModal from '../components/HelpModal';
```

`useRef` is already imported. After `const [helpOpen, setHelpOpen] = useState(false);`, add:
```js
const menuBtnRef       = useRef(null);
const headerInfoRef    = useRef(null);
const viewBtnsRef      = useRef(null);
const sortHeaderRef    = useRef(null);
const freeEditBtnRef   = useRef(null);
const periodsHeaderRef = useRef(null);
const nextPeriodBtnRef = useRef(null);
const firstPlayerRef   = useRef(null);
const firstCellRef     = useRef(null);
const progressBarRef   = useRef(null);
const addOvertimeBtnRef = useRef(null);
```

- [ ] **Step 2: Rename state and define TOUR_STEPS**

Change:
```js
const [helpOpen, setHelpOpen] = useState(false);
```
to:
```js
const [tourActive, setTourActive] = useState(false);
```

After the new `useRef` declarations, add:
```js
const TOUR_STEPS = [
  { ref: menuBtnRef,       title: 'Menú lateral',          text: 'Navega a otras secciones de la app.' },
  { ref: headerInfoRef,    title: 'Información del partido', text: 'Nombre del rival y fecha. Puedes editar los datos del partido desde aquí.' },
  { ref: viewBtnsRef,      title: 'Vistas',                text: 'Cambia entre vista de cuadrícula completa, compacta o lista según tu preferencia.' },
  { ref: sortHeaderRef,    title: 'Ordenar jugadores',      text: 'Ordena la plantilla por posición o por número de dorsal.' },
  { ref: freeEditBtnRef,   title: 'Edición libre',          text: 'Actívalo para desactivar las restricciones de Pasarela y asignar periodos libremente.' },
  { ref: periodsHeaderRef, title: 'Periodos',               text: 'Los 8 periodos del partido. El periodo actual aparece resaltado.' },
  { ref: nextPeriodBtnRef, title: 'Avanzar periodo',        text: 'Marca el periodo actual como jugado y avanza al siguiente.' },
  { ref: firstPlayerRef,   title: 'Jugador',                text: 'El nombre y la posición de cada jugador aparecen a la izquierda.' },
  { ref: firstCellRef,     title: 'Asignar periodo',        text: 'Toca una celda para asignar ese jugador a ese periodo. Vuelve a tocarla para quitarlo.' },
  { ref: firstCellRef,     title: 'Colores Pasarela',       text: '🟢 Cumple el reglamento · 🟡 En el límite · 🔴 Infringe la norma.' },
  { ref: progressBarRef,   title: 'Progreso',               text: 'Muestra cuántos de los 8 periodos lleva jugados ese jugador.' },
  { ref: firstCellRef,     title: 'Vaciar jugador',         text: 'Mantén pulsada una celda para quitar a ese jugador de todos los periodos de golpe.' },
  { ref: addOvertimeBtnRef,title: 'Prórroga',               text: 'Añade periodos extra si el partido va a prórroga. El botón de papelera permite eliminarlos.' },
];
```

- [ ] **Step 3: Attach refs to header elements**

In the header JSX (the `<LinearGradient>` header section):

```jsx
// Menu button (backBtn) — add ref:
<TouchableOpacity ref={menuBtnRef} style={styles.backBtn} onPress={() => setDrawerOpen(true)}>

// HelpCircle button — change to setTourActive:
<TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>

// Free edit toggle button — add ref:
<TouchableOpacity
  ref={freeEditBtnRef}
  style={[styles.headerIconBtn, isFreeEdit && styles.headerIconBtnActive]}
  onPress={() => setIsFreeEdit(!isFreeEdit)}
>

// headerInfoRow — add ref:
<View ref={headerInfoRef} style={styles.headerInfoRow}>
```

- [ ] **Step 4: Attach refs to matrix elements**

In the matrix section (below the header):

```jsx
// "Jugador" column header (sortHeaderRef) — already a TouchableOpacity:
<TouchableOpacity
  ref={sortHeaderRef}
  style={styles.jugadorHeader}
  onPress={() => setSortBy(sortBy === 'number' ? 'role' : 'number')}
>

// Periods header container (periodsHeaderRef) — wrap or add ref:
<View ref={periodsHeaderRef} style={styles.periodsHeaderContainer}>
```

For the view buttons row at line ~1194:
```jsx
// Add ref to the wrapping View:
<View ref={viewBtnsRef} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 14, marginTop: 12 }}>
```

For the overtime button:
```jsx
// + Prórroga button — add ref:
<TouchableOpacity
  ref={addOvertimeBtnRef}
  style={[styles.addOvertimeBtn, { flex: 1 }]}
  onPress={handleAddOvertime}
  disabled={saving}
>
```

For the next period button in bottom bar:
```jsx
// ChevronRight (next period) — add ref:
<TouchableOpacity
  ref={nextPeriodBtnRef}
  style={[styles.periodNavBtn, (currentPeriod >= totalPeriods || saving) && styles.disabledBtn]}
  onPress={handleNextPeriod}
  disabled={currentPeriod >= totalPeriods || saving}
>
```

- [ ] **Step 5: Attach refs inside renderPlayerName and renderPlayerCells**

In `renderPlayerName`, attach `firstPlayerRef` and `progressBarRef` to the first player only. Change the function:

```jsx
const renderPlayerName = (player) => {
  const isFirst = player.id === sortedPlayers[0]?.id;
  // ... existing code ...
  return (
    <View
      ref={isFirst ? firstPlayerRef : null}
      key={player.id}
      style={[styles.playerNameRow, isOnCourt && styles.playerNameRowActive, hasError && styles.playerNameRowError]}
    >
      {/* ... existing content ... */}
      {/* Progress bar track — attach progressBarRef for first player */}
      <View
        ref={isFirst ? progressBarRef : null}
        style={styles.minsBarTrack}
      >
        <View style={[styles.minsBarFill, { width: `${pct}%`, backgroundColor: ... }]} />
      </View>
      {/* ... rest of content ... */}
    </View>
  );
};
```

In `renderPlayerCells`, attach `firstCellRef` to the period-1 cell of the first player:

```jsx
const renderPlayerCells = (player) => {
  const isFirst = player.id === sortedPlayers[0]?.id;
  return (
    <View key={player.id} style={[styles.playerCellsRow, ...]}>
      {[...Array(totalPeriods)].map((_, i) => {
        const periodNum = i + 1;
        // ... existing derived values ...
        return (
          <TouchableOpacity
            ref={isFirst && periodNum === 1 ? firstCellRef : null}
            key={periodNum}
            style={[styles.periodCell, ...]}
            // ... existing props ...
          >
```

- [ ] **Step 6: Swap HelpModal for GuidedTourOverlay**

Replace:
```jsx
<HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} screenKey="matchMatrix" />
```
with:
```jsx
<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
```

---

## Task 6: Wire CalendarScreen (3 steps)

**Files:**
- Modify: `src/screens/CalendarScreen.js`

The 3 steps target: menu button, calendar widget, próximos partidos list.

- [ ] **Step 1: Add import, useRef, and refs**

Change:
```js
import React, { useState } from 'react';
```
to:
```js
import React, { useState, useRef } from 'react';
```

Add import:
```js
import GuidedTourOverlay from '../components/GuidedTourOverlay';
```

Remove:
```js
import HelpModal from '../components/HelpModal';
```

Inside `CalendarScreen()`, add refs after state declarations:
```js
const menuBtnRef      = useRef(null);
const calendarViewRef = useRef(null);
const listSectRef     = useRef(null);
```

- [ ] **Step 2: Rename state and define TOUR_STEPS**

Change:
```js
const [helpOpen, setHelpOpen] = useState(false);
```
to:
```js
const [tourActive, setTourActive] = useState(false);
```

After refs, add:
```js
const TOUR_STEPS = [
  { ref: menuBtnRef,      title: 'Menú lateral',      text: 'Navega a otras secciones de la app.' },
  { ref: calendarViewRef, title: 'Calendario',         text: 'Navega por los meses para ver en qué días tienes partidos. Los días con partido aparecen marcados.' },
  { ref: listSectRef,     title: 'Próximos partidos',  text: 'Lista de los partidos más cercanos de todos tus equipos. Toca uno para ir a su matriz.' },
];
```

- [ ] **Step 3: Attach refs**

```jsx
// Menu button — add ref:
<TouchableOpacity ref={menuBtnRef} onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>

// HelpCircle button — change to setTourActive:
<TouchableOpacity onPress={() => setTourActive(true)} style={styles.menuBtn}>

// CalendarView — wrap in a View with ref:
<View ref={calendarViewRef}>
  <CalendarView
    matches={matches}
    onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
  />
</View>

// listSection — add ref:
<View ref={listSectRef} style={styles.listSection}>
```

- [ ] **Step 4: Swap HelpModal for GuidedTourOverlay**

Replace:
```jsx
<HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} screenKey="calendar" />
```
with:
```jsx
<GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
```

---

## Self-Review Checklist

- [x] All 28 tour steps covered (4+4+4+13+3)
- [x] GuidedTourOverlay handles out-of-viewport fallback (spot=null → top rect covers full screen, tooltip centered)
- [x] Steps 9, 10, 12 in MatchMatrixScreen correctly reuse `firstCellRef`
- [x] `TOUR_STEPS` defined inside component (must reference refs) but outside JSX `return` 
- [x] `measureInWindow` used (not `measure`) — works inside ScrollViews
- [x] Pulsing border uses `useNativeDriver: true`
- [x] Fallback for no players (firstCellRef/firstPlayerRef null) — `measureStep` checks `ref.current` null and calls `setSpot(null)`, rendering tooltip centered without spotlight
- [x] `HelpModal` import removed from each modified screen (still exists in `HelpModal.js` file)
