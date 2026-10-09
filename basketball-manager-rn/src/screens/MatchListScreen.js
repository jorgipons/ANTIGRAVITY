import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Menu, Plus, Calendar, MapPin, Users, List, Check, Activity, HelpCircle } from 'lucide-react-native';
import Svg, { Defs, Pattern as SvgPattern, Path as SvgPath, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import CalendarView from '../components/CalendarView';
import AppDrawer from '../components/AppDrawer';
import GuidedTourOverlay from '../components/GuidedTourOverlay';
import CreateMatchModal from '../components/CreateMatchModal';
import { useTheme } from '../theme/ThemeContext';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import { useLayout } from '../hooks/useLayout';
import { importFederationMatches } from '../utils/federation';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(date, time) {
  const matchDate = new Date(`${date}T${time || '00:00'}`);
  const diffMs = matchDate - new Date();
  if (diffMs <= 0) return null;
  const days = Math.ceil(diffMs / 86400000);
  if (days === 1) return 'Mañana';
  return `en ${days} días`;
}

function fmtDate(dateStr) {
  try {
    return new Date(dateStr + 'T12:00')
      .toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
      .toUpperCase();
  } catch { return dateStr; }
}

// ── Shared micro-components ───────────────────────────────────────────────────

function GridPattern() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgPattern id="mlgrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
          </SvgPattern>
        </Defs>
        <SvgRect width="100%" height="100%" fill="url(#mlgrid)" opacity={0.05} />
      </Svg>
    </View>
  );
}

function Brand() {
  const T = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <SvgRect x="0" y="0" width="24" height="24" rx="7" fill="rgba(255,255,255,0.12)" />
        <SvgPath
          d="M5 16h2.4V12h1.6c2 0 3.5-1.4 3.5-3.5S11 5 9 5H5v11zM7.4 7h1.6c.7 0 1.2.5 1.2 1.5S9.7 10 9 10H7.4V7z"
          fill={T.orange}
        />
        <SvgCircle cx="17" cy="17" r="3" fill={T.orange} />
      </Svg>
      <Text style={{ color: '#fff', fontFamily: T.fontBlack, fontSize: 14, letterSpacing: -0.3 }}>
        partits<Text style={{ color: T.orange }}>.</Text>
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MatchListScreen() {
  const T = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId, initialViewMode } = route.params;
  const { matches, loading, addMatch, updateMatch, deleteMatch } = useMatches(teamId);

  const { teams } = useTeams();
  const team = teams.find(t => t.id === teamId);

  const [modalVisible, setModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState(initialViewMode || 'list');
  const [tourActive, setTourActive] = useState(false);

  const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
  const { isPro } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);

  const menuBtnRef  = useRef(null);
  const fabRef      = useRef(null);
  const heroCardRef = useRef(null);
  const heroPillRef = useRef(null);

  const TOUR_STEPS = [
    { ref: menuBtnRef,  title: 'Menú lateral',  text: 'Navega a otras secciones de la app.' },
    { ref: fabRef,      title: 'Nuevo partido',  text: 'Crea un partido con rival, fecha, hora y lugar.' },
    { ref: heroCardRef, title: 'Partido',        text: 'Toca para abrir la matriz de sustituciones. Mantén la ficha del partido para editarla o eliminarla.' },
    { ref: heroPillRef, title: 'Estado',         text: 'Pendiente → En curso → Finalizado. Cambia el estado desde la ficha del partido.' },
  ];

  // ── Derived data ────────────────────────────────────────────────

  const standing = team?.federationData?.standing;
  const pos   = standing?.position ?? null;
  const pts   = standing?.points   ?? null;
  const wins  = standing?.wins     ?? 0;
  const losses = standing?.losses  ?? 0;
  const diff  = (standing?.scoreFavour ?? 0) - (standing?.scoreAgainst ?? 0);

  const sortedAsc = [...matches].sort(
    (a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`)
  );
  const nextMatch     = sortedAsc.find(m => m.state !== 'finished');
  const upcomingOthers = sortedAsc.filter(m => m.state !== 'finished' && m !== nextMatch);
  const playedMatches  = [...matches]
    .filter(m => m.state === 'finished')
    .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
  const last5 = playedMatches.slice(0, 5).map(m => m.result === 'won' ? 'W' : 'L');

  // ── Handlers (lógica sin cambios) ──────────────────────────────

  const handleSyncFederation = async () => {
    if (!team?.federationId) {
      Alert.alert('Info', 'Configura el ID de Federación en el detalle del equipo primero.');
      return;
    }
    setSyncing(true);
    try {
      const res = await importFederationMatches(team.federationId, 'smart');
      if (!res.success) {
        Alert.alert('Error', res.error || 'No se pudieron sincronizar los partidos.');
        return;
      }
      let added = 0, updated = 0;
      const initialPlayers = team?.players ? [...team.players] : [];
      for (const m of res.matches) {
        const exists = matches.find(ex => ex.federationMatchId === m.federationMatchId);
        if (!exists) {
          await addMatch({ ...m, players: initialPlayers });
          added++;
        } else if (
          exists.state !== m.state || exists.date !== m.date || exists.time !== m.time ||
          JSON.stringify(exists.score) !== JSON.stringify(m.score)
        ) {
          await updateMatch(exists.id, { state: m.state, date: m.date, time: m.time, score: m.score, result: m.result, location: m.location });
          updated++;
        }
      }
      Alert.alert('Éxito', added > 0 || updated > 0
        ? `Sincronización completada.\nNuevos: ${added}\nActualizados: ${updated}`
        : 'Ya estaba todo al día.');
    } catch {
      Alert.alert('Error', 'Fallo general al sincronizar con la federación.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMatch = (matchId, opponent) => {
    const msg = `¿Seguro que quieres eliminar el partido contra ${opponent}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) deleteMatch(matchId).catch(() => Alert.alert('Error', 'No se pudo eliminar'));
      return;
    }
    Alert.alert('Eliminar partido', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteMatch(matchId); } catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  const effectiveMatchCount = Math.max(team?.matchCount || 0, matches.length);

  const handleNewMatch = () => {
    if (!isPro && effectiveMatchCount >= 8) {
      setPaywallVisible(true);
    } else {
      setModalVisible(true);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.ink2 }} edges={['top']}>
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} showsVerticalScrollIndicator={false}>

        {/* ══ Scoreboard header ══════════════════════════════════════ */}
        <LinearGradient
          colors={[T.ink2, T.ink]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={s.header}
        >
          <GridPattern />

          {/* Top row */}
          <View style={s.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {!IS_TABLET_LANDSCAPE && (
                <TouchableOpacity ref={menuBtnRef} style={s.backBtn} onPress={() => setDrawerOpen(true)}>
                  <Menu color="#fff" size={20} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
              <Brand />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {team?.federationId && (
                <TouchableOpacity
                  style={[s.syncPill, syncing && { opacity: 0.6 }]}
                  onPress={handleSyncFederation}
                  disabled={syncing}
                >
                  {syncing
                    ? <ActivityIndicator size="small" color="#5BE89B" style={{ width: 8, height: 8 }} />
                    : <View style={s.syncDot} />}
                  <Text style={s.syncText}>Sincro Smart</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setViewMode(v => v === 'list' ? 'calendar' : 'list')}
              >
                {viewMode === 'list'
                  ? <Calendar color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />
                  : <List color="rgba(255,255,255,0.65)" size={18} strokeWidth={1.8} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTourActive(true)} style={s.iconBtn}>
                <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Team identity */}
          <View style={{ marginTop: 14 }}>
            <Text style={s.eyebrow}>FBCV · TEMPORADA 25/26</Text>
            <Text style={s.teamName} numberOfLines={1}>{team?.name || '—'}</Text>
            {!isPro && (
              <View style={s.remainingBadge}>
                <Text style={s.remainingText}>
                  {Math.max(0, 8 - effectiveMatchCount)} partidos restantes · plan gratuito
                </Text>
              </View>
            )}
          </View>

          {/* Stats card */}
          <View style={s.statsCard}>
            {/* POS */}
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>POS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
                <Text style={[s.statVal, { color: T.orange }]}>{pos ?? '—'}</Text>
                {pos != null && <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: T.fontBold }}>º</Text>}
              </View>
            </View>
            {/* PTS */}
            <View style={[{ flex: 1 }, s.statBorderLeft]}>
              <Text style={s.statLabel}>PTS</Text>
              <Text style={[s.statVal, { color: '#fff' }]}>{pts ?? '—'}</Text>
            </View>
            {/* BALANCE */}
            <View style={[{ flex: 1.3 }, s.statBorderLeft]}>
              <Text style={s.statLabel}>BALANCE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                <Text style={s.statValSm}>
                  {wins}<Text style={{ color: 'rgba(255,255,255,0.35)' }}>-</Text>{losses}
                </Text>
                {(wins > 0 || losses > 0) && (
                  <Text style={[s.statValSm, { fontSize: 10, color: diff >= 0 ? T.pos : T.neg }]}>
                    {diff > 0 ? '+' : ''}{diff}
                  </Text>
                )}
              </View>
              {last5.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 5 }}>
                  {last5.map((r, i) => (
                    <View key={i} style={{ width: 14, height: 4, borderRadius: 1, backgroundColor: r === 'W' ? T.pos : T.neg }} />
                  ))}
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ══ Calendar view ═══════════════════════════════════════════ */}
        {viewMode === 'calendar' && (
          <CalendarView
            matches={matches}
            onMatchPress={m => navigation.navigate('MatchMatrix', { matchId: m.id, teamId })}
          />
        )}

        {/* ══ List view ═══════════════════════════════════════════════ */}
        {viewMode === 'list' && (
          <>
            {matches.length === 0 ? (
              <View style={s.empty}>
                <Activity color={T.border} size={56} strokeWidth={1.5} />
                <Text style={s.emptyTitle}>Sin partidos</Text>
                <Text style={s.emptyText}>Crea el primer partido para gestionar las actas.</Text>
              </View>
            ) : (
              <>
                {/* Hero — próximo partido */}
                {nextMatch && (
                  <View style={{ padding: 14, paddingBottom: 0 }}>
                    <View ref={heroCardRef} style={s.heroCard}>
                      <View style={s.heroTopBar} />
                      <View style={s.heroPillRow}>
                        <View ref={heroPillRef} style={s.heroPill}>
                          <Text style={s.heroPillDot}>●</Text>
                          <Text style={s.heroPillText}>PRÓXIMO PARTIDO</Text>
                        </View>
                        {daysUntil(nextMatch.date, nextMatch.time) != null && (
                          <Text style={s.heroCountdown}>{daysUntil(nextMatch.date, nextMatch.time)}</Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.heroOpponent} numberOfLines={1}>{nextMatch.opponent}</Text>
                          {nextMatch.location ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <MapPin color={T.textSub} size={11} strokeWidth={1.8} />
                              <Text style={s.heroVenue} numberOfLines={1}>{nextMatch.location}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={s.heroTimeSide}>
                          <Text style={s.heroTime}>{nextMatch.time}</Text>
                          <Text style={s.heroDate}>{fmtDate(nextMatch.date)}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                        <TouchableOpacity
                          style={s.heroMainBtn}
                          onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
                          activeOpacity={0.8}
                        >
                          <Text style={s.heroMainBtnText}>Iniciar partido</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.heroIconBtn}
                          onPress={() => navigation.navigate('MatchAttendance', { matchId: nextMatch.id, teamId })}
                        >
                          <Users color={T.text} size={14} strokeWidth={1.8} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* Partidos programados (upcoming restantes) */}
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
                          <View style={[s.upcomingBadge, { backgroundColor: m.isHome ? T.blueSoft : T.orangeSoft }]}>
                            <Text style={[s.upcomingBadgeText, { color: m.isHome ? T.blue : T.orangeDeep }]}>
                              {m.isHome ? 'C' : 'V'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.upcomingOpp} numberOfLines={1}>{m.opponent}</Text>
                            <Text style={s.upcomingMeta}>{m.date} · {m.time}</Text>
                          </View>
                          <TouchableOpacity
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            onPress={() => handleDeleteMatch(m.id, m.opponent)}
                          >
                            <Text style={{ fontSize: 20, color: T.textFaint, lineHeight: 22 }}>›</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Últimos resultados */}
                {playedMatches.length > 0 && (
                  <View style={{ paddingHorizontal: 14, marginTop: 18 }}>
                    <View style={s.sectionHeader}>
                      <Text style={s.sectionTitle}>Últimos resultados</Text>
                    </View>
                    <View style={IS_TABLET ? s.twoColGrid : null}>
                      {playedMatches.map(m => {
                        const won = m.result === 'won';
                        const sc = m.score;
                        const ourScore   = sc ? (m.isHome ? sc.local   : sc.visitor) : null;
                        const theirScore = sc ? (m.isHome ? sc.visitor : sc.local)   : null;
                        const scoreDiff  = (ourScore != null && theirScore != null) ? ourScore - theirScore : null;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[s.playedRow, IS_TABLET && s.twoColCard]}
                            onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId })}
                            activeOpacity={0.7}
                          >
                            <View style={[s.resultBadge, { backgroundColor: won ? T.posSoft : T.negSoft }]}>
                              <Text style={[s.resultBadgeText, { color: won ? T.posDark : '#B91C1C' }]}>
                                {m.result === 'won' ? 'V' : m.result === 'lost' ? 'D' : '—'}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.playedOpp} numberOfLines={1}>{m.opponent}</Text>
                              <Text style={s.playedMeta}>{m.date} · {m.isHome ? 'CASA' : 'VIS'}</Text>
                            </View>
                            {sc && (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[s.playedScore, { color: won ? T.posDark : '#B91C1C' }]}>
                                  {ourScore}<Text style={{ color: T.textFaint }}>:</Text>{theirScore}
                                </Text>
                                {scoreDiff !== null && (
                                  <Text style={[s.playedDiff, { color: won ? T.pos : T.neg }]}>
                                    {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                                  </Text>
                                )}
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* ══ FAB ══════════════════════════════════════════════════════ */}
      <TouchableOpacity ref={fabRef} style={s.fab} onPress={handleNewMatch} activeOpacity={0.85}>
        <Plus color="#fff" size={24} strokeWidth={2} />
      </TouchableOpacity>

      <CreateMatchModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        team={team}
        addMatch={addMatch}
        onCreated={(id) => navigation.navigate('MatchMatrix', { matchId: id, teamId })}
      />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />
      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="match_limit"
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(T) { return StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  syncPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.rPill,
    backgroundColor: 'rgba(16,164,82,0.18)',
    borderWidth: 1, borderColor: 'rgba(16,164,82,0.3)',
  },
  syncDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#5BE89B',
  },
  syncText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: '#5BE89B', letterSpacing: 0.2,
  },
  eyebrow: {
    fontSize: 10, fontFamily: T.fontBold, color: T.orange,
    letterSpacing: 1.6, textTransform: 'uppercase',
  },
  teamName: {
    fontSize: 20, fontFamily: T.fontBold, color: '#fff',
    letterSpacing: -0.3, marginTop: 2,
  },

  // Stats card
  statsCard: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 2,
  },
  statBorderLeft: {
    borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', paddingLeft: 12,
  },
  statLabel: {
    fontSize: 9, fontFamily: T.fontBold, color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  statVal: {
    fontFamily: T.monoBold, fontSize: 26, letterSpacing: -1, lineHeight: 32,
  },
  statValSm: {
    fontFamily: T.monoBold, fontSize: 14, color: '#fff',
  },

  // Hero card
  heroCard: {
    backgroundColor: T.bg,
    borderRadius: T.rCardLg,
    borderWidth: 1, borderColor: T.border,
    padding: 14,
    overflow: 'hidden',
    shadowColor: T.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.11, shadowRadius: 24, elevation: 5,
  },
  heroTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: T.orange,
  },
  heroPillRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6,
  },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.orangeSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.rPill,
  },
  heroPillDot: {
    fontSize: 7, color: T.orangeDeep,
  },
  heroPillText: {
    fontSize: 10, fontFamily: T.fontBold, color: T.orangeDeep, letterSpacing: 0.2,
  },
  heroCountdown: {
    fontSize: 11, fontFamily: T.mono, color: T.textSub,
  },
  heroOpponent: {
    fontSize: 16, fontFamily: T.fontBlack, color: T.text, letterSpacing: -0.2,
  },
  heroVenue: {
    fontSize: 12, color: T.textSub, fontFamily: T.fontMed, flex: 1,
  },
  heroTimeSide: {
    alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: T.border, paddingLeft: 12,
  },
  heroTime: {
    fontFamily: T.monoBold, fontSize: 18, color: T.text, letterSpacing: -0.5,
  },
  heroDate: {
    fontSize: 10, fontFamily: T.fontBold, color: T.textSub, letterSpacing: 0.8, marginTop: 1,
  },
  heroMainBtn: {
    flex: 1, paddingVertical: 10, backgroundColor: T.ink, borderRadius: T.rBtn,
    alignItems: 'center', justifyContent: 'center',
  },
  heroMainBtnText: {
    color: '#fff', fontFamily: T.fontBold, fontSize: 12, letterSpacing: 0.2,
  },
  heroIconBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: T.panel, borderRadius: T.rBtn,
    borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13, fontFamily: T.fontBlack, color: T.text, letterSpacing: -0.1,
  },

  // Upcoming rows
  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  upcomingBadge: {
    width: 28, height: 28, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingBadgeText: {
    fontSize: 11, fontFamily: T.monoBold,
  },
  upcomingOpp: {
    fontSize: 13, fontFamily: T.fontBold, color: T.text, letterSpacing: -0.1,
  },
  upcomingMeta: {
    fontSize: 10, fontFamily: T.mono, color: T.textSub, marginTop: 1,
  },

  // Played rows
  playedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  resultBadge: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  resultBadgeText: {
    fontSize: 12, fontFamily: T.monoBold,
  },
  playedOpp: {
    fontSize: 13, fontFamily: T.fontBold, color: T.text, letterSpacing: -0.1,
  },
  playedMeta: {
    fontSize: 10, fontFamily: T.mono, color: T.textSub, marginTop: 1,
  },
  playedScore: {
    fontFamily: T.monoBold, fontSize: 17, letterSpacing: -0.5,
  },
  playedDiff: {
    fontFamily: T.monoBold, fontSize: 10, fontWeight: '700',
  },

  // Empty state
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, marginTop: 60, gap: 12,
  },
  emptyTitle: {
    fontSize: 22, fontFamily: T.fontBlack, color: T.text,
  },
  emptyText: {
    fontSize: 14, fontFamily: T.fontMed, color: T.textSub, textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.orangeDeep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 7,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(11,14,20,0.6)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16,
    overflow: 'hidden',
  },
  modalEyebrow: {
    fontSize: 9, fontFamily: T.fontBold, color: T.orange,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 17, fontFamily: T.fontBlack, color: '#fff', letterSpacing: -0.3, marginTop: 2,
  },
  modalSaveQuickBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: T.rPill,
    backgroundColor: T.orange,
  },
  modalSaveQuickText: {
    fontSize: 12, fontFamily: T.fontBold, color: '#fff',
  },

  // Form cards
  formCard: {
    backgroundColor: T.bg, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border, padding: 14,
  },
  formCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  formCardNum: {
    fontSize: 10, fontFamily: T.monoBold, color: T.orange,
  },
  formCardTitle: {
    fontSize: 13, fontFamily: T.fontBlack, color: T.text,
  },
  formLabel: {
    fontSize: 11, fontFamily: T.fontBold, color: T.text, marginBottom: 5, letterSpacing: -0.1,
  },
  formInput: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: T.fontSemi, color: T.text,
  },

  // Segmented control
  segmented: {
    flexDirection: 'row', backgroundColor: T.panel,
    borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: T.border,
  },
  segBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: T.bg,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  segBtnActiveOrange: {
    backgroundColor: T.orangeSoft,
    borderWidth: 1.5, borderColor: T.orange,
  },
  segBtnText: {
    fontSize: 12, fontFamily: T.fontBold, color: T.textSub, letterSpacing: 0.4,
  },
  segBtnTextActive: {
    color: T.text,
  },
  segBtnTextOrange: {
    color: T.orange,
  },

  // Footer buttons
  formFooter: {
    flexDirection: 'row', gap: 8, marginTop: 16,
  },
  discardBtn: {
    flex: 1, paddingVertical: 13, borderRadius: T.rBtnLg,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  discardText: {
    fontSize: 13, fontFamily: T.fontBold, color: T.textSub,
  },
  saveBtn: {
    flex: 2, paddingVertical: 13, borderRadius: T.rBtnLg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
    shadowColor: T.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  saveBtnText: {
    fontSize: 13, fontFamily: T.fontBlack, color: '#fff',
  },

  // 2-column grid (tablet)
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  upcomingRowTablet: {
    width: '50%',
    paddingRight: 6,
  },
  twoColCard: {
    width: '50%',
    paddingRight: 6,
  },
  remainingBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: T.rPill, alignSelf: 'flex-start', marginTop: 4,
  },
  remainingText: { fontFamily: T.fontSemi, fontSize: 11, color: 'rgba(255,255,255,0.65)' },
}); }
