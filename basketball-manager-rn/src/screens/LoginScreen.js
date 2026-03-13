import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { COLORS } from '../constants/colors';

// Ensure the web browser resolves after auth
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  // Configure Google Auth correctly for Firebase
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '177594386006-h5j431e2d42tqovb2j60v4r2o3tjsj44.apps.googleusercontent.com', // Web Client ID
    androidClientId: '177594386006-ka9dcils2879chn1mmdpd4d0fjngviu3.apps.googleusercontent.com', // Android Client ID for EAS standalone
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      setLoading(true);
      signInWithCredential(auth, credential)
        .catch((error) => {
          Alert.alert("Error", error.message);
          setLoading(false);
        });
    } else if (response?.type === 'cancel' || response?.type === 'error') {
      setLoading(false);
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestor Basket Pasarela</Text>
        <Text style={styles.subtitle}>Panel de gestión deportiva</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Inicia Sesión</Text>
        <Text style={styles.cardText}>
          Necesitas una cuenta para gestionar tus equipos, jugadores y partidos.
        </Text>

        <TouchableOpacity 
          style={[styles.googleButton, loading || !request ? styles.buttonDisabled : null]}
          disabled={loading || !request}
          onPress={() => {
            setLoading(true);
            promptAsync();
          }}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              {/* Google logo placeholder or icon */}
              <View style={styles.iconPlaceholder}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.buttonText}>Continuar con Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.slate500,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: COLORS.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.slate100,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.slate800,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.slate500,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  googleButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleG: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
