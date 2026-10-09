import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useTheme } from '../theme/ThemeContext';
import Svg, { Rect } from 'react-native-svg';

if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: '177594386006-7969dbqtjmp5uun0d9rk7du66mel9vaj.apps.googleusercontent.com',
    offlineAccess: false,
  });
}

const GridDots = () => {
  const dots = [];
  for (let r = 0; r < 22; r++) {
    for (let c = 0; c < 16; c++) {
      dots.push(<Rect key={`${r}-${c}`} x={c * 26} y={r * 26} width={2} height={2} fill="white" rx={1} />);
    }
  }
  return (
    <Svg style={[StyleSheet.absoluteFill, { opacity: 0.05 }]} width="100%" height="100%">
      {dots}
    </Svg>
  );
};

export default function LoginScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.idToken || userInfo?.data?.idToken;
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error('No idToken from Google Sign In');
        }
      }
    } catch (error) {
      if (error.code !== 'SIGN_IN_CANCELLED' && error.code !== 12501) {
        Alert.alert('Error de Inicio de Sesión', error.message || 'Ocurrió un error al conectar con Google.');
      }
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[T.ink2, T.ink]} style={styles.bg}>
      <GridDots />
      <View style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>🏀</Text>
          </View>
          <Text style={styles.brandName}>partits.</Text>
          <Text style={styles.brandSub}>GESTOR BASKET PASARELA</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inicia Sesión</Text>
          <Text style={styles.cardText}>
            Necesitas una cuenta para gestionar tus equipos, jugadores y partidos.
          </Text>

          <TouchableOpacity
            style={[styles.googleBtnWrap, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[T.orange, T.orangeDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.googleBtnGrad}
            >
              {loading ? (
                <ActivityIndicator color={T.white} />
              ) : (
                <>
                  <View style={styles.gIconBox}>
                    <Text style={styles.gLetter}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continuar con Google</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>FBCV · Pasarela · 2025–26</Text>
      </View>
    </LinearGradient>
  );
}

function makeStyles(T) { return StyleSheet.create({
  bg: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  brand: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 76, height: 76, borderRadius: T.rCardLg,
    backgroundColor: 'rgba(255,106,44,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  logoEmoji: { fontSize: 38 },
  brandName: { fontFamily: T.fontBlack, fontSize: 44, color: T.white, letterSpacing: -1 },
  brandSub: { fontFamily: T.fontSemi, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 2.5, marginTop: 4 },

  card: {
    width: '100%', maxWidth: 420, backgroundColor: T.white, borderRadius: T.rCardLg,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 36, elevation: 24,
  },
  cardTitle: { fontFamily: T.fontBold, fontSize: 20, color: T.text, marginBottom: 8 },
  cardText: {
    fontFamily: T.fontReg, fontSize: 14, color: T.textSub, textAlign: 'center',
    lineHeight: 20, marginBottom: 28,
  },

  googleBtnWrap: { width: '100%', borderRadius: T.rBtn, overflow: 'hidden' },
  googleBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24,
  },
  gIconBox: {
    width: 24, height: 24, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  gLetter: { fontFamily: T.fontBold, color: T.white, fontSize: 14 },
  googleBtnText: { fontFamily: T.fontSemi, color: T.white, fontSize: 16 },

  footer: { fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 44, letterSpacing: 1 },
}); }
