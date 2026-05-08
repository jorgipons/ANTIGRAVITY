import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../constants/colors';
import { useAllMatches } from '../hooks/useAllMatches';
import CalendarView from '../components/CalendarView';

export default function CalendarScreen() {
  const navigation = useNavigation();
  const { matches, loading } = useAllMatches();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={COLORS.slate600} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendario General</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <CalendarView 
            matches={matches} 
            onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })} 
          />
          
          <View style={styles.matchesList}>
             <Text style={styles.listTitle}>Próximos Partidos</Text>
             {matches.filter(m => {
               const matchDate = new Date(m.date + 'T' + (m.time || '00:00'));
               return m.state !== 'finished' && matchDate >= new Date();
             }).length === 0 ? (
                <Text style={styles.emptyText}>No hay partidos próximos.</Text>
             ) : (
               matches.filter(m => {
                 const matchDate = new Date(m.date + 'T' + (m.time || '00:00'));
                 return m.state !== 'finished' && matchDate >= new Date();
               }).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 10).map(m => (
                 <TouchableOpacity 
                   key={m.id} 
                   style={styles.matchCard}
                   onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                 >
                   <View style={styles.matchDate}>
                     <Text style={styles.dateText}>{new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</Text>
                     <Text style={styles.timeText}>{m.time}h</Text>
                   </View>
                   <View style={styles.matchInfo}>
                     <Text style={styles.teamName}>{m.teamName}</Text>
                     <Text style={styles.opponentText}>vs {m.opponent}</Text>
                   </View>
                 </TouchableOpacity>
               ))
             )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.slate50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.slate200 },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.slate900 },
  container: { padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  matchesList: { marginTop: 24, paddingBottom: 40 },
  listTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.slate800, marginBottom: 16 },
  matchCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.slate100 },
  matchDate: { width: 65, borderRightWidth: 1, borderRightColor: COLORS.slate100, marginRight: 16, paddingRight: 8 },
  dateText: { fontSize: 13, fontWeight: 'bold', color: COLORS.primary },
  timeText: { fontSize: 11, color: COLORS.slate400, marginTop: 2 },
  matchInfo: { flex: 1 },
  teamName: { fontSize: 10, fontWeight: 'bold', color: COLORS.slate400, textTransform: 'uppercase', marginBottom: 2 },
  opponentText: { fontSize: 15, fontWeight: 'bold', color: COLORS.slate900 },
  emptyText: { textAlign: 'center', color: COLORS.slate400, padding: 20 },
});
