import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  Dimensions, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const OVERLAY_COLOR = 'rgba(0,0,0,0.72)';
const PAD = 8;

export default function GuidedTourOverlay({ steps, visible, onClose, scrollRef, scrollOffsetRef }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [currentStep, setCurrentStep] = useState(0);
  const [spot, setSpot] = useState(null);
  const overlayAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(0.5)).current;
  const pulseLoopRef = useRef(null);
  const containerRef = useRef(null);

  const measureStep = (stepIndex) => {
    const step = steps[stepIndex];
    if (!step?.ref?.current || !containerRef.current) { setSpot(null); return; }

    // Measure the overlay container first so we can convert window coordinates
    // to overlay-local coordinates. This handles the iOS safe-area offset where
    // measureInWindow may return coords relative to the safe-area content origin
    // rather than the physical screen top.
    containerRef.current.measureInWindow((ox, oy) => {
      // Effective overlay height from its top to the screen bottom
      const OH = SCREEN_H - oy;

      if (!scrollRef?.current) {
        step.ref.current.measureInWindow((x, y, w, h) => {
          const ry = y - oy;
          if (w === 0 || h === 0 || ry < 0 || ry + h > OH) setSpot(null);
          else setSpot({ x: x - ox, y: ry, w, h });
        });
        return;
      }

      // Measure the scroll container, then the element
      scrollRef.current.measureInWindow((scx, scy, scw, sch) => {
        const cy = scy - oy; // scroll container top in overlay coords

        step.ref.current.measureInWindow((x, y, w, h) => {
          if (w === 0 || h === 0) { setSpot(null); return; }

          const ry = y - oy; // element y in overlay coords
          const rx = x - ox;

          // Fully visible within the scroll container
          const inContainer = ry >= cy && ry + h <= cy + sch;
          // Fixed header: above the scroll container
          const isFixedHeader = ry >= 0 && ry + h <= cy;

          if (inContainer || isFixedHeader) {
            setSpot({ x: rx, y: ry, w, h });
            return;
          }

          // May be scroll content below the visible area, or a fixed element
          // outside the container (e.g. bottom bar). Try scrolling first.
          const currentOffset = scrollOffsetRef?.current ?? 0;
          const relY = (ry - cy) + currentOffset;
          const targetY = Math.max(0, relY - (sch - h) / 2);

          scrollRef.current.scrollTo({ y: targetY, animated: true });

          setTimeout(() => {
            if (!step.ref.current || !containerRef.current) { setSpot(null); return; }
            containerRef.current.measureInWindow((ox2, oy2) => {
              const OH2 = SCREEN_H - oy2;
              step.ref.current.measureInWindow((x2, y2, w2, h2) => {
                if (w2 === 0 || h2 === 0) { setSpot(null); return; }
                if (!scrollRef.current) { setSpot(null); return; }
                scrollRef.current.measureInWindow((_sx, scy2, _sw, sch2) => {
                  const cy2 = scy2 - oy2;
                  const ry2 = y2 - oy2;
                  const rx2 = x2 - ox2;
                  if (ry2 >= cy2 && ry2 + h2 <= cy2 + sch2) {
                    // Now visible inside the scroll container
                    setSpot({ x: rx2, y: ry2, w: w2, h: h2 });
                  } else if (ry2 + h2 <= cy2 || (ry2 >= cy2 + sch2 && ry2 + h2 <= OH2)) {
                    // Element didn't move with scroll → fixed element (header or bottom bar)
                    setSpot({ x: rx2, y: ry2, w: w2, h: h2 });
                  } else {
                    setSpot(null);
                  }
                });
              });
            });
          }, 500);
        });
      });
    });
  };

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setSpot(null);
      scrollRef?.current?.scrollTo({ y: 0, animated: false });
      overlayAnim.setValue(0);
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      pulseLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]));
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      overlayAnim.setValue(0);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => measureStep(currentStep), 150);
    return () => clearTimeout(timer);
  }, [visible, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  if (!visible || !steps?.length) return null;

  const step = steps[currentStep];

  const hasSpot = spot !== null;
  const spotX = hasSpot ? Math.max(0, spot.x - PAD) : 0;
  const spotY = hasSpot ? Math.max(0, spot.y - PAD) : 0;
  const spotW = hasSpot ? spot.w + PAD * 2 : SCREEN_W;
  const spotH = hasSpot ? spot.h + PAD * 2 : SCREEN_H;

  const tooltipPos = !hasSpot
    ? { top: SCREEN_H / 2 - 80 }
    : spotY <= SCREEN_H / 2
      ? { top: spotY + spotH + 12 }
      : { bottom: SCREEN_H - spotY + 12 };

  const isFirst = currentStep === 0;
  const isLast  = currentStep === steps.length - 1;

  return (
    <View ref={containerRef} style={styles.container} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: overlayAnim }]} pointerEvents="box-none">

        {/* Dark rects — block background touches */}
        <View style={[styles.rect, { top: 0, left: 0, right: 0, height: hasSpot ? spotY : SCREEN_H }]} />
        {hasSpot && (
          <View style={[styles.rect, { top: spotY + spotH, left: 0, right: 0, bottom: 0 }]} />
        )}
        {hasSpot && (
          <View style={[styles.rect, { top: spotY, left: 0, width: spotX, height: spotH }]} />
        )}
        {hasSpot && (
          <View style={[styles.rect, { top: spotY, left: spotX + spotW, right: 0, height: spotH }]} />
        )}

        {/* Pulsing border around spotlight */}
        {hasSpot && (
          <Animated.View
            style={[styles.spotBorder, { top: spotY, left: spotX, width: spotW, height: spotH, opacity: pulseAnim }]}
            pointerEvents="none"
          />
        )}

        {/* Tooltip */}
        <View style={[styles.tooltip, tooltipPos]}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipTitle}>{step.title}</Text>
            <Text style={styles.tooltipCounter}>{currentStep + 1} / {steps.length}</Text>
          </View>
          <Text style={styles.tooltipText}>{step.text}</Text>

          <View style={styles.tooltipFooter}>
            <TouchableOpacity
              onPress={handlePrev}
              style={[styles.navBtnText, isFirst && styles.navBtnDisabled]}
              disabled={isFirst}
            >
              <ChevronLeft color={isFirst ? 'rgba(255,255,255,0.2)' : '#fff'} size={16} strokeWidth={2} />
              <Text style={[styles.navBtnLabel, isFirst && { color: 'rgba(255,255,255,0.2)' }]}>Anterior</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="rgba(255,255,255,0.55)" size={14} strokeWidth={2} />
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNext} style={styles.navBtnText}>
              {isLast
                ? <Text style={styles.finishText}>✓</Text>
                : <>
                    <Text style={styles.navBtnLabel}>Siguiente</Text>
                    <ChevronRight color="#fff" size={16} strokeWidth={2} />
                  </>}
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

function makeStyles(T) { return StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  rect: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  spotBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: T.orange,
    borderRadius: 8,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F1826',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tooltipTitle: {
    fontFamily: T.fontBold,
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  tooltipCounter: {
    fontFamily: T.fontMed,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginLeft: 10,
  },
  tooltipText: {
    fontFamily: T.fontReg,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
    marginBottom: 16,
  },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navBtnText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navBtnLabel: {
    fontFamily: T.fontSemi,
    fontSize: 12,
    color: '#fff',
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  closeBtnText: {
    fontFamily: T.fontSemi,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  finishText: {
    color: T.orange,
    fontSize: 16,
    fontFamily: T.fontBold,
  },
}); }
