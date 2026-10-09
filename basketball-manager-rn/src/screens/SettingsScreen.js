import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, Info, Menu, Crown, Users, Sun, Moon, Monitor, Bell, BellOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { auth } from '../constants/firebase';
import { signOut } from 'firebase/auth';
import AppDrawer from '../components/AppDrawer';
import { useLayout } from '../hooks/useLayout';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { openSubscribePage, openManagePage } from '../utils/openSubscribePage';
import PaywallModal from '../components/PaywallModal';
import * as ClipboardAPI from 'expo-clipboard';
import { useClub } from '../hooks/useClub';
import { openClubSubscribePage } from '../utils/openSubscribePage';
import JoinClubModal from '../components/JoinClubModal';

export default function SettingsScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { IS_TABLET, IS_TABLET_LANDSCAPE } = useLayout();
  const { isPro, currentPeriodEnd, cancelAtPeriodEnd, clubId, isClubMember, isClubAdmin } = useSubscription();
  const { notifEnabled, toggleNotifications } = useNotifications();
  const { club } = useClub(clubId);
  const { user } = useAuth();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [joinClubVisible, setJoinClubVisible] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => signOut(auth) },
      ]
    );
  };

  const handleExpelMember = (member) => {
    Alert.alert(
      'Expulsar miembro',
      `¿Expulsar a ${member.displayName || member.email} del club?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(
                'https://europe-west3-basketmanager-ed370.cloudfunctions.net/removeMember',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ adminId: user.uid, clubId, memberId: member.uid }),
                }
              );
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Error');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleLeaveClub = () => {
    Alert.alert(
      'Salir del club',
      `Si sales de ${club?.name || 'el club'} perderás el acceso Pro (a menos que tengas un plan individual activo). ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir del club', style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(
                'https://europe-west3-basketmanager-ed370.cloudfunctions.net/leaveClub',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.uid, clubId }),
                }
              );
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Error');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient colors={[T.ink2, T.ink]} style={styles.header}>
        {!IS_TABLET_LANDSCAPE ? (
          <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
            <Menu color="rgba(255,255,255,0.8)" size={20} strokeWidth={1.8} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}
        <Text style={styles.headerTitle}>Ajustes</Text>
      </LinearGradient>

      <ScrollView style={[styles.container, IS_TABLET && styles.containerTablet]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* PLAN section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PLAN</Text>

          {/* State 3: Club Admin */}
          {isClubAdmin && club ? (
            <View style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: T.blueSoft }]}>
                  <Users color={T.blue} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{club.name}</Text>
                  <Text style={styles.rowSub}>
                    {club.tier === 'small' ? 'Club Small' : club.tier === 'medium' ? 'Club Medium' : 'Club Large'} · Admin
                  </Text>
                </View>
                {user?.uid ? (
                  <TouchableOpacity onPress={() => openManagePage(user.uid)} style={styles.manageBtnSmall} activeOpacity={0.7}>
                    <Text style={styles.manageBtnSmallText}>Gestionar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={[styles.row, { gap: 10 }]}>
                <Text style={[styles.rowText, { fontFamily: T.mono, flex: 1, letterSpacing: 1 }]}>
                  {club.inviteCode}
                </Text>
                <TouchableOpacity
                  style={styles.manageBtnSmall}
                  onPress={async () => {
                    await ClipboardAPI.setStringAsync(club.inviteCode);
                    Alert.alert('Copiado', 'Código copiado al portapapeles');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.manageBtnSmallText}>Copiar</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 0 }]}>
                <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>
                  MIEMBROS ({(club.members || []).length}/{club.tier === 'small' ? 10 : club.tier === 'medium' ? 20 : 30})
                </Text>
                {(club.members || []).length === 0 ? (
                  <Text style={styles.rowSub}>Ningún entrenador se ha unido todavía.</Text>
                ) : (
                  (club.members || []).map(member => (
                    <View key={member.uid} style={styles.memberRow}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.displayName || member.email}
                      </Text>
                      <TouchableOpacity onPress={() => handleExpelMember(member)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.expelText}>Expulsar</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {user?.uid ? (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => openClubSubscribePage(user.uid, clubId, club.tier)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[T.ink2, T.ink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeBtnGrad}
                  >
                    <Text style={styles.upgradeBtnText}>Cambiar tier del club</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </View>

          /* State 4: Club Member (not admin) */
          ) : isClubMember && club ? (
            <View style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: T.blueSoft }]}>
                  <Users color={T.blue} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>Miembro de {club.name}</Text>
                  <Text style={styles.rowSub}>Pro activo · a través del club</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.row, { borderColor: T.neg + '40', borderWidth: 1.5 }]}
                onPress={handleLeaveClub}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, { color: T.neg }]}>Salir del club</Text>
                </View>
              </TouchableOpacity>
            </View>

          /* State 2: Individual Pro, no club */
          ) : isPro ? (
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: T.orangeSoft }]}>
                <Crown color={T.orange} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>Plan Pro</Text>
                <Text style={styles.rowSub}>
                  {cancelAtPeriodEnd
                    ? `Cancelado · activo hasta ${currentPeriodEnd?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '—'}`
                    : `Activo hasta ${currentPeriodEnd?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '—'}`}
                </Text>
              </View>
              {user?.uid ? (
                <TouchableOpacity onPress={() => openManagePage(user.uid)} style={styles.manageBtnSmall} activeOpacity={0.7}>
                  <Text style={styles.manageBtnSmallText}>Gestionar</Text>
                </TouchableOpacity>
              ) : null}
            </View>

          /* State 1: Free, no club */
          ) : (
            <>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: T.panel }]}>
                  <Crown color={T.textFaint} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>Plan Gratuito</Text>
                  <Text style={styles.rowSub}>1 equipo · 8 partidos incluidos</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.upgradeBtn} onPress={() => setPaywallVisible(true)} activeOpacity={0.85}>
                <LinearGradient colors={[T.orange, T.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.upgradeBtnGrad}>
                  <Crown color={T.white} size={15} />
                  <Text style={styles.upgradeBtnText}>Ver plan Pro · €1.99/mes</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.joinClubBtn} onPress={() => setJoinClubVisible(true)} activeOpacity={0.7}>
                <Text style={styles.joinClubText}>¿Tienes un código de club? Únete →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CUENTA</Text>
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: T.negSoft }]}>
              <LogOut color={T.neg} size={18} />
            </View>
            <Text style={[styles.rowText, { color: T.neg }]}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICACIONES</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => toggleNotifications(!notifEnabled)}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, { backgroundColor: notifEnabled ? T.orangeSoft : T.panel }]}>
              {notifEnabled
                ? <Bell color={T.orange} size={18} />
                : <BellOff color={T.textFaint} size={18} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Avisos de partido</Text>
              <Text style={styles.rowSub}>
                {notifEnabled ? 'Activados' : 'Desactivados'}
              </Text>
            </View>
            <View style={[styles.notifToggle, { backgroundColor: notifEnabled ? T.orange : T.borderHard }]}>
              <View style={[styles.notifThumb, { marginLeft: notifEnabled ? 18 : 2 }]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APARIENCIA</Text>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: T.isDark ? '#1D2844' : T.blueSoft }]}>
              {T.isDark
                ? <Moon color={T.blue} size={18} />
                : <Sun color={T.blue} size={18} />}
            </View>
            <Text style={[styles.rowText, { flex: 1 }]}>Tema</Text>
          </View>
          <View style={styles.themeSegmented}>
            {[
              { mode: 'light',  label: 'Claro',   Icon: Sun },
              { mode: 'dark',   label: 'Oscuro',  Icon: Moon },
              { mode: 'system', label: 'Sistema', Icon: Monitor },
            ].map(({ mode, label, Icon }) => {
              const active = T.themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeSegBtn, active && styles.themeSegBtnActive]}
                  onPress={() => T.setTheme(mode)}
                  activeOpacity={0.75}
                >
                  <Icon
                    color={active ? T.orange : T.textFaint}
                    size={14}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <Text style={[styles.themeSegText, active && styles.themeSegTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INFORMACIÓN</Text>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: T.blueSoft }]}>
              <Info color={T.blue} size={18} />
            </View>
            <View>
              <Text style={styles.rowText}>partits. v2.0</Text>
              <Text style={styles.rowSub}>FBCV · Pasarela</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} navigation={navigation} />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        reason="feature"
        featureName="Plan Pro"
      />
      <JoinClubModal
        visible={joinClubVisible}
        onClose={() => setJoinClubVisible(false)}
        onJoined={(name) => Alert.alert('¡Bienvenido!', `Te has unido al club ${name}.`)}
      />
    </SafeAreaView>
  );
}

function makeStyles(T) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
  },
  menuBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: T.fontBlack, fontSize: 20, color: T.onDark, flex: 1 },

  container: { flex: 1, padding: 20, paddingTop: 28 },
  containerTablet: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  section: { marginBottom: 32 },
  sectionLabel: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.white, padding: 16, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontFamily: T.fontSemi, fontSize: 15, color: T.text },
  rowSub: { fontFamily: T.fontReg, fontSize: 11, color: T.textFaint, marginTop: 1 },
  manageBtnSmall: {
    backgroundColor: T.panel, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: T.rBtn,
  },
  manageBtnSmallText: { fontFamily: T.fontSemi, fontSize: 12, color: T.textSub },
  upgradeBtn: { borderRadius: T.rBtn, overflow: 'hidden', marginTop: 8 },
  upgradeBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  upgradeBtnText: { fontFamily: T.fontSemi, fontSize: 14, color: T.white },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  memberName: { fontFamily: T.fontMed, fontSize: 14, color: T.text, flex: 1 },
  expelText: { fontFamily: T.fontSemi, fontSize: 12, color: T.neg },
  joinClubBtn: { alignItems: 'center', paddingVertical: 10 },
  joinClubText: { fontFamily: T.fontMed, fontSize: 13, color: T.blue },

  // Notification toggle
  notifToggle: {
    width: 42, height: 24, borderRadius: 12, justifyContent: 'center',
  },
  notifThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },

  // Theme toggle
  themeSegmented: {
    flexDirection: 'row',
    backgroundColor: T.panelDeep,
    borderRadius: T.rBtn,
    padding: 3,
    marginTop: 8,
    gap: 2,
    borderWidth: 1, borderColor: T.border,
  },
  themeSegBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 8,
  },
  themeSegBtnActive: {
    backgroundColor: T.white,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  themeSegText: { fontFamily: T.fontSemi, fontSize: 12, color: T.textFaint },
  themeSegTextActive: { color: T.orange },
}); }
