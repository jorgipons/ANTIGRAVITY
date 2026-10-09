import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import Svg, { Defs, Pattern as SvgPattern, Path as SvgPath, Rect as SvgRect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

function GridPattern() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgPattern id="cmgrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <SvgPath d="M14 0 L0 0 0 14" fill="none" stroke="white" strokeWidth="0.5" />
          </SvgPattern>
        </Defs>
        <SvgRect width="100%" height="100%" fill="url(#cmgrid)" opacity={0.05} />
      </Svg>
    </View>
  );
}

const EMPTY_FORM = {
  opponent: '',
  date: '',
  time: '',
  callTime: '',
  matchDay: '',
  location: '',
  isHome: true,
  departureTime: '',
  transportType: 'car',
  departureLocation: '',
  returnTime: '',
  observations: '',
};

function freshForm() {
  return { ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] };
}

export default function CreateMatchModal({ visible, onClose, team, addMatch, onCreated }) {
  const T = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const [form, setForm] = useState(freshForm());
  const [submitting, setSubmitting] = useState(false);

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const handleCreate = async () => {
    if (!form.opponent.trim() || !form.date.trim() || !form.time.trim()) {
      Alert.alert('Error', 'Rival, fecha y hora son obligatorios');
      return;
    }
    setSubmitting(true);
    try {
      const initialPlayers = team?.players ? [...team.players] : [];
      const newMatchId = await addMatch({ ...form, players: initialPlayers });
      setForm(freshForm());
      onClose();
      onCreated?.(newMatchId);
    } catch (e) {
      console.error('CreateMatchModal error:', e);
      Alert.alert('Error', 'No se pudo crear el partido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setForm(freshForm());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          {/* Header */}
          <LinearGradient
            colors={[T.ink2, T.ink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.header}
          >
            <GridPattern />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={s.eyebrow}>NUEVO PARTIDO</Text>
                <Text style={s.title}>{team?.name || 'Equipo'}</Text>
              </View>
              <TouchableOpacity style={s.quickSaveBtn} onPress={handleCreate} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.quickSaveText}>Crear</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
              {['Rival', 'Fecha y hora', 'Ubicación', 'Viaje'].map((label, i) => (
                <View key={label} style={{ flex: 1, gap: 4 }}>
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: T.orange }} />
                  <Text style={{ fontSize: 9, fontFamily: T.fontBold, color: '#fff', letterSpacing: 0.5 }}>
                    0{i + 1} · {label}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Form */}
          <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 12 }}>

              {/* Card 01 — Rival */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardNum}>01</Text>
                  <Text style={s.cardTitle}>Rival</Text>
                </View>
                <TextInput
                  style={s.input}
                  placeholder="Nombre del equipo rival"
                  placeholderTextColor={T.textFaint}
                  value={form.opponent}
                  onChangeText={t => set({ opponent: t })}
                />
              </View>

              {/* Card 02 — Fecha y hora */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardNum}>02</Text>
                  <Text style={s.cardTitle}>Fecha y hora</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Fecha</Text>
                    <TextInput
                      style={[s.input, { fontFamily: T.mono }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={T.textFaint}
                      value={form.date}
                      onChangeText={t => set({ date: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Hora inicio</Text>
                    <TextInput
                      style={[s.input, { fontFamily: T.mono }]}
                      placeholder="10:00"
                      placeholderTextColor={T.textFaint}
                      value={form.time}
                      onChangeText={t => set({ time: t })}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Convocatoria</Text>
                    <TextInput
                      style={[s.input, { fontFamily: T.mono }]}
                      placeholder="--:--"
                      placeholderTextColor={T.textFaint}
                      value={form.callTime}
                      onChangeText={t => set({ callTime: t })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Jornada</Text>
                    <TextInput
                      style={s.input}
                      placeholder="—"
                      placeholderTextColor={T.textFaint}
                      keyboardType="numeric"
                      value={form.matchDay}
                      onChangeText={t => set({ matchDay: t })}
                    />
                  </View>
                </View>
              </View>

              {/* Card 03 — Ubicación y localía */}
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardNum}>03</Text>
                  <Text style={s.cardTitle}>Ubicación</Text>
                </View>
                <Text style={s.label}>Pabellón</Text>
                <TextInput
                  style={s.input}
                  placeholder="Nombre del pabellón"
                  placeholderTextColor={T.textFaint}
                  value={form.location}
                  onChangeText={t => set({ location: t })}
                />
                <View style={[s.segmented, { marginTop: 10 }]}>
                  <TouchableOpacity
                    style={[s.segBtn, form.isHome && s.segBtnActive]}
                    onPress={() => set({ isHome: true })}
                  >
                    <Text style={[s.segBtnText, form.isHome && s.segBtnTextActive]}>LOCAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.segBtn, !form.isHome && s.segBtnActiveOrange]}
                    onPress={() => set({ isHome: false })}
                  >
                    <Text style={[s.segBtnText, !form.isHome && s.segBtnTextOrange]}>VISITANTE</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card 04 — Desplazamiento (solo visitante) */}
              {!form.isHome && (
                <View style={[s.card, { borderColor: T.orange + '40', borderWidth: 1.5 }]}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardNum}>04</Text>
                    <Text style={s.cardTitle}>Desplazamiento</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Hora salida</Text>
                      <TextInput
                        style={[s.input, { fontFamily: T.mono }]}
                        placeholder="--:--"
                        placeholderTextColor={T.textFaint}
                        value={form.departureTime}
                        onChangeText={t => set({ departureTime: t })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Transporte</Text>
                      <View style={s.transportToggle}>
                        <TouchableOpacity
                          style={[s.transportBtn, form.transportType === 'bus' && s.transportBtnActive]}
                          onPress={() => set({ transportType: 'bus' })}
                        >
                          <Text style={{ fontSize: 20 }}>🚌</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.transportBtn, form.transportType === 'car' && s.transportBtnActive]}
                          onPress={() => set({ transportType: 'car' })}
                        >
                          <Text style={{ fontSize: 20 }}>🚗</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Lugar salida</Text>
                      <TextInput
                        style={s.input}
                        placeholder="Pabellón..."
                        placeholderTextColor={T.textFaint}
                        value={form.departureLocation}
                        onChangeText={t => set({ departureLocation: t })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>Hora vuelta</Text>
                      <TextInput
                        style={[s.input, { fontFamily: T.mono }]}
                        placeholder="--:--"
                        placeholderTextColor={T.textFaint}
                        value={form.returnTime}
                        onChangeText={t => set({ returnTime: t })}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Observaciones */}
              <View style={s.card}>
                <Text style={s.label}>Observaciones</Text>
                <TextInput
                  style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Indicar ropa, material, etc."
                  placeholderTextColor={T.textFaint}
                  value={form.observations}
                  onChangeText={t => set({ observations: t })}
                />
              </View>

              {/* Footer */}
              <View style={s.footer}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose} disabled={submitting}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleCreate}
                  disabled={submitting}
                >
                  <LinearGradient
                    colors={[T.orange, T.orangeDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: T.rBtnLg }]}
                  />
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Check color="#fff" size={15} strokeWidth={2} /><Text style={s.saveBtnText}>Crear partido</Text></>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,14,20,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', overflow: 'hidden',
  },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, overflow: 'hidden' },
  eyebrow: { fontSize: 9, fontFamily: T.fontBold, color: T.orange, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 17, fontFamily: T.fontBlack, color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  quickSaveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: T.rPill, backgroundColor: T.orange },
  quickSaveText: { fontSize: 12, fontFamily: T.fontBold, color: '#fff' },

  card: {
    backgroundColor: T.bg, borderRadius: T.rCard,
    borderWidth: 1, borderColor: T.border, padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardNum: { fontSize: 10, fontFamily: T.monoBold, color: T.orange },
  cardTitle: { fontSize: 13, fontFamily: T.fontBlack, color: T.text },
  label: { fontSize: 11, fontFamily: T.fontBold, color: T.text, marginBottom: 5, letterSpacing: -0.1 },
  input: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: T.fontSemi, color: T.text,
  },

  segmented: {
    flexDirection: 'row', backgroundColor: T.panel,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: T.border,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: {
    backgroundColor: T.bg,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  segBtnActiveOrange: { backgroundColor: T.orangeSoft, borderWidth: 1.5, borderColor: T.orange },
  segBtnText: { fontSize: 12, fontFamily: T.fontBold, color: T.textSub, letterSpacing: 0.4 },
  segBtnTextActive: { color: T.text },
  segBtnTextOrange: { color: T.orange },

  transportToggle: {
    flexDirection: 'row', backgroundColor: T.panel,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: T.border,
  },
  transportBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  transportBtnActive: {
    backgroundColor: T.bg,
    shadowColor: T.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },

  footer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: T.rBtnLg,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 13, fontFamily: T.fontBold, color: T.textSub },
  saveBtn: {
    flex: 2, paddingVertical: 13, borderRadius: T.rBtnLg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
    shadowColor: T.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  saveBtnText: { fontSize: 13, fontFamily: T.fontBlack, color: '#fff' },
}); }
