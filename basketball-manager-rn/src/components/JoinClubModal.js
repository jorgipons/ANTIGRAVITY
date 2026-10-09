import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';

const CF_BASE = 'https://europe-west3-basketmanager-ed370.cloudfunctions.net';

export default function JoinClubModal({ visible, onClose, onJoined }) {
  const T = useTheme();
  const s = useMemo(() => makeStyles(T), [T]);
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch(`${CF_BASE}/joinClub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, inviteCode: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al unirse');
      setCode('');
      onClose();
      onJoined?.(data.clubName);
    } catch (err) {
      Alert.alert('No se pudo unir', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <X color={T.textFaint} size={18} />
          </TouchableOpacity>

          <Text style={s.title}>Unirse a un club</Text>
          <Text style={s.desc}>
            Introduce el código que te ha compartido el administrador de tu club.
          </Text>

          <Text style={s.label}>CÓDIGO DE INVITACIÓN</Text>
          <TextInput
            style={s.input}
            placeholder="PARTITS-XXXXXX"
            placeholderTextColor={T.textFaint}
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />

          <TouchableOpacity
            style={[s.btn, (!code.trim() || loading) && { opacity: 0.5 }]}
            onPress={handleJoin}
            disabled={!code.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={T.white} size="small" />
              : <Text style={s.btnText}>Unirse al club</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T) { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.panel, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: T.fontBlack, fontSize: 20, color: T.text, marginBottom: 6 },
  desc: { fontFamily: T.fontReg, fontSize: 14, color: T.textSub, marginBottom: 20, lineHeight: 20 },
  label: {
    fontFamily: T.fontSemi, fontSize: 10, color: T.textFaint,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.border,
    borderRadius: T.rInput, padding: 16, fontSize: 18,
    fontFamily: T.mono, color: T.text, letterSpacing: 2, marginBottom: 20,
  },
  btn: {
    backgroundColor: T.ink, borderRadius: T.rBtnLg,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  btnText: { fontFamily: T.fontBlack, fontSize: 16, color: T.white },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontFamily: T.fontMed, fontSize: 14, color: T.textFaint },
}); }
