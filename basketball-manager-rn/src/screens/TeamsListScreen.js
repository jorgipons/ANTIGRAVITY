import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

// Placeholder - will be fully implemented in Phase 3a
export default function TeamsListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Equipos</Text>
      <Text style={styles.subtitle}>Fase 3 — Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.slate50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.slate800,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.slate400,
    marginTop: 8,
  },
});
