import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Modal, Alert, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Calendar, Settings, LogOut, HelpCircle, Users, Play } from 'lucide-react-native';
import { auth } from '../constants/firebase';
import { signOut } from 'firebase/auth';
import Svg, {
  Defs, Pattern as SvgPattern, Path as SvgPath, Rect as SvgRect,
} from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { useTeams } from '../hooks/useTeams';
import { useAllMatches } from '../hooks/useAllMatches';
import { useLayout } from '../hooks/useLayout';
import { useSubscription } from '../hooks/useSubscription';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 300);

export default function AppDrawer({ visible, onClose = () => {}, navigation, persistent = false }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const { teams, loading: teamsLoading } = useTeams();
  const { matches } = useAllMatches();
  const { IS_TABLET_LANDSCAPE } = useLayout();
  const { isPro, isClubAdmin, isClubMember } = useSubscription();

  const nextMatchByTeam = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const map = {};
    teams.forEach(t => {
      const upcoming = matches
        .filter(m => m.teamId === t.id && m.state !== 'finished' && m.date >= todayStr)
        .sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
      map[t.id] = upcoming[0] || null;
    });
    return map;
  }, [teams, matches]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.52, duration: 220, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH, useNativeDriver: true, tension: 80, friction: 13,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  const navTo = useCallback((screenName, params) => {
    onClose();
    if (navigation.isReady && !navigation.isReady()) return;
    if (persistent) {
      navigation.navigate(screenName, params);
    } else {
      setTimeout(() => navigation.navigate(screenName, params), 130);
    }
  }, [navigation, onClose, persistent]);

  const handleLogout = useCallback(() => {
    const doSignOut = () => signOut(auth);
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) { onClose(); doSignOut(); }
      return;
    }
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => { onClose(); doSignOut(); } },
    ]);
  }, [onClose]);

  const sidebarContent = () => (
    <>
      {/* Brand */}
      <View style={styles.brandSection}>
        <Image
          source={require('../../assets/icon-white.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>
            partits<Text style={{ color: T.orange }}>.</Text>
          </Text>
          <Text style={styles.brandSub}>Gestor Basket · v2.0</Text>
          <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeFree]}>
            <Text style={[styles.planBadgeText, isPro ? styles.planBadgeTextPro : styles.planBadgeTextFree]}>
              {isPro ? (isClubAdmin ? 'Club Admin' : isClubMember ? 'Club Pro' : 'Pro') : 'Gratuito'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Mis Equipos */}
      <TouchableOpacity style={styles.navItem} onPress={() => navTo('TeamsTab')}>
        <View style={styles.navIconBox}>
          <Home color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Mis Equipos</Text>
      </TouchableOpacity>

      {/* Team cards */}
      {!teamsLoading && teams.map(team => {
        const nextMatch = nextMatchByTeam[team.id];
        const formattedDate = nextMatch
          ? new Date(nextMatch.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
          : null;
        return (
          <TouchableOpacity key={team.id} style={styles.teamCard} onPress={() => navTo('TeamDetail', { teamId: team.id })} activeOpacity={0.75}>
            <View style={styles.teamCardHeader}>
              <View style={styles.teamDot} />
              <Text style={styles.teamCardName} numberOfLines={1}>{team.name}</Text>
            </View>
            {nextMatch ? (
              <>
                <Text style={styles.teamCardMatchText} numberOfLines={1}>
                  {nextMatch.isHome ? '🏠' : (nextMatch.transportType === 'car' ? '🚗' : '🚌')} {nextMatch.opponent} · {formattedDate} · {nextMatch.time}h
                </Text>
                <View style={styles.teamCardActions}>
                  <TouchableOpacity
                    style={styles.teamCardBtn}
                    onPress={() => navTo('MatchAttendance', { matchId: nextMatch.id, teamId: team.id })}
                  >
                    <Users size={12} color="rgba(255,255,255,0.65)" strokeWidth={1.8} />
                    <Text style={styles.teamCardBtnText}>Asistencia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.teamCardBtn, styles.teamCardBtnAccent]}
                    onPress={() => navTo('MatchMatrix', { matchId: nextMatch.id, teamId: team.id })}
                  >
                    <Play size={11} color={T.orange} strokeWidth={2} fill={T.orange} />
                    <Text style={[styles.teamCardBtnText, { color: T.orange }]}>Partido</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.teamCardEmpty}>Sin partidos próximos</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('Calendar')}>
        <View style={styles.navIconBox}>
          <Calendar color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Calendario</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('Help')}>
        <View style={styles.navIconBox}>
          <HelpCircle color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Cómo usar</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={() => navTo('SettingsTab')}>
        <View style={styles.navIconBox}>
          <Settings color="rgba(255,255,255,0.75)" size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.navLabel}>Ajustes</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      <View style={styles.divider} />

      <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
        <View style={[styles.navIconBox, styles.logoutIconBox]}>
          <LogOut color={T.neg} size={17} strokeWidth={1.8} />
        </View>
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      </TouchableOpacity>
    </>
  );

  // Persistent sidebar mode — plain View, no animation, no modal
  if (persistent) {
    return (
      <View style={styles.persistentSidebar}>
        <LinearGradient
          colors={[T.ink2, T.ink]}
          style={[styles.drawerInner, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Grid bg — same as modal version */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgPattern id="dgp" width="14" height="14" patternUnits="userSpaceOnUse">
                  <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
                </SvgPattern>
              </Defs>
              <SvgRect width="100%" height="100%" fill="url(#dgp)" opacity={0.05} />
            </Svg>
          </View>
          {sidebarContent()}
        </LinearGradient>
      </View>
    );
  }

  // In tablet landscape, the persistent sidebar (rendered by RootNavigation) is shown.
  // This instance (opened from a screen as a modal) should render nothing.
  if (IS_TABLET_LANDSCAPE) {
    return null;
  }

  // Modal mode — existing code follows unchanged
  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap to close */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={onClose}
        activeOpacity={1}
      >
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0B0E14', opacity: backdropOpacity }]}
        />
      </TouchableOpacity>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <LinearGradient
          colors={[T.ink2, T.ink]}
          style={[styles.drawerInner, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}
        >
          {/* Grid bg */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgPattern id="dg" width="14" height="14" patternUnits="userSpaceOnUse">
                  <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
                </SvgPattern>
              </Defs>
              <SvgRect width="100%" height="100%" fill="url(#dg)" opacity={0.05} />
            </Svg>
          </View>
          {sidebarContent()}
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH,
  },
  drawerInner: {
    flex: 1,
  },
  persistentSidebar: {
    width: DRAWER_WIDTH,
    height: '100%',
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  brandLogo: {
    width: 48,
    height: 48,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontFamily: T.fontBlack,
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  brandSub: {
    fontFamily: T.fontMed,
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
    marginVertical: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  navIconBox: {
    width: 32, height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: {
    fontFamily: T.fontSemi,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  logoutIconBox: {
    backgroundColor: 'rgba(229,72,72,0.12)',
  },
  logoutLabel: {
    fontFamily: T.fontSemi,
    fontSize: 15,
    color: T.neg,
    letterSpacing: 0.2,
  },

  teamCard: {
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  teamDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.orange,
  },
  teamCardName: {
    fontFamily: T.fontSemi,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
  teamCardMatchText: {
    fontFamily: T.fontReg,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    paddingLeft: 12,
  },
  teamCardActions: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 12,
  },
  teamCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  teamCardBtnAccent: {
    backgroundColor: 'rgba(255,106,44,0.18)',
  },
  teamCardBtnText: {
    fontFamily: T.fontSemi,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
  teamCardEmpty: {
    fontFamily: T.fontReg,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    paddingLeft: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },

  planBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: T.rPill,
  },
  planBadgePro: { backgroundColor: T.orange },
  planBadgeFree: { backgroundColor: 'rgba(255,255,255,0.1)' },
  planBadgeText: { fontFamily: T.fontBlack, fontSize: 10, letterSpacing: 0.5 },
  planBadgeTextPro: { color: '#fff' },
  planBadgeTextFree: { color: 'rgba(255,255,255,0.45)' },
}); }
