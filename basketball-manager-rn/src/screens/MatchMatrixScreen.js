import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Info, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { ROLES } from '../constants/roles';
import { DEFAULT_RULESET, getPlayerPeriods, validatePlayerSelection, getPlayerStatusClasses } from '../constants/ruleset';
import { db } from '../constants/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function MatchMatrixScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId } = route.params;

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Escuchar el partido en tiempo real
    const matchRef = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Initialize history if needed
        if (!data.history) {
          const initialHistory = {};
          for(let i=1; i<=DEFAULT_RULESET.totalPeriods; i++) {
            initialHistory[i] = [];
          }
          data.history = initialHistory;
        }

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
    if (!match || !match.players) return [];
    return [...match.players].sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [match?.players]);

  const togglePlayerInPeriod = async (playerId, period) => {
    if (!match || saving) return;
    
    // Obtener estado actual o inicializar
    const currentHistory = match.history || {};
    const periodArray = currentHistory[period] || [];
    
    const isCurrentlySelected = periodArray.includes(playerId);
    
    let newPeriodArray;
    if (isCurrentlySelected) {
      newPeriodArray = periodArray.filter(id => id !== playerId);
    } else {
      newPeriodArray = [...periodArray, playerId];
    }
    
    // Optimistic update
    const newHistory = { ...currentHistory, [period]: newPeriodArray };
    setMatch({ ...match, history: newHistory });

    try {
      setSaving(true);
      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, {
        [`history.${period}`]: newPeriodArray
      });
    } catch (error) {
      // Revert on error
      Alert.alert('Error', 'No se pudo guardar la selección');
      setMatch({ ...match, history: currentHistory });
    } finally {
      setSaving(false);
    }
  };

  const renderPlayerRow = (player) => {
    const roleConf = ROLES[player.role || 'receptor'];
    const periodsStatus = getPlayerStatusClasses(player.id, match.history || {}, DEFAULT_RULESET);
    
    // Determines global line style based on validation
    let rowStyle = styles.playerRow;
    let nameStyle = styles.playerName;
    
    if (periodsStatus === 'error') {
      rowStyle = [styles.playerRow, styles.playerRowError];
      nameStyle = [styles.playerName, styles.playerNameError];
    } else if (periodsStatus === 'valid') {
      rowStyle = [styles.playerRow, styles.playerRowValid];
    }

    return (
      <View key={player.id} style={rowStyle}>
        
        {/* Fixed Player Info Column */}
        <View style={styles.fixedCol}>
          <View style={styles.playerInfoBox}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{player.number}</Text>
            </View>
            <View style={styles.nameAndRole}>
              <Text style={nameStyle} numberOfLines={1}>{player.name}</Text>
              <View style={[styles.roleLabel, { backgroundColor: roleConf?.bg }]}>
                <Text style={[styles.roleText, { color: roleConf?.color }]}>{roleConf?.label}</Text>
              </View>
            </View>
            
            {periodsStatus === 'error' && <AlertCircle color={COLORS.danger} size={16} />}
            {periodsStatus === 'valid' && <CheckCircle2 color={COLORS.success} size={16} />}
          </View>
        </View>

        {/* Scrollable Periods */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodsScrollContainer}>
          {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => {
            const periodNum = i + 1;
            const isSelected = match.history && match.history[periodNum] && match.history[periodNum].includes(player.id);
            const isCurrentPeriod = match.currentPeriod === periodNum;
            
            // Validación específica para este clic
            const validation = validatePlayerSelection(player.id, periodNum, match.history || {}, DEFAULT_RULESET);
            const isWarning = !isSelected && !validation.isValid;

            return (
              <TouchableOpacity
                key={periodNum}
                style={[
                  styles.periodCell,
                  isSelected && styles.periodCellSelected,
                  isCurrentPeriod && !isSelected && styles.periodCellCurrent,
                  isWarning && styles.periodCellWarning
                ]}
                onPress={() => togglePlayerInPeriod(player.id, periodNum)}
              >
                {isSelected && <Text style={styles.checkText}>X</Text>}
              </TouchableOpacity>
            );
          })}
          
          {/* Resumen Total */}
          <View style={styles.totalCell}>
            <Text style={styles.totalText}>
              {getPlayerPeriods(player.id, match.history || {}, DEFAULT_RULESET.totalPeriods)}
            </Text>
          </View>
        </ScrollView>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={COLORS.slate600} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>vs {match.opponent}</Text>
          <Text style={styles.headerSubtitle}>{match.date} • {match.isHome ? 'Local' : 'Visitante'}</Text>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Info color={COLORS.primary} size={20} />
        </TouchableOpacity>
      </View>

      {/* Matrix Header */}
      <View style={styles.matrixHeader}>
        <View style={styles.fixedColHeader}>
          <Text style={styles.colHeaderText}>Jugador</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} contentContainerStyle={styles.periodsScrollContainer}>
          {[...Array(DEFAULT_RULESET.totalPeriods)].map((_, i) => (
            <View key={i} style={[styles.periodHeaderCell, match.currentPeriod === i + 1 && styles.periodHeaderCellActive]}>
              <Text style={[styles.periodHeaderText, match.currentPeriod === i + 1 && styles.periodHeaderTextActive]}>
                P{i + 1}
              </Text>
            </View>
          ))}
          <View style={styles.totalHeaderCell}>
            <Text style={styles.colHeaderText}>Tot</Text>
          </View>
        </ScrollView>
      </View>

      <ScrollView style={styles.matrixContainer}>
        {sortedPlayers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay jugadores convocados.</Text>
            <Text style={styles.emptySubText}>Añade jugadores desde el detalle del equipo.</Text>
          </View>
        ) : (
          sortedPlayers.map(renderPlayerRow)
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200,
    zIndex: 10
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate900 },
  headerSubtitle: { fontSize: 12, color: COLORS.slate500 },
  infoButton: { padding: 8, marginRight: -8, backgroundColor: COLORS.primaryLight, borderRadius: 8 },

  matrixHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.slate100,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate300,
    position: 'relative',
    zIndex: 5
  },
  matrixContainer: {
    flex: 1,
  },
  
  fixedColHeader: {
    width: 140,
    padding: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate300,
    backgroundColor: COLORS.slate100,
    zIndex: 5
  },
  colHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.slate600,
    textTransform: 'uppercase'
  },
  
  periodsScrollContainer: {
    flexDirection: 'row',
  },
  periodHeaderCell: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
    paddingVertical: 12,
  },
  periodHeaderCellActive: {
    backgroundColor: COLORS.primaryLight,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  periodHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.slate600,
  },
  periodHeaderTextActive: {
    color: COLORS.primaryDark,
  },
  totalHeaderCell: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.slate200,
  },

  playerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
  },
  playerRowValid: {
    backgroundColor: '#F0FDF4', // bg-green-50
  },
  playerRowError: {
    backgroundColor: '#FEF2F2', // bg-red-50
  },
  
  fixedCol: {
    width: 140,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
    backgroundColor: 'inherit',
    zIndex: 5
  },
  playerInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberBadge: {
    width: 24,
    height: 24,
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  numberText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.slate700,
  },
  nameAndRole: {
    flex: 1,
    justifyContent: 'center'
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate800,
    marginBottom: 2
  },
  playerNameError: {
    color: COLORS.danger,
  },
  roleLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  periodCell: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
  },
  periodCellSelected: {
    backgroundColor: COLORS.primary,
  },
  periodCellCurrent: {
    backgroundColor: COLORS.primaryLight,
  },
  periodCellWarning: {
    backgroundColor: COLORS.warningLight,
  },
  checkText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  totalCell: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.slate50,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.slate200,
  },
  totalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.slate700,
  },

  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.slate600,
    fontWeight: 'bold',
    marginBottom: 8
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.slate400,
    textAlign: 'center'
  }
});
