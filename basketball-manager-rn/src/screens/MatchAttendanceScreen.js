import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Info, Share2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { ROLES } from '../constants/roles';
import { db } from '../constants/firebase';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';

export default function MatchAttendanceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId, isPublic } = route.params || {};

  const [match, setMatch] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId || !teamId) {
      setLoading(false);
      return;
    }

    const teamRef = doc(db, 'teams', teamId);
    getDoc(teamRef).then(docSnap => {
      if (docSnap.exists()) {
        setTeam({ id: docSnap.id, ...docSnap.data() });
      }
    });

    const matchRef = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) {
        setMatch({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to match attendance:", error);
      Alert.alert('Error', 'No se pudo cargar el partido');
      setLoading(false);
    });

    return unsubscribe;
  }, [matchId, teamId]);

  const updateAttendance = async (playerId, status) => {
    if (!match || isPublic) return;

    const currentAttendance = match.attendance || {};
    const newAttendance = {
      ...currentAttendance,
      [playerId]: { status, timestamp: new Date().toISOString() }
    };

    // Optimistic update
    setMatch({ ...match, attendance: newAttendance });

    try {
      const matchRef = doc(db, 'matches', match.id);
      await updateDoc(matchRef, {
        attendance: newAttendance
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la asistencia');
      setMatch({ ...match, attendance: currentAttendance });
    }
  };

  const shareLink = async () => {
    // Implement standard React Native Share or clipboard copy here.
    // For now, simple alert.
    const url = `https://your-domain.com/match/${teamId}/${matchId}`;
    Alert.alert('Enlace copiado', `El enlace para compartir es:\n\n${url}`);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!match || !team) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Partido no encontrado.</Text>
        {!isPublic && (
          <TouchableOpacity style={styles.backButtonCenter} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonCenterText}>Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const players = match.players || [];
  const attendance = match.attendance || {};

  const confirmedPlayers = players.filter(p => attendance[p.id]?.status === 'available');
  const unavailablePlayers = players.filter(p => attendance[p.id]?.status === 'unavailable');
  const pendingPlayers = players.filter(p => !attendance[p.id]?.status || attendance[p.id]?.status === 'pending');

  const renderPlayerRow = (p, status) => {
    const roleConf = ROLES[p.role || 'receptor'];
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
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, status === 'available' ? styles.btnAvailableActive : styles.btnAvailable]}
              onPress={() => updateAttendance(p.id, 'available')}
            >
              <CheckCircle2 color={status === 'available' ? COLORS.white : COLORS.success} size={20} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, status === 'unavailable' ? styles.btnUnavailableActive : styles.btnUnavailable]}
              onPress={() => updateAttendance(p.id, 'unavailable')}
            >
              <XCircle color={status === 'unavailable' ? COLORS.white : COLORS.danger} size={20} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {!isPublic && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIconBtn}>
            <ChevronLeft color={COLORS.slate600} size={24} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>{match.opponent}</Text>
          <Text style={styles.headerSubtitle}>{match.date}{match.time ? ` • ${match.time}h` : ''}</Text>
        </View>
        {!isPublic && (
          <TouchableOpacity onPress={shareLink} style={styles.infoButton}>
            <Share2 color={COLORS.primary} size={20} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.container}>
        
        {/* Stats Widget */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValueGreen}>{confirmedPlayers.length}</Text>
            <Text style={styles.statLabel}>Vienen</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValueRed}>{unavailablePlayers.length}</Text>
            <Text style={styles.statLabel}>No Vienen</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValueGray}>{pendingPlayers.length}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Players List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confirmados ({confirmedPlayers.length})</Text>
          <View style={styles.listContainer}>
            {confirmedPlayers.map(p => renderPlayerRow(p, 'available'))}
            {confirmedPlayers.length === 0 && <Text style={styles.emptyText}>Ninguno confirmado aún</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pendientes ({pendingPlayers.length})</Text>
          <View style={styles.listContainer}>
            {pendingPlayers.map(p => renderPlayerRow(p, 'pending'))}
            {pendingPlayers.length === 0 && <Text style={styles.emptyText}>Ninguno pendiente</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>No Vienen ({unavailablePlayers.length})</Text>
          <View style={styles.listContainer}>
            {unavailablePlayers.map(p => renderPlayerRow(p, 'unavailable'))}
            {unavailablePlayers.length === 0 && <Text style={styles.emptyText}>Ninguno reportó ausencia</Text>}
          </View>
        </View>

        {isPublic && (
          <View style={styles.publicFooter}>
            <Text style={styles.publicFooterText}>Gestionado con Basketball Manager</Text>
          </View>
        )}

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, color: COLORS.slate500, marginBottom: 16 },
  backButtonCenter: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backButtonCenterText: { color: COLORS.primary, fontWeight: 'bold' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200,
  },
  backIconBtn: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate900 },
  headerSubtitle: { fontSize: 12, color: COLORS.slate500 },
  infoButton: { padding: 8, marginRight: -8, backgroundColor: COLORS.primaryLight, borderRadius: 8 },

  container: { padding: 16 },

  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.slate200, marginBottom: 24,
    shadowColor: COLORS.slate900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValueGreen: { fontSize: 24, fontWeight: 'bold', color: COLORS.success },
  statValueRed: { fontSize: 24, fontWeight: 'bold', color: COLORS.danger },
  statValueGray: { fontSize: 24, fontWeight: 'bold', color: COLORS.slate500 },
  statLabel: { fontSize: 12, color: COLORS.slate500, marginTop: 4, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: COLORS.slate200, marginHorizontal: 8 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.slate800, marginBottom: 8, marginLeft: 4 },
  listContainer: { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.slate200 },
  emptyText: { padding: 16, textAlign: 'center', color: COLORS.slate400, fontSize: 13, fontStyle: 'italic' },

  playerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.slate100, backgroundColor: COLORS.white
  },
  playerInfoBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  numberBadge: { width: 28, height: 28, backgroundColor: COLORS.slate100, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numberText: { fontSize: 12, fontWeight: 'bold', color: COLORS.slate700 },
  nameAndRole: { flex: 1, justifyContent: 'center' },
  playerName: { fontSize: 14, fontWeight: '600', color: COLORS.slate800, marginBottom: 2 },
  roleLabel: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },

  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  btnAvailable: { borderColor: COLORS.success, backgroundColor: '#F0FDF4' },
  btnAvailableActive: { borderColor: COLORS.success, backgroundColor: COLORS.success },
  btnUnavailable: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  btnUnavailableActive: { borderColor: COLORS.danger, backgroundColor: COLORS.danger },

  publicFooter: { marginTop: 32, alignItems: 'center' },
  publicFooterText: { fontSize: 12, color: COLORS.slate400, fontWeight: '500' }
});
