import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { COLORS } from '../constants/colors';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// We configure GoogleSignin only for native (Android/iOS)
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    // We MUST use the WEB Client ID here. Firebase uses the Web Client ID to verify the token.
    // The native Android SHA-1 is verified by Google Play Services automatically.
    webClientId: '177594386006-h5j431e2d42tqovb2j60v4r2o3tjsj44.apps.googleusercontent.com', 
    offlineAccess: false,
  });
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Web uses standard Firebase popup
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // Native uses Google Sign-In via Google Play Services
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        
        // V16 of @react-native-google-signin usually returns data in userInfo.data
        const idToken = userInfo.idToken || userInfo?.data?.idToken;
        
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error('No idToken from Google Sign In');
        }
      }
    } catch (error) {
      console.log('Login Error: ', error);
      if (error.code !== 'SIGN_IN_CANCELLED' && error.code !== 12501) {
        Alert.alert("Error de Inicio de Sesión", error.message || "Ocurrió un error al conectar con Google.");
      }
      setLoading(false);
    }
  };

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
          style={[styles.googleButton, loading ? styles.buttonDisabled : null]}
          disabled={loading}
          onPress={handleGoogleSignIn}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
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
