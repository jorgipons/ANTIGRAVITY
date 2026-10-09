import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Menu, ChevronLeft, ChevronRight, Lock, Unlock, Settings, Trash2,
  ArrowDown, ArrowUp, Users, Activity, Clipboard, ExternalLink,
  List, LayoutGrid, XCircle, Clock, MapPin, Check, Bus, Car, AlertTriangle,
  Play, Pause, BarChart2, RotateCcw, Save, HelpCircle,
} from 'lucide-react-native';
import Svg, {
  Defs, Pattern as SvgPattern, Path as SvgPath, Rect as SvgRect,
  Circle as SvgCircle,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as ClipboardAPI from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import AppDrawer from '../components/AppDrawer';
import GuidedTourOverlay from '../components/GuidedTourOverlay';
import { ROLES, getRoleConfig, getAvailableRoleKeys } from '../constants/roles';
import { resolveRuleset, MAX_PERIODS } from '../constants/ruleset';
import { db } from '../constants/firebase';
import { doc, onSnapshot, getDoc, deleteDoc, deleteField } from 'firebase/firestore';
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';

// ── Shared micro-components ───────────────────────────────────────────────────

function GridPattern({ uid = 'mm' }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgPattern id={`${uid}grid`} width="14" height="14" patternUnits="userSpaceOnUse">
            <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
          </SvgPattern>
        </Defs>
        <SvgRect width="100%" height="100%" fill={`url(#${uid}grid)`} opacity={0.05} />
      </Svg>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MatchMatrixScreen() {
  const T = useTheme();
  const { IS_TABLET, IS_TABLET_LANDSCAPE, width: SCREEN_WIDTH } = useLayout();
  const insets = useSafeAreaInsets();

  const NAME_COLUMN_WIDTH = IS_TABLET ? 180 : 140;

  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId } = route.params || {};

  const [match, setMatch]   = useState(null);
  const [team,  setTeam]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const headerScrollRef = React.useRef(null);
  const bodyScrollRef   = React.useRef(null);

  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedOut, setSelectedOut] = useState(null);
  const [selectedIn,  setSelectedIn]  = useState(null);

  const [isFreeEdit,        setIsFreeEdit]        = useState(false);
  const [compactViewVisible,setCompactViewVisible] = useState(false);
  const [listViewVisible,   setListViewVisible]    = useState(false);
  const [configModalVisible,setConfigModalVisible] = useState(false);
  const [matchForm, setMatchForm] = useState(null);
  const [sortBy,    setSortBy]    = useState('role');
  const [timePickerVisible,  setTimePickerVisible]  = useState(false);
  const [activeTimeField,    setActiveTimeField]     = useState(null);
  const [confirmModal,       setConfirmModal]        = useState(null);
  const [drawerOpen,         setDrawerOpen]          = useState(false);
  const [tourActive,         setTourActive]          = useState(false);
  const [score,              setScore]               = useState({ home: '', away: '' });

  const [syncMessage, setSyncMessage] = useState(null);
  const handleSyncComplete = React.useCallback((count) => {
    setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
    setTimeout(() => setSyncMessage(null), 3000);
  }, []);
  const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });

  const menuBtnRef        = useRef(null);
  const headerInfoRef     = useRef(null);
  const viewBtnsRef       = useRef(null);
  const sortHeaderRef     = useRef(null);
  const freeEditBtnRef    = useRef(null);
  const periodsHeaderRef  = useRef(null);
  const nextPeriodBtnRef  = useRef(null);
  const firstPlayerRef    = useRef(null);
  const firstRemoveBtnRef = useRef(null);
  const firstCellRef      = useRef(null);
  const progressBarRef    = useRef(null);
  const convocatoriaRef        = useRef(null);
  const addOvertimeBtnRef      = useRef(null);
  const tableBodyScrollRef     = useRef(null);
  const tableBodyScrollOffsetRef = useRef(0);

  const TOUR_STEPS = [
    /* 1  */ { ref: menuBtnRef,        title: 'Menú lateral',           text: 'Navega a otras secciones de la app.' },
    /* 2  */ { ref: convocatoriaRef,   title: 'Convocatoria',           text: 'Abre la pantalla de convocatoria para gestionar la asistencia de los jugadores al partido.' },
    /* 3  */ { ref: freeEditBtnRef,    title: 'Edición libre',          text: 'Actívalo para desactivar las restricciones de Pasarela y asignar periodos libremente.' },
    /* 4  */ { ref: headerInfoRef,     title: 'Información del partido', text: 'Nombre del rival y fecha. Puedes editar los datos del partido desde aquí.' },
    /* 5  */ { ref: sortHeaderRef,     title: 'Ordenar jugadores',      text: 'Ordena la plantilla por posición o por número de dorsal.' },
    /* 6  */ { ref: periodsHeaderRef,  title: 'Periodos',               text: 'Los 8 periodos del partido. El periodo actual aparece resaltado.' },
    /* 7  */ { ref: firstPlayerRef,    title: 'Jugador',                text: 'Nombre y posición de cada jugador. Toca la posición para cambiar el rol del jugador en este partido.' },
    /* 8  */ { ref: firstPlayerRef,    title: 'Quitar jugador',         text: 'Mantén pulsado el nombre de un jugador para retirarlo de la convocatoria.' },
    /* 9  */ { ref: firstCellRef,      title: 'Asignar periodo',        text: 'Toca una celda de la cuadrícula para asignar ese jugador a ese periodo. Vuelve a tocarla para quitarlo.' },
    /* 10 */ { ref: firstCellRef,      title: 'Vaciar jugador',         text: 'Pulsación larga sobre una celda para quitar al jugador de todos los periodos de golpe.' },
    /* 11 */ { ref: firstCellRef,      title: 'Colores Pasarela',       text: 'Sin color: OK · 🟡 En el límite · 🔴 No puede jugar ese periodo (infringe la norma).' },
    /* 12 */ { ref: progressBarRef,    title: 'Progreso',               text: 'Barra que muestra los periodos jugados respecto al total.' },
    /* 13 */ { ref: nextPeriodBtnRef,  title: 'Avanzar periodo',        text: 'Marca el periodo actual como jugado y avanza al siguiente.' },
    /* 14 */ { ref: addOvertimeBtnRef, title: 'Prórroga',               text: 'Botón con borde discontinuo para añadir periodos extra. El icono de papelera permite eliminarlos.' },
    /* 15 */ { ref: viewBtnsRef,       title: 'Vistas',                 text: 'Cambia la visualización: por periodos (cuadrícula completa) o compacta.' },
  ];

  // Reset horizontal scroll when tour opens so period 1 is always visible
  useEffect(() => {
    if (tourActive) {
      bodyScrollRef.current?.scrollTo({ x: 0, animated: false });
      headerScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [tourActive]);

  // Timer state (libre mode)
  const [timerRunning,    setTimerRunning]    = useState(false);
  const [timerElapsed,    setTimerElapsed]    = useState(0);   // seconds since period start
  const timerIntervalRef    = useRef(null);
  const timerStartAtRef     = useRef(null);   // Date.now() - elapsed*1000 (virtual origin)
  const timerInitializedRef = useRef(false);  // restore only once on first snapshot

  // Derived — depend on async state, updated on every render
  // Un único reglamento resuelto para toda la pantalla: el del partido si lo tiene,
  // si no el del equipo, con respaldo al campo antiguo team.mode.
  const ruleset      = resolveRuleset(team, match);
  const isLibre      = ruleset.freeSubstitutions;
  const basePeriods  = ruleset.totalPeriods;
  const totalPeriods = basePeriods + (match?.extraPeriods || 0);

  // Dynamic column width: fill screen in libre mode (4 cols), fixed 44px in Pasarela (8 cols)
  const MATRIX_WIDTH = IS_TABLET_LANDSCAPE ? SCREEN_WIDTH * 0.65 : SCREEN_WIDTH;
  const COLUMN_WIDTH = (IS_TABLET || isLibre)
    ? Math.floor((MATRIX_WIDTH - NAME_COLUMN_WIDTH) / (totalPeriods + 1))
    : 44;

  const styles = useMemo(
    () => createStyles(COLUMN_WIDTH, NAME_COLUMN_WIDTH, IS_TABLET, T),
    [COLUMN_WIDTH, NAME_COLUMN_WIDTH, IS_TABLET, T]
  );

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    // 1. Carga caché proactiva — no espera a Firestore
    if (teamId) {
      getCachedDoc('teams', teamId).then(cached => { if (cached) setTeam(cached); });
      getDoc(doc(db, 'teams', teamId)).then(snap => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setTeam(data);
          cacheDoc('teams', teamId, data);
        }
      }).catch(() => {/* ya cargado desde caché */ });
    }

    // 2. Caché del partido antes de que onSnapshot responda
    getCachedDoc('matches', matchId).then(cached => {
      if (!cached) return;
      setMatch(cached);
      setLoading(false);
      // Restaurar timer desde caché (necesario cuando se arranca offline)
      if (!timerInitializedRef.current) {
        timerInitializedRef.current = true;
        if (cached.timerStartedAt) {
          const elapsed = Math.floor((Date.now() - cached.timerStartedAt) / 1000);
          setTimerElapsed(elapsed);
          setTimerRunning(true);
        } else {
          const p = cached.currentPeriod || 1;
          setTimerElapsed(cached.timerData?.[p]?.duration || 0);
        }
      }
    });

    const unsubscribe = onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!data.history) data.history = {};
        // Normaliza todos los periodos del catálogo y además cualquiera que ya
        // exista (prórrogas incluidas), sin depender del reglamento del equipo.
        const storedPeriods = Object.keys(data.history).map(Number).filter(Number.isFinite);
        const upperPeriod = Math.max(MAX_PERIODS, ...(storedPeriods.length ? storedPeriods : [0]));
        for (let i = 1; i <= upperPeriod; i++) {
          if (!Array.isArray(data.history[i])) {
            if (data.history[i] && typeof data.history[i] === 'object') {
              data.history[i] = Object.entries(data.history[i])
                .filter(([, val]) => val === true || typeof val === 'string')
                .map(([id, val]) => ({ id, role: typeof val === 'string' ? val : null }));
            } else {
              data.history[i] = [];
            }
          } else {
            data.history[i] = data.history[i].map(e => typeof e === 'string' ? { id: e, role: null } : e);
          }
        }
        if (!data.injuries)      data.injuries = [];
        if (!data.currentPeriod) data.currentPeriod = 1;
        // Restore timer on first load
        if (!timerInitializedRef.current) {
          timerInitializedRef.current = true;
          if (data.timerStartedAt) {
            const elapsed = Math.floor((Date.now() - data.timerStartedAt) / 1000);
            setTimerElapsed(elapsed);
            setTimerRunning(true);
          } else {
            // Timer is paused — restore elapsed from the current period's saved duration
            const p = data.currentPeriod || 1;
            setTimerElapsed(data.timerData?.[p]?.duration || 0);
          }
        }
        setMatch({ id: snap.id, ...data });
        cacheDoc('matches', matchId, { id: snap.id, ...data });
      }
      setLoading(false);
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

    return unsubscribe;
  }, [matchId]);

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerStartAtRef.current = Date.now() - timerElapsed * 1000;
      timerIntervalRef.current = setInterval(() => {
        setTimerElapsed(Math.floor((Date.now() - timerStartAtRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning]);

  // When period changes, stop timer and restore elapsed from the new period's saved duration
  const prevPeriodRef = useRef(null);
  useEffect(() => {
    const p = match?.currentPeriod ?? null;
    if (prevPeriodRef.current !== null && prevPeriodRef.current !== p) {
      setTimerRunning(false);
      setTimerElapsed(match?.timerData?.[p]?.duration || 0);
    }
    prevPeriodRef.current = p;
  }, [match?.currentPeriod]);

  // Initialize score from match data when it first loads
  useEffect(() => {
    if (match?.score && score.home === '' && score.away === '') {
      const home = match.isHome
        ? String(match.score.local ?? '')
        : String(match.score.visitor ?? '');
      const away = match.isHome
        ? String(match.score.visitor ?? '')
        : String(match.score.local ?? '');
      setScore({ home, away });
    }
  }, [match?.score]);

  // ── Timer helpers ────────────────────────────────────────────────

  const PERIOD_DURATION_S = 10 * 60; // 10 minutes

  const calcPlayerSeconds = (playerId) => {
    const timerData = match?.timerData;
    if (!timerData) return 0;
    let totalSecs = 0;
    const activePeriod = match.currentPeriod || 1;
    Object.entries(timerData).forEach(([periodKey, periodData]) => {
      const pNum     = parseInt(periodKey, 10);
      const isActive = timerRunning && pNum === activePeriod;
      const stints   = periodData.stints?.[playerId] || [];
      stints.forEach(s => {
        const start = s.start ?? 0;
        const end = s.end !== null && s.end !== undefined
          ? s.end
          : (isActive ? timerElapsed : (periodData.duration || 0));
        const raw = end - start;
        if (raw <= 0) return;
        if (isActive) {
          // Active period: show real seconds (final duration unknown)
          totalSecs += raw;
        } else {
          // Completed period: normalize to 10-minute equivalent
          const duration = periodData.duration || 0;
          totalSecs += duration > 0 ? (raw / duration) * PERIOD_DURATION_S : raw;
        }
      });
    });
    return Math.round(totalSecs);
  };

  const handleResetTimer = () => {
    setConfirmModal({
      title: 'Reiniciar contador',
      msg: 'Se borrarán todos los minutos registrados de los jugadores. ¿Continuar?',
      confirmLabel: 'Reiniciar',
      onConfirm: async () => {
        try {
          setTimerRunning(false);
          setTimerElapsed(0);
          setMatch(prev => ({ ...prev, timerData: {}, timerStartedAt: null }));
          await writeDoc('matches', match.id, { timerData: {}, timerStartedAt: null });
        } catch { Alert.alert('Error', 'No se pudo reiniciar el contador'); }
      },
    });
  };

  const formatDate = (str) => {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length !== 3) return str;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatMSS = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const doStartTimer = async (period, onCourt) => {
    const nowSec = timerElapsed;
    const currentTimerData = match.timerData || {};
    const periodData = currentTimerData[period] || { duration: 0, stints: {} };
    const updatedStints = { ...periodData.stints };
    onCourt.forEach(pid => {
      const playerStints = updatedStints[pid] || [];
      const hasOpen = playerStints.some(s => s.end === null || s.end === undefined);
      if (!hasOpen) updatedStints[pid] = [...playerStints, { start: nowSec, end: null }];
    });
    const newTimerData = { ...currentTimerData, [period]: { ...periodData, stints: updatedStints } };
    const timerStartedAt = Date.now() - nowSec * 1000;
    setMatch(prev => ({ ...prev, timerData: newTimerData, timerStartedAt }));
    await writeDoc('matches', match.id, { timerData: newTimerData, timerStartedAt });
    setTimerRunning(true);
  };

  const handleToggleTimer = async () => {
    if (!match) return;
    const period = match.currentPeriod || 1;
    const nowSec = timerElapsed;

    if (!timerRunning) {
      const onCourt = (match.history[period] || []).map(e => typeof e === 'object' ? e.id : e);
      if (onCourt.length < 5) {
        setConfirmModal({
          title: 'Faltan jugadores',
          msg: `Tienes ${onCourt.length} de 5 jugadores en pista. ¿Iniciar el tiempo igualmente?`,
          confirmLabel: 'Iniciar igual',
          onConfirm: () => doStartTimer(period, onCourt),
        });
        return;
      }
      await doStartTimer(period, onCourt);
    } else {
      // Pausing — close all open stints and save duration
      const currentTimerData = match.timerData || {};
      const periodData = currentTimerData[period] || { duration: 0, stints: {} };
      const updatedStints = {};
      Object.entries(periodData.stints || {}).forEach(([pid, stints]) => {
        updatedStints[pid] = stints.map(s => s.end === null || s.end === undefined ? { ...s, end: nowSec } : s);
      });
      const newTimerData = { ...currentTimerData, [period]: { duration: nowSec, stints: updatedStints } };
      setMatch(prev => ({ ...prev, timerData: newTimerData, timerStartedAt: null }));
      await writeDoc('matches', match.id, { timerData: newTimerData, timerStartedAt: null });
      setTimerRunning(false);
    }
  };

  // Called when a player is added to the current period while timer is running
  const openStintForPlayer = async (playerId) => {
    if (!timerRunning || !match) return;
    const period = match.currentPeriod || 1;
    const nowSec = timerElapsed;
    const playerStints = match.timerData?.[period]?.stints?.[playerId] || [];
    const hasOpen = playerStints.some(s => s.end === null || s.end === undefined);
    if (hasOpen) return;
    const newPlayerStints = [...playerStints, { start: nowSec, end: null }];
    // Merge into latest state — do not replace other players' stints
    setMatch(prev => {
      const pData = prev.timerData?.[period] || { duration: 0, stints: {} };
      return { ...prev, timerData: { ...prev.timerData, [period]: { ...pData, stints: { ...pData.stints, [playerId]: newPlayerStints } } } };
    });
    // Dot-notation: only update this player's stints — avoids overwriting others
    await writeDoc('matches', match.id, {
      [`timerData.${period}.stints.${playerId}`]: newPlayerStints,
    });
  };

  // Called when a player is removed from the current period while timer is running
  const closeStintForPlayer = async (playerId) => {
    if (!timerRunning || !match) return;
    const period = match.currentPeriod || 1;
    const nowSec = timerElapsed;
    const playerStints = match.timerData?.[period]?.stints?.[playerId] || [];
    const updatedStints = playerStints.map(s => s.end === null || s.end === undefined ? { ...s, end: nowSec } : s);
    // Merge into latest state — do not replace other players' stints
    setMatch(prev => {
      const pData = prev.timerData?.[period] || { duration: 0, stints: {} };
      return { ...prev, timerData: { ...prev.timerData, [period]: { ...pData, stints: { ...pData.stints, [playerId]: updatedStints } } } };
    });
    // Dot-notation: only update this player's stints — avoids overwriting others
    await writeDoc('matches', match.id, {
      [`timerData.${period}.stints.${playerId}`]: updatedStints,
    });
  };

  // ── Memos ────────────────────────────────────────────────────────

  const sortedPlayers = useMemo(() => {
    if (!match) return [];
    const src = team?.players || match.players || [];
    let players = [...src];
    if (sortBy === 'role') {
      players.sort((a, b) =>
        (getRoleConfig(team, a.role || 'receptor')?.order || 99) - (getRoleConfig(team, b.role || 'receptor')?.order || 99) ||
        parseInt(a.number) - parseInt(b.number)
      );
    } else {
      players.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    }
    // Solo filtra por asistencia si al menos un jugador está marcado como 'available'.
    // Si match.attendance es {} o nadie ha confirmado todavía, muestra todos.
    const hasConfirmed = match.attendance &&
      Object.values(match.attendance).some(a => a.status === 'available');
    if (hasConfirmed) {
      return players.filter(p => match.attendance[p.id]?.status === 'available');
    }
    return players;
  }, [match?.players, team?.players, match?.attendance, team?.roles, sortBy]);

  const validationErrors = useMemo(() => {
    if (isLibre || !match?.history) return {};
    const errors = {};
    const currentP = match.currentPeriod || 1;
    const notInjured = (p, i) => !(match.injuries || []).find(
      inj => inj.period === i && (inj.playerOut === p.id || inj.playerIn === p.id)
    );
    const inHistory = (p, i) => (match.history[i] || []).some(e => e === p.id || (e && e.id === p.id));

    sortedPlayers.forEach(p => {
      // Definitive: count ALL first-6 periods (catches free-edit future selections too)
      let playedAll = 0;
      for (let i = 1; i <= ruleset.checkPeriod; i++) {
        if (notInjured(p, i) && inHistory(p, i)) playedAll++;
      }
      if (playedAll > ruleset.maxPlay) { errors[p.id] = true; return; }
      const restedAll = ruleset.checkPeriod - playedAll;
      if (playedAll < ruleset.minPlay) { errors[p.id] = true; return; }
      if (restedAll < ruleset.minRest) { errors[p.id] = true; return; }

      // Predictive: only count up to currentP, check if requirements are still reachable
      let played = 0, rested = 0;
      for (let i = 1; i <= ruleset.checkPeriod; i++) {
        if (!notInjured(p, i)) continue;
        if (i <= currentP) { inHistory(p, i) ? played++ : rested++; }
      }
      const remaining = ruleset.checkPeriod - Math.min(ruleset.checkPeriod, currentP);
      if (played + remaining < ruleset.minPlay) { errors[p.id] = true; return; }
      if (played < ruleset.minPlay && currentP >= ruleset.checkPeriod) { errors[p.id] = true; return; }
      if (rested + remaining < ruleset.minRest) { errors[p.id] = true; return; }
      if (rested < ruleset.minRest && currentP >= ruleset.checkPeriod) { errors[p.id] = true; return; }
    });
    return errors;
  }, [match?.history, match?.currentPeriod, match?.injuries, sortedPlayers, isLibre]);

  const onCourtPlayers = useMemo(() => {
    if (!match?.history) return [];
    const ids = new Set(
      (match.history[match.currentPeriod] || [])
        .map(e => typeof e === 'object' ? e.id : e)
        .filter(id => sortedPlayers.some(p => p.id === id))
    );
    return sortedPlayers.filter(p => ids.has(p.id));
  }, [match?.history, match?.currentPeriod, sortedPlayers]);

  const forbiddenCells = useMemo(() => {
    if (isLibre || !match?.history) return {};
    const { checkPeriod, maxPlay, minRest } = ruleset;
    const result = {};
    sortedPlayers.forEach(p => {
      result[p.id] = {};
      for (let periodNum = 1; periodNum <= checkPeriod; periodNum++) {
        const arr = match.history[periodNum] || [];
        if (arr.some(e => e === p.id || (e && e.id === p.id))) continue;
        let playedExcluding = 0;
        for (let i = 1; i <= checkPeriod; i++) {
          if (i === periodNum) continue;
          if ((match.history[i] || []).some(e => e === p.id || (e && e.id === p.id))) playedExcluding++;
        }
        const wouldPlay = playedExcluding + 1;
        const wouldRest = checkPeriod - wouldPlay;
        if (wouldPlay > maxPlay || wouldRest < minRest) result[p.id][periodNum] = true;
      }
    });
    return result;
  }, [match?.history, sortedPlayers, isLibre]);

  // ── Handlers ─────────────────────────────────────────────────────

  const getPlayerPeriodsCount = (playerId) => {
    if (!match?.history) return 0;
    let count = 0;
    for (let i = 1; i <= totalPeriods; i++) {
      const arr = match.history[i] || [];
      const selected = Array.isArray(arr) && arr.some(e => e === playerId || e.id === playerId);
      if (selected && !(match.injuries || []).find(inj => inj.period === i && (inj.playerOut === playerId || inj.playerIn === playerId))) count++;
    }
    return count;
  };

  const togglePlayerInPeriod = async (playerId, period) => {
    if (!match || saving) return;

    const currentHistory = match.history || {};
    const currentRoles   = match.history_roles || {};
    const periodArray    = currentHistory[period] || [];
    const periodRoles    = currentRoles[period] || {};
    const entryIndex     = periodArray.findIndex(e => (typeof e === 'object' ? e.id === playerId : e === playerId));
    const isSelected     = entryIndex > -1;

    const persist = (newArr, newRoles) => {
      // Actualización inmediata — no bloquea la UI en modo offline
      setMatch(prev => ({
        ...prev,
        history: { ...(prev.history || {}), [period]: newArr },
        history_roles: { ...(prev.history_roles || {}), [period]: newRoles },
      }));
      writeDoc('matches', match.id, {
        [`history.${period}`]: newArr.map(e => typeof e === 'object' ? e.id : e),
        [`history_roles.${period}`]: newRoles,
      });
    };

    if (isSelected) {
      if (isLibre) {
        // Libre mode: tap selected player = remove and close their open stint
        await clearPlay(playerId, period);
        return;
      }
      // Role cycling — only in editable periods
      if (period !== match.currentPeriod && !isFreeEdit) {
        Alert.alert('Modo Lectura', 'Activa el modo de edición libre (candado) para modificar otros periodos.');
        return;
      }
      const availableRoles = getAvailableRoleKeys(team);
      const entry          = periodArray[entryIndex];
      const roleFromHist   = periodRoles[playerId] || (typeof entry === 'object' ? entry.role : null);
      const currentRole    = roleFromHist || 'receptor';
      const nextRole       = availableRoles[(availableRoles.indexOf(currentRole) + 1) % availableRoles.length];
      await persist(
        periodArray.map((e, idx) => idx === entryIndex ? playerId : e),
        { ...periodRoles, [playerId]: nextRole }
      );
    } else {
      const doAdd = async () => {
        const active = periodArray.filter(e => sortedPlayers.some(p => p.id === (typeof e === 'object' ? e.id : e)));
        if (active.length >= 5) {
          Alert.alert('Límite alcanzado', 'Solo puedes seleccionar 5 jugadores por periodo.');
          return;
        }
        await persist(
          [...periodArray, playerId],
          { ...periodRoles, [playerId]: sortedPlayers.find(p => p.id === playerId)?.role || 'receptor' }
        );
        if (period === match.currentPeriod) await openStintForPlayer(playerId);
      };

      // Pasarela: modal de confirmación si viola el reglamento
      if (!isLibre && period <= ruleset.checkPeriod) {
        let playedExcluding = 0;
        for (let i = 1; i <= ruleset.checkPeriod; i++) {
          if (i === period) continue;
          if ((currentHistory[i] || []).some(e => e === playerId || (e && e.id === playerId))) playedExcluding++;
        }
        const wouldPlay = playedExcluding + 1;
        const wouldRest = ruleset.checkPeriod - wouldPlay;
        if (wouldPlay > ruleset.maxPlay || wouldRest < ruleset.minRest) {
          const violationMsg = wouldPlay > ruleset.maxPlay
            ? `Jugaría ${wouldPlay} de los primeros ${ruleset.checkPeriod} periodos (máx. ${ruleset.maxPlay}).`
            : `Solo descansaría ${wouldRest} de los ${ruleset.checkPeriod} (mín. ${ruleset.minRest}).`;
          setConfirmModal({ title: 'Aviso Pasarela', msg: violationMsg, confirmLabel: 'Añadir igualmente', onConfirm: doAdd });
          return;
        }
      }

      // Modo lectura: periodo distinto al actual con candado cerrado
      if (period !== match.currentPeriod && !isFreeEdit) {
        setConfirmModal({ title: 'Periodo bloqueado', msg: 'Estás editando un periodo diferente al actual.', confirmLabel: 'Añadir', onConfirm: doAdd });
        return;
      }

      await doAdd();
    }
  };

  const handleAddOvertime = async () => {
    if (!match || saving) return;
    const newExtra = (match.extraPeriods || 0) + 1;
    try {
      setSaving(true);
      setMatch(prev => ({ ...prev, extraPeriods: newExtra }));
      await writeDoc('matches', match.id, { extraPeriods: newExtra });
    } catch { Alert.alert('Error', 'No se pudo añadir prórroga'); }
    finally { setSaving(false); }
  };

  const doRemoveOvertimePeriod = async (periodNum) => {
    if (!match || saving) return;
    const newExtra = periodNum - basePeriods - 1;
    try {
      setSaving(true);
      const update = { extraPeriods: newExtra };
      for (let i = periodNum; i <= totalPeriods; i++) {
        update[`history.${i}`] = deleteField();
      }
      setMatch(prev => {
        const newHistory = { ...prev.history };
        for (let i = periodNum; i <= totalPeriods; i++) delete newHistory[i];
        return { ...prev, extraPeriods: newExtra, history: newHistory };
      });
      await writeDoc('matches', match.id, update);
    } catch { Alert.alert('Error', 'No se pudo eliminar la prórroga'); }
    finally { setSaving(false); }
  };

  const handleRemoveOvertime = () => {
    if (!match || !match.extraPeriods || saving) return;
    const extras = match.extraPeriods;

    if (extras === 1) {
      const p = basePeriods + 1;
      setConfirmModal({
        title: 'Eliminar prórroga',
        msg: `¿Eliminar P${p}? Se perderán los datos de ese período.`,
        confirmLabel: 'Eliminar',
        onConfirm: () => doRemoveOvertimePeriod(p),
      });
    } else {
      setConfirmModal({
        title: 'Eliminar prórroga',
        msg: '¿Qué prórroga quieres eliminar?\nSe eliminarán también los períodos posteriores.',
        options: Array.from({ length: extras }, (_, i) => {
          const p = basePeriods + i + 1;
          return { label: `P${p}${i < extras - 1 ? ` (y P${p + 1}–P${basePeriods + extras})` : ''}`, onPress: () => doRemoveOvertimePeriod(p) };
        }),
      });
    }
  };

  const clearPlay = (playerId, period) => {
    if (!match) return;
    const currentHistory  = match.history || {};
    const currentRoles    = match.history_roles || {};
    const periodArray     = currentHistory[period] || [];
    const newPeriodArray  = periodArray.filter(e => (typeof e === 'object' ? e.id : e) !== playerId);
    const newPeriodRoles  = { ...(currentRoles[period] || {}) };
    delete newPeriodRoles[playerId];
    const newInjuries     = (match.injuries || []).filter(inj => !(inj.period === period && (inj.playerOut === playerId || inj.playerIn === playerId)));
    setMatch(prev => ({
      ...prev,
      history: { ...(prev.history || {}), [period]: newPeriodArray },
      history_roles: { ...(prev.history_roles || {}), [period]: newPeriodRoles },
      injuries: newInjuries,
    }));
    writeDoc('matches', match.id, {
      [`history.${period}`]: newPeriodArray.map(e => typeof e === 'object' ? e.id : e),
      [`history_roles.${period}`]: newPeriodRoles,
      injuries: newInjuries,
    });
    if (period === match.currentPeriod) closeStintForPlayer(playerId);
  };

  const handleClearPeriod = async (period) => {
    if (!match || saving) return;
    const doIt = async () => {
      try {
        setSaving(true);
        const isCurrentPeriod = period === (match.currentPeriod || 1);
        if (isCurrentPeriod && timerRunning) {
          setTimerRunning(false);
          setTimerElapsed(0);
        }
        const newInjuries    = (match.injuries || []).filter(inj => inj.period !== period);
        const newHistory     = { ...match.history, [period]: [] };
        const newHistoryRoles = { ...match.history_roles, [period]: {} };
        const newTimerData   = { ...(match.timerData || {}), [period]: {} };
        setMatch(prev => ({ ...prev, history: newHistory, history_roles: newHistoryRoles, injuries: newInjuries, timerData: newTimerData }));
        await writeDoc('matches', match.id, {
          [`history.${period}`]: [],
          [`history_roles.${period}`]: {},
          injuries: newInjuries,
          [`timerData.${period}`]: {},
          ...(isCurrentPeriod ? { timerStartedAt: null } : {}),
        });
      } catch { Alert.alert('Error', 'No se pudo limpiar el periodo'); }
      finally { setSaving(false); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar todas las entradas de P${period}?`)) doIt();
    } else {
      Alert.alert('Limpiar Periodo', `¿Eliminar todas las entradas de P${period}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  const handleSubstitutionConfirm = async () => {
    if (!selectedOut || !selectedIn || saving || !match) return;
    const newInjury      = { period: match.currentPeriod, playerOut: selectedOut, playerIn: selectedIn, timestamp: new Date().toISOString() };
    const updatedInjuries = [...(match.injuries || []), newInjury];
    const currentHistory = match.history || {};
    const currentRoles   = match.history_roles || {};
    const periodArray    = currentHistory[match.currentPeriod] || [];
    const newPeriodArray = periodArray.filter(e => (typeof e === 'object' ? e.id !== selectedOut : e !== selectedOut));
    const newPeriodRoles = { ...(currentRoles[match.currentPeriod] || {}) };
    delete newPeriodRoles[selectedOut];
    if (!newPeriodArray.some(e => (typeof e === 'object' ? e.id === selectedIn : e === selectedIn))) {
      newPeriodArray.push(selectedIn);
      newPeriodRoles[selectedIn] = sortedPlayers.find(p => p.id === selectedIn)?.role || 'receptor';
    }
    try {
      setSaving(true);
      const clean = newPeriodArray.map(e => typeof e === 'object' ? e.id : e);
      const period = match.currentPeriod || 1;
      const nowSec = timerElapsed;

      // Compute timerData changes inline (dot-notation, no overwrite of other players)
      const timerUpdates = {};
      let newTimerData = match.timerData;
      if (timerRunning) {
        // Close selectedOut's open stints
        const outStints = match.timerData?.[period]?.stints?.[selectedOut] || [];
        const closedStints = outStints.map(s => s.end === null || s.end === undefined ? { ...s, end: nowSec } : s);
        timerUpdates[`timerData.${period}.stints.${selectedOut}`] = closedStints;
        // Open selectedIn's stints (if no open stint already)
        const inStints = match.timerData?.[period]?.stints?.[selectedIn] || [];
        const hasOpen = inStints.some(s => s.end === null || s.end === undefined);
        if (!hasOpen) {
          const newInStints = [...inStints, { start: nowSec, end: null }];
          timerUpdates[`timerData.${period}.stints.${selectedIn}`] = newInStints;
          // Merge into local timerData for optimistic update
          const pData = match.timerData?.[period] || { duration: 0, stints: {} };
          newTimerData = { ...match.timerData, [period]: { ...pData, stints: { ...pData.stints, [selectedOut]: closedStints, [selectedIn]: newInStints } } };
        } else {
          const pData = match.timerData?.[period] || { duration: 0, stints: {} };
          newTimerData = { ...match.timerData, [period]: { ...pData, stints: { ...pData.stints, [selectedOut]: closedStints } } };
        }
      }

      setMatch({ ...match, history: { ...currentHistory, [period]: clean }, history_roles: { ...currentRoles, [period]: newPeriodRoles }, injuries: updatedInjuries, timerData: newTimerData });
      await writeDoc('matches', match.id, { injuries: updatedInjuries, [`history.${period}`]: clean, [`history_roles.${period}`]: newPeriodRoles, ...timerUpdates });
      setSubstitutionModalVisible(false); setSelectedOut(null); setSelectedIn(null);
    } catch { Alert.alert('Error', 'No se pudo aplicar la sustitución'); }
    finally { setSaving(false); }
  };

  // Close all open stints for current period and save duration — returns data for caller to use
  const flushCurrentPeriod = () => {
    const period = match.currentPeriod || 1;
    const nowSec = timerElapsed;
    const currentTimerData = match.timerData || {};
    const periodData = currentTimerData[period] || { duration: 0, stints: {} };
    const updatedStints = {};
    Object.entries(periodData.stints || {}).forEach(([pid, stints]) => {
      updatedStints[pid] = stints.map(s =>
        s.end === null || s.end === undefined ? { ...s, end: nowSec } : s
      );
    });
    const flushedPeriodData = { duration: nowSec, stints: updatedStints };
    const newTimerData = { ...currentTimerData, [period]: flushedPeriodData };
    setTimerRunning(false);
    // Do NOT reset timerElapsed here — caller sets it to the target period's saved duration
    return { newTimerData, firestoreUpdate: { [`timerData.${period}`]: flushedPeriodData, timerStartedAt: null } };
  };

  const handlePrevPeriod = async () => {
    if (!match || match.currentPeriod <= 1 || saving) return;
    const prevPeriod = match.currentPeriod - 1;
    const { newTimerData, firestoreUpdate } = flushCurrentPeriod();
    // Restore elapsed to whatever was saved for the previous period
    setTimerElapsed(newTimerData[prevPeriod]?.duration || 0);
    try {
      setSaving(true);
      setMatch(prev => ({ ...prev, currentPeriod: prevPeriod, timerData: newTimerData, timerStartedAt: null }));
      await writeDoc('matches', match.id, { currentPeriod: prevPeriod, ...firestoreUpdate });
    } catch { Alert.alert('Error', 'No se pudo cambiar el periodo'); }
    finally { setSaving(false); }
  };

  const handleNextPeriod = async () => {
    if (!match || saving) return;
    const nextPeriod = (match.currentPeriod || 1) + 1;
    if (nextPeriod > totalPeriods) return;
    const { newTimerData, firestoreUpdate } = flushCurrentPeriod();
    // Restore elapsed to whatever was saved for the next period (0 if never visited)
    setTimerElapsed(newTimerData[nextPeriod]?.duration || 0);
    try {
      setSaving(true);
      setMatch(prev => ({ ...prev, currentPeriod: nextPeriod, timerData: newTimerData, timerStartedAt: null }));
      await writeDoc('matches', match.id, { currentPeriod: nextPeriod, ...firestoreUpdate });
    } catch { Alert.alert('Error', 'No se pudo cambiar el periodo'); }
    finally { setSaving(false); }
  };

  const handleBodyScroll = (event) => {
    headerScrollRef.current?.scrollTo({ x: event.nativeEvent.contentOffset.x, animated: false });
  };

  const handleRemoveFromSquad = (playerId) => {
    if (!match || saving) return;
    const doRemove = async () => {
      try {
        setSaving(true);
        const ts = new Date().toISOString();
        setMatch(prev => ({ ...prev, attendance: { ...(prev.attendance || {}), [playerId]: { status: 'unavailable', timestamp: ts } } }));
        await writeDoc('matches', match.id, {
          [`attendance.${playerId}.status`]: 'unavailable',
          [`attendance.${playerId}.timestamp`]: ts,
        });
      } catch { Alert.alert('Error', 'No se pudo quitar el jugador'); }
      finally { setSaving(false); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Quitar este jugador de la convocatoria?')) doRemove();
      return;
    }
    Alert.alert('Quitar jugador', '¿Quitar este jugador de la convocatoria?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: doRemove },
    ]);
  };

  const openConfigModal = () => {
    setMatchForm({
      opponent:          match.opponent,
      date:              match.date,
      time:              match.time,
      callTime:          match.callTime || '',
      round:             match.round || '',
      location:          match.location || '',
      isHome:            match.isHome,
      notes:             match.notes || '',
      departureTime:     match.departureTime || '',
      transportType:     match.transportType || 'car',
      departureLocation: match.departureLocation || '',
      returnTime:        match.returnTime || '',
    });
    setConfigModalVisible(true);
  };

  const handleUpdateMatchConfig = async () => {
    if (!matchForm) return;
    try {
      setSaving(true);
      await writeDoc('matches', matchId, { ...matchForm });
      setConfigModalVisible(false);
      Alert.alert('Éxito', 'Partido actualizado');
    } catch { Alert.alert('Error', 'No se pudieron guardar los cambios'); }
    finally { setSaving(false); }
  };

  const openTimePicker = (fieldKey, label, currentValue) => {
    setActiveTimeField({ key: fieldKey, label, value: currentValue || '10:00' });
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (value) => {
    if (activeTimeField?.key && value) {
      setMatchForm(prev => ({ ...prev, [activeTimeField.key]: value }));
    }
    setTimePickerVisible(false);
    setActiveTimeField(null);
  };

  const copyToClipboard = async (text) => {
    await ClipboardAPI.setStringAsync(text);
    Alert.alert('Copiado', 'El texto se ha copiado al portapapeles');
  };

  const generateShareText = (type, lang = 'es') => {
    const isEs = lang === 'es';
    const squad = sortedPlayers.filter(p => match.attendance?.[p.id]?.status === 'available');
    let text = isEs ? `🏀 *${type === 'squad' ? 'CONVOCATORIA' : 'INFO PARTIDO'}* 🏀\n\n` : `🏀 *${type === 'squad' ? 'CONVOCATÒRIA' : 'INFO PARTIT'}* 🏀\n\n`;
    text += `${match.opponent}\n${match.date}\n`;
    text += isEs ? `Inicio: ${match.time}h\n` : `Inici: ${match.time}h\n`;
    if (type === 'squad') {
      text += isEs ? `Conv: ${match.callTime}h\n\n*JUGADORES:*` : `Conv: ${match.callTime}h\n\n*JUGADORS:*`;
      squad.forEach(p => { text += `\n- #${p.number} ${p.name}`; });
    } else {
      text += isEs ? `Ubicación: ${match.location || 'Local'}` : `Ubicació: ${match.location || 'Local'}`;
    }
    if (match.notes) text += `\n\n*Notas:* ${match.notes}`;
    copyToClipboard(text);
  };

  // ── Render helpers ────────────────────────────────────────────────

  const renderPlayerName = (player) => {
    const isFirst   = player.id === sortedPlayers[0]?.id;
    const isOnCourt = onCourtPlayers.some(p => p.id === player.id);
    const hasError  = validationErrors[player.id];

    // Libre: show time played MM:SS; Pasarela: show period count
    const periods   = getPlayerPeriodsCount(player.id);
    const secs      = isLibre ? calcPlayerSeconds(player.id) : 0;
    const pct       = isLibre
      ? Math.min(100, (secs / (totalPeriods * PERIOD_DURATION_S)) * 100)
      : Math.min(100, (periods / totalPeriods) * 100);
    const barLabel  = isLibre ? formatMSS(secs) : String(periods);

    return (
      <TouchableOpacity
        ref={isFirst ? firstPlayerRef : null}
        key={player.id}
        style={[styles.playerNameRow, isOnCourt && styles.playerNameRowActive, hasError && styles.playerNameRowError]}
        activeOpacity={0.75}
        delayLongPress={500}
        onLongPress={() => handleRemoveFromSquad(player.id)}
      >
        {isOnCourt && !hasError && <View style={styles.onCourtBar} />}
        {hasError && <View style={styles.ruleErrorBar} />}
        {/* Dorsal chip */}
        <View style={[styles.dorsalChip, { backgroundColor: isOnCourt ? T.pos : hasError ? T.negSoft : T.panel }]}>
          <Text style={[styles.dorsalText, { color: isOnCourt ? '#fff' : hasError ? T.neg : T.text }]}>
            {player.number}
          </Text>
        </View>
        {/* Name + progress bar */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {(() => {
              const rc = getRoleConfig(team, player.role, T.isDark);
              if (!rc) return null;
              return (
                <View style={[styles.playerPosChip, { backgroundColor: rc.bg }]}>
                  <Text style={[styles.playerPosChipText, { color: rc.color }]}>
                    {rc.label?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              );
            })()}
            <Text
              style={[styles.playerNameText, isOnCourt && styles.playerNameTextActive, hasError && styles.playerNameTextError]}
              numberOfLines={1}
            >{player.name}</Text>
            {hasError && <AlertTriangle color={T.neg} size={11} strokeWidth={2.5} />}
          </View>
          <View
            ref={isFirst ? progressBarRef : null}
            style={styles.minsBarTrack}
          >
            <View style={[styles.minsBarFill, { width: `${pct}%`, backgroundColor: isOnCourt ? T.pos : hasError ? T.neg : T.textFaint }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPlayerCells = (player) => {
    const isFirst = player.id === sortedPlayers[0]?.id;
    return (
    <View key={player.id} style={[styles.playerCellsRow, validationErrors[player.id] && styles.playerCellsRowError]}>
      {[...Array(totalPeriods)].map((_, i) => {
        const periodNum   = i + 1;
        const isFirstCell = isFirst && periodNum === 1;
        const periodArray = match.history[periodNum] || [];
        const entry       = periodArray.find(e => (typeof e === 'object' ? e.id === player.id : e === player.id));
        const isSelected  = !!entry;
        const assignedRole = (typeof entry === 'object' ? entry.role : null) || match.history_roles?.[periodNum]?.[player.id];
        const currentRole  = assignedRole || player.role || 'receptor';
        const isCurrentPeriod = match.currentPeriod === periodNum;
        const isReadOnly      = periodNum !== match.currentPeriod && !isFreeEdit;
        const injury          = (match.injuries || []).find(inj => inj.period === periodNum && (inj.playerOut === player.id || inj.playerIn === player.id));
        const roleConf        = getRoleConfig(team, currentRole, T.isDark);

        return (
          <TouchableOpacity
            ref={isFirstCell ? firstCellRef : null}
            key={periodNum}
            style={[styles.periodCell, isCurrentPeriod && styles.periodCellCurrent, isReadOnly && styles.periodCellReadOnly]}
            activeOpacity={0.6}
            onPress={() => togglePlayerInPeriod(player.id, periodNum)}
            onLongPress={() => { if (!isReadOnly) clearPlay(player.id, periodNum); }}
            delayLongPress={500}
          >
            {injury ? (
              <View style={[styles.injuryChip, { backgroundColor: injury.playerOut === player.id ? T.negSoft : T.posSoft }]}>
                {injury.playerOut === player.id
                  ? <ArrowDown color={T.neg} size={10} strokeWidth={2} />
                  : <ArrowUp color={T.pos} size={10} strokeWidth={2} />}
              </View>
            ) : isSelected ? (
              <View style={[styles.roleChip, { backgroundColor: roleConf?.bg || T.panelDeep }]}>
                <Text style={[styles.roleChipText, { color: roleConf?.color || T.textSub }]}>
                  {roleConf?.label?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            ) : forbiddenCells[player.id]?.[periodNum] ? (
              <Text style={styles.forbiddenExcl}>!</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
      {/* Total / Minutos */}
      <View style={[styles.totalCell, validationErrors[player.id] && styles.totalCellError]}>
        <Text style={[styles.totalText, validationErrors[player.id] && styles.totalTextError]}>
          {isLibre
            ? (() => { const s = calcPlayerSeconds(player.id); return s > 0 ? formatMSS(s) : '—'; })()
            : getPlayerPeriodsCount(player.id)}
        </Text>
      </View>
    </View>
  );
  };

  // ── Loading ──────────────────────────────────────────────────────

  if (loading || !match) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  const currentPeriod  = match.currentPeriod || 1;
  const onCourtCount   = onCourtPlayers.length;
  const isFinished     = match.state === 'finished';

  // ── Render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.ink2 }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>

        {/* ══ Scoreboard header ══════════════════════════════════════ */}
        <LinearGradient
          colors={[T.ink2, T.ink]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.header}
        >
          <GridPattern uid="mm" />

          {/* Top row: nav + actions */}
          <View style={styles.headerTop}>
            {!IS_TABLET_LANDSCAPE && (
              <TouchableOpacity ref={menuBtnRef} style={styles.backBtn} onPress={() => setDrawerOpen(true)}>
                <Menu color="#fff" size={20} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <TouchableOpacity
                ref={convocatoriaRef}
                style={styles.headerIconBtn}
                onPress={() => navigation.navigate('MatchAttendance', { matchId, teamId })}
              >
                <Users color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />
              </TouchableOpacity>
              {isLibre && (
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => navigation.navigate('MatchSummary', { match, team, totalPeriods, timerElapsed, timerRunning, currentPeriod: match.currentPeriod || 1 })}
                >
                  <BarChart2 color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                ref={freeEditBtnRef}
                style={[styles.headerIconBtn, isFreeEdit && styles.headerIconBtnActive]}
                onPress={() => setIsFreeEdit(!isFreeEdit)}
              >
                {isFreeEdit
                  ? <Unlock color={T.orange} size={18} strokeWidth={1.8} />
                  : <Lock color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn} onPress={openConfigModal}>
                <Settings color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>
                <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Match info row */}
          <View ref={headerInfoRef} style={styles.headerInfoRow}>
            <Text style={styles.headerOpponent} numberOfLines={1}>{match.opponent}</Text>
            <Text style={styles.headerInfoSep}>·</Text>
            <Text style={styles.headerInfoMeta}>{formatDate(match.date)}</Text>
            <Text style={styles.headerInfoSep}>·</Text>
            <Text style={styles.headerInfoMeta}>{match.time}H</Text>
          </View>

          {/* Libre timer row */}
          {isLibre && (
            <View style={styles.timerRow}>
              <TouchableOpacity style={styles.timerBtn} onPress={handleToggleTimer}>
                {timerRunning
                  ? <Pause color={T.orange} size={18} strokeWidth={2} />
                  : <Play color="rgba(255,255,255,0.8)" size={18} strokeWidth={2} />}
                <Text style={[styles.timerText, timerRunning && { color: T.orange }]}>
                  {formatTimer(timerElapsed)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timerResetBtn} onPress={handleResetTimer}>
                <RotateCcw color="rgba(255,255,255,0.45)" size={15} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        <OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

        {/* ══ Matrix + right panel ══════════════════════════════════ */}
        <View style={IS_TABLET_LANDSCAPE ? styles.matrixRow : { flex: 1 }}>
        <View style={[styles.matrixWrapper, IS_TABLET_LANDSCAPE && { flex: 0.65 }]}>
          {/* Column header row */}
          <View style={styles.tableHeaderSection}>
            <TouchableOpacity
              ref={sortHeaderRef}
              style={styles.jugadorHeader}
              onPress={() => setSortBy(sortBy === 'number' ? 'role' : 'number')}
            >
              <Text style={styles.colHeaderText}>Jugador</Text>
              <View style={styles.sortToggleChip}>
                <Text style={styles.sortToggleText}>{sortBy === 'role' ? 'POS' : '#'}</Text>
              </View>
            </TouchableOpacity>
            <ScrollView
              horizontal ref={headerScrollRef}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.periodsHeaderScroll}
            >
              <View ref={periodsHeaderRef} style={styles.periodsHeaderContainer}>
                {[...Array(totalPeriods)].map((_, i) => {
                  const periodNum   = i + 1;
                  const periodArray = match.history[periodNum] || [];
                  const count = periodArray.filter(e => {
                    const pid = typeof e === 'object' ? e.id : e;
                    return sortedPlayers.some(p => p.id === pid);
                  }).length;
                  const isCurrent = currentPeriod === periodNum;
                  const bg    = count === 5 ? T.posSoft : count > 0 ? T.negSoft : T.panel;
                  const color = count === 5 ? T.posDark : count > 0 ? '#B91C1C' : T.textFaint;
                  return (
                    <View key={i} style={[
                      styles.periodHeaderCell,
                      { backgroundColor: bg, borderBottomColor: isCurrent ? T.orange : T.border, borderBottomWidth: isCurrent ? 2 : 1 },
                    ]}>
                      <Text style={[styles.periodHeaderText, { color }, isCurrent && { fontFamily: T.fontBlack }]}>
                        P{periodNum}
                      </Text>
                      {count > 0 && (
                        <Text style={[styles.periodCountText, { color }]}>{count}</Text>
                      )}
                    </View>
                  );
                })}
                <View style={styles.totalHeaderCell}>
                  <Text style={styles.colHeaderText}>{isLibre ? 'Min' : 'Tot'}</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Body */}
          <ScrollView
            ref={tableBodyScrollRef}
            showsVerticalScrollIndicator={false}
            style={styles.tableBodyScroll}
            onScroll={(e) => { tableBodyScrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
          >
            <View style={styles.tableBodyRowContainer}>
              {/* Names column */}
              <View style={styles.namesColumnContainer}>
                {sortedPlayers.map(renderPlayerName)}
                <View style={styles.emptyHeaderPlaceholder} />
              </View>
              {/* Cells */}
              <ScrollView
                horizontal
                ref={bodyScrollRef}
                onScroll={handleBodyScroll}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={Platform.OS === 'web'}
                nestedScrollEnabled={true}
                style={[
                  styles.cellsHorizontalScroll,
                  Platform.OS === 'web' && { touchAction: 'pan-x' },
                ]}
              >
                <View>
                  {sortedPlayers.length === 0
                    ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay jugadores convocados.</Text></View>
                    : sortedPlayers.map(renderPlayerCells)}
                  {/* Trash row */}
                  <View style={styles.trashRow}>
                    {[...Array(totalPeriods)].map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.trashCell}
                        onPress={() => handleClearPeriod(i + 1)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Trash2 color={T.neg} size={11} strokeWidth={1.6} />
                      </TouchableOpacity>
                    ))}
                    <View style={styles.totalHeaderCell} />
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* En pista chips */}
            {onCourtPlayers.length > 0 && (
              <View style={styles.enPistaCard}>
                <View style={styles.enPistaCardHeader}>
                  <Users color={T.textSub} size={12} strokeWidth={1.8} />
                  <Text style={styles.enPistaCardTitle}>EN PISTA P{currentPeriod}</Text>
                </View>
                {/* Basketball court visualization */}
                <View style={styles.courtContainer}>
                  <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 165">
                    {/* Court surface */}
                    <SvgRect width="300" height="165" rx="8" fill="#16315E" />
                    {/* Court border */}
                    <SvgRect x="4" y="4" width="292" height="157" rx="5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    {/* Three-point arc */}
                    <SvgPath d="M 20 163 A 132 132 0 0 1 280 163" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                    {/* Paint (key) */}
                    <SvgRect x="115" y="105" width="70" height="58" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                    {/* Free throw circle (top half only) */}
                    <SvgPath d="M 115 105 A 35 35 0 0 1 185 105" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                    {/* Backboard */}
                    <SvgRect x="135" y="156" width="30" height="3" rx="1.5" fill="rgba(255,140,0,0.65)" />
                    {/* Basket */}
                    <SvgCircle cx="150" cy="159" r="6" fill="none" stroke="rgba(255,140,0,0.65)" strokeWidth="2" />
                  </Svg>
                  {/* Player badges */}
                  {(() => {
                    const COURT_SLOTS = {
                      1: { left: '50%', top: '10%' },
                      2: { left: '14%', top: '32%' },
                      3: { left: '86%', top: '32%' },
                      4: { left: '28%', top: '68%' },
                      5: { left: '72%', top: '68%' },
                    };
                    const usedSlots = new Set();
                    return onCourtPlayers.slice(0, 5).map((p, idx) => {
                      const entry     = (match.history[currentPeriod] || []).find(e => (typeof e === 'object' ? e.id === p.id : e === p.id));
                      const entryRole = typeof entry === 'object' ? entry.role : match.history_roles?.[currentPeriod]?.[p.id];
                      const roleConf  = getRoleConfig(team, entryRole || p.role || 'receptor', T.isDark);
                      const posNum    = roleConf?.position;
                      let slotKey = posNum && !usedSlots.has(posNum) ? posNum : [1,2,3,4,5].find(n => !usedSlots.has(n)) || idx + 1;
                      usedSlots.add(slotKey);
                      const pos = COURT_SLOTS[slotKey] || COURT_SLOTS[1];
                      const firstName = p.name.split(' ')[0].substring(0, 7);
                      return (
                        <View key={p.id} style={[styles.courtPlayerBadge, { left: pos.left, top: pos.top }]}>
                          <View style={[styles.courtPlayerCircle, { backgroundColor: roleConf?.color || T.textSub }]}>
                            <Text style={styles.courtPlayerNum}>{p.number}</Text>
                          </View>
                          <View style={styles.courtPlayerNamePill}>
                            <Text style={styles.courtPlayerName} numberOfLines={1}>{firstName}</Text>
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            )}

            {/* Secondary view buttons */}
            <View ref={viewBtnsRef} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 14, marginTop: 12 }}>
              <TouchableOpacity style={[styles.viewBtn, { flex: 1 }]} onPress={() => setListViewVisible(true)}>
                <List color={T.textSub} size={14} strokeWidth={1.8} />
                <Text style={styles.viewBtnText}>POR PERIODOS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.viewBtn, { flex: 1 }]} onPress={() => setCompactViewVisible(true)}>
                <LayoutGrid color={T.textSub} size={14} strokeWidth={1.8} />
                <Text style={styles.viewBtnText}>COMPACTA</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.overtimeRow}>
              <TouchableOpacity
                ref={addOvertimeBtnRef}
                style={[styles.addOvertimeBtn, { flex: 1 }]}
                onPress={handleAddOvertime}
                disabled={saving}
              >
                <Text style={styles.addOvertimeBtnText}>+ Prórroga</Text>
              </TouchableOpacity>
              {!!(match?.extraPeriods) && (
                <TouchableOpacity
                  style={styles.removeOvertimeBtn}
                  onPress={handleRemoveOvertime}
                  disabled={saving}
                >
                  <Trash2 color={T.neg} size={15} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 120 }} />
          </ScrollView>
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
              <View style={[styles.rpSection, { flex: 1 }]}>
                <Text style={styles.rpLabel}>MINUTOS JUGADOS</Text>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {sortedPlayers.map(p => {
                    const periodsPlayed = [...Array(totalPeriods)].filter((_, i) => {
                      const periodArray = match.history[i + 1] || [];
                      return periodArray.some(e => (typeof e === 'object' ? e.id : e) === p.id);
                    }).length;
                    const roleConf = getRoleConfig(team, p.role || 'receptor', T.isDark);
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
                    {match.injuries.map((inj, i) => {
                      const injuredPlayer = sortedPlayers.find(p => p.id === inj.playerOut) || sortedPlayers.find(p => p.id === inj.playerIn);
                      return (
                        <Text key={i} style={styles.rpInjuryText} numberOfLines={1}>
                          ⚠ {injuredPlayer?.name || `Jugador ${i + 1}`}
                        </Text>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* ══ Bottom action bar ══════════════════════════════════════ */}
        <View style={[styles.bottomBar, { bottom: 20 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.periodNavBtn, (currentPeriod <= 1 || saving) && styles.disabledBtn]}
            onPress={handlePrevPeriod}
            disabled={currentPeriod <= 1 || saving}
          >
            <ChevronLeft color="#fff" size={20} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sustBtn}
            onPress={() => setSubstitutionModalVisible(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[T.orange, T.orangeDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
            />
            <View style={styles.sustPeriodBadge}>
              <Text style={styles.sustPeriodText}>P{currentPeriod}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ArrowUp color="#fff" size={16} strokeWidth={2} />
              <ArrowDown color="#fff" size={16} strokeWidth={2} style={{ marginLeft: -8 }} />
            </View>
            <Text style={styles.sustBtnText}>SUSTITUCIÓN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            ref={nextPeriodBtnRef}
            style={[styles.periodNavBtn, (currentPeriod >= totalPeriods || saving) && styles.disabledBtn]}
            onPress={handleNextPeriod}
            disabled={currentPeriod >= totalPeriods || saving}
          >
            <ChevronRight color="#fff" size={20} strokeWidth={2} />
          </TouchableOpacity>
        </View>

      </View>

      {/* ══ Modal: Sustitución ═══════════════════════════════════════ */}
      <Modal visible={substitutionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleBar} />
            <Text style={styles.modalTitle}>Sustitución · P{currentPeriod}</Text>
            <Text style={styles.modalSubLabel}>Sale (lesionado)</Text>
            <View style={styles.playerBtnRow}>
              {sortedPlayers
                .filter(p => (match.history[currentPeriod] || []).some(e => (typeof e === 'object' ? e.id === p.id : e === p.id)))
                .map(p => (
                  <TouchableOpacity key={p.id} style={[styles.playerBtn, selectedOut === p.id && styles.playerBtnOut]} onPress={() => setSelectedOut(p.id)}>
                    <Text style={styles.playerBtnText}>{p.number} · {p.name}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <ArrowDown color={T.border} size={22} />
            </View>
            <Text style={styles.modalSubLabel}>Entra</Text>
            <View style={styles.playerBtnRow}>
              {sortedPlayers
                .filter(p => !(match.history[currentPeriod] || []).some(e => (typeof e === 'object' ? e.id === p.id : e === p.id)))
                .map(p => (
                  <TouchableOpacity key={p.id} style={[styles.playerBtn, selectedIn === p.id && styles.playerBtnIn]} onPress={() => setSelectedIn(p.id)}>
                    <Text style={styles.playerBtnText}>{p.number} · {p.name}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setSubstitutionModalVisible(false); setSelectedOut(null); setSelectedIn(null); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!selectedOut || !selectedIn) && { opacity: 0.4 }]}
                disabled={!selectedOut || !selectedIn}
                onPress={handleSubstitutionConfirm}
              >
                <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: T.rBtnLg }]} />
                <Text style={styles.modalConfirmText}>Confirmar cambio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Editar partido ════════════════════════════════════ */}
      <Modal visible={configModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: T.panel }}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* Dark header */}
            <LinearGradient colors={[T.ink2, T.ink]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.configHeader}>
              <GridPattern uid="cfg" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setConfigModalVisible(false)}>
                    <ChevronLeft color="#fff" size={16} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <View>
                    <Text style={[styles.headerEyebrow, { color: T.orange }]}>EDITAR PARTIDO</Text>
                    <Text style={styles.configHeaderTitle}>
                      {matchForm?.opponent || match.opponent}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.saveQuickBtn} onPress={handleUpdateMatchConfig} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Save color="#fff" size={18} strokeWidth={2} />}
                </TouchableOpacity>
              </View>
              {/* Progress steps */}
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
                {[['Rival', true], ['Fecha', true], ['Ubicación', true], ['Viaje', !matchForm?.isHome]].map(([s, done], i) => (
                  <View key={s} style={{ flex: 1, gap: 3 }}>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: done ? T.orange : 'rgba(255,255,255,0.12)' }} />
                    <Text style={{ fontSize: 9, fontFamily: T.fontBold, color: done ? '#fff' : 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
                      0{i + 1} · {s}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            {/* Form body */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Card 01 — Rival y localía */}
              <View style={styles.formCard}>
                <View style={styles.formCardHead}>
                  <Text style={styles.formCardNum}>01</Text>
                  <Text style={styles.formCardTitle}>Rival y localía</Text>
                </View>
                <Text style={styles.formLabel}>Equipo rival</Text>
                <TextInput style={styles.formInput} value={matchForm?.opponent} onChangeText={t => setMatchForm({ ...matchForm, opponent: t })} placeholder="Rival" placeholderTextColor={T.textFaint} />
                <View style={[styles.segmented, { marginTop: 12 }]}>
                  <TouchableOpacity style={[styles.segBtn, matchForm?.isHome && styles.segBtnActive]} onPress={() => setMatchForm({ ...matchForm, isHome: true })}>
                    <Text style={[styles.segText, matchForm?.isHome && styles.segTextActive]}>LOCAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.segBtn, !matchForm?.isHome && styles.segBtnOrange]} onPress={() => setMatchForm({ ...matchForm, isHome: false })}>
                    <Text style={[styles.segText, !matchForm?.isHome && styles.segTextOrange]}>VISITANTE</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card 02 — Fecha, hora, ubicación */}
              <View style={styles.formCard}>
                <View style={styles.formCardHead}>
                  <Text style={styles.formCardNum}>02</Text>
                  <Text style={styles.formCardTitle}>Fecha, hora y lugar</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Fecha</Text>
                    <TextInput style={[styles.formInput, { fontFamily: T.mono }]} value={matchForm?.date} onChangeText={t => setMatchForm({ ...matchForm, date: t })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Hora inicio</Text>
                    <TouchableOpacity style={styles.formInputTouchable} onPress={() => openTimePicker('time', 'Hora Inicio', matchForm?.time)}>
                      <Text style={[styles.formInputText, { fontFamily: T.mono }]}>{matchForm?.time || '--:--'}</Text>
                      <Clock color={T.textFaint} size={14} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Convocatoria</Text>
                    <TouchableOpacity style={styles.formInputTouchable} onPress={() => openTimePicker('callTime', 'Convocatoria', matchForm?.callTime)}>
                      <Text style={[styles.formInputText, { fontFamily: T.mono, color: matchForm?.callTime ? T.text : T.textFaint }]}>{matchForm?.callTime || '--:--'}</Text>
                      <Clock color={T.textFaint} size={14} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Jornada</Text>
                    <TextInput style={styles.formInput} value={matchForm?.round} onChangeText={t => setMatchForm({ ...matchForm, round: t })} placeholder="—" placeholderTextColor={T.textFaint} />
                  </View>
                </View>
                <Text style={[styles.formLabel, { marginTop: 10 }]}>Ubicación</Text>
                <TextInput style={styles.formInput} value={matchForm?.location} onChangeText={t => setMatchForm({ ...matchForm, location: t })} placeholder="Pabellón…" placeholderTextColor={T.textFaint} />
              </View>

              {/* Card 03 — Desplazamiento (solo visitante) */}
              {!matchForm?.isHome && (
                <View style={[styles.formCard, styles.formCardVisitante]}>
                  <View style={styles.visitanteTag}><Text style={styles.visitanteTagText}>VISITANTE</Text></View>
                  <View style={styles.formCardHead}>
                    <Text style={styles.formCardNum}>03</Text>
                    <Text style={styles.formCardTitle}>Desplazamiento</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Hora salida</Text>
                      <TouchableOpacity style={styles.formInputTouchable} onPress={() => openTimePicker('departureTime', 'Hora Salida', matchForm?.departureTime)}>
                        <Text style={[styles.formInputText, { fontFamily: T.mono, color: matchForm?.departureTime ? T.text : T.textFaint }]}>{matchForm?.departureTime || '--:--'}</Text>
                        <Clock color={T.textFaint} size={14} strokeWidth={1.8} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Hora vuelta</Text>
                      <TouchableOpacity style={styles.formInputTouchable} onPress={() => openTimePicker('returnTime', 'Hora Vuelta', matchForm?.returnTime)}>
                        <Text style={[styles.formInputText, { fontFamily: T.mono, color: matchForm?.returnTime ? T.text : T.textFaint }]}>{matchForm?.returnTime || '--:--'}</Text>
                        <Clock color={T.textFaint} size={14} strokeWidth={1.8} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.formLabel, { marginTop: 10 }]}>Transporte</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.transportBtn, matchForm?.transportType === 'bus' && styles.transportBtnActive]}
                      onPress={() => setMatchForm({ ...matchForm, transportType: 'bus' })}
                    >
                      <Bus color={matchForm?.transportType === 'bus' ? T.orange : T.textSub} size={16} strokeWidth={1.8} />
                      <Text style={[styles.transportBtnText, matchForm?.transportType === 'bus' && { color: T.orange }]}>Bus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.transportBtn, matchForm?.transportType === 'car' && styles.transportBtnActive]}
                      onPress={() => setMatchForm({ ...matchForm, transportType: 'car' })}
                    >
                      <Car color={matchForm?.transportType === 'car' ? T.orange : T.textSub} size={16} strokeWidth={1.8} />
                      <Text style={[styles.transportBtnText, matchForm?.transportType === 'car' && { color: T.orange }]}>Coches</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.formLabel, { marginTop: 10 }]}>Lugar de salida</Text>
                  <TextInput style={styles.formInput} value={matchForm?.departureLocation} onChangeText={t => setMatchForm({ ...matchForm, departureLocation: t })} placeholder="Pabellón propio" placeholderTextColor={T.textFaint} />
                </View>
              )}

              {/* Card 04 — Notas */}
              <View style={styles.formCard}>
                <View style={styles.formCardHead}>
                  <Text style={styles.formCardNum}>{!matchForm?.isHome ? '04' : '03'}</Text>
                  <Text style={styles.formCardTitle}>Observaciones</Text>
                </View>
                <TextInput
                  style={[styles.formInput, { height: 72, textAlignVertical: 'top' }]}
                  value={matchForm?.notes}
                  onChangeText={t => setMatchForm({ ...matchForm, notes: t })}
                  placeholder="Notas del partido…"
                  placeholderTextColor={T.textFaint}
                  multiline
                />
              </View>

              {/* Share cards */}
              <View style={[styles.formCard, { gap: 10 }]}>
                <Text style={styles.shareCardTitle}>COPIAR CONVOCATORIA</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.shareBtn, { backgroundColor: T.orangeSoft }]} onPress={() => generateShareText('squad', 'ca')}>
                    <Clipboard color={T.orangeDeep} size={14} /><Text style={[styles.shareBtnText, { color: T.orangeDeep }]}>Valencià</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shareBtn, { backgroundColor: T.posSoft }]} onPress={() => generateShareText('squad', 'es')}>
                    <Clipboard color={T.posDark} size={14} /><Text style={[styles.shareBtnText, { color: T.posDark }]}>Castellano</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.shareCardTitle}>COPIAR INFO PARTIDO</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.shareBtn, { backgroundColor: T.orangeSoft }]} onPress={() => generateShareText('info', 'ca')}>
                    <Clipboard color={T.orangeDeep} size={14} /><Text style={[styles.shareBtnText, { color: T.orangeDeep }]}>Valencià</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shareBtn, { backgroundColor: T.posSoft }]} onPress={() => generateShareText('info', 'es')}>
                    <Clipboard color={T.posDark} size={14} /><Text style={[styles.shareBtnText, { color: T.posDark }]}>Castellano</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: T.blueSoft, marginTop: 2 }]}
                  onPress={() => copyToClipboard('https://jorgipons.github.io/ANTIGRAVITY/basketball-manager/?matchId=' + matchId)}
                >
                  <ExternalLink color={T.blue} size={14} />
                  <Text style={[styles.shareBtnText, { color: T.blue }]}>Copiar enlace de asistencia</Text>
                </TouchableOpacity>
              </View>

              {/* Footer actions */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.configDiscardBtn}
                  onPress={() => setConfigModalVisible(false)}
                >
                  <Text style={styles.configDiscardText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.configSaveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleUpdateMatchConfig}
                  disabled={saving}
                >
                  <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: T.rBtnLg }]} />
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Check color="#fff" size={15} strokeWidth={2} /><Text style={styles.configSaveText}>Guardar cambios</Text></>}
                </TouchableOpacity>
              </View>

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => Alert.alert('Eliminar', '¿Seguro que quieres eliminar este partido?', [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Eliminar', style: 'destructive',
                    onPress: async () => {
                      setConfigModalVisible(false);
                      try {
                        await deleteDoc(doc(db, 'matches', matchId));
                      } catch {
                        Alert.alert('Error', 'No se pudo eliminar el partido');
                        return;
                      }
                      navigation.goBack();
                    },
                  },
                ])}
              >
                <Text style={styles.deleteBtnText}>Eliminar partido</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ══ Modal: Selector de hora ══════════════════════════════════ */}
      <Modal visible={timePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingTop: 0 }]}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.modalTitle}>{activeTimeField?.label || 'Seleccionar hora'}</Text>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <XCircle color={T.textFaint} size={22} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={styles.formLabel}>HORA</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {[...Array(24)].map((_, h) => {
                  const hs = h.toString().padStart(2, '0');
                  const active = (activeTimeField?.value?.split(':')[0] || '10') === hs;
                  return (
                    <TouchableOpacity key={h} style={[styles.timeSlot, active && styles.timeSlotActive]}
                      onPress={() => setActiveTimeField({ ...activeTimeField, value: `${hs}:${activeTimeField?.value?.split(':')[1] || '00'}` })}>
                      <Text style={[styles.timeSlotText, active && styles.timeSlotTextActive]}>{hs}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.formLabel}>MINUTOS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => {
                  const active = (activeTimeField?.value?.split(':')[1] || '00') === m;
                  return (
                    <TouchableOpacity key={m} style={[styles.timeSlot, active && styles.timeSlotActive]}
                      onPress={() => setActiveTimeField({ ...activeTimeField, value: `${activeTimeField?.value?.split(':')[0] || '10'}:${m}` })}>
                      <Text style={[styles.timeSlotText, active && styles.timeSlotTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.configSaveBtn]}
                onPress={() => handleTimeConfirm(activeTimeField?.value)}
              >
                <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: T.rBtnLg }]} />
                <Check color="#fff" size={15} strokeWidth={2} />
                <Text style={styles.configSaveText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Vista por periodos ════════════════════════════════ */}
      <Modal visible={listViewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandleBar} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Jugadores por periodo</Text>
              <TouchableOpacity onPress={() => setListViewVisible(false)}>
                <Text style={{ fontFamily: T.fontBold, color: T.textSub }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[...Array(totalPeriods)].map((_, i) => {
                const pn = i + 1;
                const pls = (match.history[pn] || [])
                  .map(e => { const pid = typeof e === 'object' ? e.id : e; return sortedPlayers.find(p => p.id === pid); })
                  .filter(Boolean);
                return (
                  <View key={pn} style={[styles.listViewPeriod, pn === currentPeriod && { borderColor: T.orange }]}>
                    <Text style={[styles.listViewPeriodTitle, pn === currentPeriod && { color: T.orange }]}>P{pn}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {pls.length > 0 ? pls.map(p => {
                        const rc = getRoleConfig(team, match.history_roles?.[pn]?.[p.id] || p.role || 'receptor', T.isDark);
                        return (
                          <View key={p.id} style={styles.listViewTag}>
                            <Text style={styles.listViewTagNum}>{p.number}</Text>
                            <Text style={styles.listViewTagName}>{p.name}</Text>
                            <View style={[styles.listViewTagDot, { backgroundColor: rc.color }]} />
                          </View>
                        );
                      }) : <Text style={{ fontSize: 11, color: T.textFaint, fontFamily: T.fontMed }}>Sin jugadores</Text>}
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Vista compacta ════════════════════════════════════ */}
      <Modal visible={compactViewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandleBar} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Vista compacta</Text>
              <TouchableOpacity onPress={() => setCompactViewVisible(false)}>
                <Text style={{ fontFamily: T.fontBold, color: T.textSub }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.compactTable}>
                {sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={[styles.compactRow, { backgroundColor: idx % 2 === 0 ? T.bg : T.panel }]}>
                    <Text style={styles.compactNum}>{p.number}</Text>
                    <Text style={styles.compactName}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {[...Array(totalPeriods)].map((_, i) => {
                        const sel = match.history[i + 1]?.some(e => (typeof e === 'object' ? e.id === p.id : e === p.id));
                        return (
                          <View key={i} style={[styles.compactDot, { backgroundColor: sel ? T.orange : T.border }]}>
                            {sel && <Text style={styles.compactDotText}>{i + 1}</Text>}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Confirmación Pasarela / Periodo bloqueado ═══════ */}
      <Modal visible={!!confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{confirmModal?.title}</Text>
            <Text style={styles.confirmMsg}>{confirmModal?.msg}</Text>
            {confirmModal?.options ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                {confirmModal.options.map(opt => (
                  <TouchableOpacity
                    key={opt.label}
                    style={styles.confirmOptionBtn}
                    onPress={() => { setConfirmModal(null); opt.onPress(); }}
                  >
                    <Text style={styles.confirmOptionText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.confirmCancelBtn, { marginTop: 4 }]} onPress={() => setConfirmModal(null)}>
                  <Text style={styles.confirmCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.confirmBtnRow}>
                <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmModal(null)}>
                  <Text style={styles.confirmCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmOkBtn}
                  onPress={() => {
                    const fn = confirmModal?.onConfirm;
                    setConfirmModal(null);
                    fn && fn();
                  }}
                >
                  <LinearGradient colors={[T.orange, T.orangeDeep]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <Text style={styles.confirmOkText}>{confirmModal?.confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />
      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} scrollRef={tableBodyScrollRef} scrollOffsetRef={tableBodyScrollOffsetRef} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (COLUMN_WIDTH, NAME_COLUMN_WIDTH, IS_TABLET, T) => StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  headerInfoRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap',
    marginTop: 8, gap: 6,
  },
  headerOpponent: {
    fontSize: IS_TABLET ? 16 : 15, fontFamily: T.fontBlack, color: '#fff',
    letterSpacing: -0.3, flexShrink: 1,
  },
  headerInfoSep: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: T.fontReg,
  },
  headerInfoMeta: {
    fontSize: 12, fontFamily: T.mono, color: 'rgba(255,255,255,0.55)',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  headerIconBtnActive: {
    backgroundColor: 'rgba(255,106,44,0.18)',
    borderColor: 'rgba(255,106,44,0.3)',
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: T.rPill,
    backgroundColor: 'rgba(229,72,72,0.18)',
    borderWidth: 1, borderColor: 'rgba(229,72,72,0.3)',
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: '#FCA5A5',
  },
  livePillText: {
    fontSize: 9, fontFamily: T.fontBold, color: '#FCA5A5', letterSpacing: 0.5,
  },
  timerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10,
  },
  timerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.rBtn,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  timerText: {
    fontFamily: T.monoBold, fontSize: 20, color: 'rgba(255,255,255,0.8)', letterSpacing: 1,
  },
  timerResetBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  statsCol: {},
  statsLabel: {
    fontSize: 9, fontFamily: T.fontBold, color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  statsPeriod: {
    fontFamily: T.monoBold, fontSize: IS_TABLET ? 28 : 22,
    color: '#fff', letterSpacing: -0.8, lineHeight: IS_TABLET ? 34 : 26,
  },
  enPistaNum: {
    fontFamily: T.monoBold, fontSize: IS_TABLET ? 34 : 28,
    letterSpacing: -1, lineHeight: IS_TABLET ? 38 : 32,
  },
  enPistaSlash: {
    fontFamily: T.monoBold, fontSize: IS_TABLET ? 20 : 16,
    color: 'rgba(255,255,255,0.35)', letterSpacing: -0.5,
  },

  // Period strip
  periodStrip: {
    flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8,
    gap: 4, backgroundColor: T.bg,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  periodStripBtn: {
    flex: 1, paddingVertical: 6, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border,
    backgroundColor: 'transparent',
  },
  periodStripBtnActive: {
    backgroundColor: T.ink, borderColor: T.ink,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  periodStripBtnDone: {
    backgroundColor: T.panel, borderColor: T.border,
  },
  periodStripText: {
    fontSize: 11, fontFamily: T.fontBold, color: T.textFaint,
  },
  periodStripTextActive: {
    color: '#fff', fontFamily: T.fontBlack,
  },
  periodStripTextDone: {
    color: T.text,
  },

  // Matrix
  matrixWrapper: {
    flex: 1, backgroundColor: T.bg,
  },
  tableHeaderSection: {
    flexDirection: 'row', height: IS_TABLET ? 52 : 46,
    backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border, zIndex: 20,
  },
  jugadorHeader: {
    width: NAME_COLUMN_WIDTH, height: IS_TABLET ? 52 : 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, backgroundColor: T.bg,
    borderRightWidth: 1, borderRightColor: T.border,
  },
  periodsHeaderScroll: { flex: 1 },
  periodsHeaderContainer: { flexDirection: 'row' },
  periodHeaderCell: {
    width: COLUMN_WIDTH, height: IS_TABLET ? 52 : 46,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: T.border,
  },
  periodHeaderText: {
    fontSize: IS_TABLET ? 13 : 11, fontFamily: T.fontBold,
  },
  periodCountText: {
    fontSize: 9, fontFamily: T.monoBold, marginTop: 1,
  },
  totalHeaderCell: {
    width: COLUMN_WIDTH, height: IS_TABLET ? 52 : 46,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: T.panel,
  },
  colHeaderText: {
    fontSize: IS_TABLET ? 12 : 10, fontFamily: T.fontBold,
    color: T.textSub, textTransform: 'uppercase',
  },
  tableBodyScroll: { flex: 1 },
  tableBodyRowContainer: { flexDirection: 'row' },
  namesColumnContainer: {
    width: NAME_COLUMN_WIDTH, backgroundColor: T.bg,
    borderRightWidth: 1, borderRightColor: T.border,
  },
  playerNameRow: {
    height: IS_TABLET ? 56 : 48,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingLeft: 10,
    borderBottomWidth: 1, borderBottomColor: T.border,
    backgroundColor: T.bg, gap: 7, overflow: 'hidden',
  },
  playerNameRowActive: {
    backgroundColor: 'rgba(16,164,82,0.07)',
  },
  onCourtBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: T.pos,
  },
  playerNameRowError: {
    backgroundColor: 'rgba(229,72,72,0.10)',
  },
  playerCellsRowError: {
    backgroundColor: 'rgba(229,72,72,0.05)',
  },
  ruleErrorBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: T.neg,
  },
  dorsalChip: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dorsalText: {
    fontFamily: T.monoBold, fontSize: IS_TABLET ? 12 : 11,
  },
  playerPosChip: {
    width: 18, height: 18, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  playerPosChipText: {
    fontFamily: T.monoBold, fontSize: 9, letterSpacing: 0.2,
  },
  playerNameText: {
    fontSize: IS_TABLET ? 14 : 12, fontFamily: T.fontSemi, color: T.text,
    letterSpacing: -0.1,
  },
  playerNameTextActive: {
    fontFamily: T.fontBold,
  },
  playerNameTextError: {
    color: T.neg,
  },
  minsBarTrack: {
    height: 3, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden', marginTop: 5,
  },
  minsBarFill: {
    height: 3, borderRadius: 3,
  },
  removePlayerBtn: {
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  cellsHorizontalScroll: { flex: 1 },
  playerCellsRow: {
    height: IS_TABLET ? 56 : 48,
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: T.border,
  },
  periodCell: {
    width: COLUMN_WIDTH, height: IS_TABLET ? 56 : 48,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: T.border,
  },
  periodCellCurrent: {
    backgroundColor: 'rgba(255,106,44,0.07)',
  },
  periodCellReadOnly: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  roleChip: {
    width: '80%', height: IS_TABLET ? 26 : 22,
    borderRadius: 5, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  roleChipText: {
    fontFamily: T.monoBold, fontSize: IS_TABLET ? 11 : 10,
    letterSpacing: 0.2,
  },
  injuryChip: {
    width: IS_TABLET ? 24 : 20, height: IS_TABLET ? 24 : 20,
    borderRadius: 5, alignItems: 'center', justifyContent: 'center',
  },
  emptyDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: T.borderHard,
  },
  forbiddenExcl: {
    fontFamily: T.fontBlack, fontSize: IS_TABLET ? 11 : 10,
    color: '#C9A000',
  },
  totalCell: {
    width: COLUMN_WIDTH, height: IS_TABLET ? 56 : 48,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: T.panel,
  },
  totalCellError: { backgroundColor: T.negSoft },
  totalText: { fontSize: IS_TABLET ? 13 : 11, fontFamily: T.fontBold, color: T.textSub },
  totalTextError: { color: T.neg },
  trashRow: {
    flexDirection: 'row', height: 30,
    borderTopWidth: 1, borderTopColor: T.borderHard,
    backgroundColor: T.panelDeep,
  },
  trashCell: {
    width: COLUMN_WIDTH, height: 30,
    justifyContent: 'center', alignItems: 'center',
    borderRightWidth: 1, borderRightColor: T.border,
  },
  emptyHeaderPlaceholder: { height: 30, backgroundColor: T.bg },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, fontFamily: T.fontMed, color: T.textFaint, textAlign: 'center' },

  // En pista card
  enPistaCard: {
    margin: 14, backgroundColor: T.panel,
    borderRadius: T.rCard, padding: 12,
    borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  enPistaCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  enPistaCardTitle: {
    fontSize: 10, fontFamily: T.fontBlack, color: T.textSub,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  enPistaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  enPistaChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: T.rBtn, borderWidth: 1, borderColor: T.border, gap: 5,
  },
  enPistaChipNum: { fontSize: 11, fontFamily: T.monoBold, color: T.textSub },
  enPistaChipName: { fontSize: IS_TABLET ? 13 : 12, fontFamily: T.fontBold, color: T.text },
  enPistaChipDot: { width: 6, height: 6, borderRadius: 3 },

  // Basketball court visualization
  courtContainer: {
    width: '100%', aspectRatio: 300 / 165,
    borderRadius: 8, overflow: 'hidden',
    position: 'relative',
  },
  courtPlayerBadge: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  courtPlayerCircle: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  courtPlayerNum: { fontSize: 11, fontFamily: T.monoBold, color: '#fff' },
  courtPlayerNamePill: {
    marginTop: 3, backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
    maxWidth: 56,
  },
  courtPlayerName: { fontSize: 8, fontFamily: T.fontBold, color: '#16315E' },

  // View buttons
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: T.rBtn,
    borderWidth: 1, borderColor: T.border, backgroundColor: T.bg,
  },
  viewBtnText: {
    fontSize: 10, fontFamily: T.fontBold, color: T.textSub, letterSpacing: 0.5,
  },

  overtimeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginTop: 10, gap: 8,
  },
  addOvertimeBtn: {
    paddingVertical: 11, borderRadius: T.rBtn,
    borderWidth: 1.5, borderColor: T.orange, borderStyle: 'dashed',
    alignItems: 'center',
  },
  addOvertimeBtnText: { fontSize: 12, fontFamily: T.fontBold, color: T.orange, letterSpacing: 0.3 },
  removeOvertimeBtn: {
    width: 40, height: 40, borderRadius: T.rBtn,
    borderWidth: 1.5, borderColor: T.negSoft,
    backgroundColor: T.negSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.ink, borderRadius: 14, padding: 5,
    shadowColor: T.ink2, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
    borderWidth: 1, borderColor: T.insetTop,
  },
  periodNavBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.3 },
  sustBtn: {
    flex: 1, height: 38, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    overflow: 'hidden',
    shadowColor: T.orangeDeep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 5,
  },
  sustBtnText: {
    color: '#fff', fontFamily: T.fontBlack, fontSize: 12, letterSpacing: 0.6,
  },
  sustPeriodBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  sustPeriodText: { fontFamily: T.monoBold, fontSize: 13, color: '#fff' },
  sortToggleChip: {
    backgroundColor: T.orangeSoft, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  sortToggleText: { fontSize: 9, color: T.orange, fontFamily: T.fontBold },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(11,14,20,0.55)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 8,
  },
  modalHandleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.borderHard, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18, fontFamily: T.fontBlack, color: T.text, marginBottom: 4,
  },
  modalSubLabel: {
    fontSize: 10, fontFamily: T.fontBold, color: T.textSub,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 14, marginBottom: 8,
  },
  playerBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerBtn: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg,
  },
  playerBtnOut: { backgroundColor: T.negSoft, borderColor: T.neg, borderWidth: 2 },
  playerBtnIn:  { backgroundColor: T.posSoft, borderColor: T.pos, borderWidth: 2 },
  playerBtnText: { fontSize: 13, fontFamily: T.fontBold, color: T.text },
  modalFooterRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: T.rBtnLg,
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    alignItems: 'center',
  },
  modalCancelText: { fontFamily: T.fontBold, color: T.textSub },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 13, borderRadius: T.rBtnLg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
  },
  modalConfirmText: { fontFamily: T.fontBlack, color: '#fff', fontSize: 13 },

  // Config modal
  configHeader: {
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, overflow: 'hidden',
  },
  configHeaderTitle: {
    fontSize: 16, fontFamily: T.fontBlack, color: '#fff', letterSpacing: -0.3, marginTop: 2,
  },
  saveQuickBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: T.rPill,
    backgroundColor: T.orange,
  },
  saveQuickText: { fontSize: 12, fontFamily: T.fontBold, color: '#fff' },
  formCard: {
    backgroundColor: T.bg, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border, padding: 14,
  },
  formCardVisitante: {
    borderColor: T.orange,
    shadowColor: T.orange, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 0, elevation: 0,
    // halo
  },
  visitanteTag: {
    position: 'absolute', top: -10, left: 12,
    backgroundColor: T.orange, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: T.rTag,
  },
  visitanteTagText: {
    fontSize: 9, fontFamily: T.fontBlack, color: '#fff', letterSpacing: 0.8,
  },
  formCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  formCardNum: { fontSize: 10, fontFamily: T.monoBold, color: T.orange },
  formCardTitle: { fontSize: 13, fontFamily: T.fontBlack, color: T.text },
  formLabel: {
    fontSize: 11, fontFamily: T.fontBold, color: T.text, marginBottom: 5, letterSpacing: -0.1,
  },
  formInput: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 13, fontFamily: T.fontSemi, color: T.text,
  },
  formInputTouchable: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, paddingHorizontal: 12, paddingVertical: 11,
  },
  formInputText: { flex: 1, fontSize: 13, fontFamily: T.fontSemi, color: T.text },
  segmented: {
    flexDirection: 'row', backgroundColor: T.panel, borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: T.border,
  },
  segBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: T.bg,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  segBtnOrange: { backgroundColor: T.orangeSoft, borderWidth: 1.5, borderColor: T.orange },
  segText: { fontSize: 12, fontFamily: T.fontBold, color: T.textSub, letterSpacing: 0.4 },
  segTextActive: { color: T.text },
  segTextOrange: { color: T.orange },
  transportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: T.rBtn, borderWidth: 1, borderColor: T.border, backgroundColor: T.panel,
  },
  transportBtnActive: { backgroundColor: T.orangeSoft, borderColor: T.orange, borderWidth: 1.5 },
  transportBtnText: { fontSize: 12, fontFamily: T.fontBold, color: T.textSub },
  configDiscardBtn: {
    flex: 1, paddingVertical: 13, borderRadius: T.rBtnLg,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border, alignItems: 'center',
  },
  configDiscardText: { fontSize: 13, fontFamily: T.fontBold, color: T.textSub },
  configSaveBtn: {
    flex: 2, paddingVertical: 13, borderRadius: T.rBtnLg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
    shadowColor: T.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  configSaveText: { fontSize: 13, fontFamily: T.fontBlack, color: '#fff' },
  deleteBtn: {
    paddingVertical: 13, borderRadius: T.rBtnLg,
    borderWidth: 1, borderColor: T.negSoft, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 13, fontFamily: T.fontBold, color: T.neg },
  shareCardTitle: {
    fontSize: 11, fontFamily: T.fontBlack, color: T.textSub, letterSpacing: 0.5, marginTop: 4,
  },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: T.rBtn,
  },
  shareBtnText: { fontSize: 12, fontFamily: T.fontBold },

  // Time picker
  timePickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  timeSlot: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: T.panel, marginRight: 6,
    borderWidth: 1, borderColor: T.border,
  },
  timeSlotActive: { backgroundColor: T.ink, borderColor: T.ink },
  timeSlotText: { fontSize: 14, fontFamily: T.fontBold, color: T.textSub },
  timeSlotTextActive: { color: '#fff' },

  // List view modal
  listViewPeriod: {
    marginBottom: 12, backgroundColor: T.panel, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
  },
  listViewPeriodTitle: {
    fontSize: 12, fontFamily: T.fontBlack, color: T.textSub,
    letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase',
  },
  listViewTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: T.border, gap: 5,
  },
  listViewTagNum: { fontSize: 11, fontFamily: T.monoBold, color: T.textFaint },
  listViewTagName: { fontSize: 12, fontFamily: T.fontBold, color: T.text },
  listViewTagDot: { width: 6, height: 6, borderRadius: 3 },

  // Compact view modal
  compactTable: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  compactRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  compactNum: { width: 28, fontFamily: T.monoBold, fontSize: 11, color: T.textSub },
  compactName: { flex: 1, fontFamily: T.fontSemi, fontSize: 13, color: T.text },
  compactDot: {
    width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  compactDotText: { fontSize: 8, fontFamily: T.monoBold, color: '#fff' },

  // Confirm modal (Pasarela / Periodo bloqueado)
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(11,14,20,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  confirmCard: {
    width: '100%', backgroundColor: T.white,
    borderRadius: T.rCard + 4, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 36, elevation: 14,
    borderWidth: 1, borderColor: T.border,
  },
  confirmTitle: {
    fontFamily: T.fontBlack, fontSize: 16, color: T.text, marginBottom: 8,
  },
  confirmMsg: {
    fontFamily: T.fontReg, fontSize: 13, color: T.textSub, lineHeight: 20, marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row', gap: 10,
  },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: T.rBtn,
    borderWidth: 1, borderColor: T.border, alignItems: 'center',
  },
  confirmCancelText: {
    fontFamily: T.fontBold, fontSize: 13, color: T.textSub,
  },
  confirmOkBtn: {
    flex: 1.4, paddingVertical: 12, borderRadius: T.rBtn,
    alignItems: 'center', overflow: 'hidden',
  },
  confirmOkText: {
    fontFamily: T.fontBlack, fontSize: 13, color: '#fff',
  },
  confirmOptionBtn: {
    paddingVertical: 13, borderRadius: T.rBtn,
    borderWidth: 1.5, borderColor: T.negSoft,
    backgroundColor: T.negSoft, alignItems: 'center',
  },
  confirmOptionText: {
    fontFamily: T.fontBlack, fontSize: 13, color: T.neg,
  },

  // Right info panel (tablet landscape)
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
});
