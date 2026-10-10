import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal,
  TextInput, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Menu, ChevronLeft, Plus, UserPlus, Trash2, Edit2, AlertCircle, Settings,
  Calendar, Clock, MapPin, Users, Activity, RefreshCw, Trophy, ChevronDown,
  XCircle, Dribbble, Bell, Copy, ExternalLink, Save, Check, HelpCircle,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import AppDrawer from '../components/AppDrawer';
import GuidedTourOverlay from '../components/GuidedTourOverlay';
import { ROLES, ROLE_KEYS, getRoleConfig, ROLE_COLORS_PALETTE, getAvailableRoleKeys } from '../constants/roles';
import { useTeams } from '../hooks/useTeams';
import { useMatches } from '../hooks/useMatches';
import { db } from '../constants/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { syncWithFederation, importFederationMatches } from '../utils/federation';
import * as Clipboard from 'expo-clipboard';
import { generateInfoPartido, generateInfoConvo, getAttendanceLink } from '../utils/sharing';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useLayout } from '../hooks/useLayout';
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { writeDoc } from '../utils/writeDoc';
import { cacheDoc, getCachedDoc } from '../utils/offlineCache';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import CreateMatchModal from '../components/CreateMatchModal';
import { RULESETS, resolveRulesetId } from '../constants/ruleset';

export default function TeamDetailScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params;
  const { deleteTeam } = useTeams();
  const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [playerForm, setPlayerForm] = useState({ name: '', number: '', role: 'receptor' });
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [teamForm, setTeamForm] = useState(null);
  const [syncMenuVisible, setSyncMenuVisible] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [matchEditModalVisible, setMatchEditModalVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchesExpanded, setMatchesExpanded] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const { isPro } = useSubscription();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState('');
  const [createMatchVisible, setCreateMatchVisible] = useState(false);

  const showPaywall = (featureName = '') => {
    setPaywallFeature(featureName);
    setPaywallVisible(true);
  };
  const handleSyncComplete = React.useCallback((count) => {
    setSyncMessage(`✓ ${count} cambio(s) sincronizado(s)`);
    setTimeout(() => setSyncMessage(null), 3000);
  }, []);
  const { isOnline } = useNetworkStatus({ onSyncComplete: handleSyncComplete });
  const MATCHES_PREVIEW = 5;

  const scrollRef       = useRef(null);
  const scrollOffsetRef = useRef(0);
  const menuBtnRef      = useRef(null);
  const configureBtnRef = useRef(null);
  const fedCardRef      = useRef(null);
  const playersSectRef  = useRef(null);
  const addPlayerBtnRef = useRef(null);

  const TOUR_STEPS = [
    { ref: menuBtnRef,      title: 'Menú lateral',      text: 'Navega a otras secciones de la app.' },
    { ref: configureBtnRef, title: 'Configurar equipo',  text: 'Cambia el nombre, el modo de partido (Pasarela 8P, 6P o Libre) y los roles de cada posición. Aquí también introduces el ID de federación FBCV para sincronizar partidos.' },
    { ref: fedCardRef,      title: 'Sincronización FBCV', text: 'Una vez configurado el ID de federación, esta tarjeta aparece. Pulsa "Sincro" para importar automáticamente los partidos del equipo desde la FBCV.' },
    { ref: playersSectRef,  title: 'Jugadores',          text: 'Aquí aparece la plantilla completa con número de dorsal y posición.' },
    { ref: addPlayerBtnRef, title: 'Añadir jugador',     text: 'Añade un nuevo jugador con su nombre, dorsal y posición.' },
  ];

  const [playersSectionY, setPlayersSectionY] = useState(0);

  const scrollToPlayers = () => {
    if (scrollRef.current && playersSectionY > 0) {
      scrollRef.current.scrollTo({ y: playersSectionY - 20, animated: true });
    }
  };

  const { matches, addMatch, updateMatch: updateMatchHook, deleteMatch } = useMatches(teamId);

  const effectiveMatchCount = Math.max(team?.matchCount || 0, matches.length);

  const nextMatch = React.useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcoming = matches
      .filter(m => m.state !== 'finished' && m.date >= todayStr)
      .sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [matches]);

  const sortedPlayers = React.useMemo(() => {
    if (!team?.players) return [];
    return [...team.players].sort((a, b) => parseInt(a.number || 0) - parseInt(b.number || 0));
  }, [team?.players]);

  useEffect(() => {
    // 1. Caché proactiva — visible inmediatamente sin red
    getCachedDoc('teams', teamId).then(cached => {
      if (cached) { setTeam(cached); setLoading(false); }
    });

    // 2. Firestore actualiza cuando haya red
    getDoc(doc(db, 'teams', teamId)).then(teamDoc => {
      if (teamDoc.exists()) {
        const data = { id: teamDoc.id, ...teamDoc.data() };
        setTeam(data);
        cacheDoc('teams', teamId, data);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false); // caché ya cargado arriba
    });
  }, [teamId]);

  const openPlayerModal = (player = null) => {
    if (player) {
      setEditingPlayerId(player.id);
      setPlayerForm({ name: player.name, number: player.number, role: player.role || 'receptor' });
    } else {
      setEditingPlayerId(null);
      setPlayerForm({ name: '', number: '', role: 'receptor' });
    }
    setModalVisible(true);
  };

  const handleSavePlayer = async () => {
    if (!playerForm.name.trim() || !playerForm.number.trim()) {
      Alert.alert('Error', 'Formulario incompleto');
      return;
    }
    try {
      let newPlayers = [...(team.players || [])];
      if (editingPlayerId) {
        newPlayers = newPlayers.map(p => p.id === editingPlayerId ? { ...playerForm, id: p.id } : p);
      } else {
        const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        newPlayers.push({ ...playerForm, id: newId });
      }
      setTeam({ ...team, players: newPlayers });
      await writeDoc('teams', teamId, { players: newPlayers });
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el jugador');
    }
  };

  const handleDeletePlayer = (playerId, playerName) => {
    Alert.alert('Eliminar', `¿Seguro que quieres eliminar a ${playerName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const newPlayers = team.players.filter(p => p.id !== playerId);
          setTeam({ ...team, players: newPlayers });
          await writeDoc('teams', teamId, { players: newPlayers });
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    Alert.alert('¡Atención!', '¿Quieres eliminar este equipo y TODOS sus partidos de forma irreversible?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar Equipo', style: 'destructive',
        onPress: async () => { await deleteTeam(teamId); navigation.goBack(); },
      },
    ]);
  };

  const openConfigModal = () => {
    const currentRoles = {};
    const availableKeys = getAvailableRoleKeys(team);
    availableKeys.forEach(key => {
      const conf = getRoleConfig(team, key, T.isDark);
      currentRoles[key] = {
        label: conf.label, color: conf.color, bg: conf.bg,
        position: conf.position ?? null, order: conf.order ?? 99,
      };
    });
    setTeamForm({ name: team.name, roles: currentRoles, federationId: team.federationId || '', rulesetId: resolveRulesetId(team) });
    setConfigModalVisible(true);
  };

  const handleSaveTeamConfig = async () => {
    try {
      if (!teamForm.name.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío');
      const sorted = {};
      Object.entries(teamForm.roles)
        .sort(([, a], [, b]) => (a.position ?? 999) - (b.position ?? 999))
        .forEach(([k, v], i) => { sorted[k] = { ...v, order: v.position ?? (100 + i) }; });
      // Se escribe solo rulesetId. El antiguo team.mode se deja intacto en los
      // documentos ya existentes: se sigue leyendo como respaldo, nunca se escribe.
      setTeam({ ...team, name: teamForm.name, roles: sorted, federationId: teamForm.federationId, rulesetId: teamForm.rulesetId });
      await writeDoc('teams', teamId, { name: teamForm.name, roles: sorted, federationId: teamForm.federationId, rulesetId: teamForm.rulesetId });
      setConfigModalVisible(false);
    } catch {
      Alert.alert('Error', 'No se guardó la configuración');
    }
  };

  const handleAddRole = () => {
    const orders = Object.values(teamForm.roles).map(r => r.order || 0);
    const nextOrder = orders.length > 0 ? Math.max(...orders) + 1 : 1;
    const newKey = `custom_${Date.now()}`;
    setTeamForm(prev => ({
      ...prev,
      roles: {
        ...prev.roles,
        [newKey]: { label: 'Nuevo rol', color: ROLE_COLORS_PALETTE[0].color, bg: ROLE_COLORS_PALETTE[0].bg, position: null, order: nextOrder },
      },
    }));
  };

  const handleDeleteRole = (rk) => {
    setTeamForm(prev => {
      const { [rk]: _, ...rest } = prev.roles;
      return { ...prev, roles: rest };
    });
  };

  const handleRoleColorSet = (roleKey, paletteColor) => {
    setTeamForm(prev => ({
      ...prev,
      roles: { ...prev.roles, [roleKey]: { ...prev.roles[roleKey], color: paletteColor.color, bg: paletteColor.bg } },
    }));
  };

  const handleSyncStanding = async () => {
    if (!team.federationId || syncingAll) return;
    setSyncingAll(true);
    setSyncMenuVisible(false);
    try {
      const res = await syncWithFederation(team.federationId);
      if (res.success) {
        setTeam(prev => ({ ...prev, federationData: res.data }));
        await writeDoc('teams', teamId, { federationData: res.data });
        Alert.alert('Éxito', 'Clasificación actualizada');
      } else {
        Alert.alert('Error', res.error);
      }
    } catch {
      Alert.alert('Error', 'Fallo en la sincronización');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncMatches = async (mode = 'smart') => {
    if (!team.federationId || syncingAll) return;
    setSyncingAll(true);
    setSyncMenuVisible(false);
    try {
      const res = await importFederationMatches(team.federationId, mode);
      if (!res.success) { Alert.alert('Error', res.error); return; }
      let imported = 0, updated = 0;
      const initialPlayers = team.players || [];
      for (const fedMatch of res.matches) {
        const existing = matches.find(m => m.federationMatchId === fedMatch.federationMatchId);
        if (!existing) {
          await addMatch({ ...fedMatch, players: initialPlayers, rulesetId: resolveRulesetId(team) });
          imported++;
        } else {
          const needsUpdate = existing.date !== fedMatch.date || existing.time !== fedMatch.time
            || existing.state !== fedMatch.state
            || JSON.stringify(existing.score) !== JSON.stringify(fedMatch.score);
          if (needsUpdate) {
            await updateMatchHook(existing.id, {
              date: fedMatch.date, time: fedMatch.time, state: fedMatch.state,
              score: fedMatch.score, result: fedMatch.result, location: fedMatch.location,
            });
            updated++;
          }
        }
      }
      // Also update standings after syncing matches
      const standRes = await syncWithFederation(team.federationId);
      if (standRes.success) {
        setTeam(prev => ({ ...prev, federationData: standRes.data }));
        await writeDoc('teams', teamId, { federationData: standRes.data });
      }
      Alert.alert('Sincronización completa', `${imported} partidos nuevos, ${updated} actualizados.`);
    } catch {
      Alert.alert('Error', 'Fallo al importar partidos');
    } finally {
      setSyncingAll(false);
    }
  };

  const openMatchEdit = (match) => { setEditingMatch({ ...match }); setMatchEditModalVisible(true); };

  const handleSaveMatchEdit = async () => {
    if (!editingMatch) return;
    try {
      await updateMatchHook(editingMatch.id, {
        opponent: editingMatch.opponent, date: editingMatch.date, time: editingMatch.time,
        location: editingMatch.location, isHome: editingMatch.isHome,
        matchDay: editingMatch.matchDay || '', callTime: editingMatch.callTime || '',
        departureTime: editingMatch.departureTime || '', departureLocation: editingMatch.departureLocation || '',
        transportType: editingMatch.transportType || 'car', returnTime: editingMatch.returnTime || '',
        observations: editingMatch.observations || '',
      });
      setMatchEditModalVisible(false);
      setEditingMatch(null);
      Alert.alert('Éxito', 'Configuración del partido actualizada');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el partido');
    }
  };

  const handleDeleteMatch = (matchId, opponent) => {
    const message = `¿Seguro que quieres eliminar el partido contra ${opponent}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) deleteMatch(matchId).catch(() => Alert.alert('Error', 'No se pudo eliminar'));
      return;
    }
    Alert.alert('Eliminar Partido', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await deleteMatch(matchId); } catch { Alert.alert('Error', 'No se pudo eliminar'); } } },
    ]);
  };

  const copyMatchInfo = async (lang) => {
    if (!editingMatch) return;
    await Clipboard.setStringAsync(generateInfoPartido(editingMatch, team, lang));
    Alert.alert('Copiado', 'Información del partido copiada');
  };

  const copyRoster = async (lang) => {
    if (!editingMatch) return;
    const playersList = editingMatch.players || team.players || [];
    await Clipboard.setStringAsync(generateInfoConvo(editingMatch, team, playersList, lang));
    Alert.alert('Copiado', 'Convocatoria copiada');
  };

  const copyAttendanceLinkAction = async () => {
    if (!editingMatch) return;
    const url = getAttendanceLink(teamId, editingMatch.id);
    await Clipboard.setStringAsync(url);
    Alert.alert('Enlace copiado', url);
  };

  const renderMatchItem = (item) => {
    const isFinished = item.state === 'finished';
    const renderRightActions = (id, opp) => (
      <View style={{ width: 80, height: '100%', marginBottom: 12 }}>
        <RectButton style={[styles.swipeDelete, { height: '100%', borderRadius: 14 }]} onPress={() => handleDeleteMatch(id, opp)}>
          <Trash2 color={T.white} size={22} />
        </RectButton>
      </View>
    );
    const dateParts = item.date?.split('-');
    const dateDisplay = dateParts?.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.date;
    return (
      <Swipeable key={item.id} renderRightActions={() => renderRightActions(item.id, item.opponent)} containerStyle={{ marginBottom: 10 }}>
        <View style={[styles.matchCard, { marginBottom: 0 }]}>
          {/* Result accent bar */}
          {isFinished && (
            <View style={[styles.matchResultBar, {
              backgroundColor: item.result === 'won' ? T.pos : item.result === 'lost' ? T.neg : T.borderHard,
            }]} />
          )}
          {/* Top: opponent + score */}
          <TouchableOpacity onPress={() => navigation.navigate('MatchMatrix', { matchId: item.id, teamId })}>
            <View style={styles.matchTopRow}>
              <Text style={styles.matchOpponent}>{item.opponent}</Text>
              {isFinished && item.score && (
                <View style={[styles.scoreBox, { backgroundColor: item.result === 'won' ? T.posSoft : item.result === 'lost' ? T.negSoft : T.panel }]}>
                  <Text style={[styles.scoreText, { color: item.result === 'won' ? T.pos : item.result === 'lost' ? T.neg : T.textSub }]}>
                    {item.score.local}–{item.score.visitor}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.matchMetaText}>
              {dateDisplay} · {item.time ? `${item.time}h` : '--:--'} · {item.isHome ? 'Casa' : 'Visitante'}
            </Text>
          </TouchableOpacity>
          {/* Bottom: actions */}
          <View style={styles.matchDivider} />
          <View style={styles.matchActions}>
            <TouchableOpacity style={styles.matchActionBtn} onPress={() => navigation.navigate('MatchAttendance', { matchId: item.id, teamId })}>
              <Users color={T.textSub} size={14} strokeWidth={1.8} />
              <Text style={styles.matchActionLabel}>Asistencia</Text>
            </TouchableOpacity>
            <View style={styles.matchActionSep} />
            <TouchableOpacity style={styles.matchActionBtn} onPress={() => openMatchEdit(item)}>
              <Edit2 color={T.textSub} size={14} strokeWidth={1.8} />
              <Text style={styles.matchActionLabel}>Editar</Text>
            </TouchableOpacity>
            <View style={styles.matchActionSep} />
            <TouchableOpacity style={[styles.matchActionBtn, styles.matchActionBtnPrimary]} onPress={() => navigation.navigate('MatchMatrix', { matchId: item.id, teamId })}>
              <Dribbble color={T.orange} size={14} strokeWidth={1.8} />
              <Text style={[styles.matchActionLabel, { color: T.orange, fontFamily: T.fontBold }]}>Partido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  if (loading || !team) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  const fedData = team?.federationData || null;
  const sortedMatches = matches ? [...matches].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" backgroundColor={T.ink2} />
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        {/* Top row: menu + name */}
        <View style={styles.headerTop}>
          {!IS_TABLET_LANDSCAPE && (
            <TouchableOpacity ref={menuBtnRef} style={styles.headerIconBtn} onPress={() => setDrawerOpen(true)}>
              <Menu color="rgba(255,255,255,0.7)" size={20} strokeWidth={1.8} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{team.name}</Text>
          <TouchableOpacity onPress={() => setTourActive(true)} style={styles.headerIconBtn}>
            <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
          </TouchableOpacity>
        </View>
        {/* Action buttons row */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn} onPress={scrollToPlayers}>
            <Users color="rgba(255,255,255,0.8)" size={16} strokeWidth={1.8} />
            <Text style={styles.headerActionText}>Jugadores</Text>
          </TouchableOpacity>
          <View style={styles.headerActionSep} />
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('MatchList', { teamId, initialViewMode: 'calendar' })}>
            <Calendar color="rgba(255,255,255,0.8)" size={16} strokeWidth={1.8} />
            <Text style={styles.headerActionText}>Calendario</Text>
          </TouchableOpacity>
          <View style={styles.headerActionSep} />
          <TouchableOpacity ref={configureBtnRef} style={styles.headerActionBtn} onPress={openConfigModal}>
            <Settings color="rgba(255,255,255,0.8)" size={16} strokeWidth={1.8} />
            <Text style={styles.headerActionText}>Configurar</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <OfflineBanner isOnline={isOnline} syncMessage={syncMessage} />

      {IS_TABLET_LANDSCAPE ? (
        /* Two-column layout for tablet landscape */
        <View style={styles.twoColContainer}>
          {/* Left column: Players */}
          <ScrollView style={styles.twoColLeft} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            <View
              ref={playersSectRef}
              style={[styles.sectionRow, { marginTop: 0 }]}
              onLayout={(e) => setPlayersSectionY(e.nativeEvent.layout.y)}
            >
              <Text style={styles.sectionTitle}>Jugadores ({sortedPlayers.length})</Text>
              <TouchableOpacity ref={addPlayerBtnRef} onPress={() => openPlayerModal()} style={styles.addLinkBtn}>
                <Plus color={T.orange} size={16} />
                <Text style={styles.addLinkText}>Añadir</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.playersGrid}>
              {sortedPlayers.map(item => {
                const roleConf = getRoleConfig(team, item.role || 'receptor', T.isDark);
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
            <View style={{ height: 32 }} />
            <TouchableOpacity onPress={handleDeleteTeam} style={styles.deleteTeamBtn}>
              <Trash2 color={T.neg} size={15} />
              <Text style={styles.deleteTeamText}>Eliminar Equipo</Text>
            </TouchableOpacity>
            <View style={{ height: 48 }} />
          </ScrollView>

          {/* Right column: Fed card + Next match + Matches */}
          <ScrollView style={styles.twoColRight} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
            {/* Federation Card */}
            {team.federationId && (
              <View ref={fedCardRef} style={[styles.fedCard, syncMenuVisible && { zIndex: 1000, elevation: 10 }]}>
                <View style={[styles.fedHeader, syncMenuVisible && { zIndex: 1001 }]}>
                  <View style={styles.fedTitleBox}>
                    <RefreshCw color={T.blue} size={15} />
                    <Text style={styles.fedTitle}>Federació FBCV</Text>
                  </View>
                  <View style={styles.syncBtnContainer}>
                    <TouchableOpacity
                      style={styles.syncBtn}
                      onPress={() => {
                        if (!isPro) { showPaywall('Sincronización FBCV'); return; }
                        setSyncMenuVisible(!syncMenuVisible);
                      }}
                    >
                      {syncingAll ? (
                        <ActivityIndicator size="small" color={T.white} />
                      ) : (
                        <>
                          <Activity color={T.white} size={13} />
                          <Text style={styles.syncBtnText}>Sincro</Text>
                          <ChevronDown color={T.white} size={13} />
                        </>
                      )}
                    </TouchableOpacity>
                    {syncMenuVisible && (
                      <View style={styles.syncDropdown}>
                        <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncMatches('smart')}>
                          <Text style={styles.syncOptionText}>Sincro Smart (Actual + Sig.)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncMatches('total')}>
                          <Text style={styles.syncOptionText}>Sincro Total (Toda la temp.)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncStanding()}>
                          <Text style={styles.syncOptionText}>Actualizar Clasificación</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {fedData ? (
                  <View style={styles.fedStats}>
                    <View style={styles.fedStatRow}>
                      <View style={styles.fedStatItem}>
                        <Text style={styles.fedStatLabel}>POS</Text>
                        <Text style={styles.fedStatValue}>{fedData.standing?.position || '--'}º</Text>
                      </View>
                      <View style={styles.fedStatItem}>
                        <Text style={styles.fedStatLabel}>PTS</Text>
                        <Text style={styles.fedStatValue}>{fedData.standing?.points || '--'}</Text>
                      </View>
                      <View style={styles.fedStatItem}>
                        <Text style={styles.fedStatLabel}>V/D</Text>
                        <Text style={styles.fedStatValue}>{fedData.standing?.wins}/{fedData.standing?.losses}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fedEmpty}>Sincroniza para ver clasificación</Text>
                )}
              </View>
            )}

            {/* Next match card */}
            {nextMatch && (
              <TouchableOpacity
                style={styles.nmWidget}
                onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
                activeOpacity={0.85}
              >
                <View style={styles.nmHeaderRow}>
                  <View style={styles.nmTitleRow}>
                    <View style={styles.nmDot} />
                    <Text style={styles.nmLabel}>PRÓXIMO PARTIDO</Text>
                  </View>
                  <View style={[styles.nmBadge, nextMatch.isHome ? styles.nmBadgeHome : styles.nmBadgeAway]}>
                    <Text style={styles.nmBadgeText}>{nextMatch.isHome ? '🏠 CASA' : (nextMatch.transportType === 'car' ? '🚗 COCHE' : '🚌 BUS')}</Text>
                  </View>
                </View>

                <View style={styles.nmBody}>
                  <View style={styles.nmInfoCol}>
                    <Text style={styles.nmOpponent} numberOfLines={1}>{nextMatch.opponent.toUpperCase()}</Text>
                    <View style={styles.nmRow}>
                      <Clock color="rgba(255,255,255,0.4)" size={13} />
                      <Text style={styles.nmRowText}>
                        {new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {nextMatch.time}h
                      </Text>
                    </View>
                    {nextMatch.location && (
                      <View style={styles.nmLocationPill}>
                        <MapPin color="rgba(255,255,255,0.4)" size={11} />
                        <Text style={styles.nmLocationText} numberOfLines={1}>{nextMatch.location.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.nmRow}>
                      <Bell color={T.pos} size={13} />
                      <Text style={[styles.nmRowText, { color: T.pos }]}>
                        Convocatoria: {nextMatch.callTime || '--:--'}h
                      </Text>
                    </View>
                  </View>

                  <View style={styles.nmRightCol}>
                    <View style={styles.nmAttBox}>
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); navigation.navigate('MatchAttendance', { matchId: nextMatch.id, teamId }); }}
                        style={styles.nmUsersBtn}
                        activeOpacity={0.7}
                      >
                        <Users color="rgba(255,255,255,0.8)" size={18} />
                      </TouchableOpacity>
                      <View style={styles.nmStatsRow}>
                        <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: T.pos }]} /><Text style={styles.nmStatCount}>{nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available').length : 0}</Text></View>
                        <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: T.neg }]} /><Text style={styles.nmStatCount}>{nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'unavailable').length : 0}</Text></View>
                        <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]} /><Text style={styles.nmStatCount}>{team?.players ? team.players.length - (nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available' || a.status === 'unavailable').length : 0) : 0}</Text></View>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Matches Section */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Partidos</Text>
              <TouchableOpacity
                style={styles.addLinkBtn}
                onPress={() => {
                  if (!isPro && effectiveMatchCount >= 8) { showPaywall('Creación de partidos'); return; }
                  setCreateMatchVisible(true);
                }}
              >
                <Plus color={T.orange} size={16} />
                <Text style={styles.addLinkText}>Nuevo Partido</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.matchesSection}>
              {sortedMatches.length === 0 ? (
                <Text style={styles.emptySectionText}>No hay partidos creados.</Text>
              ) : (
                <>
                  {sortedMatches.slice(0, matchesExpanded ? sortedMatches.length : MATCHES_PREVIEW).map(renderMatchItem)}
                  {sortedMatches.length > MATCHES_PREVIEW && (
                    <TouchableOpacity
                      style={styles.accordionBtn}
                      onPress={() => setMatchesExpanded(!matchesExpanded)}
                    >
                      <ChevronDown
                        color={T.textSub}
                        size={16}
                        strokeWidth={2}
                        style={{ transform: [{ rotate: matchesExpanded ? '180deg' : '0deg' }] }}
                      />
                      <Text style={styles.accordionText}>
                        {matchesExpanded
                          ? 'Ver menos'
                          : `Ver ${sortedMatches.length - MATCHES_PREVIEW} partidos más`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      ) : (
        /* Single column — existing ScrollView UNCHANGED */
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={IS_TABLET && !IS_TABLET_LANDSCAPE ? { maxWidth: 680, alignSelf: 'center', width: '100%' } : undefined}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >

          {/* Federation Card */}
          {team.federationId && (
            <View ref={fedCardRef} style={[styles.fedCard, syncMenuVisible && { zIndex: 1000, elevation: 10 }]}>
              <View style={[styles.fedHeader, syncMenuVisible && { zIndex: 1001 }]}>
                <View style={styles.fedTitleBox}>
                  <RefreshCw color={T.blue} size={15} />
                  <Text style={styles.fedTitle}>Federació FBCV</Text>
                </View>
                <View style={styles.syncBtnContainer}>
                  <TouchableOpacity
                    style={styles.syncBtn}
                    onPress={() => {
                      if (!isPro) { showPaywall('Sincronización FBCV'); return; }
                      setSyncMenuVisible(!syncMenuVisible);
                    }}
                  >
                    {syncingAll ? (
                      <ActivityIndicator size="small" color={T.white} />
                    ) : (
                      <>
                        <Activity color={T.white} size={13} />
                        <Text style={styles.syncBtnText}>Sincro</Text>
                        <ChevronDown color={T.white} size={13} />
                      </>
                    )}
                  </TouchableOpacity>
                  {syncMenuVisible && (
                    <View style={styles.syncDropdown}>
                      <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncMatches('smart')}>
                        <Text style={styles.syncOptionText}>Sincro Smart (Actual + Sig.)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncMatches('total')}>
                        <Text style={styles.syncOptionText}>Sincro Total (Toda la temp.)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.syncOption} onPress={() => handleSyncStanding()}>
                        <Text style={styles.syncOptionText}>Actualizar Clasificación</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {fedData ? (
                <View style={styles.fedStats}>
                  <View style={styles.fedStatRow}>
                    <View style={styles.fedStatItem}>
                      <Text style={styles.fedStatLabel}>POS</Text>
                      <Text style={styles.fedStatValue}>{fedData.standing?.position || '--'}º</Text>
                    </View>
                    <View style={styles.fedStatItem}>
                      <Text style={styles.fedStatLabel}>PTS</Text>
                      <Text style={styles.fedStatValue}>{fedData.standing?.points || '--'}</Text>
                    </View>
                    <View style={styles.fedStatItem}>
                      <Text style={styles.fedStatLabel}>V/D</Text>
                      <Text style={styles.fedStatValue}>{fedData.standing?.wins}/{fedData.standing?.losses}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.fedEmpty}>Sincroniza para ver clasificación</Text>
              )}
            </View>
          )}

          {/* Next Match */}
          {nextMatch && (
            <TouchableOpacity
              style={styles.nmWidget}
              onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
              activeOpacity={0.85}
            >
              <View style={styles.nmHeaderRow}>
                <View style={styles.nmTitleRow}>
                  <View style={styles.nmDot} />
                  <Text style={styles.nmLabel}>PRÓXIMO PARTIDO</Text>
                </View>
                <View style={[styles.nmBadge, nextMatch.isHome ? styles.nmBadgeHome : styles.nmBadgeAway]}>
                  <Text style={styles.nmBadgeText}>{nextMatch.isHome ? '🏠 CASA' : (nextMatch.transportType === 'car' ? '🚗 COCHE' : '🚌 BUS')}</Text>
                </View>
              </View>

              <View style={styles.nmBody}>
                <View style={styles.nmInfoCol}>
                  <Text style={styles.nmOpponent} numberOfLines={1}>{nextMatch.opponent.toUpperCase()}</Text>
                  <View style={styles.nmRow}>
                    <Clock color="rgba(255,255,255,0.4)" size={13} />
                    <Text style={styles.nmRowText}>
                      {new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} · {nextMatch.time}h
                    </Text>
                  </View>
                  {nextMatch.location && (
                    <View style={styles.nmLocationPill}>
                      <MapPin color="rgba(255,255,255,0.4)" size={11} />
                      <Text style={styles.nmLocationText} numberOfLines={1}>{nextMatch.location.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.nmRow}>
                    <Bell color={T.pos} size={13} />
                    <Text style={[styles.nmRowText, { color: T.pos }]}>
                      Convocatoria: {nextMatch.callTime || '--:--'}h
                    </Text>
                  </View>
                </View>

                <View style={styles.nmRightCol}>
                  <View style={styles.nmAttBox}>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); navigation.navigate('MatchAttendance', { matchId: nextMatch.id, teamId }); }}
                      style={styles.nmUsersBtn}
                      activeOpacity={0.7}
                    >
                      <Users color="rgba(255,255,255,0.8)" size={18} />
                    </TouchableOpacity>
                    <View style={styles.nmStatsRow}>
                      <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: T.pos }]} /><Text style={styles.nmStatCount}>{nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available').length : 0}</Text></View>
                      <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: T.neg }]} /><Text style={styles.nmStatCount}>{nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'unavailable').length : 0}</Text></View>
                      <View style={styles.nmStatMini}><View style={[styles.nmStatDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]} /><Text style={styles.nmStatCount}>{team?.players ? team.players.length - (nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available' || a.status === 'unavailable').length : 0) : 0}</Text></View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Matches Section */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Partidos</Text>
            <TouchableOpacity
              style={styles.addLinkBtn}
              onPress={() => {
                if (!isPro && effectiveMatchCount >= 8) { showPaywall('Creación de partidos'); return; }
                setCreateMatchVisible(true);
              }}
            >
              <Plus color={T.orange} size={16} />
              <Text style={styles.addLinkText}>Nuevo Partido</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.matchesSection}>
            {sortedMatches.length === 0 ? (
              <Text style={styles.emptySectionText}>No hay partidos creados.</Text>
            ) : (
              <>
                {sortedMatches.slice(0, matchesExpanded ? sortedMatches.length : MATCHES_PREVIEW).map(renderMatchItem)}
                {sortedMatches.length > MATCHES_PREVIEW && (
                  <TouchableOpacity
                    style={styles.accordionBtn}
                    onPress={() => setMatchesExpanded(!matchesExpanded)}
                  >
                    <ChevronDown
                      color={T.textSub}
                      size={16}
                      strokeWidth={2}
                      style={{ transform: [{ rotate: matchesExpanded ? '180deg' : '0deg' }] }}
                    />
                    <Text style={styles.accordionText}>
                      {matchesExpanded
                        ? 'Ver menos'
                        : `Ver ${sortedMatches.length - MATCHES_PREVIEW} partidos más`}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Players Section */}
          <View
            ref={playersSectRef}
            style={[styles.sectionRow, { marginTop: 28 }]}
            onLayout={(e) => setPlayersSectionY(e.nativeEvent.layout.y)}
          >
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

          <View style={{ height: 32 }} />
          <TouchableOpacity onPress={handleDeleteTeam} style={styles.deleteTeamBtn}>
            <Trash2 color={T.neg} size={15} />
            <Text style={styles.deleteTeamText}>Eliminar Equipo</Text>
          </TouchableOpacity>
          <View style={{ height: 48 }} />
        </ScrollView>
      )}

      {/* Player Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingPlayerId ? 'Editar Jugador' : 'Añadir Jugador'}</Text>
            <Text style={styles.modalLabel}>NOMBRE</Text>
            <TextInput style={styles.modalInput} value={playerForm.name} onChangeText={t => setPlayerForm({ ...playerForm, name: t })} />
            <Text style={styles.modalLabel}>DORSAL</Text>
            <TextInput style={styles.modalInput} keyboardType="number-pad" value={playerForm.number} onChangeText={t => setPlayerForm({ ...playerForm, number: t })} />
            <Text style={styles.modalLabel}>ROL POR DEFECTO</Text>
            <View style={styles.roleGrid}>
              {getAvailableRoleKeys(team).map(rk => {
                const conf = getRoleConfig(team, rk, T.isDark);
                return (
                  <TouchableOpacity
                    key={rk}
                    style={[styles.roleBtn, { backgroundColor: conf.bg }, playerForm.role === rk && { borderWidth: 2, borderColor: conf.color }]}
                    onPress={() => setPlayerForm({ ...playerForm, role: rk })}
                  >
                    <Text style={[styles.roleBtnText, { color: conf.color }]}>{conf.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveWrap} onPress={handleSavePlayer}>
                <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalSaveGrad}>
                  <Text style={styles.modalSaveText}>Guardar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Team Config Modal */}
      <Modal visible={configModalVisible} transparent animationType="slide">
        <View style={styles.matchEditOverlay}>
          <SafeAreaView style={styles.matchEditSheet} edges={['bottom']}>

            {/* Header */}
            <LinearGradient colors={[T.ink2, T.ink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.matchEditHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setConfigModalVisible(false)} style={styles.matchEditBackBtn}>
                  <ChevronLeft color="#fff" size={16} strokeWidth={1.8} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.matchEditEyebrow}>CONFIGURAR EQUIPO</Text>
                  <Text style={styles.matchEditTitle} numberOfLines={1}>{team?.name || '—'}</Text>
                </View>
                <TouchableOpacity style={styles.matchEditSaveBtn} onPress={handleSaveTeamConfig}>
                  <Save color="#fff" size={18} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {teamForm && (
                <View style={{ gap: 12 }}>

                  {/* Card 01 — Equipo */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>01</Text>
                      <Text style={styles.meFormCardTitle}>Equipo</Text>
                    </View>
                    <Text style={styles.meFormLabel}>NOMBRE</Text>
                    <TextInput style={styles.meFormInput} value={teamForm.name} onChangeText={t => setTeamForm({ ...teamForm, name: t })} />
                    <Text style={[styles.meFormLabel, { marginTop: 12 }]}>ID FEDERACIÓN (FBCV)</Text>
                    <TextInput
                      style={styles.meFormInput}
                      placeholder="Ej: 3822100"
                      placeholderTextColor={T.textFaint}
                      keyboardType="number-pad"
                      value={teamForm.federationId}
                      onChangeText={t => setTeamForm({ ...teamForm, federationId: t })}
                    />
                  </View>

                  {/* Card 02 — Modo de partido */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>02</Text>
                      <Text style={styles.meFormCardTitle}>Modo de partido</Text>
                    </View>
                    {Object.values(RULESETS).map(r => ({ key: r.id, label: r.name, sub: r.sub })).map(m => {
                      const active = teamForm.rulesetId === m.key;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.cfModeRow, active && styles.cfModeRowActive]}
                          onPress={() => setTeamForm({ ...teamForm, rulesetId: m.key })}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.cfModeRadio, active && styles.cfModeRadioActive]}>
                            {active && <View style={styles.cfModeRadioDot} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cfModeLabel, active && styles.cfModeLabelActive]}>{m.label}</Text>
                            <Text style={styles.cfModeSub}>{m.sub}</Text>
                          </View>
                          {active && <Check color={T.orange} size={15} strokeWidth={2.5} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Card 03 — Roles */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>03</Text>
                      <Text style={styles.meFormCardTitle}>Roles de jugadores</Text>
                    </View>
                    {Object.keys(teamForm.roles).map((rk, idx) => {
                      const role = teamForm.roles[rk];
                      const updateRole = (patch) =>
                        setTeamForm(prev => ({ ...prev, roles: { ...prev.roles, [rk]: { ...prev.roles[rk], ...patch } } }));
                      return (
                        <View key={rk} style={[styles.cfRoleRow, idx > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                          {/* Nombre visible + eliminar */}
                          <View style={styles.cfRoleNameRow}>
                            <View style={[styles.cfRolePosBadge, { backgroundColor: role.color + '22' }]}>
                              <Text style={[styles.cfRolePosText, { color: role.color }]}>
                                {role.position ?? '—'}
                              </Text>
                            </View>
                            <TextInput
                              style={[styles.meFormInput, { flex: 1 }]}
                              value={role.label}
                              placeholder="Nombre visible"
                              placeholderTextColor={T.textFaint}
                              onChangeText={t => updateRole({ label: t })}
                            />
                            <TouchableOpacity onPress={() => handleDeleteRole(rk)} style={styles.cfDeleteBtn}>
                              <Trash2 color={T.neg} size={15} strokeWidth={1.8} />
                            </TouchableOpacity>
                          </View>
                          {/* Posición en cancha */}
                          <View style={styles.cfPosRow}>
                            <Text style={styles.cfPosRowLabel}>Posición cancha</Text>
                            <View style={styles.cfPosChips}>
                              {[1, 2, 3, 4, 5, null].map(pos => {
                                const sel = role.position === pos;
                                return (
                                  <TouchableOpacity
                                    key={pos ?? 'null'}
                                    style={[styles.cfPosChip, sel && { backgroundColor: role.color, borderColor: role.color }]}
                                    onPress={() => updateRole({ position: pos })}
                                  >
                                    <Text style={[styles.cfPosChipText, sel && { color: '#fff' }]}>
                                      {pos ?? '—'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          {/* Color */}
                          <View style={styles.cfColorRow}>
                            {ROLE_COLORS_PALETTE.map(pal => (
                              <TouchableOpacity
                                key={pal.id}
                                style={[styles.cfColorDot, { backgroundColor: pal.color },
                                  role.color === pal.color && { borderWidth: 3, borderColor: T.text }]}
                                onPress={() => handleRoleColorSet(rk, pal)}
                              />
                            ))}
                          </View>
                        </View>
                      );
                    })}
                    <TouchableOpacity style={styles.cfAddRoleBtn} onPress={handleAddRole}>
                      <Plus color={T.orange} size={15} strokeWidth={2} />
                      <Text style={styles.cfAddRoleBtnText}>Añadir rol</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 32 }} />
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Match Edit Modal */}
      <Modal visible={matchEditModalVisible} transparent animationType="slide">
        <View style={styles.matchEditOverlay}>
          <SafeAreaView style={styles.matchEditSheet} edges={['bottom']}>

            {/* Dark gradient header */}
            <LinearGradient colors={[T.ink2, T.ink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.matchEditHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setMatchEditModalVisible(false)} style={styles.matchEditBackBtn}>
                  <ChevronLeft color="#fff" size={16} strokeWidth={1.8} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.matchEditEyebrow}>EDITAR PARTIDO</Text>
                  <Text style={styles.matchEditTitle} numberOfLines={1}>{editingMatch?.opponent || '—'}</Text>
                </View>
                <TouchableOpacity style={styles.matchEditSaveBtn} onPress={handleSaveMatchEdit}>
                  <Save color="#fff" size={18} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
                {['Rival', 'Fecha y hora', 'Ubicación', 'Viaje'].map((label, i) => (
                  <View key={label} style={{ flex: 1, gap: 4 }}>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: T.orange }} />
                    <Text style={{ fontSize: 9, fontFamily: T.fontBold, color: '#fff', letterSpacing: 0.5 }}>0{i + 1} · {label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editingMatch && (
                <View style={{ gap: 12 }}>

                  {/* Card 01 — Rival */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>01</Text>
                      <Text style={styles.meFormCardTitle}>Rival</Text>
                    </View>
                    <TextInput
                      style={styles.meFormInput}
                      value={editingMatch.opponent}
                      placeholder="Nombre del rival"
                      placeholderTextColor={T.textFaint}
                      onChangeText={t => setEditingMatch({ ...editingMatch, opponent: t })}
                    />
                  </View>

                  {/* Card 02 — Fecha y hora */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>02</Text>
                      <Text style={styles.meFormCardTitle}>Fecha y hora</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meFormLabel}>Fecha</Text>
                        <TextInput style={[styles.meFormInput, { fontFamily: T.mono }]} value={editingMatch.date} onChangeText={t => setEditingMatch({ ...editingMatch, date: t })} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meFormLabel}>Hora inicio</Text>
                        <TextInput style={[styles.meFormInput, { fontFamily: T.mono }]} value={editingMatch.time} onChangeText={t => setEditingMatch({ ...editingMatch, time: t })} />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meFormLabel}>Convocatoria</Text>
                        <TextInput style={[styles.meFormInput, { fontFamily: T.mono }]} value={editingMatch.callTime} placeholder="--:--" placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, callTime: t })} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meFormLabel}>Jornada</Text>
                        <TextInput style={styles.meFormInput} value={editingMatch.matchDay} placeholder="—" placeholderTextColor={T.textFaint} keyboardType="numeric" onChangeText={t => setEditingMatch({ ...editingMatch, matchDay: t })} />
                      </View>
                    </View>
                  </View>

                  {/* Card 03 — Ubicación y localía */}
                  <View style={styles.meFormCard}>
                    <View style={styles.meFormCardHeader}>
                      <Text style={styles.meFormCardNum}>03</Text>
                      <Text style={styles.meFormCardTitle}>Ubicación</Text>
                    </View>
                    <Text style={styles.meFormLabel}>Pabellón</Text>
                    <TextInput style={styles.meFormInput} value={editingMatch.location} placeholder="Nombre del pabellón" placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, location: t })} />
                    <View style={[styles.toggleRow, { marginTop: 10 }]}>
                      <TouchableOpacity style={[styles.toggleBtn, editingMatch.isHome && styles.toggleBtnActive]} onPress={() => setEditingMatch({ ...editingMatch, isHome: true })}>
                        <Text style={[styles.toggleBtnText, editingMatch.isHome && styles.toggleBtnTextActive]}>LOCAL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.toggleBtn, !editingMatch.isHome && styles.toggleBtnActiveOrange]} onPress={() => setEditingMatch({ ...editingMatch, isHome: false })}>
                        <Text style={[styles.toggleBtnText, !editingMatch.isHome && styles.toggleBtnTextOrange]}>VISITANTE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Card 04 — Viaje (away only) */}
                  {!editingMatch.isHome && (
                    <View style={[styles.meFormCard, { borderColor: T.orange + '40', borderWidth: 1.5 }]}>
                      <View style={styles.meFormCardHeader}>
                        <Text style={styles.meFormCardNum}>04</Text>
                        <Text style={styles.meFormCardTitle}>Desplazamiento</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.meFormLabel}>Hora salida</Text>
                          <TextInput style={[styles.meFormInput, { fontFamily: T.mono }]} value={editingMatch.departureTime} placeholder="--:--" placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, departureTime: t })} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.meFormLabel}>Transporte</Text>
                          <View style={styles.transportToggle}>
                            <TouchableOpacity style={[styles.transportBtn, editingMatch.transportType === 'bus' && styles.transportBtnActive]} onPress={() => setEditingMatch({ ...editingMatch, transportType: 'bus' })}>
                              <Text style={{ fontSize: 20 }}>🚌</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.transportBtn, editingMatch.transportType === 'car' && styles.transportBtnActive]} onPress={() => setEditingMatch({ ...editingMatch, transportType: 'car' })}>
                              <Text style={{ fontSize: 20 }}>🚗</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.meFormLabel}>Lugar salida</Text>
                          <TextInput style={styles.meFormInput} value={editingMatch.departureLocation} placeholder="Pabellón..." placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, departureLocation: t })} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.meFormLabel}>Hora vuelta</Text>
                          <TextInput style={[styles.meFormInput, { fontFamily: T.mono }]} value={editingMatch.returnTime} placeholder="--:--" placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, returnTime: t })} />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Observaciones */}
                  <View style={styles.meFormCard}>
                    <Text style={styles.meFormLabel}>Observaciones</Text>
                    <TextInput style={[styles.meFormInput, { height: 70, textAlignVertical: 'top' }]} multiline value={editingMatch.observations} placeholder="Indicar ropa, comida, etc." placeholderTextColor={T.textFaint} onChangeText={t => setEditingMatch({ ...editingMatch, observations: t })} />
                  </View>

                  {/* Footer buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity style={styles.meDeleteBtn} onPress={() => handleDeleteMatch(editingMatch.id, editingMatch.opponent)}>
                      <Trash2 color={T.neg} size={16} strokeWidth={1.8} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.meSaveBtn} onPress={handleSaveMatchEdit}>
                      <Save color="#fff" size={16} strokeWidth={2} />
                      <Text style={styles.meSaveBtnText}>Guardar cambios</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.shareGroup}>
                    <Text style={styles.shareGroupTitle}>COPIAR CONVOCATORIA</Text>
                    <Text style={styles.shareGroupDesc}>Con el listado de jugadores convocados</Text>
                    <View style={styles.shareBtnRow}>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: T.orangeSoft }]} onPress={() => copyRoster('val')}>
                        <Copy color={T.orange} size={15} />
                        <Text style={[styles.copyBtnText, { color: T.orange }]}>Valencià</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: T.posSoft }]} onPress={() => copyRoster('es')}>
                        <Copy color={T.posDark} size={15} />
                        <Text style={[styles.copyBtnText, { color: T.posDark }]}>Castellano</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.shareGroup}>
                    <Text style={styles.shareGroupTitle}>COPIAR INFO PARTIDO</Text>
                    <Text style={styles.shareGroupDesc}>Sin listado de jugadores, solo información</Text>
                    <View style={styles.shareBtnRow}>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: T.orangeSoft }]} onPress={() => copyMatchInfo('val')}>
                        <Copy color={T.orange} size={15} />
                        <Text style={[styles.copyBtnText, { color: T.orange }]}>Valencià</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: T.posSoft }]} onPress={() => copyMatchInfo('es')}>
                        <Copy color={T.posDark} size={15} />
                        <Text style={[styles.copyBtnText, { color: T.posDark }]}>Castellano</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.shareGroupBlue}>
                    <Text style={[styles.shareGroupTitle, { color: '#1E3A8A' }]}>ENLACE PARA PADRES</Text>
                    <Text style={[styles.shareGroupDesc, { color: T.blue }]}>Envía este enlace por WhatsApp para confirmar asistencia</Text>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => { navigation.push('MatchAttendance', { matchId: editingMatch.id, teamId }); setTimeout(() => setMatchEditModalVisible(false), 200); }}
                    >
                      <Users color={T.blue} size={17} />
                      <Text style={styles.linkBtnText}>Ver Estado Convocatoria</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkBtnPrimary} onPress={copyAttendanceLinkAction}>
                      <ExternalLink color={T.white} size={17} />
                      <Text style={styles.linkBtnPrimaryText}>Copiar Enlace de Asistencia</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />
      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} scrollRef={scrollRef} scrollOffsetRef={scrollOffsetRef} />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="feature"
        featureName={paywallFeature}
      />
      <CreateMatchModal
        visible={createMatchVisible}
        onClose={() => setCreateMatchVisible(false)}
        team={team}
        addMatch={addMatch}
        onCreated={(id) => navigation.navigate('MatchMatrix', { matchId: id, teamId })}
      />
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  // ink2, no bg: en iOS este color rellena el hueco de la barra de estado, que
  // va sobre una cabecera azul. Con T.bg quedaba una franja clara arriba.
  safeArea: { flex: 1, backgroundColor: T.ink2 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  headerIconBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, fontFamily: T.fontBold, fontSize: 20, color: T.onDark, letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, overflow: 'hidden',
  },
  headerActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  headerActionText: {
    fontFamily: T.fontSemi, fontSize: 12, color: 'rgba(255,255,255,0.85)',
  },
  headerActionSep: {
    width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 8,
  },

  container: { flex: 1, padding: 16 },

  // Federation Card
  fedCard: {
    backgroundColor: T.blueSoft, borderRadius: T.rCard, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(64,113,255,0.2)', position: 'relative', zIndex: 50,
  },
  fedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, position: 'relative' },
  fedTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fedTitle: { fontFamily: T.fontSemi, fontSize: 13, color: T.blue },
  syncBtnContainer: { position: 'relative', zIndex: 1100 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.blue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: T.rTag + 4 },
  syncBtnText: { fontFamily: T.fontSemi, color: T.white, fontSize: 12 },
  syncDropdown: {
    position: 'absolute', top: 36, right: 0, backgroundColor: T.white, borderRadius: T.rCard, width: 220, zIndex: 1200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 20,
    borderWidth: 1, borderColor: T.border,
  },
  syncOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  syncOptionText: { fontFamily: T.fontMed, fontSize: 13, color: T.text },
  fedStats: { flexDirection: 'row', gap: 8 },
  fedStatRow: { flex: 1, flexDirection: 'row', backgroundColor: T.white, borderRadius: T.rCard, padding: 10, gap: 12 },
  fedStatItem: { flex: 1, alignItems: 'center' },
  fedStatLabel: { fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  fedStatValue: { fontFamily: T.monoBold, fontSize: 18, color: T.text, marginTop: 2 },
  fedEmpty: { fontFamily: T.fontReg, fontSize: 12, color: T.blue, textAlign: 'center', padding: 4 },

  // Next Match Widget
  nmWidget: {
    backgroundColor: T.ink, borderRadius: T.rCardLg, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
  },
  nmHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nmDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.blue },
  nmLabel: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5 },
  nmBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.rPill },
  nmBadgeHome: { backgroundColor: '#172554' },
  nmBadgeAway: { backgroundColor: 'rgba(255,255,255,0.08)' },
  nmBadgeText: { fontFamily: T.fontSemi, fontSize: 10, color: T.white },
  nmBody: { flexDirection: 'row', justifyContent: 'space-between' },
  nmInfoCol: { flex: 1, gap: 7 },
  nmOpponent: { fontFamily: T.fontBlack, fontSize: 18, color: T.white },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  nmRowText: { fontFamily: T.fontMed, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  nmLocationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: T.rPill, alignSelf: 'flex-start',
  },
  nmLocationText: { fontFamily: T.fontSemi, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  nmRightCol: { alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  nmAttBox: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 34, position: 'relative' },
  nmUsersBtn: { backgroundColor: '#1E3A8A', padding: 8, borderRadius: 12 },
  nmStatsRow: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 5, backgroundColor: 'rgba(11,14,20,0.85)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8 },
  nmStatMini: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nmStatDot: { width: 5, height: 5, borderRadius: 2.5 },
  nmStatCount: { fontFamily: T.mono, fontSize: 9, color: T.white },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: T.fontBold, fontSize: 17, color: T.text },
  addLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { fontFamily: T.fontSemi, color: T.orange, fontSize: 14 },

  // Match Cards
  matchesSection: {},
  matchCard: {
    backgroundColor: T.white, paddingHorizontal: 14, paddingTop: 14,
    borderRadius: T.rCard, borderWidth: 1, borderColor: T.borderHard,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  matchResultBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },
  matchTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  matchOpponent: { fontFamily: T.fontBlack, fontSize: 14, color: T.text, flex: 1, letterSpacing: -0.2 },
  matchMetaText: { fontFamily: T.fontReg, fontSize: 12, color: T.textSub, marginBottom: 12 },
  scoreBox: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: T.rPill },
  scoreText: { fontFamily: T.fontBlack, fontSize: 13, letterSpacing: -0.3 },
  matchDivider: { height: 1, backgroundColor: T.border, marginHorizontal: -14 },
  matchActions: {
    flexDirection: 'row', gap: 0,
    backgroundColor: T.panel,
    marginHorizontal: -14, paddingHorizontal: 14,
  },
  matchActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  matchActionBtnPrimary: { backgroundColor: 'rgba(255,106,44,0.06)' },
  matchActionLabel: { fontFamily: T.fontSemi, fontSize: 12, color: T.textSub },
  matchActionSep: { width: 1, backgroundColor: T.border, marginVertical: 8 },

  swipeDelete: { backgroundColor: T.neg, justifyContent: 'center', alignItems: 'center', width: 80 },

  // Players Grid
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerCard: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: T.white,
    padding: 8, borderRadius: T.rCard, borderWidth: 1, borderColor: T.border, gap: 7,
  },
  playerNumBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: T.panel, alignItems: 'center', justifyContent: 'center' },
  playerNum: { fontFamily: T.mono, fontSize: 11, color: T.textSub },
  playerName: { flex: 1, fontFamily: T.fontMed, fontSize: 12, color: T.text },
  playerRoleDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  playerRoleText: { fontFamily: T.fontBold, fontSize: 9 },
  playerEditBtn: { padding: 3 },

  emptySectionText: { fontFamily: T.fontReg, color: T.textFaint, textAlign: 'center', padding: 20, fontSize: 13 },
  accordionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, marginTop: 4,
    backgroundColor: T.white, borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
  },
  accordionText: { fontFamily: T.fontSemi, fontSize: 13, color: T.textSub },

  deleteTeamBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  deleteTeamText: { fontFamily: T.fontSemi, color: T.neg, fontSize: 13 },

  // Two-column tablet landscape layout
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

  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(11,14,20,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: T.white, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 20,
  },
  modalTitle: { fontFamily: T.fontBold, fontSize: 20, color: T.text, marginBottom: 20 },
  modalLabel: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  modalInput: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, padding: 14, fontSize: 15, color: T.text, fontFamily: T.fontReg,
  },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  roleBtnText: { fontFamily: T.fontSemi, fontSize: 11, textTransform: 'uppercase' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 28 },
  modalCancelBtn: { flex: 1, padding: 16, backgroundColor: T.panel, borderRadius: T.rBtn, alignItems: 'center' },
  modalCancelText: { fontFamily: T.fontSemi, color: T.textSub, fontSize: 15 },
  modalSaveWrap: { flex: 1, borderRadius: T.rBtn, overflow: 'hidden' },
  modalSaveGrad: { padding: 16, alignItems: 'center' },
  modalSaveText: { fontFamily: T.fontSemi, color: T.white, fontSize: 15 },

  roleConfigRow: { backgroundColor: T.panel, padding: 12, borderRadius: T.rCard, marginBottom: 10, borderWidth: 1, borderColor: T.border },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected: { borderColor: T.text, borderWidth: 3 },

  modeToggleRow: { flexDirection: 'row', gap: 8 },
  modeToggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: T.rBtn,
    borderWidth: 1.5, borderColor: T.border,
    alignItems: 'center', backgroundColor: T.panel,
  },
  modeToggleBtnActive: { borderColor: T.orange, backgroundColor: 'rgba(255,107,0,0.08)' },
  modeToggleText: { fontFamily: T.fontSemi, fontSize: 13, color: T.textFaint },
  modeToggleTextActive: { color: T.orange },

  // Match Edit (old)
  configSection: { backgroundColor: T.white, borderRadius: T.rCard, padding: 16, borderWidth: 1, borderColor: T.border },
  configSectionGray: { backgroundColor: T.panel, borderRadius: T.rCard, padding: 16, borderWidth: 1, borderColor: T.border },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: T.rBtn, borderWidth: 1, borderColor: T.border, backgroundColor: T.white, alignItems: 'center' },
  toggleBtnActive: { borderColor: T.blue, backgroundColor: T.blueSoft },
  toggleBtnActiveOrange: { borderColor: T.orange, backgroundColor: T.orangeSoft },
  toggleBtnText: { fontFamily: T.fontSemi, color: T.textSub, fontSize: 13 },
  toggleBtnTextActive: { color: T.blue },
  toggleBtnTextOrange: { color: T.orange },
  transportToggle: { flexDirection: 'row', backgroundColor: T.white, borderRadius: T.rBtn, borderWidth: 1, borderColor: T.border, padding: 2 },
  transportBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  transportBtnActive: { backgroundColor: T.orangeSoft },

  savePrimaryBtn: { backgroundColor: T.ink, padding: 18, borderRadius: T.rCard, alignItems: 'center' },
  savePrimaryText: { fontFamily: T.fontSemi, color: T.white, fontSize: 16 },
  deleteMatchBtn: { padding: 18, borderRadius: T.rCard, borderWidth: 1, borderColor: T.negSoft, alignItems: 'center' },
  deleteMatchText: { fontFamily: T.fontSemi, color: T.neg },

  // Match Edit Modal (new style)
  matchEditOverlay: { flex: 1, backgroundColor: 'rgba(11,14,20,0.6)', justifyContent: 'flex-end' },
  matchEditSheet: {
    backgroundColor: T.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', overflow: 'hidden',
  },
  matchEditHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, overflow: 'hidden' },
  matchEditBackBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  matchEditEyebrow: { fontSize: 9, fontFamily: T.fontBold, color: T.orange, letterSpacing: 1.4, textTransform: 'uppercase' },
  matchEditTitle: { fontSize: 16, fontFamily: T.fontBlack, color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  matchEditSaveBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: T.orange, alignItems: 'center', justifyContent: 'center',
  },
  meFormCard: { backgroundColor: T.bg, borderRadius: T.rCard, borderWidth: 1, borderColor: T.border, padding: 14 },
  meFormCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  meFormCardNum: { fontSize: 10, fontFamily: T.monoBold, color: T.orange },
  meFormCardTitle: { fontSize: 13, fontFamily: T.fontBlack, color: T.text },
  meFormLabel: { fontSize: 11, fontFamily: T.fontBold, color: T.textSub, marginBottom: 5, marginTop: 8, letterSpacing: -0.1 },
  meFormInput: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: T.fontSemi, color: T.text,
  },
  meDeleteBtn: {
    width: 46, height: 46, borderRadius: T.rBtn, borderWidth: 1, borderColor: T.negSoft,
    backgroundColor: T.negSoft, alignItems: 'center', justifyContent: 'center',
  },
  meSaveBtn: {
    flex: 1, height: 46, borderRadius: T.rBtn, backgroundColor: T.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  meSaveBtnText: { fontFamily: T.fontBlack, fontSize: 13, color: '#fff' },

  // Config modal — mode selector
  cfModeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: T.rCard, marginBottom: 2,
  },
  cfModeRowActive: { backgroundColor: T.orangeSoft },
  cfModeRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cfModeRadioActive: { borderColor: T.orange },
  cfModeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.orange },
  cfModeLabel: { fontFamily: T.fontSemi, fontSize: 13, color: T.text },
  cfModeLabelActive: { color: T.orange },
  cfModeSub: { fontFamily: T.fontReg, fontSize: 11, color: T.textFaint, marginTop: 1 },

  // Config modal — role rows
  cfRoleRow: { paddingTop: 14, paddingBottom: 8, gap: 10 },
  cfRoleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cfRolePosBadge: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cfRolePosText: { fontFamily: T.monoBold, fontSize: 13 },
  cfPosRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cfPosRowLabel: { fontFamily: T.fontSemi, fontSize: 11, color: T.textFaint, width: 90 },
  cfPosChips: { flexDirection: 'row', gap: 6 },
  cfPosChip: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  cfPosChipText: { fontFamily: T.monoBold, fontSize: 12, color: T.textSub },
  cfColorRow: { flexDirection: 'row', gap: 8 },
  cfColorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  cfOrderInput: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: T.border,
    backgroundColor: T.panel,
    fontFamily: T.monoBold, fontSize: 13, color: T.text,
    textAlign: 'center',
  },
  cfDeleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.negSoft,
  },
  cfAddRoleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 4,
    marginTop: 6, borderTopWidth: 1, borderTopColor: T.border,
  },
  cfAddRoleBtnText: { fontFamily: T.fontSemi, fontSize: 13, color: T.orange },

  divider: { height: 1, backgroundColor: T.border, marginVertical: 4 },

  shareGroup: { backgroundColor: T.white, padding: 16, borderRadius: T.rCard, borderWidth: 1, borderColor: T.border },
  shareGroupTitle: { fontFamily: T.fontSemi, fontSize: 11, color: T.textSub, letterSpacing: 0.5 },
  shareGroupDesc: { fontFamily: T.fontReg, fontSize: 11, color: T.textFaint, marginBottom: 10 },
  shareBtnRow: { flexDirection: 'row', gap: 10 },
  copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, borderRadius: T.rBtn },
  copyBtnText: { fontFamily: T.fontSemi, fontSize: 13 },

  shareGroupBlue: { backgroundColor: T.blueSoft, padding: 16, borderRadius: T.rCard, borderWidth: 1, borderColor: 'rgba(64,113,255,0.2)' },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: T.rBtn, backgroundColor: T.white, borderWidth: 1, borderColor: 'rgba(64,113,255,0.3)', marginTop: 10,
  },
  linkBtnText: { fontFamily: T.fontSemi, color: T.blue },
  linkBtnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: T.rBtn, backgroundColor: T.blue, marginTop: 8 },
  linkBtnPrimaryText: { fontFamily: T.fontSemi, color: T.white },
}); }
