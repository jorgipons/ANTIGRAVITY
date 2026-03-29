import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  ChevronLeft, Info, CheckCircle2, AlertCircle, Users, Activity, 
  ArrowDown, ArrowUp, ChevronRight, Lock, Unlock, Settings, 
  Trash2, Clipboard, ExternalLink, Maximize2, UserPlus, Calendar, Clock, MapPin, Search
} from 'lucide-react-native';
import * as ClipboardAPI from 'expo-clipboard';
import { COLORS } from '../constants/colors';
import { ROLES, getRoleConfig, getAvailableRoleKeys } from '../constants/roles';
import { DEFAULT_RULESET, validatePlayerSelection, getPlayerStatusClasses } from '../constants/ruleset';
import { db } from '../constants/firebase';
import { doc, onSnapshot, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';


export default function MatchMatrixScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const IS_TABLET = SCREEN_WIDTH > 600;
  const COLUMN_WIDTH = IS_TABLET ? 54 : 44;
  const NAME_COLUMN_WIDTH = IS_TABLET ? 180 : 140;

  const styles = useMemo(() => createStyles(COLUMN_WIDTH, NAME_COLUMN_WIDTH), [COLUMN_WIDTH, NAME_COLUMN_WIDTH]);

  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId } = route.params || {};

  const [match, setMatch] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const headerScrollRef = React.useRef(null);
  const bodyScrollRef = React.useRef(null);

  const [substitutionModalVisible, setSubstitutionModalVisible] = useState(false);
  const [selectedOut, setSelectedOut] = useState(null);
  const [selectedIn, setSelectedIn] = useState(null);

  const [isFreeEdit, setIsFreeEdit] = useState(false);
  const [compactViewVisible, setCompactViewVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [matchForm, setMatchForm] = useState(null);

  useEffect(() => {
    if (teamId) {
      getDoc(doc(db, 'teams', teamId)).then(docSnap => {
        if (docSnap.exists()) {
          setTeam({ id: docSnap.id, ...docSnap.data() });
        }
      });
    }

    const matchRef = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.history) data.history = {};
        for(let i=1; i<=DEFAULT_RULESET.totalPeriods; i++) {
          if (!Array.isArray(data.history[i])) {
            if (data.history[i] && typeof data.history[i] === 'object') {
              // Convert object-map format to array of {id, role}
              data.history[i] = Object.entries(data.history[i])
                .filter(([_, val]) => val === true || typeof val === 'string')
                .map(([id, val]) => ({ id, role: typeof val === 'string' ? val : null }));
            } else {
              data.history[i] = [];
            }
          } else {
            // Already an array, normalize contents if they are just strings
            data.history[i] = data.history[i].map(entry => typeof entry === 'string' ? { id: entry, role: null } : entry);
          }
        }
        if (!data.injuries) data.injuries = [];
        if (!data.currentPeriod) data.currentPeriod = 1;
        setMatch({ id: docSnap.id, ...data });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to match:", error);
      Alert.alert('Error', 'No se pudo cargar el partido');
      setLoading(false);
    });

    return unsubscribe;
  }, [matchId]);

  const sortedPlayers = useMemo(() => {
    if (!match) return [];
    const sourcePlayers = team?.players || match.players || [];
    const players = [...sourcePlayers].sort((a, b) => parseInt(a.number) - parseInt(b.number));
    
    // Al filtrar por los jugadores reales de la convocatoria, la matriz es más útil
    if (match.attendance) {
      return players.filter(p => match.attendance[p.id]?.status === 'available');
    }
    return players;
  }, [match?.players, team?.players, match?.attendance]);


  const togglePlayerInPeriod = async (playerId, period) => {
    if (!match || saving) return;
    if (period !== match.currentPeriod && !isFreeEdit) {
      Alert.alert('Modo Lectura', 'Activa el modo de edición libre (candado) para modificar otros periodos.');
      return;
    }

    const currentHistory = match.history || {};
    const currentRoles = match.history_roles || {};
    const periodArray = currentHistory[period] || [];
    const periodRoles = currentRoles[period] || {};
    
    // Check if player is already in the period (supporting both formats)
    const entryIndex = periodArray.findIndex(e => (typeof e === 'object' ? e.id === playerId : e === playerId));
    const isCurrentlySelected = entryIndex > -1;
    
    let newPeriodArray;
    let newPeriodRoles = { ...periodRoles };

    if (isCurrentlySelected) {
      // Restore role cycling logic
      const player = sortedPlayers.find(p => p.id === playerId);
      const availableRoles = getAvailableRoleKeys(team);
      const currentEntry = periodArray[entryIndex];
      const roleFromHistory = typeof currentEntry === 'object' ? currentEntry.role : periodRoles[playerId];
      const currentRole = roleFromHistory || player?.role || 'receptor';
      
      const currentIndex = availableRoles.indexOf(currentRole);
      const nextRole = availableRoles[(currentIndex + 1) % availableRoles.length];
      
      newPeriodRoles[playerId] = nextRole;
      newPeriodArray = periodArray.map((e, idx) => idx === entryIndex ? playerId : e); // Convert to string ID if it was an object
    } else {
      // Only count active players in convocatoria
      const activeEntries = periodArray.filter(e => {
        const id = typeof e === 'object' ? e.id : e;
        return sortedPlayers.some(p => p.id === id);
      });

      if (activeEntries.length >= 5) {
        Alert.alert('Límite alcanzado', 'Solo puedes seleccionar 5 jugadores por periodo (convocados).');
        return;
      }
      const player = sortedPlayers.find(p => p.id === playerId);
      newPeriodArray = [...periodArray, playerId];
      newPeriodRoles[playerId] = player?.role || 'receptor';
    }
    
    try {
      setSaving(true);
      // Update local state first
      setMatch(prev => ({
        ...prev,
        history: { ...currentHistory, [period]: newPeriodArray },
        history_roles: { ...currentRoles, [period]: newPeriodRoles }
      }));

      const matchRef = doc(db, 'matches', match.id);
      const dbHistoryArray = newPeriodArray.map(e => typeof e === 'object' ? e.id : e);
      
      await updateDoc(matchRef, { 
        [`history.${period}`]: dbHistoryArray,
        [`history_roles.${period}`]: newPeriodRoles 
      });
    } catch (error) { 
      console.error("Error toggling player:", error);
      Alert.alert('Error', 'No se pudo actualizar el partido'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleUpdateMatchConfig = async () => {
    if (!matchForm) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'matches', matchId), { ...matchForm });
      setConfigModalVisible(false);
      Alert.alert('Éxito', 'Partido actualizado');
    } catch (e) {
      console.error("Error updating match config:", e);
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const openConfigModal = () => {
    setMatchForm({
      opponent: match.opponent,
      date: match.date,
      time: match.time,
      callTime: match.callTime || '',
      round: match.round || '',
      location: match.location || '',
      isHome: match.isHome,
      notes: match.notes || '',
      departureTime: match.departureTime || '',
      transportType: match.transportType || 'car',
      departureLocation: match.departureLocation || '',
      returnTime: match.returnTime || '',
    });
    setConfigModalVisible(true);
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
      squad.forEach(p => text += `\n- #${p.number} ${p.name}`);
    } else {
      text += isEs ? `Ubicación: ${match.location || 'Local'}` : `Ubicació: ${match.location || 'Local'}`;
    }
    if (match.notes) text += `\n\n*Notas:* ${match.notes}`;
    copyToClipboard(text);
  };

  const handlePrevPeriod = async () => {
    if (!match || match.currentPeriod <= 1 || saving) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'matches', match.id), { currentPeriod: match.currentPeriod - 1 });
    } catch (error) { Alert.alert('Error', 'No se pudo cambiar el periodo'); } 
    finally { setSaving(false); }
  };

  const handleNextPeriod = async () => {
    if (!match || saving) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'matches', match.id), { currentPeriod: (match.currentPeriod || 1) + 1 });
    } catch (error) { Alert.alert('Error', 'No se pudo cambiar el periodo'); } 
    finally { setSaving(false); }
  };

  const handleBodyScroll = (event) => {
    headerScrollRef.current?.scrollTo({ x: event.nativeEvent.contentOffset.x, animated: false });
  };

  const getPlayerPeriodsCount = (playerId) => {
    if (!match?.history) return 0;
    let count = 0;
    for (let i = 1; i <= DEFAULT_RULESET.totalPeriods; i++) {
        const periodArray = match.history[i] || [];
        // Handle both formats for robustness during migration
        const isSelected = Array.isArray(periodArray) && periodArray.some(e => e === playerId || e.id === playerId);
        
        if (isSelected) {
            const isInjured = (match.injuries || []).find(inj => inj.period === i && (inj.playerOut === playerId || inj.playerIn === playerId));
            if (!isInjured) count++;
        }
    }
    return count;
  };

  const clearPlay = async (playerId, period) => {
    if (!match || saving) return;
    const currentHistory = match.history || {};
    const currentRoles = match.history_roles || {};
    const periodArray = currentHistory[period] || [];
    const newPeriodArray = periodArray.filter(pid => pid !== playerId);
    
    const newPeriodRoles = { ...(currentRoles[period] || {}) };
    delete newPeriodRoles[playerId];

    const newInjuries = (match.injuries || []).filter(inj => !(inj.period === period && (inj.playerOut === playerId || inj.playerIn === playerId)));
    
    try {
      setSaving(true);
      // Update local state
      setMatch({
        ...match,
        history: { ...currentHistory, [period]: newPeriodArray },
        history_roles: { ...currentRoles, [period]: newPeriodRoles },
        injuries: newInjuries
      });

      await updateDoc(doc(db, 'matches', match.id), { 
        [`history.${period}`]: newPeriodArray,
        [`history_roles.${period}`]: newPeriodRoles,
        injuries: newInjuries
      });
    } catch (error) { Alert.alert('Error', 'No se pudo limpiar la celda'); }
    finally { setSaving(false); }
  };

  const handleClearPeriod = async (period) => {
    if (!match || saving) return;
    
    const confirmAction = async () => {
      try {
        setSaving(true);
        const newInjuries = (match.injuries || []).filter(inj => inj.period !== period);
        const newHistory = { ...match.history, [period]: [] };
        const newHistoryRoles = { ...match.history_roles, [period]: {} };
        
        // Update local state first for immediate UI response
        setMatch(prev => ({ ...prev, history: newHistory, history_roles: newHistoryRoles, injuries: newInjuries }));

        await updateDoc(doc(db, 'matches', match.id), { 
          [`history.${period}`]: [],
          [`history_roles.${period}`]: {},
          injuries: newInjuries
        });
      } catch (error) { 
        console.error("Error clearing period:", error);
        Alert.alert('Error', 'No se pudo limpiar el periodo'); 
      } finally { 
        setSaving(false); 
      }
    };

    if (require('react-native').Platform.OS === 'web') {
      if (window.confirm(`¿Estás seguro de que quieres eliminar todas las entradas de P${period}?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        'Limpiar Periodo',
        `¿Estás seguro de que quieres eliminar todas las entradas de P${period}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: confirmAction }
        ]
      );
    }
  };

  const handleSubstitutionConfirm = async () => {
    if (!selectedOut || !selectedIn || saving || !match) return;
    const newInjury = { period: match.currentPeriod, playerOut: selectedOut, playerIn: selectedIn, timestamp: new Date().toISOString() };
    const updatedInjuries = [...(match.injuries || []), newInjury];
    
    const currentHistory = match.history || {};
    const currentRoles = match.history_roles || {};
    const periodArray = currentHistory[match.currentPeriod] || [];
    const newPeriodArray = periodArray.filter(e => (typeof e === 'object' ? e.id !== selectedOut : e !== selectedOut));
    const newPeriodRoles = { ...(currentRoles[match.currentPeriod] || {}) };
    delete newPeriodRoles[selectedOut];
    
    if (!newPeriodArray.some(e => (typeof e === 'object' ? e.id === selectedIn : e === selectedIn))) {
        const playerIn = sortedPlayers.find(p => p.id === selectedIn);
        newPeriodArray.push(selectedIn);
        newPeriodRoles[selectedIn] = playerIn?.role || 'receptor';
    }

    try {
      setSaving(true);
      // Clean all items in array to ensure they are IDs
      const cleanArray = newPeriodArray.map(e => typeof e === 'object' ? e.id : e);
      
      setMatch({
        ...match,
        history: { ...currentHistory, [match.currentPeriod]: cleanArray },
        history_roles: { ...currentRoles, [match.currentPeriod]: newPeriodRoles },
        injuries: updatedInjuries
      });

      await updateDoc(doc(db, 'matches', match.id), { 
        injuries: updatedInjuries, 
        [`history.${match.currentPeriod}`]: cleanArray,
        [`history_roles.${match.currentPeriod}`]: newPeriodRoles
      });
      setSubstitutionModalVisible(false);
      setSelectedOut(null); setSelectedIn(null);
    } catch (error) { Alert.alert('Error', 'No se pudo aplicar la sustitución'); } 
    finally { setSaving(false); }
  };

  const renderPlayerName = (player) => {
    const roleConf = getRoleConfig(team, player.role || 'receptor');
    const isInCurrentPeriod = (match.history[match.currentPeriod] || []).some(e => (typeof e === 'object' ? e.id === player.id : e === player.id));
    
    return (
      <View key={player.id} style={[styles.playerNameRow, isInCurrentPeriod && styles.playerNameRowActive]}>
        <View style={[styles.attendanceDot, { backgroundColor: match.attendance?.[player.id]?.status === 'available' ? COLORS.success : COLORS.danger }]} />
        <View style={styles.numberBadge}><Text style={styles.numberText}>{player.number}</Text></View>
        <Text style={[styles.playerNameText, isInCurrentPeriod && styles.playerNameTextActive]} numberOfLines={1}>{player.name}</Text>
        <View style={[styles.roleDot, { backgroundColor: roleConf?.color || COLORS.slate400 }]} />
      </View>
    );
  };

  const renderPlayerCells = (player) => {
    return (
      <View key={player.id} style={styles.playerCellsRow}>
        {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => {
          const periodNum = i + 1;
          const periodArray = match.history[periodNum] || [];
          
          // Detect selection and role (handling both schemas)
          const entry = periodArray.find(e => (typeof e === 'object' ? e.id === player.id : e === player.id));
          const isSelected = !!entry;
          const assignedRole = typeof entry === 'object' ? entry.role : match.history_roles?.[periodNum]?.[player.id];
          const currentRole = assignedRole || player.role || 'receptor';

          const isCurrentPeriod = match.currentPeriod === periodNum;
          const injury = (match.injuries || []).find(inj => inj.period === periodNum && (inj.playerOut === player.id || inj.playerIn === player.id));
          const isReadOnly = periodNum !== match.currentPeriod && !isFreeEdit;

          let cellStyle = [styles.periodCell];
          let content = null;

          if (injury) {
            cellStyle.push({ backgroundColor: injury.playerOut === player.id ? '#FEE2E2' : '#F0FDF4' });
            content = injury.playerOut === player.id ? <ArrowDown color={COLORS.danger} size={14} /> : <ArrowUp color={COLORS.success} size={14} />;
          } else if (isSelected) {
            const specificRoleConf = getRoleConfig(team, currentRole);
            const specificRoleInitial = specificRoleConf?.label?.[0]?.toUpperCase() || 'R';
            const specificRoleColor = specificRoleConf?.color || COLORS.slate400;
            const specificRoleBg = specificRoleConf?.bg || '#F8FAFC';

            cellStyle.push({ backgroundColor: specificRoleBg, borderWidth: 2, borderColor: specificRoleColor });
            content = <Text style={[styles.roleCellText, { color: specificRoleColor }]}>{specificRoleInitial}</Text>;
          } else if (isCurrentPeriod) {
            cellStyle.push(styles.periodCellCurrent);
          } else if (isReadOnly) {
            cellStyle.push(styles.periodCellReadOnly);
          }

          return (
            <TouchableOpacity 
              key={periodNum} 
              style={cellStyle} 
              activeOpacity={isReadOnly ? 1 : 0.7} 
              onPress={() => togglePlayerInPeriod(player.id, periodNum)}
              onLongPress={() => {
                if (!isReadOnly) clearPlay(player.id, periodNum);
              }}
              delayLongPress={500}
            >
              {content}
            </TouchableOpacity>
          );
        })}
        <View style={styles.totalCell}><Text style={styles.totalText}>{getPlayerPeriodsCount(player.id)}</Text></View>
      </View>
    );
  };

  if (loading || !match) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><ChevronLeft color={COLORS.slate600} size={24} /></TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>vs {match.opponent}</Text>
          <Text style={styles.headerSubtitle}>{match.date} • P{match.currentPeriod}</Text>
        </View>
        <View style={styles.headerRightIcons}>
          <TouchableOpacity style={[styles.headerIconBtn, isFreeEdit && styles.headerIconBtnActive]} onPress={() => setIsFreeEdit(!isFreeEdit)}>
            {isFreeEdit ? <Unlock color={COLORS.primary} size={20} /> : <Lock color={COLORS.slate400} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={openConfigModal}><Settings color={COLORS.slate600} size={22} /></TouchableOpacity>
        </View>

      </View>

      <View style={styles.matrixWrapper}>
        <View style={styles.tableHeaderSection}>
          <View style={styles.jugadorHeader}><Text style={styles.colHeaderText}>Jugador</Text></View>
          <ScrollView horizontal ref={headerScrollRef} showsHorizontalScrollIndicator={false} scrollEnabled={false} style={styles.periodsHeaderScroll}>
            <View style={styles.periodsHeaderContainer}>
              {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => {
                const periodNum = i + 1;
                const periodArray = match.history[periodNum] || [];
                const playerCount = periodArray.filter(e => {
                  const pid = typeof e === 'object' ? e.id : e;
                  return sortedPlayers.some(p => p.id === pid);
                }).length;
                const isCurrent = match.currentPeriod === periodNum;
                
                let headerBg = COLORS.white;
                let textColor = COLORS.slate400;
                let borderColor = COLORS.slate100;

                if (playerCount === 5) {
                   headerBg = '#DCFCE7'; // Green
                   textColor = '#166534';
                   borderColor = '#86EFAC';
                } else if (playerCount > 0) {
                   headerBg = '#FEE2E2'; // Red
                   textColor = '#991B1B';
                   borderColor = '#FCA5A5';
                } else {
                   headerBg = COLORS.slate50; // Gray
                   textColor = COLORS.slate400;
                   borderColor = COLORS.slate200;
                }

                return (
                  <View key={i} style={[
                    styles.periodHeaderCell, 
                    { backgroundColor: headerBg, borderBottomColor: isCurrent ? COLORS.primary : borderColor, borderBottomWidth: isCurrent ? 3 : 1 }
                  ]}>
                    <Text style={[styles.periodHeaderText, { color: textColor }, isCurrent && { fontWeight: '900' }]}>P{periodNum}</Text>
                  </View>
                );
              })}
              <View style={styles.totalHeaderCell}><Text style={styles.colHeaderText}>Tot</Text></View>
            </View>
          </ScrollView>
        </View>

        <ScrollView vertical showsVerticalScrollIndicator={true} style={styles.tableBodyScroll}>
          <View style={styles.tableBodyRowContainer}>
            <View style={styles.namesColumnContainer}>
              {sortedPlayers.map(renderPlayerName)}
              <View style={styles.emptyHeaderPlaceholder} />
            </View>
            <ScrollView horizontal ref={bodyScrollRef} onScroll={handleBodyScroll} scrollEventThrottle={16} style={styles.cellsHorizontalScroll}>
              <View>
                {sortedPlayers.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay jugadores.</Text></View> : sortedPlayers.map(renderPlayerCells)}
                <View style={styles.trashRow}>
                  {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.trashCell} 
                      onPress={() => handleClearPeriod(i + 1)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                      <Trash2 color={COLORS.danger} size={18} />
                    </TouchableOpacity>
                  ))}
                  <View style={styles.totalHeaderCell} />
                </View>
              </View>
            </ScrollView>
          </View>
          
          <View style={styles.enPistaContainer}>
            <View style={styles.enPistaHeader}><Users color={COLORS.slate700} size={18} /><Text style={styles.enPistaTitle}>EN PISTA ({
              (match.history[match.currentPeriod] || []).filter(e => {
                  const pid = typeof e === 'object' ? e.id : e;
                  return sortedPlayers.some(p => p.id === pid);
              }).length
            })</Text></View>
            <View style={styles.enPistaList}>
              {sortedPlayers.filter(p => {
                  const periodArray = match.history[match.currentPeriod] || [];
                  return periodArray.some(e => (typeof e === 'object' ? e.id === p.id : e === p.id));
              }).map(p => {
                const entry = (match.history[match.currentPeriod] || []).find(e => (typeof e === 'object' ? e.id === p.id : e === p.id));
                const entryRole = typeof entry === 'object' ? entry.role : match.history_roles?.[match.currentPeriod]?.[p.id];
                const roleConf = getRoleConfig(team, entryRole || p.role || 'receptor');
                return (
                  <View key={p.id} style={styles.pistaPlayerTag}>
                    <Text style={styles.pistaNumber}>#{p.number}</Text>
                    <Text style={styles.pistaName} numberOfLines={1}>{p.name}</Text>
                    <View style={[styles.pistaRoleDot, { backgroundColor: roleConf?.color || COLORS.slate400 }]} />
                  </View>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={styles.compactViewBtn} onPress={() => setCompactViewVisible(true)}>
             <Maximize2 color={COLORS.slate600} size={16} /><Text style={styles.compactViewBtnText}>VISTA COMPACTA</Text>
          </TouchableOpacity>
          <View style={styles.footerSpacingLower} />
        </ScrollView>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.periodControl}>
          <TouchableOpacity style={[styles.periodNavBtn, match.currentPeriod <= 1 && styles.disabledBtn]} onPress={handlePrevPeriod} disabled={match.currentPeriod <= 1 || saving}>
            <ChevronLeft color={match.currentPeriod <= 1 ? COLORS.slate300 : COLORS.slate600} size={28} />
          </TouchableOpacity>
          
          <View style={styles.periodDisplayLarge}>
            <Text style={styles.periodLabel}>PERIODO</Text>
            <Text style={styles.periodTextLarge}>P{match.currentPeriod || 1}</Text>
          </View>

          <TouchableOpacity style={styles.periodNavBtn} onPress={handleNextPeriod} disabled={saving}>
            <ChevronRight color={COLORS.slate600} size={28} />
          </TouchableOpacity>

          <View style={styles.periodDivider} />

          <TouchableOpacity style={styles.injuryIconLarge} onPress={() => setSubstitutionModalVisible(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2 }}>
              <ArrowUp color={COLORS.success} size={20} />
              <ArrowDown color={COLORS.danger} size={20} style={{ marginLeft: -8 }} />
            </View>
            <Text style={styles.injuryText}>Sust.</Text>
          </TouchableOpacity>

          <View style={styles.periodPlayersBadge}>
            <Users color={COLORS.slate400} size={14} />
            <Text style={styles.periodPlayersCount}>{
                (match.history[match.currentPeriod] || []).filter(e => {
                    const pid = typeof e === 'object' ? e.id : e;
                    return sortedPlayers.some(p => p.id === pid);
                }).length
            }/5</Text>
          </View>
        </View>
      </View>


      {/* Substitution Modal */}
      <Modal visible={substitutionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sustitución por Lesión (P{match.currentPeriod})</Text>
            <Text style={styles.modalSubtitle}>Sale (Lesionado)</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
              {sortedPlayers.filter(p => (match.history[match.currentPeriod] || []).some(e => (typeof e === 'object' ? e.id === p.id : e === p.id))).map(p => (
                <TouchableOpacity key={p.id} style={[styles.modalBtn, selectedOut === p.id && styles.modalBtnSelectedOut]} onPress={() => setSelectedOut(p.id)}><Text style={styles.modalBtnText}>{p.number} - {p.name}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={{alignItems: 'center', marginVertical: 10}}><ArrowDown color={COLORS.slate300} size={24} /></View>
            <Text style={styles.modalSubtitle}>Entra (Sustituto)</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
              {sortedPlayers.filter(p => !(match.history[match.currentPeriod] || []).some(e => (typeof e === 'object' ? e.id === p.id : e === p.id))).map(p => (
                <TouchableOpacity key={p.id} style={[styles.modalBtn, selectedIn === p.id && styles.modalBtnSelectedIn]} onPress={() => setSelectedIn(p.id)}><Text style={styles.modalBtnText}>{p.number} - {p.name}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSubstitutionModalVisible(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, (!selectedOut || !selectedIn) && {opacity: 0.5}]} disabled={!selectedOut || !selectedIn} onPress={handleSubstitutionConfirm}><Text style={styles.modalConfirmText}>Confirmar Cambio</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Config Modal */}
      <Modal visible={configModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={() => setConfigModalVisible(false)}><ChevronLeft color={COLORS.slate600} size={28} /></TouchableOpacity>
                <View style={{ marginLeft: 16 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Editar Partido</Text>
                  <Text style={{ fontSize: 10, color: COLORS.slate300 }}>v1.2</Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput style={styles.input} value={matchForm?.opponent} onChangeText={t => setMatchForm({...matchForm, opponent: t})} placeholder="Rival" />
                <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                  <View style={{flex: 1}}><Text style={styles.label}>Fecha</Text><TextInput style={styles.input} value={matchForm?.date} onChangeText={t => setMatchForm({...matchForm, date: t})} /></View>
                  <View style={{flex: 1}}><Text style={styles.label}>Hora Inicio</Text><TextInput style={styles.input} value={matchForm?.time} onChangeText={t => setMatchForm({...matchForm, time: t})} /></View>
                </View>
                <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                  <View style={{flex: 1}}><Text style={styles.label}>Convocatoria</Text><TextInput style={styles.input} value={matchForm?.callTime} onChangeText={t => setMatchForm({...matchForm, callTime: t})} /></View>
                  <View style={{flex: 1}}><Text style={styles.label}>Jornada</Text><TextInput style={styles.input} value={matchForm?.round} onChangeText={t => setMatchForm({...matchForm, round: t})} /></View>
                </View>
                <Text style={styles.label}>Ubicación</Text>
                <TextInput style={styles.input} value={matchForm?.location} onChangeText={t => setMatchForm({...matchForm, location: t})} />
                
                <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                   <TouchableOpacity style={[styles.shareBtn, { backgroundColor: matchForm?.isHome ? COLORS.primaryLight : COLORS.slate100 }]} onPress={() => setMatchForm({...matchForm, isHome: true})}><Text style={[styles.shareBtnText, { color: matchForm?.isHome ? COLORS.primary : COLORS.slate600 }]}>LOCAL</Text></TouchableOpacity>
                   <TouchableOpacity style={[styles.shareBtn, { backgroundColor: !matchForm?.isHome ? COLORS.primaryLight : COLORS.slate100 }]} onPress={() => setMatchForm({...matchForm, isHome: false})}><Text style={[styles.shareBtnText, { color: !matchForm?.isHome ? COLORS.primary : COLORS.slate600 }]}>VISITANTE</Text></TouchableOpacity>
                </View>

                {/* Travel Section for Visitors */}
                {!matchForm?.isHome && (
                  <View style={[styles.shareCard, { backgroundColor: '#F8FAFC', padding: 16, marginTop: 16 }]}>
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>HORA SALIDA</Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                              <TextInput style={[styles.input, { paddingRight: 35 }]} value={matchForm?.departureTime} placeholder="--:--" onChangeText={t => setMatchForm({...matchForm, departureTime: t})} />
                              <Clock color={COLORS.slate400} size={14} style={{ position: 'absolute', right: 12 }} />
                            </View>
                        </View>
                        <View style={{flex: 1}}>
                           <Text style={styles.label}>TRANSPORTE</Text>
                           <View style={{flexDirection: 'row', gap: 8}}>
                                <TouchableOpacity 
                                    style={[styles.shareBtn, { padding: 8 }, matchForm?.transportType === 'bus' && { backgroundColor: COLORS.primaryLight }]}
                                    onPress={() => setMatchForm({...matchForm, transportType: 'bus'})}
                                >
                                    <Text style={{fontSize: 20}}>🚌</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.shareBtn, { padding: 8 }, matchForm?.transportType === 'car' && { backgroundColor: COLORS.primaryLight }]}
                                    onPress={() => setMatchForm({...matchForm, transportType: 'car'})}
                                >
                                    <Text style={{fontSize: 20}}>🚗</Text>
                                </TouchableOpacity>
                           </View>
                        </View>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>LUGAR SALIDA</Text>
                            <TextInput style={styles.input} value={matchForm?.departureLocation} placeholder="Pabellón..." onChangeText={t => setMatchForm({...matchForm, departureLocation: t})} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>HORA VUELTA</Text>
                            <View style={{ position: 'relative', justifyContent: 'center' }}>
                              <TextInput style={[styles.input, { paddingRight: 35 }]} value={matchForm?.returnTime} placeholder="--:--" onChangeText={t => setMatchForm({...matchForm, returnTime: t})} />
                              <Clock color={COLORS.slate400} size={14} style={{ position: 'absolute', right: 12 }} />
                            </View>
                        </View>
                    </View>
                  </View>
                )}

                <TextInput style={[styles.input, {height: 80, marginTop: 12}]} value={matchForm?.notes} onChangeText={t => setMatchForm({...matchForm, notes: t})} placeholder="Observaciones" multiline />
                
                <View style={{flexDirection: 'row', gap: 12, marginTop: 24}}>
                  <TouchableOpacity style={styles.btnSave} onPress={handleUpdateMatchConfig}><Text style={{color: COLORS.white, fontWeight: 'bold'}}>Guardar Cambios</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.btnDelete} onPress={() => { Alert.alert('Eliminar', '¿Seguro?', [{text: 'Sí', onPress: () => { deleteDoc(doc(db, 'matches', matchId)); navigation.goBack(); }}, {text: 'No'}]) }}><Text style={{color: COLORS.danger, fontWeight: 'bold'}}>Eliminar Partido</Text></TouchableOpacity>

                <View style={styles.shareCard}>
                  <Text style={styles.shareTitle}>COPIAR CONVOCATORIA</Text>
                  <Text style={styles.shareDesc}>Con el listado de jugadores convocados</Text>
                  <View style={styles.shareRow}>
                    <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#FFEDD5'}]} onPress={() => generateShareText('squad', 'ca')}><Clipboard color="#9A3412" size={18} /><Text style={[styles.shareBtnText, {color: '#9A3412'}]}>Valencià</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#DCFCE7'}]} onPress={() => generateShareText('squad', 'es')}><Clipboard color="#166534" size={18} /><Text style={[styles.shareBtnText, {color: '#166534'}]}>Castellano</Text></TouchableOpacity>
                  </View>
                </View>

                <View style={styles.shareCard}>
                  <Text style={styles.shareTitle}>COPIAR INFO PARTIDO</Text>
                  <Text style={styles.shareDesc}>Sin listado de jugadores, solo información</Text>
                  <View style={styles.shareRow}>
                    <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#FFEDD5'}]} onPress={() => generateShareText('info', 'ca')}><Clipboard color="#9A3412" size={18} /><Text style={[styles.shareBtnText, {color: '#9A3412'}]}>Valencià</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#DCFCE7'}]} onPress={() => generateShareText('info', 'es')}><Clipboard color="#166534" size={18} /><Text style={[styles.shareBtnText, {color: '#166534'}]}>Castellano</Text></TouchableOpacity>
                  </View>
                </View>
                
                <View style={[styles.shareCard, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={styles.shareTitle}>ENLACE PARA PADRES</Text>
                  <Text style={styles.shareDesc}>Envía este enlace por WhatsApp para confirmar</Text>
                  <TouchableOpacity 
                    style={[styles.shareBtn, {backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary}]}
                    onPress={() => {
                      navigation.push('MatchAttendance', { matchId, teamId });
                      setTimeout(() => setConfigModalVisible(false), 200);
                    }}
                  >
                    <Users color={COLORS.primary} size={18} /><Text style={{color: COLORS.primary, fontWeight: 'bold'}}>Ver Estado Convocatoria</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.shareBtn, {backgroundColor: COLORS.primaryDark, marginTop: 10}]} onPress={() => copyToClipboard('https://jorgipons.github.io/ANTIGRAVITY/basketball-manager/?matchId='+matchId)}><ExternalLink color={COLORS.white} size={18} /><Text style={{color: COLORS.white, fontWeight: 'bold'}}>Copiar Enlace de Asistencia</Text></TouchableOpacity>
                </View>
                <View style={{height: 50}} />
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Compact View Modal */}
      <Modal visible={compactViewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>Vista Compacta</Text>
              <TouchableOpacity onPress={() => setCompactViewVisible(false)}><Text style={{ fontWeight: 'bold', color: COLORS.slate500 }}>Cerrar</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.slate200 }}>
                {sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={{ flexDirection: 'row', padding: 12, backgroundColor: idx % 2 === 0 ? COLORS.white : COLORS.slate50, borderBottomWidth: idx === sortedPlayers.length - 1 ? 0 : 1, borderBottomColor: COLORS.slate200 }}>
                    <Text style={{ width: 30, fontWeight: 'bold' }}>{p.number}</Text>
                    <Text style={{ flex: 1 }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => (
                        <View key={i} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: match.history[i+1]?.some(e => e.id === p.id) ? COLORS.primary : COLORS.slate200 }} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLUMN_WIDTH, NAME_COLUMN_WIDTH) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200, zIndex: 10 },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate900 },
  headerSubtitle: { fontSize: 12, color: COLORS.slate500 },
  headerRightIcons: { flexDirection: 'row', gap: 6 },
  headerIconBtn: { padding: 8, borderRadius: 8, backgroundColor: COLORS.slate50 },
  headerIconBtnActive: { backgroundColor: COLORS.primaryLight },
  matrixWrapper: { flex: 1, backgroundColor: COLORS.white },
  tableHeaderSection: { flexDirection: 'row', height: 44, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200, zIndex: 20 },
  jugadorHeader: { width: NAME_COLUMN_WIDTH, height: 44, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: COLORS.white, borderRightWidth: 1, borderRightColor: COLORS.slate200 },
  periodsHeaderScroll: { flex: 1 },
  periodsHeaderContainer: { flexDirection: 'row' },
  periodHeaderCell: { width: COLUMN_WIDTH, height: 44, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.slate100 },
  periodHeaderCellActive: { backgroundColor: COLORS.primaryLight, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  periodHeaderText: { fontSize: 13, fontWeight: 'bold', color: COLORS.slate400 },
  periodHeaderTextActive: { color: COLORS.primaryDark },
  totalHeaderCell: { width: COLUMN_WIDTH, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.slate50 },
  colHeaderText: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate400, textTransform: 'uppercase' },
  tableBodyScroll: { flex: 1 },
  tableBodyRowContainer: { flexDirection: 'row' },
  namesColumnContainer: { width: NAME_COLUMN_WIDTH, backgroundColor: COLORS.white, borderRightWidth: 1, borderRightColor: COLORS.slate200 },
  playerNameRow: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.slate100, backgroundColor: COLORS.white, gap: 6 },
  playerNameRowActive: { backgroundColor: COLORS.primaryLight + '30' },
  playerNameText: { flex: 1, fontSize: 13, color: COLORS.slate800, fontWeight: '500' },
  playerNameTextActive: { fontWeight: 'bold', color: COLORS.slate900 },
  cellsHorizontalScroll: { flex: 1 },
  playerCellsRow: { height: 52, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.slate50 },
  periodCell: { width: COLUMN_WIDTH, height: 52, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.slate50 },
  periodCellCurrent: { backgroundColor: COLORS.primaryLight + '20' },
  periodCellReadOnly: { opacity: 0.6 },
  roleCellText: { fontSize: 13, fontWeight: '700' },
  totalCell: { width: COLUMN_WIDTH, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.slate50 },
  totalText: { fontSize: 13, fontWeight: 'bold', color: COLORS.slate600 },
  trashRow: { flexDirection: 'row', height: 48, borderTopWidth: 1, borderTopColor: COLORS.slate100, backgroundColor: '#FEF2F240' },
  trashCell: { width: COLUMN_WIDTH, height: 48, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.slate50 },
  emptyHeaderPlaceholder: { height: 40, backgroundColor: COLORS.white },
  enPistaContainer: { margin: 16, backgroundColor: '#F8FAFC', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.slate200 },
  enPistaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  enPistaTitle: { fontSize: 11, fontWeight: '900', color: COLORS.slate500, letterSpacing: 1 },
  enPistaList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pistaPlayerTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate200, gap: 6 },
  pistaNumber: { fontSize: 12, fontWeight: 'bold', color: COLORS.slate500 },
  pistaName: { fontSize: 13, fontWeight: 'bold', color: COLORS.slate900 },
  pistaRoleDot: { width: 6, height: 6, borderRadius: 3 },
  compactViewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.slate200, backgroundColor: COLORS.white },
  compactViewBtnText: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate600, letterSpacing: 1 },
  footerSpacingLower: { height: 100 },
  attendanceDot: { width: 6, height: 6, borderRadius: 3 },
  numberBadge: { width: 24, height: 24, backgroundColor: COLORS.slate100, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 10, fontWeight: 'bold', color: COLORS.slate600 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  bottomBar: { 
    position: 'absolute', 
    bottom: 20, 
    left: 16, 
    right: 16, 
    backgroundColor: COLORS.white, 
    borderRadius: 24,
    height: 90, 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  periodControl: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  periodNavBtn: { padding: 8, backgroundColor: COLORS.slate50, borderRadius: 12 },
  disabledBtn: { opacity: 0.3 },
  periodDisplayLarge: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontSize: 10, fontWeight: 'bold', color: COLORS.slate400, letterSpacing: 1 },
  periodTextLarge: { fontSize: 28, fontWeight: '900', color: COLORS.slate900 },
  periodDivider: { width: 1, height: 40, backgroundColor: COLORS.slate100, marginHorizontal: 8 },
  injuryIconLarge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  injuryText: { fontSize: 10, fontWeight: 'bold', color: COLORS.danger, marginTop: 2 },
  periodPlayersBadge: { backgroundColor: COLORS.slate50, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  periodPlayersCount: { fontSize: 14, color: COLORS.slate500, fontWeight: 'bold' },
  attendanceBtn: { backgroundColor: COLORS.slate900, height: 48, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  attendanceBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '95%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.slate900, marginBottom: 20 },
  modalSubtitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.slate500, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 16 },
  modalList: { maxHeight: 200 },
  modalBtn: { margin: 4, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 14, backgroundColor: COLORS.white },
  modalBtnSelectedOut: { backgroundColor: '#fef2f2', borderColor: COLORS.danger, borderWidth: 2 },
  modalBtnSelectedIn: { backgroundColor: '#f0fdf4', borderColor: COLORS.success, borderWidth: 2 },
  modalBtnText: { fontSize: 14, fontWeight: 'bold', color: COLORS.slate700 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: COLORS.slate100, alignItems: 'center' },
  modalCancelText: { fontWeight: 'bold', color: COLORS.slate600 },
  modalConfirm: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: COLORS.danger, alignItems: 'center' },
  modalConfirmText: { fontWeight: 'bold', color: COLORS.white },
  label: { fontSize: 11, fontWeight: 'bold', color: COLORS.slate500, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: COLORS.slate50, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.slate900 },
  shareCard: { backgroundColor: COLORS.slate50, borderRadius: 20, padding: 20, marginTop: 20, borderWidth: 1, borderColor: COLORS.slate200 },
  shareTitle: { fontSize: 13, fontWeight: '900', color: COLORS.slate800, marginBottom: 4 },
  shareDesc: { fontSize: 12, color: COLORS.slate500, marginBottom: 16 },
  shareRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: COLORS.slate100 },
  shareBtnText: { fontWeight: 'bold', fontSize: 13 },
  btnSave: { flex: 1, padding: 16, backgroundColor: COLORS.slate900, borderRadius: 16, alignItems: 'center' },
  btnDelete: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.dangerLight, alignItems: 'center', marginTop: 12 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.slate400, textAlign: 'center' },
});
