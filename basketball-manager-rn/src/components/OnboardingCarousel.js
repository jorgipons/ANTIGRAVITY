import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { ONBOARDING_SLIDES } from '../constants/helpContent';

const { width: W, height: H } = Dimensions.get('window');

export default function OnboardingCarousel({ visible, onDismiss }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goNext = useCallback(() => {
    if (activeIndex < ONBOARDING_SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      onDismiss();
    }
  }, [activeIndex, onDismiss]);

  const onViewableChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = useCallback(({ item }) => (
    <View style={styles.slide}>
      <Text style={styles.slideIcon}>{item.icon}</Text>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideBody}>{item.body}</Text>
    </View>
  ), []);

  const isLast = activeIndex === ONBOARDING_SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <LinearGradient colors={[T.ink2, T.ink, '#0B1E40']} style={styles.container}>
        <TouchableOpacity style={styles.skipBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>

        <FlatList
          ref={flatRef}
          data={ONBOARDING_SLIDES}
          keyExtractor={item => item.key}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableChanged}
          viewabilityConfig={viewConfig}
          style={styles.list}
        />

        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          {activeIndex > 0 ? (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => flatRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true })}
              activeOpacity={0.7}
            >
              <Text style={styles.prevText}>Anterior</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            style={[styles.nextBtn, isLast && styles.nextBtnLast]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>{isLast ? '¡Empezar!' : 'Siguiente'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  container: { flex: 1 },

  skipBtn: {
    position: 'absolute',
    top: 56, right: 24, zIndex: 10,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: T.rPill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipText: { fontFamily: T.fontMed, fontSize: 14, color: 'rgba(255,255,255,0.65)' },

  list: { flex: 1 },

  slide: {
    width: W,
    flex: 1,
    paddingHorizontal: 36,
    paddingTop: H * 0.18,
    paddingBottom: 40,
    alignItems: 'center',
  },
  slideIcon: { fontSize: 56, marginBottom: 28 },
  slideTitle: {
    fontFamily: T.fontBlack, fontSize: 26, color: T.white,
    textAlign: 'center', letterSpacing: -0.4, marginBottom: 16,
  },
  slideBody: {
    fontFamily: T.fontReg, fontSize: 16, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', lineHeight: 24,
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 28 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: T.orange, width: 20 },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 48, gap: 12,
  },
  prevBtn: {
    flex: 1, paddingVertical: 15,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: T.rBtn, alignItems: 'center',
  },
  prevText: { fontFamily: T.fontSemi, fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  nextBtn: { flex: 2, paddingVertical: 15, backgroundColor: T.orange, borderRadius: T.rBtn, alignItems: 'center' },
  nextBtnLast: { backgroundColor: T.pos },
  nextText: { fontFamily: T.fontSemi, fontSize: 15, color: T.white },
}); }
