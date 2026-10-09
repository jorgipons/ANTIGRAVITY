import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

const PERIOD_DURATION_S = 10 * 60; // 10 minutes

function calcSeconds(timerData, playerId, { activePeriod = null, timerElapsed = 0, timerRunning = false } = {}) {
  if (!timerData) return 0;
  let totalSecs = 0;
  Object.entries(timerData).forEach(([periodKey, periodData]) => {
    const pNum     = parseInt(periodKey, 10);
    const isActive = timerRunning && pNum === activePeriod;
    const stints   = periodData.stints?.[playerId] || [];
    stints.forEach(s => {
      const start = s.start ?? 0;
      const end   = s.end !== null && s.end !== undefined
        ? s.end
        : (isActive ? timerElapsed : (periodData.duration || 0));
      const raw = end - start;
      if (raw <= 0) return;
      if (isActive) {
        totalSecs += raw;
      } else {
        const duration = periodData.duration || 0;
        totalSecs += duration > 0 ? (raw / duration) * PERIOD_DURATION_S : raw;
      }
    });
  });
  return Math.round(totalSecs);
}

function formatMSS(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function LinearTimeline({ timerData, players, totalPeriods }) {
  if (!timerData) return null;
  const periodsWithData = Array.from({ length: totalPeriods }, (_, i) => i + 1)
    .filter(p => timerData[p]?.duration > 0);
  if (periodsWithData.length === 0) return null;

  const activePlayers = players.filter(player =>
    periodsWithData.some(p => (timerData[p]?.stints?.[player.id] || []).length > 0)
  );
  if (activePlayers.length === 0) return null;

  return (
    <View style={s.linSection}>
      <Text style={s.sectionTitle}>TIMELINE COMPLETO</Text>

      {/* Period labels */}
      <View style={s.linRow}>
        <View style={{ width: 90 }} />
        <View style={s.linBars}>
          {periodsWithData.map(p => (
            <Text key={p} style={s.linPeriodLabel}>P{p}</Text>
          ))}
        </View>
      </View>

      {/* One row per player */}
      {activePlayers.map(player => (
        <View key={player.id} style={s.linRow}>
          <Text style={s.linPlayerName} numberOfLines={1}>
            {player.number} {player.name}
          </Text>
          <View style={s.linBarWrapper}>
            {periodsWithData.map((periodNum, idx) => {
              const periodData = timerData[periodNum];
              const dur    = periodData.duration || 1;
              const stints = periodData.stints?.[player.id] || [];
              return (
                <View key={periodNum} style={[s.linSegment, idx > 0 && s.linSegmentBorder]}>
                  {stints.map((stint, si) => {
                    const start = stint.start ?? 0;
                    const end   = stint.end   ?? dur;
                    const left  = (start / dur) * 100;
                    const width = Math.max(1, ((end - start) / dur) * 100);
                    return (
                      <View key={si} style={[s.linStint, { left: `${left}%`, width: `${width}%` }]} />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Timeline({ timerData, players, totalPeriods }) {
  if (!timerData) return null;
  const periodsWithData = Array.from({ length: totalPeriods }, (_, i) => i + 1)
    .filter(p => timerData[p]?.duration > 0);
  if (periodsWithData.length === 0) return null;

  return (
    <View style={s.timelineSection}>
      <Text style={s.sectionTitle}>TIMELINE DE CAMBIOS</Text>
      {periodsWithData.map(periodNum => {
        const periodData = timerData[periodNum];
        const duration   = periodData.duration || 1;

        // Collect all events (entries/exits) across players
        const events = [];
        Object.entries(periodData.stints || {}).forEach(([pid, stints]) => {
          const player = players.find(p => p.id === pid);
          if (!player) return;
          stints.forEach(stint => {
            if (stint.start != null) events.push({ sec: stint.start, type: 'in',  player });
            if (stint.end   != null) events.push({ sec: stint.end,   type: 'out', player });
          });
        });
        events.sort((a, b) => a.sec - b.sec);

        return (
          <View key={periodNum} style={s.timelinePeriod}>
            <Text style={s.timelinePeriodLabel}>P{periodNum}</Text>
            {/* Bar for each player */}
            {Object.entries(periodData.stints || {}).map(([pid, stints]) => {
              const player = players.find(p => p.id === pid);
              if (!player) return null;
              return (
                <View key={pid} style={s.timelinePlayerRow}>
                  <Text style={s.timelinePlayerName} numberOfLines={1}>{player.number} {player.name}</Text>
                  <View style={s.timelineBar}>
                    {stints.map((stint, idx) => {
                      const start = stint.start ?? 0;
                      const end   = stint.end   ?? duration;
                      const left  = (start / duration) * 100;
                      const width = Math.max(1, ((end - start) / duration) * 100);
                      return (
                        <View
                          key={idx}
                          style={[s.timelineStint, { left: `${left}%`, width: `${width}%` }]}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default function MatchSummaryScreen() {
  const T = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const route      = useRoute();
  const { match, team, totalPeriods, timerElapsed = 0, timerRunning = false, currentPeriod = 1 } = route.params || {};

  const players = useMemo(() => {
    const src = team?.players || match?.players || [];
    return [...src].sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }, [team?.players, match?.players]);

  const liveOpts = { activePeriod: currentPeriod, timerElapsed, timerRunning };

  const playerSeconds = useMemo(() => {
    return players.map(p => ({
      ...p,
      seconds: calcSeconds(match?.timerData, p.id, liveOpts),
    })).sort((a, b) => b.seconds - a.seconds);
  }, [players, match?.timerData, timerElapsed, timerRunning, currentPeriod]);

  const totalMatchSeconds = useMemo(() => {
    if (!match?.timerData) return 0;
    let t = 0;
    Object.values(match.timerData).forEach(pd => { t += pd.duration || 0; });
    return t;
  }, [match?.timerData]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <LinearGradient colors={[T.ink2, T.ink]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <ChevronLeft color="rgba(255,255,255,0.7)" size={20} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>Resumen de partido</Text>
            <Text style={s.headerSub}>vs {match?.opponent} · {match?.date}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

        {/* Minutes table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MINUTOS JUGADOS</Text>
          <View style={s.tableCard}>
            {playerSeconds.map((p, idx) => {
              const pct = Math.min(100, (p.seconds / (totalPeriods * 600)) * 100);
              return (
                <View key={p.id} style={[s.tableRow, idx > 0 && s.tableRowBorder]}>
                  <View style={s.tableLeft}>
                    <Text style={s.tableNum}>{p.number}</Text>
                    <Text style={s.tableName}>{p.name}</Text>
                  </View>
                  <View style={s.tableRight}>
                    <View style={s.minutesBarTrack}>
                      <View style={[s.minutesBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={s.tableMinutes}>
                      {p.seconds > 0 ? formatMSS(p.seconds) : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <LinearTimeline timerData={match?.timerData} players={players} totalPeriods={totalPeriods} />

        <Timeline timerData={match?.timerData} players={players} totalPeriods={totalPeriods} />

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { padding: 7, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: T.fontBold, fontSize: 20, color: T.onDark },
  headerSub: { fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },

  container: { flex: 1 },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontFamily: T.fontBold, fontSize: 10, color: T.textFaint, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  tableCard: { backgroundColor: T.white, borderRadius: T.rCard, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  tableLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 120 },
  tableNum: { fontFamily: T.monoBold, fontSize: 14, color: T.textSub, width: 28 },
  tableName: { fontFamily: T.fontSemi, fontSize: 14, color: T.text, flex: 1 },
  tableRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  minutesBarTrack: { flex: 1, height: 6, backgroundColor: T.panel, borderRadius: 3, overflow: 'hidden' },
  minutesBarFill: { height: '100%', backgroundColor: T.orange, borderRadius: 3 },
  tableMinutes: { fontFamily: T.monoBold, fontSize: 13, color: T.text, width: 48, textAlign: 'right' },

  linSection: { marginHorizontal: 16, marginTop: 24 },
  linRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  linBars: { flex: 1, flexDirection: 'row' },
  linPeriodLabel: { flex: 1, fontFamily: T.fontBold, fontSize: 10, color: T.textFaint, textAlign: 'center' },
  linPlayerName: { fontFamily: T.fontMed, fontSize: 11, color: T.textSub, width: 90 },
  linBarWrapper: { flex: 1, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  linSegment: { flex: 1, height: 14, backgroundColor: T.panel, position: 'relative', overflow: 'hidden' },
  linSegmentBorder: { borderLeftWidth: 1, borderLeftColor: T.borderHard },
  linStint: { position: 'absolute', height: '100%', backgroundColor: T.orange },

  timelineSection: { marginHorizontal: 16, marginTop: 24 },
  timelinePeriod: { marginBottom: 20 },
  timelinePeriodLabel: { fontFamily: T.fontBold, fontSize: 11, color: T.textSub, marginBottom: 8 },
  timelinePlayerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timelinePlayerName: { fontFamily: T.fontMed, fontSize: 11, color: T.textSub, width: 90 },
  timelineBar: { flex: 1, height: 10, backgroundColor: T.panel, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  timelineStint: { position: 'absolute', height: '100%', backgroundColor: T.orange, borderRadius: 5 },
}); }
