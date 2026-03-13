import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LogOut, Plus, Users, ChevronRight, Settings } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { useTeams } from '../hooks/useTeams';
import { auth } from '../constants/firebase';
import { signOut } from 'firebase/auth';

export default function TeamsListScreen() {
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
    >
      <View style={styles.teamIconBox}>
        <Users color={COLORS.primary} size={24} />
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name}</Text>
        <Text style={styles.teamStats}>
          {item.players ? item.players.length : 0} Jugadores
        </Text>
      </View>
      <ChevronRight color={COLORS.slate300} size={20} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mis Equipos</Text>
            <Text style={styles.headerSubtitle}>Gestor Basket Pasarela</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogOut color={COLORS.slate500} size={20} />
          </TouchableOpacity>
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
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => setModalVisible(true)}
            >
              <Plus color={COLORS.white} size={24} />
            </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.slate900,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.slate500,
    marginTop: 2,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
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
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    shadowColor: COLORS.slate900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  teamIconBox: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.slate800,
    marginBottom: 4,
  },
  teamStats: {
    fontSize: 13,
    color: COLORS.slate500,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
    paddingBottom: 36, // Safe area for iPhone
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
    letterSpacing: 0.5,
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
    backgroundColor: COLORS.primary,
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
