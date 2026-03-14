import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus, UserPlus, Trash2, Edit2, Play, AlertCircle, Settings, Calendar, Clock, MapPin, Users, Activity, RefreshCw, Trophy, Target, ChevronDown, Info, XCircle, Dribbble, Bell } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { ROLES, ROLE_KEYS, getRoleConfig, ROLE_COLORS_PALETTE, getAvailableRoleKeys } from '../constants/roles';
import { useTeams } from '../hooks/useTeams';
import { useMatches } from '../hooks/useMatches';
import { db } from '../constants/firebase';
import { doc, getDoc, updateDoc, writeBatch, collection, addDoc } from 'firebase/firestore';
import { syncWithFederation, importFederationMatches } from '../utils/federation';
import * as Clipboard from 'expo-clipboard';
import { generateInfoPartido, generateInfoConvo, getAttendanceLink } from '../utils/sharing';
import { Bus, Car, Copy, ExternalLink, Share2 } from 'lucide-react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';



export default function TeamDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params;
  const { updateTeam, deleteTeam } = useTeams();
  
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
  const [editingMatch, setEditingMatch] = useState(null);

  const { matches, addMatch, updateMatch: updateMatchHook, deleteMatch } = useMatches(teamId);


  const nextMatch = React.useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const upcomingMs = matches.filter(m => m.state !== 'finished' && m.date >= todayStr);
    upcomingMs.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
    return upcomingMs.length > 0 ? upcomingMs[0] : null;
  }, [matches]);

  const sortedPlayers = React.useMemo(() => {
    if (!team?.players) return [];
    return [...team.players].sort((a, b) => parseInt(a.number || 0) - parseInt(b.number || 0));
  }, [team?.players]);


  useEffect(() => {
    // Real-time listener for just this team (or fetch once)
    const fetchTeam = async () => {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (teamDoc.exists()) {
          setTeam({ id: teamDoc.id, ...teamDoc.data() });
        }
      } catch (e) {
        Alert.alert('Error', 'No se pudo cargar el equipo');
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
    // In a real app we'd use onSnapshot here for real-time updates of the players array
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
        newPlayers = newPlayers.map(p => 
          p.id === editingPlayerId ? { ...playerForm, id: p.id } : p
        );
      } else {
        const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        newPlayers.push({ ...playerForm, id: newId });
      }

      await updateTeam(teamId, { players: newPlayers });
      setTeam({ ...team, players: newPlayers });
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el jugador');
    }
  };

  const handleDeletePlayer = (playerId, playerName) => {
    Alert.alert(
      'Eliminar',
      `¿Seguro que quieres eliminar a ${playerName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            const newPlayers = team.players.filter(p => p.id !== playerId);
            await updateTeam(teamId, { players: newPlayers });
            setTeam({ ...team, players: newPlayers });
          }
        }
      ]
    );
  };

  const handleDeleteTeam = () => {
    Alert.alert(
      '¡Atención!',
      '¿Quieres eliminar este equipo y TODOS sus partidos de forma irreversible?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar Equipo', 
          style: 'destructive',
          onPress: async () => {
            await deleteTeam(teamId);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const openConfigModal = () => {
    const currentRoles = {};
    const availableKeys = getAvailableRoleKeys(team);
    availableKeys.forEach(key => {
      const conf = getRoleConfig(team, key);
      currentRoles[key] = { label: conf.label, color: conf.color, bg: conf.bg };
    });
    setTeamForm({ 
      name: team.name, 
      roles: currentRoles,
      federationId: team.federationId || ''
    });
    setConfigModalVisible(true);
  };

  const handleSaveTeamConfig = async () => {
    try {
      if (!teamForm.name.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío');
      await updateTeam(teamId, { 
        name: teamForm.name, 
        roles: teamForm.roles,
        federationId: teamForm.federationId
      });
      setTeam({ 
        ...team, 
        name: teamForm.name, 
        roles: teamForm.roles,
        federationId: teamForm.federationId
      });
      setConfigModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se guardó la configuración');
    }
  };

  const handleRoleColorSet = (roleKey, paletteColor) => {
    setTeamForm(prev => ({
      ...prev,
      roles: {
        ...prev.roles,
        [roleKey]: {
          ...prev.roles[roleKey],
          color: paletteColor.color,
          bg: paletteColor.bg
        }
      }
    }));
  };

  const handleSyncStanding = async () => {
    if (!team.federationId || syncingAll) return;
    setSyncingAll(true);
    setSyncMenuVisible(false);
    try {
      const res = await syncWithFederation(team.federationId);
      if (res.success) {
        await updateTeam(teamId, { federationData: res.data });
        setTeam(prev => ({ ...prev, federationData: res.data }));
        Alert.alert('Éxito', 'Clasificación actualizada');
      } else {
        Alert.alert('Error', res.error);
      }
    } catch (e) {
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
      if (!res.success) {
        Alert.alert('Error', res.error);
        return;
      }

      let imported = 0;
      let updated = 0;
      const initialPlayers = team.players || [];

      for (const fedMatch of res.matches) {
        const existing = matches.find(m => m.federationMatchId === fedMatch.federationMatchId);
        if (!existing) {
          await addMatch({ ...fedMatch, players: initialPlayers });
          imported++;
        } else {
          // Check for relevant changes (score, date, time)
          const needsUpdate = 
            existing.date !== fedMatch.date || 
            existing.time !== fedMatch.time || 
            existing.state !== fedMatch.state ||
            JSON.stringify(existing.score) !== JSON.stringify(fedMatch.score);
          
          if (needsUpdate) {
            await updateMatchHook(existing.id, {
              date: fedMatch.date,
              time: fedMatch.time,
              state: fedMatch.state,
              score: fedMatch.score,
              result: fedMatch.result,
              location: fedMatch.location
            });
            updated++;
          }
        }
      }
      Alert.alert('Sincronización completa', `${imported} partidos nuevos, ${updated} actualizados.`);
    } catch (e) {
      Alert.alert('Error', 'Fallo al importar partidos');
    } finally {
      setSyncingAll(false);
    }
  };

  const openMatchEdit = (match) => {
    setEditingMatch({ ...match });
    setMatchEditModalVisible(true);
  };

  const handleSaveMatchEdit = async () => {
    if (!editingMatch) return;
    try {
      await updateMatchHook(editingMatch.id, {
        opponent: editingMatch.opponent,
        date: editingMatch.date,
        time: editingMatch.time,
        location: editingMatch.location,
        isHome: editingMatch.isHome,
        matchDay: editingMatch.matchDay || '',
        callTime: editingMatch.callTime || '',
        departureTime: editingMatch.departureTime || '',
        departureLocation: editingMatch.departureLocation || '',
        transportType: editingMatch.transportType || 'car',
        returnTime: editingMatch.returnTime || '',
        observations: editingMatch.observations || ''
      });
      setMatchEditModalVisible(false);
      setEditingMatch(null);
      Alert.alert('Éxito', 'Configuración del partido actualizada');
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el partido');
    }
  };

  const copyMatchInfo = async (lang) => {
    if (!editingMatch) return;
    const text = generateInfoPartido(editingMatch, team, lang);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', 'Información del partido copiada');
  };

  const copyRoster = async (lang) => {
    if (!editingMatch) return;
    const playersList = editingMatch.players || team.players || [];
    const text = generateInfoConvo(editingMatch, team, playersList, lang);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', 'Convocatoria copiada');
  };

  const copyAttendanceLinkAction = async () => {
    if (!editingMatch) return;
    const url = getAttendanceLink(teamId, editingMatch.id);
    await Clipboard.setStringAsync(url);
    Alert.alert('Enlace copiado', url);
  };


  const handleDeleteMatch = (matchId, opponent) => {
    const message = `¿Seguro que quieres eliminar el partido contra ${opponent}?`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        deleteMatch(matchId).catch(e => Alert.alert('Error', 'No se pudo eliminar el partido'));
      }
      return;
    }

    Alert.alert(
      'Eliminar Partido',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteMatch(matchId);
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el partido');
            }
          } 
        }
      ]
    );
  };

  const renderMatchItem = (item) => {
    const isFinished = item.state === 'finished';

    const renderRightActions = (id, opponent) => (
      <View style={{ width: 80, height: '100%', marginBottom: 12 }}>
        <RectButton
          style={[styles.deleteAction, { height: '100%', borderRadius: 16 }]}
          onPress={() => handleDeleteMatch(id, opponent)}
        >
          <Trash2 color={COLORS.white} size={24} />
        </RectButton>
      </View>
    );

    return (
      <Swipeable
        key={item.id}
        renderRightActions={() => renderRightActions(item.id, item.opponent)}
        containerStyle={{ marginBottom: 12 }}
      >
        <View style={[styles.matchCardDetailed, { marginBottom: 0 }]}>
          <TouchableOpacity 
            style={styles.matchMainInfo}
            onPress={() => navigation.navigate('MatchMatrix', { matchId: item.id, teamId })}
          >
            <Text style={styles.matchOpponentText} numberOfLines={1}>{item.opponent}</Text>
            <View style={styles.matchMetaRow}>
              <Text style={styles.matchMetaText}>{item.date} • {item.time ? `${item.time}h` : '--:--'} • {item.isHome ? 'CASA' : 'VIS'} </Text>
              {isFinished && item.score && (
                  <View style={[styles.inlineScoreBox, { backgroundColor: item.result === 'won' ? COLORS.successLight : item.result === 'lost' ? COLORS.dangerLight : COLORS.slate100 }]}>
                      <Text style={[styles.inlineScoreText, { color: item.result === 'won' ? COLORS.success : item.result === 'lost' ? COLORS.danger : COLORS.slate600 }]}>{item.score.local}-{item.score.visitor}</Text>
                  </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.matchActionsRightIcons}>
            <TouchableOpacity style={styles.matchActionIconBtn} onPress={() => navigation.navigate('MatchAttendance', { matchId: item.id, teamId })}>
              <Users color={COLORS.slate400} size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.matchActionIconBtn} onPress={() => openMatchEdit(item)}>
              <Edit2 color={COLORS.slate400} size={18} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.matchActionIconBtn, { backgroundColor: '#FFF7ED' }]} 
              onPress={() => navigation.navigate('MatchMatrix', { matchId: item.id, teamId })}
            >
              <Dribbble color="#EA580C" size={18} />
            </TouchableOpacity>

          </View>
        </View>
      </Swipeable>
    );
  };

  if (loading || !team) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const fedData = team?.federationData || null;
  const sortedMatches = matches ? [...matches].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={COLORS.slate600} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>{team.name}</Text>
        </View>
        <View style={styles.headerRightIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('MatchList', { teamId })} style={styles.headerIconBtn}>
            <Calendar color={COLORS.slate600} size={22} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openConfigModal} style={styles.headerIconBtn}>
            <Settings color={COLORS.slate600} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Federation Section */}
        {team.federationId ? (
          <View style={[styles.fedCard, syncMenuVisible && { zIndex: 1000, elevation: 10 }]}>
            <View style={[styles.fedHeader, syncMenuVisible && { zIndex: 1001 }]}>

              <View style={styles.fedTitleBox}>
                <RefreshCw color={COLORS.primary} size={16} />
                <Text style={styles.fedTitle}>Federación FBCV</Text>
              </View>
              <View style={styles.syncBtnContainer}>
                <TouchableOpacity 
                    style={styles.syncBtnMain}
                    onPress={() => setSyncMenuVisible(!syncMenuVisible)}
                >
                  {syncingAll ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Activity color={COLORS.white} size={14} />
                      <Text style={styles.syncBtnText}>Sincro Smart</Text>
                      <ChevronDown color={COLORS.white} size={14} />
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
              <View style={[styles.fedStatsGrid, { zIndex: 1 }]}>
                <View style={styles.fedStatRow}>
                   <View style={styles.fedStatItemInline}>
                      <Text style={styles.fedStatLabelInline}>POSICIÓN: </Text>
                      <Text style={styles.fedStatValueInline}>{fedData.standing?.position || '--'}º</Text>
                   </View>
                   <View style={styles.fedStatItemInline}>
                      <Text style={styles.fedStatLabelInline}>PUNTOS: </Text>
                      <Text style={styles.fedStatValueInline}>{fedData.standing?.points || '--'}</Text>
                   </View>
                </View>
                <View style={styles.fedStatRowCompact}>
                   <Text style={styles.fedStatSubText}>V/D: {fedData.standing?.wins}/{fedData.standing?.losses}   PF/PC: {fedData.standing?.scoreFavour}/{fedData.standing?.scoreAgainst}</Text>
                </View>
              </View>
            ) : (

                <Text style={styles.fedStatEmpty}>Sincroniza para ver clasificación</Text>
            )}
          </View>
        ) : null}

        {/* Next Match Widget */}
        {nextMatch && (
            <TouchableOpacity 
              style={styles.nextMatchWidget}
              onPress={() => navigation.navigate('MatchMatrix', { matchId: nextMatch.id, teamId })}
              activeOpacity={0.8}
            >
              <View style={styles.nextMatchHeader}>
                  <View style={styles.nmTitleRow}>
                      <View style={styles.nmStatusDot} />
                      <Text style={styles.nextMatchTitle}>PRÓXIMO PARTIDO</Text>
                  </View>
                  <View style={[styles.badge, nextMatch.isHome ? styles.badgeHome : styles.badgeAway]}>
                    <Text style={styles.badgeText}>{nextMatch.isHome ? '🏠 CASA' : '🚌 FUERA'}</Text>
                  </View>
              </View>
              
              <View style={styles.nmMainContent}>
                <View style={styles.nmInfoColumn}>
                  <Text style={styles.nextMatchOpponent} numberOfLines={1}>{nextMatch.opponent.toUpperCase()}</Text>
                  
                  <View style={styles.nmRow}>
                      <Clock color={COLORS.slate400} size={13} />
                      <Text style={styles.nmText}>
                        {new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} • {nextMatch.time}h
                      </Text>
                  </View>
                  
                  {nextMatch.location && (
                    <View style={styles.nmLocationPill}>
                        <MapPin color={COLORS.slate400} size={11} />
                        <Text style={styles.nmLocationText} numberOfLines={1}>{nextMatch.location.toUpperCase()}</Text>
                    </View>
                  )}

                  <View style={styles.nmRow}>
                      <Bell color={COLORS.success} size={13} />
                      <Text style={[styles.nmText, { color: COLORS.success, fontWeight: '700' }]}>
                        Convocatoria: {nextMatch.callTime || '--:--'}h {nextMatch.callTime ? '(1h antes)' : ''}
                      </Text>
                  </View>
                </View>
                
                <View style={styles.nmRightPart}>
                  <View style={styles.nmAttendanceCircle}>
                    <Calendar color="rgba(255,255,255,0.05)" size={40} style={styles.nmBgIcon} />
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('MatchAttendance', { matchId: nextMatch.id, teamId });
                      }}
                      style={styles.nmUserIcon}
                      activeOpacity={0.7}
                    >
                      <Users color="rgba(255,255,255,0.8)" size={18} />
                    </TouchableOpacity>
                    <View style={styles.nmStatsOverlay}>
                      <View style={styles.nmStatMini}>
                        <View style={[styles.nmStatDot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.nmStatCount}>
                          {nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available').length : 0}
                        </Text>
                      </View>
                      <View style={styles.nmStatMini}>
                        <View style={[styles.nmStatDot, { backgroundColor: COLORS.danger }]} />
                        <Text style={styles.nmStatCount}>
                          {nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'unavailable').length : 0}
                        </Text>
                      </View>
                      <View style={styles.nmStatMini}>
                        <View style={[styles.nmStatDot, { backgroundColor: COLORS.slate500 }]} />
                        <Text style={styles.nmStatCount}>
                          {team?.players ? team.players.length - (nextMatch.attendance ? Object.values(nextMatch.attendance).filter(a => a.status === 'available' || a.status === 'unavailable').length : 0) : 0}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
        )}


        {/* Section Title: Partidos */}
        <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Partidos</Text>
            <View style={styles.sectionHeaderActions}>
                <TouchableOpacity style={styles.sectionIconBtn}>
                    <Calendar color={COLORS.slate600} size={18} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.addMatchBtnText}
                    onPress={() => navigation.navigate('MatchList', { teamId })}
                >
                    <Text style={styles.addMatchText}>+ Nuevo Partido</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Matches List */}
        <View style={styles.matchesSection}>
          {sortedMatches.length === 0 ? (
            <Text style={styles.emptySectionText}>No hay partidos creados.</Text>
          ) : (
            sortedMatches.map(renderMatchItem)
          )}
        </View>

        {/* Players Section (At the bottom) */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>Jugadores ({sortedPlayers.length})</Text>
            <TouchableOpacity onPress={() => openPlayerModal()} style={styles.addPlayerLink}>
                <Plus color={COLORS.primary} size={18} />
                <Text style={styles.addPlayerText}>Añadir</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.playersSection}>
            {sortedPlayers.map(item => {
                 const roleConf = getRoleConfig(team, item.role || 'receptor');
                 return (
                    <View key={item.id} style={styles.playerCardSmall}>
                        <View style={styles.numberBadgeSmall}>
                            <Text style={styles.numberTextSmall}>{item.number}</Text>
                        </View>
                        <Text style={styles.playerNameSmall} numberOfLines={1}>{item.name}</Text>
                        <View style={[styles.roleLabelSmall, { backgroundColor: roleConf?.bg }]}>
                            <Text style={[styles.roleTextSmall, { color: roleConf?.color }]}>{roleConf?.label[0]}</Text>
                        </View>
                        <TouchableOpacity onPress={() => openPlayerModal(item)} style={styles.playerEditIcon}>
                            <Edit2 color={COLORS.slate300} size={16} />
                        </TouchableOpacity>
                    </View>
                 );
            })}
        </View>
        
        <View style={styles.footerSpacer} />
        
        <TouchableOpacity onPress={handleDeleteTeam} style={styles.deleteTeamLink}>
            <Trash2 color={COLORS.danger} size={16} />
            <Text style={styles.deleteTeamText}>Eliminar Equipo</Text>
        </TouchableOpacity>
        
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Player Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingPlayerId ? 'Editar Jugador' : 'Añadir Jugador'}</Text>
            
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={playerForm.name}
              onChangeText={t => setPlayerForm({...playerForm, name: t})}
            />

            <Text style={styles.label}>Dorsal</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={playerForm.number}
              onChangeText={t => setPlayerForm({...playerForm, number: t})}
            />

            <Text style={styles.label}>Rol por defecto</Text>
            <View style={styles.roleGrid}>
              {getAvailableRoleKeys(team).map(rk => {
                const conf = getRoleConfig(team, rk);
                return (
                  <TouchableOpacity
                    key={rk}
                    style={[
                      styles.roleBtn,
                      { backgroundColor: conf.bg },
                      playerForm.role === rk && { borderWidth: 2, borderColor: conf.color }
                    ]}
                    onPress={() => setPlayerForm({...playerForm, role: rk})}
                  >
                    <Text style={[styles.roleBtnText, { color: conf.color }]}>{conf.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSavePlayer}>
                <Text style={styles.modalBtnTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Team Config Modal */}
      <Modal visible={configModalVisible} transparent animationType="slide">
        <SafeAreaView style={styles.modalBg}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Configuración del Equipo</Text>
            
            {teamForm && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View>
                    <Text style={styles.label}>Nombre del equipo</Text>
                    <TextInput
                      style={styles.input}
                      value={teamForm.name}
                      onChangeText={t => setTeamForm({...teamForm, name: t})}
                    />

                    <Text style={[styles.label, { marginTop: 16 }]}>ID Federación (FCBQ/FBCV)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 3822100"
                      keyboardType="number-pad"
                      value={teamForm.federationId}
                      onChangeText={t => setTeamForm({...teamForm, federationId: t})}
                    />

                    <Text style={[styles.label, { marginTop: 24, marginBottom: 12 }]}>Roles de Jugadores</Text>
                    {Object.keys(teamForm.roles).map(rk => (
                      <View key={rk} style={styles.roleConfigRow}>
                        <View style={{flex: 1}}>
                          <TextInput
                            style={[styles.input, { marginBottom: 8 }]}
                            value={teamForm.roles[rk].label}
                            onChangeText={t => {
                              setTeamForm(prev => ({
                                ...prev,
                                roles: { ...prev.roles, [rk]: { ...prev.roles[rk], label: t } }
                              }));
                            }}
                          />
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {ROLE_COLORS_PALETTE.map(pal => (
                              <TouchableOpacity
                                key={pal.id}
                                style={[
                                  styles.colorDot,
                                  { backgroundColor: pal.color },
                                  teamForm.roles[rk].color === pal.color && styles.colorDotSelected
                                ]}
                                onPress={() => handleRoleColorSet(rk, pal)}
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setConfigModalVisible(false)}>
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveTeamConfig}>
                <Text style={styles.modalBtnTextSave}>Guardar Todo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Match Edit Modal */}
      <Modal visible={matchEditModalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <SafeAreaView style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Configuración Partit</Text>
                <Text style={{ fontSize: 10, color: COLORS.slate300 }}>v1.1</Text>
              </View>
              <TouchableOpacity onPress={() => setMatchEditModalVisible(false)}>
                <XCircle color={COLORS.slate400} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {editingMatch && (
                <View style={{ gap: 16 }}>
                  {/* General Info */}
                  <View style={styles.configSection}>
                    <TextInput 
                      style={[styles.input, { fontSize: 18, fontWeight: 'bold' }]} 
                      value={editingMatch.opponent} 
                      placeholder="Rival"
                      onChangeText={t => setEditingMatch({...editingMatch, opponent: t})} 
                    />
                    
                    <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Fecha</Text>
                            <TextInput style={styles.input} value={editingMatch.date} onChangeText={t => setEditingMatch({...editingMatch, date: t})} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Hora Inicio</Text>
                            <TextInput style={styles.input} value={editingMatch.time} onChangeText={t => setEditingMatch({...editingMatch, time: t})} />
                        </View>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Convocatoria</Text>
                            <TextInput style={styles.input} value={editingMatch.callTime} placeholder="18:15" onChangeText={t => setEditingMatch({...editingMatch, callTime: t})} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Jornada</Text>
                            <TextInput style={styles.input} value={editingMatch.matchDay} placeholder="7" keyboardType="numeric" onChangeText={t => setEditingMatch({...editingMatch, matchDay: t})} />
                        </View>
                    </View>

                    <Text style={styles.label}>Lloc / Pabelló</Text>
                    <TextInput style={styles.input} value={editingMatch.location} placeholder="Palau Esport Benidorm" onChangeText={t => setEditingMatch({...editingMatch, location: t})} />
                    
                    <View style={styles.toggleRow}>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, editingMatch.isHome && styles.toggleBtnActive]} 
                            onPress={() => setEditingMatch({...editingMatch, isHome: true})}
                        >
                            <Text style={[styles.toggleBtnText, editingMatch.isHome && styles.toggleBtnTextActive]}>LOCAL</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, !editingMatch.isHome && styles.toggleBtnActive]} 
                            onPress={() => setEditingMatch({...editingMatch, isHome: false})}
                        >
                            <Text style={[styles.toggleBtnText, !editingMatch.isHome && styles.toggleBtnTextActive]}>VISITANTE</Text>
                        </TouchableOpacity>
                    </View>
                  </View>

                  {/* Travel Section */}
                  {!editingMatch.isHome && (
                    <View style={styles.configSectionGray}>
                      <View style={{flexDirection: 'row', gap: 10}}>
                          <View style={{flex: 1}}>
                              <Text style={styles.label}>HORA SALIDA</Text>
                              <View style={styles.inputWithIcon}>
                                <TextInput style={[styles.input, {flex: 1}]} value={editingMatch.departureTime} placeholder="--:--" onChangeText={t => setEditingMatch({...editingMatch, departureTime: t})} />
                                <Clock color={COLORS.slate400} size={16} style={styles.inputIcon} />
                              </View>
                          </View>
                          <View style={{flex: 1}}>
                             <Text style={styles.label}>TRANSPORTE</Text>
                             <View style={styles.transportToggle}>
                                  <TouchableOpacity 
                                      style={[styles.transportBtn, editingMatch.transportType === 'bus' && styles.transportBtnActive]}
                                      onPress={() => setEditingMatch({...editingMatch, transportType: 'bus'})}
                                  >
                                      <Text style={{fontSize: 20}}>🚌</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                      style={[styles.transportBtn, editingMatch.transportType === 'car' && styles.transportBtnActive]}
                                      onPress={() => setEditingMatch({...editingMatch, transportType: 'car'})}
                                  >
                                      <Text style={{fontSize: 20}}>🚗</Text>
                                  </TouchableOpacity>
                             </View>
                          </View>
                      </View>
  
                      <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
                          <View style={{flex: 1}}>
                              <Text style={styles.label}>LUGAR SALIDA</Text>
                              <TextInput style={styles.input} value={editingMatch.departureLocation} placeholder="Pabellón..." onChangeText={t => setEditingMatch({...editingMatch, departureLocation: t})} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={styles.label}>HORA VUELTA</Text>
                              <View style={styles.inputWithIcon}>
                                <TextInput style={[styles.input, {flex: 1}]} value={editingMatch.returnTime} placeholder="--:--" onChangeText={t => setEditingMatch({...editingMatch, returnTime: t})} />
                                <Clock color={COLORS.slate400} size={16} style={styles.inputIcon} />
                              </View>
                          </View>
                      </View>
                    </View>
                  )}

                  {/* Observations */}
                  <View style={styles.configSection}>
                    <Text style={styles.label}>Observaciones</Text>
                    <TextInput 
                      style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                      multiline 
                      value={editingMatch.observations} 
                      placeholder="Indicar ropa, comida, etc."
                      onChangeText={t => setEditingMatch({...editingMatch, observations: t})} 
                    />
                  </View>

                  {/* Actions */}
                  <View style={{ gap: 12, marginTop: 10 }}>
                    <TouchableOpacity style={styles.btnSavePrimary} onPress={handleSaveMatchEdit}>
                      <Text style={styles.btnSaveText}>Guardar Cambios</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.btnDeleteMatch} 
                      onPress={() => handleDeleteMatch(editingMatch.id, editingMatch.opponent)}
                    >
                      <Text style={styles.btnDeleteMatchText}>Eliminar Partido</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  {/* Share Sections */}
                  <View style={styles.shareGroup}>
                    <Text style={styles.shareGroupTitle}>COPIAR CONVOCATORIA</Text>
                    <Text style={styles.shareGroupDesc}>Con el listado de jugadores convocados</Text>
                    <View style={styles.shareBtnRow}>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#FFEDD5' }]} onPress={() => copyRoster('val')}>
                        <Copy color="#9A3412" size={16} />
                        <Text style={[styles.copyBtnText, { color: '#9A3412' }]}>Valencià</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => copyRoster('es')}>
                        <Copy color="#166534" size={16} />
                        <Text style={[styles.copyBtnText, { color: '#166534' }]}>Castellano</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.shareGroup}>
                    <Text style={styles.shareGroupTitle}>COPIAR INFO PARTIDO</Text>
                    <Text style={styles.shareGroupDesc}>Sin listado de jugadores, solo información</Text>
                    <View style={styles.shareBtnRow}>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#FFEDD5' }]} onPress={() => copyMatchInfo('val')}>
                        <Copy color="#9A3412" size={16} />
                        <Text style={[styles.copyBtnText, { color: '#9A3412' }]}>Valencià</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => copyMatchInfo('es')}>
                        <Copy color="#166534" size={16} />
                        <Text style={[styles.copyBtnText, { color: '#166534' }]}>Castellano</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.shareGroupBlue}>
                    <Text style={[styles.shareGroupTitle, { color: '#1E3A8A' }]}>ENLACE PARA PADRES</Text>
                    <Text style={[styles.shareGroupDesc, { color: '#3B82F6' }]}>Envía este enlace por WhatsApp para confirmar asistencia</Text>
                    
                    <TouchableOpacity 
                      style={styles.linkActionBtn} 
                      onPress={() => {
                        console.log("Navigating to attendance:", { matchId: editingMatch.id, teamId });
                        navigation.push('MatchAttendance', { matchId: editingMatch.id, teamId });
                        setTimeout(() => setMatchEditModalVisible(false), 200);
                      }}
                    >
                      <Users color={COLORS.primary} size={18} />
                      <Text style={styles.linkActionBtnText}>Ver Estado Convocatoria</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkActionBtnCopy} onPress={copyAttendanceLinkAction}>
                      <ExternalLink color={COLORS.white} size={18} />
                      <Text style={styles.linkActionBtnTextWhite}>Copiar Enlace de Asistencia</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.slate900 },
  headerRightIcons: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { padding: 8 },

  // Federation Card
  fedCard: { 
    position: 'relative',
    backgroundColor: '#F0F7FF', borderRadius: 16, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0EEFF',
    zIndex: 50
  },
  fedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, position: 'relative' },
  fedTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fedTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.slate700 },
  syncBtnContainer: { position: 'relative', zIndex: 1100 },
  syncBtnMain: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 
  },
  syncBtnText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  syncDropdown: { 
    position: 'absolute', top: 36, right: 0, backgroundColor: COLORS.white, borderRadius: 12, width: 220, zIndex: 1200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 20, borderWidth: 1, borderColor: COLORS.slate100
  },

  syncOption: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.slate100 },
  syncOptionText: { fontSize: 13, color: COLORS.slate700, fontWeight: '500' },
  
  fedStatsGrid: { gap: 6 },
  fedStatRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, padding: 10, borderRadius: 10 },
  fedStatItemInline: { flexDirection: 'row', alignItems: 'baseline' },
  fedStatLabelInline: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate500 },
  fedStatValueInline: { fontSize: 16, fontWeight: '800', color: COLORS.slate900 },
  
  fedStatRowCompact: { backgroundColor: 'rgba(255,255,255,0.5)', padding: 8, borderRadius: 10 },
  fedStatSubText: { fontSize: 11, fontWeight: '600', color: COLORS.slate600 },
  fedStatEmpty: { textAlign: 'center', color: COLORS.slate400, fontSize: 11, padding: 6 },


  nextMatchWidget: { 
    backgroundColor: '#0F172A', marginBottom: 20, borderRadius: 24, padding: 16, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 
  },
  nextMatchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nmStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  nextMatchTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  badge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center' },
  badgeHome: { backgroundColor: '#172554' },
  badgeAway: { backgroundColor: '#1E293B' },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  nextMatchOpponent: { color: COLORS.white, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  
  nmMainContent: { flexDirection: 'row', justifyContent: 'space-between' },
  nmInfoColumn: { flex: 1, gap: 8 },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nmText: { color: '#CBD5E1', fontSize: 13, fontWeight: '500' },
  
  nmLocationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 2
  },
  nmLocationText: { fontSize: 11, fontWeight: '700', color: '#CBD5E1' },
  
  nmRightPart: { alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  nmAttendanceCircle: {
    width: 70, height: 70, justifyContent: 'center', alignItems: 'center', position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 35
  },
  nmBgIcon: { position: 'absolute', opacity: 0.1 },
  nmUserIcon: {
    backgroundColor: '#1E3A8A', padding: 8, borderRadius: 12, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  },
  nmStatsOverlay: {
    position: 'absolute', bottom: 5, flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(15,23,42,0.8)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10
  },
  nmStatMini: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nmStatDot: { width: 6, height: 6, borderRadius: 3 },
  nmStatCount: { fontSize: 10, fontWeight: 'bold', color: COLORS.white },


  // Section Header
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate900 },
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconBtn: { padding: 8, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.slate200 },
  addMatchBtnText: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addMatchText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },

  // Matches List
  matchesSection: { gap: 10 },
  matchCardDetailed: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.slate200
  },
  matchMainInfo: { flex: 1 },
  matchOpponentText: { fontSize: 16, fontWeight: 'bold', color: COLORS.slate900, marginBottom: 4 },
  matchMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchMetaText: { fontSize: 12, color: COLORS.slate500 },
  inlineScoreBox: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inlineScoreText: { fontSize: 11, fontWeight: 'bold' },
  matchActionsRightIcons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  matchActionIconBtn: { padding: 10, borderRadius: 10, backgroundColor: COLORS.slate50 },

  // Players Section
  playersSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerCardSmall: { 
    width: '48.5%', flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, 
    padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate100, gap: 8
  },
  numberBadgeSmall: { 
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.slate50, alignItems: 'center', justifyContent: 'center' 
  },
  numberTextSmall: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate600 },
  playerNameSmall: { flex: 1, fontSize: 12, color: COLORS.slate800, fontWeight: '500' },
  roleLabelSmall: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleTextSmall: { fontSize: 9, fontWeight: 'bold' },
  playerEditIcon: { padding: 4 },

  footerSpacer: { height: 40 },
  deleteTeamLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' },
  deleteTeamText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },

  emptySectionText: { textAlign: 'center', color: COLORS.slate400, padding: 20, fontSize: 13 },
  
  // Modal Overrides
  modalBg: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: COLORS.slate900 },
  label: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate500, textTransform: 'uppercase', marginBottom: 8, marginTop: 16, letterSpacing: 1 },
  input: { backgroundColor: COLORS.slate50, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.slate900 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  roleBtnText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 32 },
  modalBtnCancel: { flex: 1, padding: 16, backgroundColor: COLORS.slate100, borderRadius: 14, alignItems: 'center' },
  modalBtnSave: { flex: 1, padding: 16, backgroundColor: COLORS.primary, borderRadius: 14, alignItems: 'center' },
  modalBtnTextCancel: { fontWeight: 'bold', color: COLORS.slate600 },
  modalBtnTextSave: { fontWeight: 'bold', color: COLORS.white },
  roleConfigRow: { backgroundColor: COLORS.slate50, padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.slate100 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected: { borderColor: COLORS.slate900, borderWidth: 3 },

  // New Match Config Styles
  configSection: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.slate100 },
  configSectionGray: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EDF2F7' },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  inputIcon: { position: 'absolute', right: 14 },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  toggleBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate200, backgroundColor: COLORS.white, alignItems: 'center' },
  toggleBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  toggleBtnText: { fontWeight: 'bold', color: COLORS.slate500, fontSize: 13 },
  toggleBtnTextActive: { color: COLORS.primary },
  
  transportToggle: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.slate200, padding: 2 },
  transportBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  transportBtnActive: { backgroundColor: COLORS.primary },
  
  btnSavePrimary: { backgroundColor: COLORS.slate900, padding: 18, borderRadius: 16, alignItems: 'center' },
  btnSaveText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  btnDeleteMatch: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center' },
  btnDeleteMatchText: { color: COLORS.danger, fontWeight: 'bold' },
  
  divider: { height: 1, backgroundColor: COLORS.slate100, marginVertical: 10 },
  
  shareGroup: { backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.slate100 },
  shareGroupTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.slate600, letterSpacing: 0.5 },
  shareGroupDesc: { fontSize: 11, color: COLORS.slate400, marginBottom: 12 },
  shareBtnRow: { flexDirection: 'row', gap: 10 },
  copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12 },
  copyBtnText: { fontWeight: 'bold', fontSize: 13 },
  
  shareGroupBlue: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DBEAFE' },
  linkActionBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, 
    padding: 14, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#BFDBFE', marginTop: 12
  },
  linkActionBtnText: { color: COLORS.primary, fontWeight: 'bold' },
  linkActionBtnCopy: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, 
    padding: 16, borderRadius: 12, backgroundColor: COLORS.primary, marginTop: 10
  },
  linkActionBtnTextWhite: { color: COLORS.white, fontWeight: 'bold' },
  deleteAction: {
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
});

