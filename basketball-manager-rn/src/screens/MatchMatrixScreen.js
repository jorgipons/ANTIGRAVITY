import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Info, Search } from 'lucide-react-native';
import { COLORS } from '../constants/colors';

// Placeholder for Phase 3c
export default function MatchMatrixScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { matchId, teamId } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={COLORS.slate600} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Acta Digital</Text>
        <TouchableOpacity onPress={() => {}} style={styles.infoButton}>
          <Info color={COLORS.slate600} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Matriz de Partidos</Text>
          <Text style={styles.subtitle}>
            Fase 3c — Próximamente. 
          </Text>
          <Text style={styles.detail}>
            ID de Partido: {matchId}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.rosterButton}
          onPress={() => {
            // Future navigation to RosterSelectionScreen
            alert("Navegando a selección de convocatoria");
          }}
        >
          <Search color={COLORS.primary} size={20} />
          <Text style={styles.rosterButtonText}>Gestionar Convocatoria</Text>
        </TouchableOpacity>
      </ScrollView>
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
  infoButton: { padding: 8, marginRight: -8 },
  
  container: { padding: 24, alignItems: 'center' },
  card: {
    backgroundColor: COLORS.white, width: '100%', padding: 32, borderRadius: 20,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.slate200,
    shadowColor: COLORS.slate900, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
    marginBottom: 24
  },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.slate800, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.slate500, textAlign: 'center', marginBottom: 24 },
  detail: { fontSize: 13, color: COLORS.slate400, fontFamily: 'monospace' },
  
  rosterButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 12, width: '100%'
  },
  rosterButtonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 }
});
