import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_HELP } from '../constants/helpContent';

export default function HelpModal({ visible, onClose, screenKey }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [rendered, setRendered] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 0.5, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 400, useNativeDriver: true, tension: 80, friction: 13 }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setRendered(false); });
    }
  }, [visible]);

  if (!rendered) return null;

  const content = SCREEN_HELP[screenKey];
  if (!content) return null;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0B0E14', opacity: backdropOpacity }]} />
      </TouchableOpacity>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{content.title}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {content.sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionText}>{section.text}</Text>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#0F1826',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  title: {
    fontFamily: T.fontBlack, fontSize: 20, color: T.white,
    letterSpacing: -0.3, marginBottom: 20,
  },
  scroll: { flexShrink: 1 },
  section: {
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: T.rCard, padding: 16,
    borderLeftWidth: 3, borderLeftColor: T.orange,
  },
  sectionHeading: {
    fontFamily: T.fontSemi, fontSize: 12, color: T.orange,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  sectionText: {
    fontFamily: T.fontReg, fontSize: 14,
    color: 'rgba(255,255,255,0.75)', lineHeight: 21,
  },
}); }
