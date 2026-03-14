import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LogOut, Plus, Users, ChevronRight, Settings, Calendar, Clock, MapPin, Bell } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { useTeams } from '../hooks/useTeams';
import { useMatches } from '../hooks/useMatches';
import { auth } from '../constants/firebase';
import { signOut } from 'firebase/auth';

export default function TeamsListScreen() {

  const TeamNextMatch = ({ teamId, teamName, players: teamPlayers }) => {
    const { matches } = useMatches(teamId);
    
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
  
    if (!nextMatch) return (
      <View style={styles.nextMatchEmpty}>
        <Text style={styles.nextMatchEmptyText}>Sin partidos próximos</Text>
      </View>
    );
  
    const date = new Date(nextMatch.date);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = date.toLocaleDateString('es-ES', options);

    const attendance = nextMatch.attendance || {};
    const confirmedCount = Object.values(attendance).filter(a => a.status === 'available').length;
    const unavailableCount = Object.values(attendance).filter(a => a.status === 'unavailable').length;
    const totalPlayers = teamPlayers?.length || 0;
    const pendingCount = totalPlayers - (confirmedCount + unavailableCount);

    return (
      <View style={styles.nextMatchWidget}>
        <View style={styles.nmHeader}>
          <View style={styles.nmTitleRow}>
            <View style={styles.nmStatusDot} />
            <Text style={styles.nextMatchLabel}>PRÓXIMO PARTIDO</Text>
          </View>
        </View>
        
        <View style={styles.nmMainContent}>
          <View style={styles.nmInfoColumn}>
            <Text style={styles.nextMatchOpponent} numberOfLines={1}>
              {nextMatch.opponent.toUpperCase()}
            </Text>
            
            <View style={styles.nmRow}>
              <Clock color={COLORS.slate400} size={13} />
              <Text style={styles.nmRowText}>{formattedDate} • {nextMatch.time}h</Text>
            </View>

            {nextMatch.location && (
              <View style={styles.nmLocationPill}>
                <MapPin color={COLORS.slate400} size={11} />
                <Text style={styles.nmLocationText} numberOfLines={1}>{nextMatch.location.toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.nmRow}>
              <Bell color={COLORS.success} size={13} />
              <Text style={[styles.nmRowText, { color: COLORS.success, fontWeight: '700' }]}>
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
                  <Text style={styles.nmStatCount}>{confirmedCount}</Text>
                </View>
                <View style={styles.nmStatMini}>
                  <View style={[styles.nmStatDot, { backgroundColor: COLORS.danger }]} />
                  <Text style={styles.nmStatCount}>{unavailableCount}</Text>
                </View>
                <View style={styles.nmStatMini}>
                  <View style={[styles.nmStatDot, { backgroundColor: COLORS.slate400 }]} />
                  <Text style={styles.nmStatCount}>{pendingCount < 0 ? 0 : pendingCount}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.nmBadge, nextMatch.isHome ? styles.nmBadgeHome : styles.nmBadgeAway]}>
              <Text style={styles.nmBadgeText}>{nextMatch.isHome ? '🏠 CASA' : '🚌 FUERA'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };


  const navigation = useNavigation();
  const { teams, loading, addTeam } = useTeams();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      Alert.alert('Error', 'No se pudo crear el equipo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: () => signOut(auth) }
      ]
    );
  };

  const renderTeamCard = ({ item }) => (
    <TouchableOpacity
      style={styles.teamCard}
      onPress={() => navigation.navigate('TeamDetail', { teamId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.teamHeader}>
        <View style={styles.teamTitleBox}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.teamStats}>
            {item.players ? item.players.length : 0} Jugadores
          </Text>
        </View>
      </View>
      
      <TeamNextMatch teamId={item.id} teamName={item.name} players={item.players} />
    </TouchableOpacity>
  );


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Equipos</Text>
            <Text style={styles.headerSubtitle}>Selecciona un equipo para gestionar</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => {/* Navegar a calendario general si existiera */}} style={styles.headerBtn}>
              <Calendar color={COLORS.slate600} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.headerBtnPlus}>
              <Plus color={COLORS.white} size={24} />
            </TouchableOpacity>
          </View>
        </View>


        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando equipos...</Text>
          </View>
        ) : teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Users color={COLORS.slate400} size={48} />
            </View>
            <Text style={styles.emptyTitle}>No tienes equipos</Text>
            <Text style={styles.emptyText}>
              Crea tu primer equipo para empezar a gestionar jugadores y partidos.
            </Text>
            <TouchableOpacity 
              style={styles.createButtonLarge}
              onPress={() => setModalVisible(true)}
            >
              <Plus color={COLORS.white} size={20} style={{ marginRight: 8 }} />
              <Text style={styles.createButtonText}>Crear Primer Equipo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={renderTeamCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          </>


        )}

        {/* Create Team Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Crear Nuevo Equipo</Text>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.label}>Nombre del equipo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Cadete A, Infantil Femenino..."
                  value={newTeamName}
                  onChangeText={setNewTeamName}
                  autoFocus
                />
              </View>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setModalVisible(false);
                    setNewTeamName('');
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.modalButtonConfirm, (!newTeamName.trim() || submitting) && styles.modalButtonDisabled]}
                  onPress={handleCreateTeam}
                  disabled={!newTeamName.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.modalButtonTextConfirm}>Añadir Equipo</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.slate50,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.slate400,
    marginTop: -2,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    width: 52,
    height: 52,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slate100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerBtnPlus: {
    width: 52,
    height: 52,
    backgroundColor: '#002E5D', // Dark blue from screenshot
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#002E5D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.slate500,
    fontSize: 16,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  teamCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  teamTitleBox: {
    flex: 1,
  },
  teamName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  teamStats: {
    fontSize: 14,
    color: COLORS.slate400,
    fontWeight: '500',
  },
  
  // Next Match Widget Styles (Dark Premium)
  nextMatchWidget: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 16,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  nmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nmStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6', // Blue dot as in screenshot
  },
  nextMatchLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  nmMainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nmInfoColumn: {
    flex: 1,
    gap: 8,
  },
  nextMatchOpponent: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  nmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nmRowText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  nmLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  nmLocationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  nmRightPart: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
  },
  nmAttendanceCircle: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 35,
  },
  nmBgIcon: {
    position: 'absolute',
    opacity: 0.1,
  },
  nmUserIcon: {
    backgroundColor: '#1E3A8A',
    padding: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nmStatsOverlay: {
    position: 'absolute',
    bottom: 5,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  nmStatMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  nmStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nmStatCount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  nmBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1E3A8A',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nmBadgeHome: {
    backgroundColor: '#172554',
  },
  nmBadgeAway: {
    backgroundColor: '#1E293B',
  },
  nmBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },
  nextMatchEmpty: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  nextMatchEmptyText: {
    fontSize: 12,
    color: COLORS.slate400,
    fontWeight: '600',
  },


  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.slate100,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.slate800,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.slate500,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  createButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#002E5D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  createButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.slate900,
  },
  modalBody: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.slate700,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.slate50,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.slate900,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.slate100,
  },
  modalButtonConfirm: {
    backgroundColor: '#002E5D',
  },
  modalButtonDisabled: {
    backgroundColor: COLORS.slate300,
  },
  modalButtonTextCancel: {
    color: COLORS.slate600,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButtonTextConfirm: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

