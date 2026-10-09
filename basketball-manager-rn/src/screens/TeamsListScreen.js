import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Plus, Users, Calendar, Clock, MapPin, Bell, Menu, ChevronRight, HelpCircle } from 'lucide-react-native';
import Svg, { Defs, Pattern as SvgPattern, Path as SvgPath, Rect as SvgRect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { useTeams } from '../hooks/useTeams';
import { useMatches } from '../hooks/useMatches';
import AppDrawer from '../components/AppDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingCarousel from '../components/OnboardingCarousel';
import GuidedTourOverlay from '../components/GuidedTourOverlay';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';

export default function TeamsListScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  // Inner component — defined inside to access T and styles via closure
  const TeamNextMatch = ({ teamId, players: teamPlayers }) => {
    const { matches } = useMatches(teamId);

    const nextMatch = React.useMemo(() => {
      if (!matches || matches.length === 0) return null;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const upcoming = matches
        .filter(m => m.state !== 'finished' && m.date >= todayStr)
        .sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
      return upcoming.length > 0 ? upcoming[0] : null;
    }, [matches]);

    if (!nextMatch) {
      return (
        <View style={styles.nmEmpty}>
          <Text style={styles.nmEmptyText}>Sin partidos próximos</Text>
        </View>
      );
    }

    const formattedDate = new Date(nextMatch.date).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

    const att = nextMatch.attendance || {};
    const confirmed = Object.values(att).filter(a => a.status === 'available').length;
    const unavailable = Object.values(att).filter(a => a.status === 'unavailable').length;
    const total = teamPlayers?.length || 0;
    const pending = Math.max(0, total - confirmed - unavailable);

    return (
      <View style={styles.nmSection}>
        <View style={styles.nmBody}>

          {/* Zona 2: info del partido → MatchMatrix */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
            activeOpacity={0.7}
          >
            <View style={styles.nmLabelRow}>
              <View style={styles.nmDot} />
              <Text style={styles.nmLabel}>PRÓXIMO PARTIDO</Text>
            </View>

            <View style={styles.nmInfoCol}>
              <Text style={styles.nmOpponent} numberOfLines={1}>{nextMatch.opponent.toUpperCase()}</Text>

              <View style={styles.nmRow}>
                <Clock color="rgba(255,255,255,0.35)" size={12} strokeWidth={1.8} />
                <Text style={styles.nmRowText}>{formattedDate} · {nextMatch.time}h</Text>
              </View>

              {nextMatch.location ? (
                <View style={styles.nmLocationPill}>
                  <MapPin color="rgba(255,255,255,0.35)" size={10} strokeWidth={1.8} />
                  <Text style={styles.nmLocationText} numberOfLines={1}>{nextMatch.location.toUpperCase()}</Text>
                </View>
              ) : null}

              <View style={styles.nmRow}>
                <Bell color={T.pos} size={12} strokeWidth={1.8} />
                <Text style={[styles.nmRowText, { color: T.pos }]}>
                  Conv. {nextMatch.callTime || '--:--'}h
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Zona 3: asistencia → MatchAttendance */}
          <View style={styles.nmRightCol}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MatchAttendance', { matchId: nextMatch.id, teamId })}
              style={styles.nmUsersBtn}
              activeOpacity={0.7}
            >
              <Users color="rgba(255,255,255,0.75)" size={16} strokeWidth={1.8} />
              <View style={styles.nmStatsRow}>
                <View style={[styles.nmStatDot, { backgroundColor: T.pos }]} />
                <Text style={styles.nmStatCount}>{confirmed}</Text>
                <View style={[styles.nmStatDot, { backgroundColor: T.neg }]} />
                <Text style={styles.nmStatCount}>{unavailable}</Text>
                <View style={[styles.nmStatDot, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                <Text style={styles.nmStatCount}>{pending}</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.nmBadge, nextMatch.isHome ? styles.nmBadgeHome : styles.nmBadgeAway]}>
              <Text style={styles.nmBadgeText}>
                {nextMatch.isHome ? '🏠 CASA' : (nextMatch.transportType === 'car' ? '🚗 COCHE' : '🚌 BUS')}
              </Text>
            </View>
          </View>

        </View>
      </View>
    );
  };

  const navigation = useNavigation();
  const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
  const menuBtnRef     = useRef(null);
  const calendarBtnRef = useRef(null);
  const plusBtnRef     = useRef(null);
  const firstCardRef   = useRef(null);
  const { teams, loading, addTeam } = useTeams();
  const { isPro } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  const TOUR_STEPS = [
    { ref: menuBtnRef,     title: 'Menú lateral',  text: 'Accede al calendario, a la guía de uso y a los ajustes desde aquí.' },
    { ref: calendarBtnRef, title: 'Calendario',     text: 'Ve todos los partidos de todos tus equipos en una sola vista.' },
    { ref: plusBtnRef,     title: 'Nuevo equipo',   text: 'Crea un nuevo equipo de baloncesto.' },
    { ref: firstCardRef,   title: 'Tu equipo',      text: 'Toca la tarjeta para gestionar jugadores, partidos y configuración del equipo.' },
  ];

  React.useEffect(() => {
    AsyncStorage.getItem('tutorial_seen').then(val => {
      if (val === null) setShowOnboarding(true);
    });
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      Alert.alert('Error', 'Debes introducir un nombre para el equipo');
      return;
    }
    setSubmitting(true);
    try {
      await addTeam({ name: newTeamName.trim() });
      setNewTeamName('');
      setModalVisible(false);
    } catch (e) {
      console.error('addTeam error:', e);
      Alert.alert('Error', 'No se pudo crear el equipo');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeamCard = ({ item, index }) => (
    <View
      ref={index === 0 ? firstCardRef : null}
      style={[styles.teamCard, IS_TABLET && styles.teamCardTablet]}
    >
      <LinearGradient
        colors={['#1C4484', '#122850']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.teamCardGrad}
      >
        {/* Subtle grid pattern */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgPattern id={`g${item.id}`} width="14" height="14" patternUnits="userSpaceOnUse">
                <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
              </SvgPattern>
            </Defs>
            <SvgRect width="100%" height="100%" fill={`url(#g${item.id})`} opacity={0.05} />
          </Svg>
        </View>

        {/* Zona 1: cabecera del equipo → TeamDetail */}
        <TouchableOpacity
          style={styles.teamCardTop}
          onPress={() => navigation.navigate('TeamDetail', { teamId: item.id })}
          activeOpacity={0.75}
        >
          <View style={styles.teamInitialBox}>
            <Text style={styles.teamInitial}>{(item.name || 'E')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.teamTitleBox}>
            <Text style={styles.teamName}>{item.name}</Text>
            <Text style={styles.teamStats}>{item.players ? item.players.length : 0} jugadores</Text>
                    {!isPro && (
                      <Text style={styles.teamMatchCount}>
                        {Math.min(item.matchCount || 0, 8)}/8 partidos
                      </Text>
                    )}
          </View>
          <ChevronRight color="rgba(255,255,255,0.22)" size={18} strokeWidth={1.5} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.teamCardDivider} />

        {/* Zona 2 + 3: próximo partido */}
        <TeamNextMatch teamId={item.id} players={item.players} />
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" backgroundColor={T.ink2} />
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        {!IS_TABLET_LANDSCAPE && (
          <TouchableOpacity ref={menuBtnRef} style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
            <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
        <View style={styles.headerLeft}>
          <Text style={styles.headerBrand}>partits.</Text>
          <Text style={styles.headerTitle}>Mis Equipos</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity ref={calendarBtnRef} onPress={() => navigation.navigate('Calendar')} style={styles.headerIconBtn}>
            <Calendar color="rgba(255,255,255,0.65)" size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>
            <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            ref={plusBtnRef}
            onPress={() => {
              if (!isPro && teams.length >= 1) {
                setPaywallVisible(true);
              } else {
                setModalVisible(true);
              }
            }}
            style={styles.headerPlusWrap}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerPlusGrad}>
              <Plus color={T.white} size={20} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={T.orange} />
          </View>
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Users color={T.textFaint} size={44} />
            </View>
            <Text style={styles.emptyTitle}>No tienes equipos</Text>
            <Text style={styles.emptyText}>
              Crea tu primer equipo para empezar a gestionar jugadores y partidos.
            </Text>
            <TouchableOpacity style={styles.emptyBtnWrap} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
              <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGrad}>
                <Plus color={T.white} size={20} />
                <Text style={styles.emptyBtnText}>Crear Primer Equipo</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key={IS_TABLET ? 'tablet' : 'mobile'}
            data={teams}
            keyExtractor={(item) => item.id}
            renderItem={renderTeamCard}
            numColumns={IS_TABLET ? 2 : 1}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nuevo Equipo</Text>

            <Text style={styles.modalLabel}>NOMBRE DEL EQUIPO</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Cadete A, Infantil Femenino..."
              placeholderTextColor={T.textFaint}
              value={newTeamName}
              onChangeText={setNewTeamName}
              autoFocus
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setModalVisible(false); setNewTeamName(''); }}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmWrap, (!newTeamName.trim() || submitting) && { opacity: 0.5 }]}
                onPress={handleCreateTeam}
                disabled={!newTeamName.trim() || submitting}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalConfirmGrad}>
                  {submitting ? (
                    <ActivityIndicator size="small" color={T.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Añadir Equipo</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <OnboardingCarousel
        visible={showOnboarding}
        onDismiss={() => {
          setShowOnboarding(false);
          AsyncStorage.setItem('tutorial_seen', 'true');
        }}
      />
      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="team_limit"
      />
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.ink2 },
  content: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 12,
  },
  menuBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  headerLeft: { flex: 1 },
  headerBrand: { fontFamily: T.fontBlack, fontSize: 10, color: T.orange, letterSpacing: 0.8, marginBottom: 1 },
  headerTitle: { fontFamily: T.fontBlack, fontSize: 20, color: T.onDark, letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  headerPlusWrap: { borderRadius: 9, overflow: 'hidden', marginLeft: 4 },
  headerPlusGrad: { paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContainer: { padding: 12 },

  // Team card — full dark gradient
  teamCard: {
    borderRadius: T.rCardLg, marginBottom: 14, overflow: 'hidden',
    shadowColor: T.ink2, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 22, elevation: 9,
  },
  teamCardTablet: {
    flex: 1,
    margin: 6,
  },
  teamCardGrad: { padding: 16, flex: 1 },
  teamCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 },
  teamInitialBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,106,44,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,106,44,0.22)',
  },
  teamInitial: { fontFamily: T.fontBlack, fontSize: 18, color: T.orange },
  teamTitleBox: { flex: 1 },
  teamName: { fontFamily: T.fontBold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },
  teamStats: { fontFamily: T.fontReg, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  teamMatchCount: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  teamCardDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14,
  },

  // Next match (now rendered directly on dark card)
  nmSection: {},
  nmLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  nmDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blue },
  nmLabel: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.38)', letterSpacing: 1.5 },
  nmBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nmInfoCol: { flex: 1, gap: 6 },
  nmOpponent: { fontFamily: T.fontBlack, fontSize: 16, color: '#fff', letterSpacing: -0.3 },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nmRowText: { fontFamily: T.fontMed, fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  nmLocationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: T.rPill, alignSelf: 'flex-start',
  },
  nmLocationText: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.45)' },

  nmRightCol: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, paddingLeft: 10 },
  nmUsersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  nmStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nmStatDot: { width: 5, height: 5, borderRadius: 2.5 },
  nmStatCount: { fontFamily: T.mono, fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  nmBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.rPill },
  nmBadgeHome: { backgroundColor: 'rgba(255,255,255,0.08)' },
  nmBadgeAway: { backgroundColor: 'rgba(255,255,255,0.05)' },
  nmBadgeText: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.6)' },

  nmEmpty: {
    alignItems: 'center', paddingVertical: 4,
  },
  nmEmptyText: { fontFamily: T.fontMed, fontSize: 12, color: 'rgba(255,255,255,0.25)' },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconBox: {
    width: 88, height: 88, backgroundColor: T.panel, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontFamily: T.fontBold, fontSize: 22, color: T.text, marginBottom: 8 },
  emptyText: { fontFamily: T.fontReg, fontSize: 15, color: T.textSub, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  emptyBtnWrap: { borderRadius: T.rBtnLg, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24 },
  emptyBtnText: { fontFamily: T.fontSemi, color: T.white, fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,14,20,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: T.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
    borderTopWidth: 1, borderColor: T.border,
  },
  modalHandle: {
    width: 32, height: 4, backgroundColor: T.borderHard, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontFamily: T.fontBold, fontSize: 18, color: T.text, marginBottom: 16 },
  modalLabel: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
  },
  modalInput: {
    backgroundColor: T.panel,
    borderRadius: T.rInput, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: T.text, fontFamily: T.fontReg, marginBottom: 18,
  },
  modalFooter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  modalCancelBtn: {
    paddingHorizontal: 20, paddingVertical: 13,
    backgroundColor: T.panel, borderRadius: T.rBtn, alignItems: 'center',
  },
  modalCancelText: { fontFamily: T.fontSemi, color: T.textSub, fontSize: 14 },
  modalConfirmWrap: { flex: 1, borderRadius: T.rBtn, overflow: 'hidden' },
  modalConfirmGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontFamily: T.fontSemi, color: '#fff', fontSize: 14 },
}); }
