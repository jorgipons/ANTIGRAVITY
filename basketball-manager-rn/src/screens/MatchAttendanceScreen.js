import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, ChevronDown, Share2, CheckCircle2, XCircle, Activity, UserMinus, UserPlus, Users, HelpCircle, ListChecks } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { getRoleConfig } from '../constants/roles';
import { db } from '../constants/firebase';
import GuidedTourOverlay from '../components/GuidedTourOverlay';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';
import * as Clipboard from 'expo-clipboard';
import { generateInfoPartido, generateInfoConvo, getAttendanceLink } from '../utils/sharing';

export default function MatchAttendanceScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId, isPublic } = route.params || {};

  const [match, setMatch] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [convocadosExpanded, setConvocadosExpanded] = useState(false);
  const [rosterModalVisible, setRosterModalVisible] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const handleSyncComplete = React.useCallback((count) => {
    setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
    setTimeout(() => setSyncMessage(null), 3000);
  }, []);
  const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });

  const statsStripRef          = useRef(null);
  const convocadosAccordionRef = useRef(null);
  const firstPlayerActionsRef  = useRef(null);
  const shareBtnRef            = useRef(null);
  const matrixBtnRef           = useRef(null);

  const TOUR_STEPS = [
    { ref: statsStripRef,          title: 'Resumen de asistencia',  text: 'Muestra cuántos jugadores confirman, cuántos declinan y cuántos están pendientes de responder.' },
    { ref: convocadosAccordionRef, title: 'Lista de convocados',    text: 'Los convocados se seleccionan desde la pantalla del partido. Despliega esta sección para ver a todos y su estado de un vistazo.' },
    { ref: firstPlayerActionsRef,  title: 'Confirmar asistencia',   text: '✓ verde si viene, ✗ rojo si no viene, icono de persona para descartarlo de la convocatoria. Los padres también pueden confirmar desde el enlace web.' },
    { ref: shareBtnRef,            title: 'Compartir convocatoria', text: 'Envía la convocatoria por WhatsApp en castellano o valenciano. También puedes copiar el enlace web para que los padres y jugadores confirmen directamente desde su móvil.' },
    { ref: matrixBtnRef,           title: 'Ir al partido',          text: 'Cuando tengas confirmadas las asistencias, vuelve a la pantalla del partido para gestionar los periodos.' },
  ];

  useEffect(() => {
    if (!matchId || !teamId) { setLoading(false); return; }

    // 1. Carga caché proactiva — visible inmediatamente sin red
    getCachedDoc('teams', teamId).then(cached => { if (cached) setTeam(cached); });
    getCachedDoc('matches', matchId).then(cached => {
      if (cached) { setMatch(cached); setLoading(false); }
    });

    // 2. Firestore actualiza cuando haya red
    getDoc(doc(db, 'teams', teamId)).then(docSnap => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setTeam(data);
        cacheDoc('teams', teamId, data);
      }
    }).catch(() => {/* ya cargado desde caché */ });

    const unsubscribe = onSnapshot(doc(db, 'matches', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setMatch(data);
        cacheDoc('matches', matchId, data);
      }
      setLoading(false);
    }, () => {
      setLoading(false); // caché ya cargado arriba
    });
    return unsubscribe;
  }, [matchId, teamId]);

  // Añade o quita un jugador del acta del partido (match.players)
  const togglePlayerInRoster = async (player) => {
    if (!match || isPublic) return;
    const current = match.players || [];
    const isIn = current.some(p => p.id === player.id);
    const newPlayers = isIn
      ? current.filter(p => p.id !== player.id)
      : [...current, player];
    setMatch({ ...match, players: newPlayers });
    await writeDoc('matches', match.id, { players: newPlayers });
  };

  const updateAttendance = async (playerId, status) => {
    if (!match || isPublic) return;
    const currentAttendance = match.attendance || {};
    let newAttendance;
    if (status === null) {
      const { [playerId]: _removed, ...rest } = currentAttendance;
      newAttendance = rest;
    } else {
      newAttendance = { ...currentAttendance, [playerId]: { status, timestamp: new Date().toISOString() } };
    }
    // Optimistic UI update
    setMatch({ ...match, attendance: newAttendance });
    // Write to Firestore (or queue if offline)
    await writeDoc('matches', match.id, { attendance: newAttendance });
  };

  const copyMatchInfo = async (lang) => {
    await Clipboard.setStringAsync(generateInfoPartido(match, team, lang));
    setShareModalVisible(false);
    Alert.alert('Copiado', 'Información del partido copiada.');
  };

  const copyRoster = async (lang) => {
    const playersList = match.players || team.players || [];
    await Clipboard.setStringAsync(generateInfoConvo(match, team, playersList, lang));
    setShareModalVisible(false);
    Alert.alert('Copiado', 'Convocatoria copiada.');
  };

  const copyWebLink = async (viewType) => {
    const url = getAttendanceLink(teamId, matchId, viewType === 'padres');
    await Clipboard.setStringAsync(url);
    setShareModalVisible(false);
    Alert.alert('Enlace copiado', url);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  if (!match || !team) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Partido no encontrado.</Text>
        {!isPublic && (
          <TouchableOpacity style={styles.backBtnCenter} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnCenterText}>Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const players = team?.players || match.players || [];
  const attendance = match.attendance || {};
  const descartadoPlayers = players.filter(p => attendance[p.id]?.status === 'descartado');
  const activePlayers = players.filter(p => attendance[p.id]?.status !== 'descartado');
  const confirmedPlayers = activePlayers.filter(p => attendance[p.id]?.status === 'available');
  const unavailablePlayers = activePlayers.filter(p => attendance[p.id]?.status === 'unavailable');
  const pendingPlayers = activePlayers.filter(p => !attendance[p.id]?.status || attendance[p.id]?.status === 'pending');

  const formattedDate = match.date
    ? new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const firstActivePId = activePlayers.length > 0 ? activePlayers[0].id : null;

  const renderPlayerRow = (p, status) => {
    const roleConf = getRoleConfig(team, p.role || 'receptor');
    const isFirstForTour = p.id === firstActivePId;
    return (
      <View key={p.id} style={styles.playerRow}>
        <View style={styles.playerInfoBox}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{p.number}</Text>
          </View>
          <View style={styles.nameAndRole}>
            <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
            <View style={[styles.roleLabel, { backgroundColor: roleConf?.bg }]}>
              <Text style={[styles.roleText, { color: roleConf?.color }]}>{roleConf?.label}</Text>
            </View>
          </View>
        </View>
        {!isPublic && (
          <View ref={isFirstForTour ? firstPlayerActionsRef : null} style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, status === 'available' ? styles.btnYesActive : styles.btnYes]}
              onPress={() => updateAttendance(p.id, 'available')}
              activeOpacity={0.7}
            >
              <CheckCircle2 color={status === 'available' ? T.white : T.pos} size={17} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, status === 'unavailable' ? styles.btnNoActive : styles.btnNo]}
              onPress={() => updateAttendance(p.id, 'unavailable')}
              activeOpacity={0.7}
            >
              <XCircle color={status === 'unavailable' ? T.white : T.neg} size={17} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.btnDescartar]}
              onPress={() => updateAttendance(p.id, 'descartado')}
              activeOpacity={0.7}
            >
              <UserMinus color={T.textFaint} size={15} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderDescartadoRow = (p) => {
    const roleConf = getRoleConfig(team, p.role || 'receptor');
    return (
      <View key={p.id} style={[styles.playerRow, styles.descartadoRow]}>
        <View style={[styles.playerInfoBox, { opacity: 0.45 }]}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{p.number}</Text>
          </View>
          <View style={styles.nameAndRole}>
            <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
            <View style={[styles.roleLabel, { backgroundColor: roleConf?.bg }]}>
              <Text style={[styles.roleText, { color: roleConf?.color }]}>{roleConf?.label}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, styles.btnReconvocar]}
          onPress={() => updateAttendance(p.id, null)}
          activeOpacity={0.7}
        >
          <UserPlus color={T.textSub} size={15} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        <View style={styles.headerRow}>
          {!isPublic ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <ChevronLeft color="rgba(255,255,255,0.7)" size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>vs {match.opponent}</Text>
            <Text style={styles.headerSub}>{formattedDate}{match.time ? ` · ${match.time}h` : ''}</Text>
          </View>
          {!isPublic ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity onPress={() => setRosterModalVisible(true)} style={styles.iconBtn}>
                <ListChecks color="rgba(255,255,255,0.7)" size={18} />
              </TouchableOpacity>
              <TouchableOpacity ref={shareBtnRef} onPress={() => setShareModalVisible(true)} style={styles.iconBtn}>
                <Share2 color="rgba(255,255,255,0.7)" size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTourActive(true)} style={styles.iconBtn}>
                <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <View ref={statsStripRef} style={styles.statsStrip}>
          <View style={styles.statChip}>
            <Text style={[styles.statValue, { color: T.pos }]}>{confirmedPlayers.length}</Text>
            <Text style={styles.statLabel}>Vienen</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statChip}>
            <Text style={[styles.statValue, { color: T.neg }]}>{unavailablePlayers.length}</Text>
            <Text style={styles.statLabel}>No vienen</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statChip}>
            <Text style={[styles.statValue, { color: 'rgba(255,255,255,0.45)' }]}>{pendingPlayers.length}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>
      </LinearGradient>

      <OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Convocados accordion */}
        <TouchableOpacity
          ref={convocadosAccordionRef}
          style={styles.convocadosAccordion}
          onPress={() => setConvocadosExpanded(v => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.convocadosAccordionLeft}>
            <Users color={T.textSub} size={13} strokeWidth={1.8} />
            <Text style={styles.convocadosAccordionTitle}>CONVOCADOS</Text>
            <View style={styles.convocadosAccordionCount}>
              <Text style={styles.convocadosAccordionCountText}>{activePlayers.length}</Text>
            </View>
          </View>
          <View style={styles.convocadosAccordionRight}>
            <View style={styles.convocadosAsistenBadge}>
              <Text style={styles.convocadosAsistenNum}>{confirmedPlayers.length}</Text>
              <Text style={styles.convocadosAsistenLabel}> asisten</Text>
            </View>
            <ChevronDown
              color={T.textFaint}
              size={16}
              strokeWidth={2}
              style={{ transform: [{ rotate: convocadosExpanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {convocadosExpanded && (
          <View style={styles.convocadosChipsPanel}>
            {activePlayers.map(p => {
              const roleConf = getRoleConfig(team, p.role || 'receptor');
              const status = attendance[p.id]?.status;
              const statusColor = status === 'available' ? T.pos : status === 'unavailable' ? T.neg : T.textFaint;
              return (
                <View key={p.id} style={styles.convocadoGridCell}>
                  <View style={[styles.convocadoChip, styles.convocadoChipGrid, status === 'available' && styles.convocadoChipConfirmed]}>
                    <View style={[styles.convocadoGridNum, { backgroundColor: statusColor + '22' }]}>
                      <Text style={[styles.convocadoChipNum, { color: statusColor }]}>{p.number}</Text>
                    </View>
                    <Text style={styles.convocadoChipName} numberOfLines={1}>{p.name}</Text>
                    <View style={{ flex: 1 }} />
                    <View style={[styles.convocadoChipDot, { backgroundColor: statusColor }]} />
                    {!isPublic && (
                      <TouchableOpacity
                        onPress={() => updateAttendance(p.id, 'descartado')}
                        style={styles.convocadoChipDismiss}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <UserMinus color={T.textFaint} size={10} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: T.pos }]} />
            <Text style={styles.sectionTitle}>Asisten ({confirmedPlayers.length})</Text>
          </View>
          <View style={styles.listCard}>
            {confirmedPlayers.map(p => renderPlayerRow(p, 'available'))}
            {confirmedPlayers.length === 0 && <Text style={styles.emptyText}>Ninguno confirmado aún</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: T.textFaint }]} />
            <Text style={styles.sectionTitle}>Pendientes ({pendingPlayers.length})</Text>
          </View>
          <View style={styles.listCard}>
            {pendingPlayers.map(p => renderPlayerRow(p, 'pending'))}
            {pendingPlayers.length === 0 && <Text style={styles.emptyText}>Ninguno pendiente</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: T.neg }]} />
            <Text style={styles.sectionTitle}>No Vienen ({unavailablePlayers.length})</Text>
          </View>
          <View style={styles.listCard}>
            {unavailablePlayers.map(p => renderPlayerRow(p, 'unavailable'))}
            {unavailablePlayers.length === 0 && <Text style={styles.emptyText}>Ninguno reportó ausencia</Text>}
          </View>
        </View>

        {!isPublic && descartadoPlayers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: T.textFaint, opacity: 0.4 }]} />
              <Text style={[styles.sectionTitle, { color: T.textFaint }]}>No convocados ({descartadoPlayers.length})</Text>
            </View>
            <View style={styles.listCard}>
              {descartadoPlayers.map(p => renderDescartadoRow(p))}
            </View>
          </View>
        )}

        {isPublic && (
          <View style={styles.publicFooter}>
            <Text style={styles.publicFooterText}>Gestionado con Basketball Manager</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {!isPublic && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            ref={matrixBtnRef}
            style={styles.matrixBtnWrap}
            onPress={() => navigation.navigate('MatchMatrix', { matchId: match.id, teamId })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[T.orange, T.orangeDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.matrixBtnGrad}
            >
              <Activity color={T.white} size={18} />
              <Text style={styles.matrixBtnText}>Ir al partido</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />

      {/* ── Modal gestión convocatoria ──────────────────────────────── */}
      <Modal visible={rosterModalVisible} transparent animationType="slide" onRequestClose={() => setRosterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.rosterModalHandle} />
            <Text style={styles.rosterModalTitle}>Gestionar convocatoria</Text>
            <Text style={styles.rosterModalSub}>Toca para añadir o quitar jugadores del acta</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {(team?.players || []).map(p => {
                const inRoster = (match?.players || []).some(mp => mp.id === p.id);
                const roleConf = getRoleConfig(team, p.role || 'receptor', T.isDark);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.rosterRow, inRoster && styles.rosterRowIn]}
                    onPress={() => togglePlayerInRoster(p)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rosterNum, { backgroundColor: inRoster ? T.posSoft : T.panelDeep }]}>
                      <Text style={[styles.rosterNumText, { color: inRoster ? T.pos : T.textFaint }]}>{p.number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rosterName, inRoster && { color: T.text }]}>{p.name}</Text>
                      <View style={[styles.roleLabel, { backgroundColor: roleConf?.bg }]}>
                        <Text style={[styles.roleText, { color: roleConf?.color }]}>{roleConf?.label}</Text>
                      </View>
                    </View>
                    <View style={[styles.rosterToggle, { backgroundColor: inRoster ? T.pos : T.border }]}>
                      {inRoster
                        ? <CheckCircle2 color="#fff" size={16} strokeWidth={2.5} />
                        : <UserPlus color={T.textFaint} size={15} strokeWidth={1.8} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRosterModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={shareModalVisible} transparent animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Compartir y Copiar</Text>

            <View style={styles.shareSection}>
              <Text style={styles.shareSectionTitle}>Convocatoria (Info + Convocados)</Text>
              <View style={styles.shareRow}>
                <TouchableOpacity style={styles.shareBtnA} onPress={() => copyRoster('val')}>
                  <Text style={styles.shareBtnAText}>Valencià</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtnA} onPress={() => copyRoster('es')}>
                  <Text style={styles.shareBtnAText}>Castellano</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.shareSection}>
              <Text style={styles.shareSectionTitle}>Solo Información del Partido</Text>
              <View style={styles.shareRow}>
                <TouchableOpacity style={styles.shareBtnB} onPress={() => copyMatchInfo('val')}>
                  <Text style={styles.shareBtnBText}>Valencià</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtnB} onPress={() => copyMatchInfo('es')}>
                  <Text style={styles.shareBtnBText}>Castellano</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.shareSection}>
              <Text style={styles.shareSectionTitle}>Enlaces Web</Text>
              <View style={styles.shareRow}>
                <TouchableOpacity style={styles.shareBtnC} onPress={() => copyWebLink('padres')}>
                  <Text style={styles.shareBtnCText}>Link Padres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtnC} onPress={() => copyWebLink('entrenador')}>
                  <Text style={styles.shareBtnCText}>Link Entrenador</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShareModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontFamily: T.fontReg, fontSize: 16, color: T.textSub, marginBottom: 16 },
  backBtnCenter: { backgroundColor: T.orangeSoft, paddingHorizontal: 20, paddingVertical: 10, borderRadius: T.rBtn },
  backBtnCenterText: { fontFamily: T.fontSemi, color: T.orange },

  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  iconBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: T.fontBold, fontSize: 15, color: T.onDark },
  headerSub: { fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },

  statsStrip: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: T.rCard, padding: 16, alignItems: 'center',
  },
  statChip: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: T.monoBold, fontSize: 28, lineHeight: 32 },
  statLabel: {
    fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2,
  },
  statSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },

  container: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: {
    fontFamily: T.fontSemi, fontSize: 12, color: T.textSub,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  listCard: { backgroundColor: T.white, borderRadius: T.rCard, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  emptyText: { padding: 16, textAlign: 'center', fontFamily: T.fontReg, color: T.textFaint, fontSize: 13, fontStyle: 'italic' },

  playerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  playerInfoBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numberBadge: {
    width: 26, height: 26, backgroundColor: T.panelDeep, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', marginRight: 9,
  },
  numberText: { fontFamily: T.mono, fontSize: 11, color: T.textSub },
  nameAndRole: { flex: 1 },
  playerName: { fontFamily: T.fontSemi, fontSize: 14, color: T.text, marginBottom: 2 },
  roleLabel: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: T.rTag },
  roleText: { fontFamily: T.fontBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },

  actionButtons: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  btnYes: { borderColor: T.pos, backgroundColor: T.posSoft },
  btnYesActive: { borderColor: T.pos, backgroundColor: T.pos },
  btnNo: { borderColor: T.neg, backgroundColor: T.negSoft },
  btnNoActive: { borderColor: T.neg, backgroundColor: T.neg },
  btnDescartar: { borderColor: T.border, backgroundColor: T.panel },
  btnReconvocar: { borderColor: T.border, backgroundColor: T.panel },
  descartadoRow: { backgroundColor: T.panel },

  convocadosAccordion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.white, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 4,
  },
  convocadosAccordionLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  convocadosAccordionTitle: {
    fontSize: 10, fontFamily: T.fontBlack, color: T.textSub,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  convocadosAccordionCount: {
    backgroundColor: T.panel, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  convocadosAccordionCountText: { fontFamily: T.monoBold, fontSize: 11, color: T.textSub },
  convocadosAccordionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convocadosAsistenBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: T.posSoft, borderRadius: 7,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  convocadosAsistenNum: { fontFamily: T.monoBold, fontSize: 13, color: T.posDark },
  convocadosAsistenLabel: { fontFamily: T.fontBold, fontSize: 9, color: T.posDark, textTransform: 'uppercase', letterSpacing: 0.4 },
  convocadosChipsPanel: {
    backgroundColor: T.panel, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border, borderTopWidth: 0,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    padding: 8, flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 16,
  },
  convocadoGridCell: { width: '50%', padding: 3 },
  convocadoChipGrid: { flex: 1 },
  convocadoGridNum: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: 2,
  },
  convocadosChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  convocadoChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.white, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: T.rBtn, borderWidth: 1, borderColor: T.border, gap: 5,
  },
  convocadoChipConfirmed: { borderColor: T.pos + '55', backgroundColor: T.posSoft },
  convocadoChipNum: { fontSize: 11, fontFamily: T.monoBold, color: T.textSub },
  convocadoChipName: { fontSize: 12, fontFamily: T.fontBold, color: T.text },
  convocadoChipDot: { width: 6, height: 6, borderRadius: 3 },
  convocadoChipDismiss: { marginLeft: 2 },

  publicFooter: { marginTop: 32, alignItems: 'center', paddingBottom: 32 },
  publicFooterText: { fontFamily: T.fontReg, fontSize: 12, color: T.textFaint },

  bottomBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: T.white, borderTopWidth: 1, borderTopColor: T.border,
  },
  matrixBtnWrap: { borderRadius: T.rBtn, overflow: 'hidden' },
  matrixBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
  },
  matrixBtnText: { fontFamily: T.fontSemi, color: T.white, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: T.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontFamily: T.fontBold, fontSize: 20, color: T.text, marginBottom: 24 },

  shareSection: { marginBottom: 20 },
  shareSectionTitle: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },
  shareRow: { flexDirection: 'row', gap: 10 },

  shareBtnA: { flex: 1, backgroundColor: T.orangeSoft, padding: 14, borderRadius: T.rBtn, alignItems: 'center' },
  shareBtnAText: { fontFamily: T.fontSemi, color: T.orange, fontSize: 14 },

  shareBtnB: { flex: 1, backgroundColor: T.panel, padding: 14, borderRadius: T.rBtn, alignItems: 'center' },
  shareBtnBText: { fontFamily: T.fontSemi, color: T.textSub, fontSize: 14 },

  shareBtnC: { flex: 1, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, padding: 14, borderRadius: T.rBtn, alignItems: 'center' },
  shareBtnCText: { fontFamily: T.fontSemi, color: T.text, fontSize: 13 },

  modalCloseBtn: { marginTop: 8, padding: 16, backgroundColor: T.panel, borderRadius: T.rBtn, alignItems: 'center' },
  modalCloseBtnText: { fontFamily: T.fontSemi, color: T.textSub, fontSize: 15 },

  // Roster modal
  rosterModalHandle: {
    width: 32, height: 4, backgroundColor: T.borderHard, borderRadius: 2,
    alignSelf: 'center', marginBottom: 14,
  },
  rosterModalTitle: { fontFamily: T.fontBold, fontSize: 17, color: T.text, marginBottom: 4 },
  rosterModalSub: { fontFamily: T.fontReg, fontSize: 12, color: T.textFaint, marginBottom: 16 },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rosterRowIn: { opacity: 1 },
  rosterNum: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  rosterNumText: { fontFamily: T.mono, fontSize: 12 },
  rosterName: { fontFamily: T.fontSemi, fontSize: 14, color: T.textSub, marginBottom: 3 },
  rosterToggle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
