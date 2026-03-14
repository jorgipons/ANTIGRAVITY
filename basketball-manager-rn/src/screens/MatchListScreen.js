import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Plus, Calendar, Clock, MapPin, ChevronRight, Activity, Users, RefreshCw, Trash2 } from 'lucide-react-native';

import { COLORS } from '../constants/colors';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import { importFederationMatches } from '../utils/federation';

export default function MatchListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { teamId } = route.params;
  const { matches, loading, addMatch, updateMatch, deleteMatch } = useMatches(teamId);

  const { teams } = useTeams();
  const team = teams.find(t => t.id === teamId);

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    opponent: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    location: '',
    isHome: true,
  });

  const handleCreateMatch = async () => {
    if (!form.opponent.trim() || !form.date.trim() || !form.time.trim()) {
      Alert.alert('Error', 'Rival, fecha y hora son obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const initialPlayers = team?.players ? [...team.players] : [];
      
      const newMatchId = await addMatch({
        ...form,
        players: initialPlayers,
      });
      
      setModalVisible(false);
      setForm({ opponent: '', date: new Date().toISOString().split('T')[0], time: '10:00', location: '', isHome: true });
      
      navigation.navigate('MatchMatrix', { matchId: newMatchId, teamId });
      
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el partido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncFederation = async () => {
    if (!team?.federationId) {
      Alert.alert('Info', 'Configura el ID de Federación en el detalle del equipo primero.');
      return;
    }
    
    setSyncing(true);
    try {
      const res = await importFederationMatches(team.federationId, 'smart');
      if (!res.success) {
        Alert.alert('Error', res.error || 'No se pudieron sincronizar los partidos.');
        return;
      }

      let added = 0;
      let updated = 0;
      const initialPlayers = team?.players ? [...team.players] : [];
      
      // Iterate over imported matches and check if they already exist
      for (const m of res.matches) {
        const exists = matches.find(existing => existing.federationMatchId === m.federationMatchId);
        if (!exists) {
          await addMatch({
            ...m,
            players: initialPlayers
          });
          added++;
        } else {
          // Si el partido existe, verificamos si hay algún cambio importante (resultado, hora, estado)
          if (
            exists.state !== m.state ||
            exists.date !== m.date ||
            exists.time !== m.time ||
            JSON.stringify(exists.score) !== JSON.stringify(m.score)
          ) {
            await updateMatch(exists.id, {
              state: m.state,
              date: m.date,
              time: m.time,
              score: m.score,
              result: m.result,
              location: m.location
            });
            updated++;
          }
        }
      }
      
      if (added > 0 || updated > 0) {
        Alert.alert('Éxito', `Sincronización completada.\nNuevos: ${added}\nActualizados: ${updated}`);
      } else {
        Alert.alert('Éxito', 'Sincronización completada. Ya estaba todo al día.');
      }
    } catch (e) {
      Alert.alert('Error', 'Fallo general al sincronizar con la federación.');
    } finally {
      setSyncing(false);
    }
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


  const renderMatchCard = ({ item }) => {
    const isFinished = item.state === 'finished';
    const statusColor = isFinished ? COLORS.slate500 : COLORS.primary;
    
    return (
      <View style={[styles.matchCard, isFinished && styles.matchCardFinished]}>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.matchMain}
          onPress={() => navigation.navigate('MatchMatrix', { matchId: item.id, teamId })}
        >
          <View style={styles.matchHeader}>
            <View style={[styles.badge, { backgroundColor: item.isHome ? COLORS.primaryLight : COLORS.warningLight }]}>
              <Text style={[styles.badgeText, { color: item.isHome ? COLORS.primaryDark : COLORS.warning }]}>
                {item.isHome ? 'LOCAL' : 'VISITANTE'}
              </Text>
            </View>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isFinished ? 'Finalizado' : 'Pendiente'}
            </Text>
          </View>
          
          <Text style={styles.opponentName} numberOfLines={1}>{item.opponent}</Text>
          
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Calendar color={COLORS.slate400} size={14} />
              <Text style={styles.detailText}>{item.date}</Text>
            </View>
            <View style={styles.detailItem}>
              <Clock color={COLORS.slate400} size={14} />
              <Text style={styles.detailText}>{item.time}h</Text>
            </View>
          </View>
          
          {item.location ? (
            <View style={[styles.detailItem, { marginTop: 4 }]}>
              <MapPin color={COLORS.slate400} size={14} />
              <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        
        <View style={styles.matchActionsRight}>
          <TouchableOpacity 
            style={styles.attendanceBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => navigation.navigate('MatchAttendance', { matchId: item.id, teamId })}
          >
            <Users color={COLORS.primary} size={20} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.attendanceBtn, { backgroundColor: COLORS.dangerLight }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleDeleteMatch(item.id, item.opponent)}
          >
            <Trash2 color={COLORS.danger} size={20} />
          </TouchableOpacity>

          <View style={styles.matchScoreArea}>
            {isFinished && item.score ? (
              <View style={styles.scoreBox}>
                <Text style={[styles.scoreText, item.result === 'won' ? styles.scoreWon : item.result === 'lost' ? styles.scoreLost : null]}>
                  {item.score.local} - {item.score.visitor}
                </Text>
              </View>
            ) : (
              <ChevronRight color={COLORS.slate300} size={24} />
            )}
          </View>
        </View>
      </View>
    );
  };


  if (loading) {
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
        <Text style={styles.headerTitle}>Partidos</Text>
        {team?.federationId ? (
          <TouchableOpacity onPress={handleSyncFederation} style={styles.syncBtn} disabled={syncing}>
            {syncing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <RefreshCw color={COLORS.primary} size={20} />}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Activity color={COLORS.slate300} size={64} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Sin partidos</Text>
          <Text style={styles.emptyText}>Crea el primer partido para empezar a gestionar las actas.</Text>
          
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
            <Plus color={COLORS.white} size={20} />
            <Text style={styles.createBtnText}>Nuevo Partido</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={matches}
            keyExtractor={item => item.id}
            renderItem={renderMatchCard}
            contentContainerStyle={styles.listContainer}
          />
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <Plus color={COLORS.white} size={24} />
          </TouchableOpacity>
        </>
      )}

      {/* New Match Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Partido</Text>
            
            <Text style={styles.label}>Equipo Rival</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: CB Valencia"
              value={form.opponent}
              onChangeText={t => setForm({...form, opponent: t})}
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2023-10-15"
                  value={form.date}
                  onChangeText={t => setForm({...form, date: t})}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Hora (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10:00"
                  value={form.time}
                  onChangeText={t => setForm({...form, time: t})}
                />
              </View>
            </View>

            <Text style={styles.label}>Ubicación / Pabellón</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Pabellón Municipal"
              value={form.location}
              onChangeText={t => setForm({...form, location: t})}
            />

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchTitle}>¿Jugamos como local?</Text>
                <Text style={styles.switchDesc}>{form.isHome ? 'Sí, en casa' : 'No, somos visitantes'}</Text>
              </View>
              <Switch
                value={form.isHome}
                onValueChange={v => setForm({...form, isHome: v})}
                trackColor={{ false: COLORS.slate300, true: COLORS.primaryLight }}
                thumbColor={form.isHome ? COLORS.primary : COLORS.slate100}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)} disabled={submitting}>
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtnSave, submitting && { opacity: 0.7 }]} 
                onPress={handleCreateMatch}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalBtnTextSave}>Crear</Text>}
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.slate900 },
  syncBtn: { padding: 8, marginRight: -8, backgroundColor: COLORS.primaryLight, borderRadius: 8 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.slate800, marginBottom: 8 },
  emptyText: { fontSize: 16, color: COLORS.slate500, textAlign: 'center', marginBottom: 32 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 8 },
  createBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },

  listContainer: { padding: 16, paddingBottom: 100 },
  matchCard: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.slate200,
    shadowColor: COLORS.slate900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  matchCardFinished: { opacity: 0.8, backgroundColor: COLORS.slate50 },
  matchMain: { flex: 1 },
  matchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  opponentName: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate800, marginBottom: 8 },
  detailsRow: { flexDirection: 'row', gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: COLORS.slate600 },
  matchActionsRight: { flexDirection: 'row', alignItems: 'center' },
  attendanceBtn: { padding: 8, backgroundColor: COLORS.primaryLight, borderRadius: 8, marginRight: 8 },
  matchScoreArea: { justifyContent: 'center', alignItems: 'flex-end', minWidth: 40 },
  scoreBox: { backgroundColor: COLORS.slate100, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  scoreText: { fontSize: 16, fontWeight: 'bold', color: COLORS.slate700 },
  scoreWon: { color: COLORS.success },
  scoreLost: { color: COLORS.danger },

  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 60, height: 60,
    backgroundColor: COLORS.primary, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.slate900, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: COLORS.slate600, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: COLORS.slate50, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 12, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, padding: 16, backgroundColor: COLORS.slate50, borderRadius: 12 },
  switchTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.slate800 },
  switchDesc: { fontSize: 13, color: COLORS.slate500, marginTop: 2 },
  
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 32 },
  modalBtnCancel: { flex: 1, padding: 16, backgroundColor: COLORS.slate100, borderRadius: 12, alignItems: 'center' },
  modalBtnSave: { flex: 1, padding: 16, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center' },
  modalBtnTextCancel: { fontWeight: 'bold', color: COLORS.slate600, fontSize: 16 },
  modalBtnTextSave: { fontWeight: 'bold', color: COLORS.white, fontSize: 16 },
});
