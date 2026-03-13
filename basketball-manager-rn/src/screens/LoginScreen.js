import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/colors';

// Placeholder - will be fully implemented in Phase 2
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestor Basket Pasarela</Text>
      <Text style={styles.subtitle}>Iniciando sesión...</Text>
      <ActivityIndicator color={COLORS.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.slate800,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.slate500,
    textAlign: 'center',
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
});
