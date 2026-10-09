import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Menu, HelpCircle, Lightbulb } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import AppDrawer from '../components/AppDrawer';
import { SCREEN_HELP } from '../constants/helpContent';

const SECTION_ORDER = ['teams', 'teamDetail', 'matchList', 'matchAttendance', 'matchMatrix', 'calendar'];

const SECTION_ICONS = {
  teams: '🏠',
  teamDetail: '📋',
  matchList: '🗓️',
  matchAttendance: '👥',
  matchMatrix: '🔢',
  calendar: '📅',
};

export default function HelpScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (key) => {
    setExpandedSection(prev => prev === key ? null : key);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" backgroundColor={T.ink2} />
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
          <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Cómo usar</Text>
          <Text style={styles.headerSub}>Guía de la app</Text>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Tour tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <HelpCircle color={T.orange} size={20} strokeWidth={2} />
          </View>
          <Text style={styles.tipText}>
            Cada pantalla tiene un botón <Text style={styles.tipBold}>?</Text> en el header que activa un tour guiado interactivo paso a paso. ¡Es la forma más rápida de aprender!
          </Text>
        </View>

        {SECTION_ORDER.map(key => {
          const section = SCREEN_HELP[key];
          const isExpanded = expandedSection === key;
          return (
            <View key={key} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(key)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionIcon}>{SECTION_ICONS[key]}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.sectionBody}>
                  {section.sections.map((sub, i) => (
                    <View
                      key={i}
                      style={[styles.subsection, i < section.sections.length - 1 && styles.subsectionDivider]}
                    >
                      <Text style={styles.subHeading}>{sub.heading}</Text>
                      <Text style={styles.subText}>{sub.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.ink2 },
  content: { flex: 1, backgroundColor: T.bg },
  scrollContent: { padding: 16, paddingTop: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 10,
  },
  menuBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: T.fontBold, fontSize: 18, color: T.onDark },
  headerSub: { fontFamily: T.fontReg, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: T.orangeSoft,
    borderRadius: T.rCard,
    borderWidth: 1,
    borderColor: T.orange + '44',
    padding: 14,
    marginBottom: 16,
  },
  tipIconWrap: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontFamily: T.fontReg,
    fontSize: 13,
    color: T.text,
    lineHeight: 20,
  },
  tipBold: {
    fontFamily: T.fontBold,
    color: T.orange,
  },

  sectionCard: {
    backgroundColor: T.white,
    borderRadius: T.rCardLg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontFamily: T.fontSemi,
    fontSize: 15,
    color: T.text,
  },
  chevron: {
    fontFamily: T.fontBold,
    fontSize: 22,
    color: T.textFaint,
    transform: [{ rotate: '0deg' }],
    lineHeight: 24,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: T.orange,
  },

  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  subsection: { paddingVertical: 12 },
  subsectionDivider: { borderBottomWidth: 1, borderBottomColor: T.border },
  subHeading: {
    fontFamily: T.fontSemi,
    fontSize: 11,
    color: T.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  subText: {
    fontFamily: T.fontReg,
    fontSize: 14,
    color: T.text,
    lineHeight: 21,
  },
}); }
