import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus, UserPlus, Trash2, Edit2, Play, AlertCircle } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { ROLES, ROLE_KEYS } from '../constants/roles';
import { useTeams } from '../hooks/useTeams';
import { db } from '../constants/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

  if (loading || !team) return null;

  const sortedPlayers = [...(team.players || [])].sort((a, b) => parseInt(a.number) - parseInt(b.number));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={COLORS.slate600} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.headerCount}>{sortedPlayers.length} Jugadores</Text>
        </View>
        <TouchableOpacity onPress={handleDeleteTeam} style={styles.deleteTeamBtn}>
          <Trash2 color={COLORS.danger} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryActionBtn}>
          <Play color={COLORS.primary} size={20} />
          <Text style={styles.actionBtnTextPrimary}>Nuevo Partido</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.secondaryActionBtn}
          onPress={() => openPlayerModal()}
        >
          <UserPlus color={COLORS.slate700} size={20} />
          <Text style={styles.actionBtnTextSecondary}>Añadir Jugador</Text>
        </TouchableOpacity>
      </View>

      {sortedPlayers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <UserPlus color={COLORS.slate300} size={48} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>No hay jugadores en la plantilla</Text>
        </View>
      ) : (
        <FlatList
          data={sortedPlayers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const roleConf = ROLES[item.role || 'receptor'];
            return (
              <View style={styles.playerCard}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{item.number}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <View style={[styles.roleLabel, { backgroundColor: roleConf?.bg }]}>
                    <Text style={[styles.roleText, { color: roleConf?.color }]}>{roleConf?.label}</Text>
                  </View>
                </View>
                <View style={styles.playerActions}>
                  <TouchableOpacity onPress={() => openPlayerModal(item)} style={styles.iconBtn}>
                    <Edit2 color={COLORS.slate400} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePlayer(item.id, item.name)} style={styles.iconBtn}>
                    <Trash2 color={COLORS.danger} size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

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
              {ROLE_KEYS.map(rk => (
                <TouchableOpacity
                  key={rk}
                  style={[
                    styles.roleBtn,
                    { backgroundColor: ROLES[rk].bg },
                    playerForm.role === rk && { borderWidth: 2, borderColor: ROLES[rk].color }
                  ]}
                  onPress={() => setPlayerForm({...playerForm, role: rk})}
                >
                  <Text style={[styles.roleBtnText, { color: ROLES[rk].color }]}>{ROLES[rk].label}</Text>
                </TouchableOpacity>
              ))}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitleBox: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.slate900 },
  headerCount: { fontSize: 13, color: COLORS.slate500 },
  deleteTeamBtn: { padding: 8, backgroundColor: COLORS.dangerLight, borderRadius: 8 },
  
  actionsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  primaryActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 12
  },
  secondaryActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.slate200, padding: 16, borderRadius: 12
  },
  actionBtnTextPrimary: { color: COLORS.primary, fontWeight: 'bold' },
  actionBtnTextSecondary: { color: COLORS.slate700, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: COLORS.slate400, textAlign: 'center', fontSize: 16 },

  listContainer: { padding: 16, paddingBottom: 40 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.slate200
  },
  numberBadge: {
    width: 36, height: 36, backgroundColor: COLORS.slate100, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 12
  },
  numberText: { fontWeight: 'bold', color: COLORS.slate700 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '600', color: COLORS.slate800, marginBottom: 4 },
  roleLabel: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  roleText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  playerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: COLORS.slate900 },
  label: { fontSize: 12, fontWeight: 'bold', color: COLORS.slate500, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.slate50, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 10, padding: 12, fontSize: 16 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  roleBtnText: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtnCancel: { flex: 1, padding: 14, backgroundColor: COLORS.slate100, borderRadius: 10, alignItems: 'center' },
  modalBtnSave: { flex: 1, padding: 14, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center' },
  modalBtnTextCancel: { fontWeight: 'bold', color: COLORS.slate600 },
  modalBtnTextSave: { fontWeight: 'bold', color: COLORS.white },
});
