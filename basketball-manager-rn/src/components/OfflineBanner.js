// src/components/OfflineBanner.js
import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function OfflineBanner({ isOnline, syncMessage }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const shouldShow = !isOnline || !!syncMessage;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: shouldShow ? 36 : 0,
      duration: 220,
      useNativeDriver: false, // height can't use native driver
    }).start();
  }, [shouldShow]);

  const isSync = !!syncMessage;

  return (
    <Animated.View
      style={[
        styles.banner,
        isSync ? styles.bannerSync : styles.bannerOffline,
        { height: heightAnim, overflow: 'hidden' },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.bannerText}>
        {isSync ? syncMessage : 'Sin conexión · Los cambios se guardarán al reconectar'}
      </Text>
    </Animated.View>
  );
}

function makeStyles(T) { return StyleSheet.create({
  banner: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bannerOffline: {
    backgroundColor: '#92400E',
  },
  bannerSync: {
    backgroundColor: T.posDark,
  },
  bannerText: {
    fontFamily: T.fontSemi,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.2,
  },
}); }
