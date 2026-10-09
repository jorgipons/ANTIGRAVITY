import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function CalendarView({ matches = [], onMatchPress, onDayPress }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayRaw = new Date(year, month, 1).getDay();
    const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

    const daysArr = [];
    for (let i = 0; i < firstDay; i++) daysArr.push({ id: `pad-${i}`, day: null });
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      daysArr.push({ id: dateStr, day: i, date: dateStr, matches: matches.filter(m => m.date === dateStr) });
    }
    return daysArr;
  }, [currentDate, matches]);

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <ChevronLeft color={T.textSub} size={20} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.monthTitle}>{MONTH_NAMES[currentDate.getMonth()].toUpperCase()}</Text>
          <Text style={styles.yearTitle}>{currentDate.getFullYear()}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
          <ChevronRight color={T.textSub} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekLabels}>
        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => (
          <Text key={d} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((item) => (
          <View key={item.id} style={styles.dayCell}>
            {item.day && (
              <TouchableOpacity style={styles.dayInner} onPress={() => onDayPress?.(item.date)} activeOpacity={0.7}>
                <Text style={[styles.dayText, todayStr === item.date && styles.todayText]}>{item.day}</Text>
                <View style={styles.matchContainer}>
                  {item.matches.slice(0, 3).map((m, idx) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.matchIndicator, { backgroundColor: m.isHome ? T.blue : T.amber }]}
                      onPress={() => onMatchPress(m)}
                    >
                      {item.matches.length === 1 && (
                        <Text style={styles.matchMinLabel} numberOfLines={1}>{m.opponent[0]}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {item.matches.length > 3 && (
                    <Text style={{ fontSize: 8, color: T.textFaint }}>+{item.matches.length - 3}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(T) { return StyleSheet.create({
  container: {
    backgroundColor: T.white, borderRadius: 24, padding: 16,
    borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthTitle: { fontSize: 16, fontWeight: '900', color: T.text, letterSpacing: 1 },
  yearTitle: { fontSize: 12, color: T.textFaint, fontWeight: 'bold' },
  navBtn: { padding: 10, backgroundColor: T.panel, borderRadius: 12 },
  weekLabels: { flexDirection: 'row', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border, paddingBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: T.textFaint, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  dayCell: { width: '14.28%', height: 65, alignItems: 'center', justifyContent: 'flex-start' },
  dayInner: { alignItems: 'center', width: '100%', padding: 2 },
  dayText: { fontSize: 14, color: T.text, fontWeight: '500' },
  todayText: { color: T.blue, fontWeight: 'bold', textDecorationLine: 'underline' },
  matchContainer: { marginTop: 4, width: '100%', alignItems: 'center', gap: 2 },
  matchIndicator: {
    width: '90%', height: 14, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2,
  },
  matchMinLabel: { fontSize: 8, fontWeight: 'bold', color: '#fff' },
}); }
