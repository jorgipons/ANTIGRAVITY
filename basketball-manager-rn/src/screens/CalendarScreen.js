import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Menu, HelpCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAllMatches } from '../hooks/useAllMatches';
import { useLayout } from '../hooks/useLayout';
import CalendarView from '../components/CalendarView';
import AppDrawer from '../components/AppDrawer';
import GuidedTourOverlay from '../components/GuidedTourOverlay';

export default function CalendarScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const { matches, loading } = useAllMatches();
  const { IS_TABLET_LANDSCAPE } = useLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const menuBtnRef      = useRef(null);
  const calendarViewRef = useRef(null);
  const listSectRef     = useRef(null);

  const TOUR_STEPS = [
    { ref: menuBtnRef,      title: 'Menú lateral',     text: 'Navega a otras secciones de la app.' },
    { ref: calendarViewRef, title: 'Calendario',        text: 'Navega por los meses para ver en qué días tienes partidos. Los días con partido aparecen marcados.' },
    { ref: listSectRef,     title: 'Próximos partidos', text: 'Lista de los partidos más cercanos de todos tus equipos. Toca uno para ir a su matriz.' },
  ];

  const upcomingMatches = React.useMemo(() => {
    if (!matches) return [];
    return matches
      .filter(m => {
        const matchDate = new Date(m.date + 'T' + (m.time || '00:00'));
        return m.state !== 'finished' && matchDate >= new Date();
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10);
  }, [matches]);

  const matchesForSelectedDay = React.useMemo(() => {
    if (!selectedDay || !matches) return [];
    return matches.filter(m => m.date === selectedDay);
  }, [selectedDay, matches]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        {!IS_TABLET_LANDSCAPE ? (
          <TouchableOpacity ref={menuBtnRef} onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
            <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Calendario</Text>
          <Text style={styles.headerSub}>Todos los equipos</Text>
        </View>
        <TouchableOpacity onPress={() => setTourActive(true)} style={styles.menuBtn}>
          <HelpCircle color="rgba(255,255,255,0.65)" size={20} />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={T.orange} />
        </View>
      ) : IS_TABLET_LANDSCAPE ? (
        /* Split view for tablet landscape */
        <View style={styles.splitContainer}>
          {/* Left panel: calendar */}
          <View style={styles.splitLeft}>
            <View ref={calendarViewRef}>
              <CalendarView
                matches={matches}
                onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                onDayPress={(dayStr) => setSelectedDay(dayStr)}
              />
            </View>
          </View>

          {/* Right panel: matches for selected day */}
          <ScrollView style={styles.splitRight} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {selectedDay ? (
              <>
                <Text style={styles.splitDayTitle}>
                  {new Date(selectedDay + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                {matchesForSelectedDay.length === 0 ? (
                  <Text style={styles.splitEmptyText}>Sin partidos este día.</Text>
                ) : (
                  matchesForSelectedDay.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.matchCard}
                      onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                      activeOpacity={0.75}
                    >
                      <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>{new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric' })}</Text>
                        <Text style={styles.dateMon}>{new Date(m.date).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</Text>
                        <Text style={styles.dateTime}>{m.time || '--:--'}h</Text>
                      </View>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchTeamName}>{m.teamName}</Text>
                        <Text style={styles.matchOpponent}>vs {m.opponent}</Text>
                      </View>
                      <View style={[styles.homePill, m.isHome ? styles.homePillHome : styles.homePillAway]}>
                        <Text style={[styles.homePillText, m.isHome ? styles.homePillTextHome : styles.homePillTextAway]}>
                          {m.isHome ? 'CASA' : 'VIS'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </>
            ) : (
              <>
                <Text style={styles.splitDayTitle}>Próximos Partidos</Text>
                {upcomingMatches.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.matchCard}
                    onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>{new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric' })}</Text>
                      <Text style={styles.dateMon}>{new Date(m.date).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}</Text>
                      <Text style={styles.dateTime}>{m.time || '--:--'}h</Text>
                    </View>
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchTeamName}>{m.teamName}</Text>
                      <Text style={styles.matchOpponent}>vs {m.opponent}</Text>
                    </View>
                    <View style={[styles.homePill, m.isHome ? styles.homePillHome : styles.homePillAway]}>
                      <Text style={[styles.homePillText, m.isHome ? styles.homePillTextHome : styles.homePillTextAway]}>
                        {m.isHome ? 'CASA' : 'VIS'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        /* Mobile/portrait — existing ScrollView UNCHANGED */
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View ref={calendarViewRef}>
            <CalendarView
              matches={matches}
              onMatchPress={(m) => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
              onDayPress={(dayStr) => setSelectedDay(dayStr)}
            />
          </View>

          <View ref={listSectRef} style={styles.listSection}>
            <Text style={styles.listTitle}>Próximos Partidos</Text>
            {upcomingMatches.length === 0 ? (
              <Text style={styles.emptyText}>No hay partidos próximos.</Text>
            ) : (
              upcomingMatches.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.matchCard}
                  onPress={() => navigation.navigate('MatchMatrix', { matchId: m.id, teamId: m.teamId })}
                  activeOpacity={0.75}
                >
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>
                      {new Date(m.date).toLocaleDateString('es-ES', { day: 'numeric' })}
                    </Text>
                    <Text style={styles.dateMon}>
                      {new Date(m.date).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={styles.dateTime}>{m.time || '--:--'}h</Text>
                  </View>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchTeamName}>{m.teamName}</Text>
                    <Text style={styles.matchOpponent}>vs {m.opponent}</Text>
                  </View>
                  <View style={[styles.homePill, m.isHome ? styles.homePillHome : styles.homePillAway]}>
                    <Text style={[styles.homePillText, m.isHome ? styles.homePillTextHome : styles.homePillTextAway]}>
                      {m.isHome ? 'CASA' : 'VIS'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />
      <GuidedTourOverlay steps={TOUR_STEPS} visible={tourActive} onClose={() => setTourActive(false)} />
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 10,
  },
  menuBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: T.fontBold, fontSize: 18, color: T.onDark },
  headerSub: { fontFamily: T.fontReg, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },

  listSection: { marginTop: 24 },
  listTitle: { fontFamily: T.fontBold, fontSize: 16, color: T.text, marginBottom: 12 },

  matchCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.white,
    borderRadius: T.rCard, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: T.border, gap: 12,
  },
  dateBox: { width: 52, alignItems: 'center' },
  dateDay: { fontFamily: T.monoBold, fontSize: 24, color: T.orange, lineHeight: 28 },
  dateMon: { fontFamily: T.mono, fontSize: 10, color: T.textSub, letterSpacing: 0.8 },
  dateTime: { fontFamily: T.mono, fontSize: 10, color: T.textFaint, marginTop: 2 },

  matchInfo: { flex: 1 },
  matchTeamName: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
  },
  matchOpponent: { fontFamily: T.fontBold, fontSize: 15, color: T.text },

  homePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: T.rPill },
  homePillHome: { backgroundColor: T.posSoft },
  homePillAway: { backgroundColor: T.panel },
  homePillText: { fontFamily: T.fontSemi, fontSize: 10 },
  homePillTextHome: { color: T.posDark },
  homePillTextAway: { color: T.textSub },

  emptyText: { fontFamily: T.fontReg, color: T.textFaint, textAlign: 'center', padding: 24 },

  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  splitLeft: {
    width: 380,
    borderRightWidth: 1,
    borderRightColor: T.border,
  },
  splitRight: {
    flex: 1,
  },
  splitDayTitle: {
    fontFamily: T.fontBold,
    fontSize: 18,
    color: T.text,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  splitEmptyText: {
    fontFamily: T.fontReg,
    fontSize: 14,
    color: T.textFaint,
    marginTop: 8,
  },
}); }
