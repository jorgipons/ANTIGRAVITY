import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS } from '../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarView({ matches = [], onMatchPress }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayRaw = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
    const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // 0 is Monday, 6 is Sunday

    const daysArr = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
      daysArr.push({ id: `pad-${i}`, day: null });
    }
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayMatches = matches.filter(m => m.date === dateStr);
      daysArr.push({ id: dateStr, day: i, date: dateStr, matches: dayMatches });
    }
    return daysArr;
  }, [currentDate, matches]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthName = monthNames[currentDate.getMonth()];
  const yearName = currentDate.getFullYear();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <ChevronLeft color={COLORS.slate600} size={20} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
          <Text style={styles.yearTitle}>{yearName}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
          <ChevronRight color={COLORS.slate600} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekLabels}>
        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(d => (
          <Text key={d} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((item, index) => (
          <View key={item.id} style={styles.dayCell}>
             {item.day && (
               <View style={styles.dayInner}>
                 <Text style={[
                   styles.dayText,
                   (new Date().toISOString().split('T')[0] === item.date) && styles.todayText
                 ]}>{item.day}</Text>
                 <View style={styles.matchContainer}>
                   {item.matches.map((m, idx) => {
                     if (idx > 2) return null; // Only show up to 3 dots, or 2 and a count?
                     return (
                       <TouchableOpacity 
                         key={m.id} 
                         style={[styles.matchIndicator, { backgroundColor: m.isHome ? COLORS.primary : COLORS.warning }]}
                         onPress={() => onMatchPress(m)}
                       >
                         {item.matches.length === 1 && (
                            <Text style={styles.matchMinLabel} numberOfLines={1}>{m.opponent[0]}</Text>
                         )}
                       </TouchableOpacity>
                     );
                   })}
                   {item.matches.length > 3 && <Text style={{fontSize: 8, color: COLORS.slate400}}>+{item.matches.length - 3}</Text>}
                 </View>
               </View>
             )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthTitle: { fontSize: 16, fontWeight: '900', color: COLORS.slate900, letterSpacing: 1 },
  yearTitle: { fontSize: 12, color: COLORS.slate400, fontWeight: 'bold' },
  navBtn: { padding: 10, backgroundColor: COLORS.slate50, borderRadius: 12 },
  weekLabels: { flexDirection: 'row', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.slate50, paddingBottom: 8 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: COLORS.slate400, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  dayCell: { width: '14.28%', height: 65, alignItems: 'center', justifyContent: 'flex-start' },
  dayInner: { alignItems: 'center', width: '100%', padding: 2 },
  dayText: { fontSize: 14, color: COLORS.slate700, fontWeight: '500' },
  todayText: { color: COLORS.primary, fontWeight: 'bold', textDecorationLine: 'underline' },
  matchContainer: { marginTop: 4, width: '100%', alignItems: 'center', gap: 2 },
  matchIndicator: { 
    width: '90%', 
    height: 14, 
    borderRadius: 4, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 2
  },
  matchMinLabel: { fontSize: 8, fontWeight: 'bold', color: COLORS.white }
});
