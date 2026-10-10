import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Zap } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { openSubscribePage } from '../utils/openSubscribePage';

const REASONS = {
  team_limit: {
    title: 'Solo 1 equipo en el plan gratuito',
    description: 'Necesitas el plan Pro para gestionar más de un equipo.',
  },
  match_limit: {
    title: 'Has usado los 8 partidos incluidos',
    description: 'El plan gratuito incluye 8 partidos por equipo. Hazte Pro para partidos ilimitados.',
  },
  feature: {
    title: 'Función exclusiva Pro',
    description: null,
  },
};

const FREE_FEATURES = [
  '1 equipo',
  '8 partidos incluidos',
  'Matriz y convocatoria completas',
];

const PRO_FEATURES = [
  'Equipos ilimitados',
  'Partidos ilimitados',
  'Temporada completa de la FBCV',
  'Sincronizar la plantilla con la FBCV',
  'Futuras funciones premium',
];

export default function PaywallModal({ visible, onClose, reason = 'feature', featureName }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { user } = useAuth();
  const info = REASONS[reason] || REASONS.feature;
  const description = reason === 'feature' && featureName?.trim()
    ? `${featureName} está disponible solo en el plan Pro.`
    : info.description;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Zap color={T.orange} size={14} fill={T.orange} />
              <Text style={styles.badgeText}>PRO</Text>
            </View>
          </View>

          <Text style={styles.title}>{info.title}</Text>
          {description && <Text style={styles.desc}>{description}</Text>}

          <View style={styles.plansRow}>
            {/* Free */}
            <View style={[styles.planCard, styles.planFree]}>
              <Text style={styles.planLabel}>GRATIS</Text>
              <Text style={styles.planPrice}>€0</Text>
              <View style={styles.featureList}>
                {FREE_FEATURES.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Check color={T.textFaint} size={13} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Pro */}
            <LinearGradient colors={[T.ink2, T.ink]} style={[styles.planCard, styles.planPro]}>
              <Text style={[styles.planLabel, { color: T.orange }]}>PRO</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.planPrice, { color: T.white }]}>€1.99</Text>
                <Text style={styles.planPriceSub}>/mes</Text>
              </View>
              <Text style={styles.planPriceAlt}>o €16.99/año</Text>
              <View style={styles.featureList}>
                {PRO_FEATURES.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Check color={T.pos} size={13} />
                    <Text style={[styles.featureText, { color: 'rgba(255,255,255,0.85)' }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => {
              onClose();
              if (user?.uid) openSubscribePage(user.uid);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[T.orange, T.orangeDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Zap color={T.white} size={16} fill={T.white} />
              <Text style={styles.ctaText}>Hazte Pro · €1.99/mes</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Ahora no</Text>
          </TouchableOpacity>

          {/* Rendered last so it paints on top and receives touches */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X color={T.textFaint} size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.panel, alignItems: 'center', justifyContent: 'center',
  },
  badgeRow: { alignItems: 'flex-start', marginBottom: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.orangeSoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: T.rPill,
  },
  badgeText: { fontFamily: T.fontBlack, fontSize: 11, color: T.orange, letterSpacing: 1 },
  title: { fontFamily: T.fontBlack, fontSize: 20, color: T.text, marginBottom: 6 },
  desc: { fontFamily: T.fontReg, fontSize: 14, color: T.textSub, marginBottom: 20 },
  plansRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  planCard: {
    flex: 1, borderRadius: T.rCard, padding: 14,
    borderWidth: 1, borderColor: T.border,
  },
  planFree: { backgroundColor: T.panel },
  planPro: { borderColor: T.ink },
  planLabel: {
    fontFamily: T.fontBlack, fontSize: 9, color: T.textFaint,
    letterSpacing: 1.5, marginBottom: 4,
  },
  planPrice: { fontFamily: T.fontBlack, fontSize: 24, color: T.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPriceSub: { fontFamily: T.fontReg, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  planPriceAlt: {
    fontFamily: T.fontReg, fontSize: 11, color: 'rgba(255,255,255,0.4)',
    marginBottom: 10,
  },
  featureList: { gap: 6, marginTop: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontFamily: T.fontReg, fontSize: 12, color: T.textSub, flex: 1 },
  ctaBtn: { borderRadius: T.rBtnLg, overflow: 'hidden', marginBottom: 12 },
  ctaGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  ctaText: { fontFamily: T.fontBlack, fontSize: 16, color: T.white },
  dismissBtn: { alignItems: 'center', paddingVertical: 8 },
  dismissText: { fontFamily: T.fontSemi, fontSize: 14, color: T.textFaint },
}); }
