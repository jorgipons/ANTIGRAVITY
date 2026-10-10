import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { X, Check, Link2, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * Emparejamiento de la plantilla local con la federada.
 *
 * Nada se aplica solo: cada enlace y cada alta es una casilla que el entrenador
 * marca. No se borra a nadie, y el nombre, dorsal y posición que ya tuviera un
 * jugador no se tocan — la federación solo aporta el nombre de los que crea.
 */
export default function RosterSyncModal({ visible, plan, saving, onClose, onApply }) {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [links, setLinks] = useState(() =>
    Object.fromEntries((plan?.suggestions || []).map(s => [s.local.id, s.fed.uuid]))
  );
  const [additions, setAdditions] = useState(() =>
    Object.fromEntries((plan?.newcomers || []).map(f => [f.uuid, true]))
  );
  // Fila de "sin emparejar" desplegada para elegir ficha a mano.
  const [abierto, setAbierto] = useState(null);

  if (!plan) return null;

  const enlazadas = new Set(Object.values(links).filter(Boolean));
  const todasFed = [...plan.suggestions.map(s => s.fed), ...plan.newcomers, ...plan.hidden];

  const disponiblesPara = (localId) => todasFed.filter(
    f => !Object.entries(links).some(([id, uuid]) => id !== localId && uuid === f.uuid)
  );

  const altas = [...plan.newcomers, ...plan.hidden]
    .filter(f => additions[f.uuid] && !enlazadas.has(f.uuid));
  const nEnlaces = enlazadas.size;

  const aplicar = () => onApply({
    links: Object.entries(links)
      .filter(([, uuid]) => uuid)
      .map(([localId, uuid]) => ({ localId, uuid })),
    additions: altas,
  });

  const Seccion = ({ titulo, nota, children }) => (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {nota ? <Text style={styles.seccionNota}>{nota}</Text> : null}
      {children}
    </View>
  );

  const Casilla = ({ marcada, desactivada }) => (
    <View style={[
      styles.casilla,
      marcada && styles.casillaMarcada,
      desactivada && styles.casillaDesactivada,
    ]}>
      {marcada && <Check color={T.white} size={13} strokeWidth={3} />}
    </View>
  );

  const vacio = !plan.suggestions.length && !plan.unmatched.length
    && !plan.newcomers.length && !plan.hidden.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>Sincronizar plantilla</Text>
              <Text style={styles.subtitulo}>
                Revisa los emparejamientos. No se borra a nadie ni se cambian los
                dorsales que ya tengas puestos.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.cerrar}>
              <X color={T.textFaint} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.cuerpo} contentContainerStyle={{ paddingBottom: 12 }}>
            {plan.linked.length > 0 && (
              <Seccion titulo={`Ya enlazados (${plan.linked.length})`} nota="De una sincronización anterior.">
                {plan.linked.map(l => (
                  <View key={l.local.id} style={styles.filaInfo}>
                    <Link2 color={T.textFaint} size={13} />
                    <Text style={styles.nombreLocal}>{l.local.name}</Text>
                    <Text style={styles.nombreFed} numberOfLines={1}>{l.fed.fullName}</Text>
                  </View>
                ))}
              </Seccion>
            )}

            {plan.suggestions.length > 0 && (
              <Seccion titulo="Sugerencias" nota="Desmarca las que no cuadren.">
                {plan.suggestions.map(s => {
                  const marcada = links[s.local.id] === s.fed.uuid;
                  return (
                    <TouchableOpacity
                      key={s.local.id}
                      style={styles.fila}
                      activeOpacity={0.7}
                      onPress={() => setLinks(p => ({ ...p, [s.local.id]: marcada ? null : s.fed.uuid }))}
                    >
                      <Casilla marcada={marcada} />
                      <Text style={styles.nombreLocal}>{s.local.name}</Text>
                      <Text style={styles.nombreFed} numberOfLines={1}>{s.fed.fullName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Seccion>
            )}

            {plan.unmatched.length > 0 && (
              <Seccion titulo="Sin emparejar" nota="Tuyos, sin candidato claro. Toca para elegir a mano.">
                {plan.unmatched.map(u => {
                  const elegida = todasFed.find(f => f.uuid === links[u.id]);
                  const desplegado = abierto === u.id;
                  return (
                    <View key={u.id}>
                      <TouchableOpacity
                        style={styles.fila}
                        activeOpacity={0.7}
                        onPress={() => setAbierto(desplegado ? null : u.id)}
                      >
                        <Text style={styles.nombreLocal}>{u.name}</Text>
                        <Text style={[styles.nombreFed, !elegida && { color: T.textFaint }]} numberOfLines={1}>
                          {elegida ? elegida.fullName : 'Sin enlazar'}
                        </Text>
                        <ChevronDown color={T.textFaint} size={15} />
                      </TouchableOpacity>

                      {desplegado && (
                        <View style={styles.desplegable}>
                          <TouchableOpacity
                            style={styles.opcion}
                            onPress={() => { setLinks(p => ({ ...p, [u.id]: null })); setAbierto(null); }}
                          >
                            <Text style={styles.opcionTexto}>No enlazar</Text>
                          </TouchableOpacity>
                          {disponiblesPara(u.id).map(f => (
                            <TouchableOpacity
                              key={f.uuid}
                              style={styles.opcion}
                              onPress={() => { setLinks(p => ({ ...p, [u.id]: f.uuid })); setAbierto(null); }}
                            >
                              <Text style={styles.opcionTexto}>
                                {f.fullName}{f.nameHidden ? '  · sin nombre publicado' : ''}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </Seccion>
            )}

            {plan.hidden.length > 0 && (
              <Seccion
                titulo="Sin nombre publicado"
                nota="La federación solo da sus iniciales porque pidieron no aparecer. Enlázalos arriba si sabes quiénes son, o añádelos y ponles tú el nombre."
              >
                {plan.hidden.map(f => {
                  const bloqueada = enlazadas.has(f.uuid);
                  return (
                    <TouchableOpacity
                      key={f.uuid}
                      style={styles.fila}
                      activeOpacity={0.7}
                      disabled={bloqueada}
                      onPress={() => setAdditions(p => ({ ...p, [f.uuid]: !p[f.uuid] }))}
                    >
                      <Casilla marcada={!!additions[f.uuid] && !bloqueada} desactivada={bloqueada} />
                      <Text style={[styles.nombreFed, { flex: 1 }]}>{f.fullName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Seccion>
            )}

            {plan.newcomers.length > 0 && (
              <Seccion titulo="Nuevos en la federación" nota="Se añaden sin dorsal: la licencia no lo incluye.">
                {plan.newcomers.map(f => {
                  const bloqueada = enlazadas.has(f.uuid);
                  return (
                    <TouchableOpacity
                      key={f.uuid}
                      style={styles.fila}
                      activeOpacity={0.7}
                      disabled={bloqueada}
                      onPress={() => setAdditions(p => ({ ...p, [f.uuid]: !p[f.uuid] }))}
                    >
                      <Casilla marcada={!!additions[f.uuid] && !bloqueada} desactivada={bloqueada} />
                      <Text style={[styles.nombreFed, { flex: 1, color: T.text }]}>{f.fullName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Seccion>
            )}

            {vacio && (
              <Text style={styles.vacio}>
                Tu plantilla ya coincide con la de la federación. No hay nada que cambiar.
              </Text>
            )}
          </ScrollView>

          <View style={styles.pie}>
            <Text style={styles.resumen}>
              {nEnlaces} enlace{nEnlaces === 1 ? '' : 's'} · {altas.length} alta{altas.length === 1 ? '' : 's'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={onClose} style={styles.btnTexto}>
                <Text style={styles.btnTextoLabel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={aplicar}
                disabled={saving || (nEnlaces === 0 && altas.length === 0)}
                style={[styles.btnPrimario, (saving || (nEnlaces === 0 && altas.length === 0)) && { opacity: 0.4 }]}
              >
                {saving
                  ? <ActivityIndicator color={T.white} size="small" />
                  : <Text style={styles.btnPrimarioLabel}>Aplicar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: T.white,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '88%',
    },
    cabecera: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: T.border,
    },
    titulo: { fontFamily: T.fontBlack, fontSize: 18, color: T.text },
    subtitulo: { fontFamily: T.fontReg, fontSize: 12, color: T.textSub, marginTop: 4, lineHeight: 17 },
    cerrar: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: T.panel,
      alignItems: 'center', justifyContent: 'center',
    },
    cuerpo: { paddingHorizontal: 20, paddingTop: 16 },
    seccion: { marginBottom: 18 },
    seccionTitulo: {
      fontFamily: T.fontBlack, fontSize: 10, color: T.textFaint,
      letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
    },
    seccionNota: { fontFamily: T.fontReg, fontSize: 11, color: T.textFaint, marginBottom: 8, lineHeight: 16 },
    fila: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 11, paddingHorizontal: 12,
      borderWidth: 1, borderColor: T.border, borderRadius: T.rCard, marginBottom: 6,
    },
    filaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 12 },
    nombreLocal: { fontFamily: T.fontBold, fontSize: 13, color: T.text },
    nombreFed: { fontFamily: T.fontReg, fontSize: 12, color: T.textSub, flex: 1 },
    casilla: {
      width: 19, height: 19, borderRadius: 5,
      borderWidth: 1.5, borderColor: T.borderHard,
      alignItems: 'center', justifyContent: 'center',
    },
    casillaMarcada: { backgroundColor: T.ink2, borderColor: T.ink2 },
    casillaDesactivada: { opacity: 0.3 },
    desplegable: {
      borderWidth: 1, borderColor: T.border, borderRadius: T.rCard,
      marginBottom: 6, overflow: 'hidden', backgroundColor: T.panel,
    },
    opcion: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: T.border },
    opcionTexto: { fontFamily: T.fontMed, fontSize: 12, color: T.text },
    vacio: { fontFamily: T.fontReg, fontSize: 13, color: T.textSub, textAlign: 'center', paddingVertical: 28 },
    pie: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderTopWidth: 1, borderTopColor: T.border,
    },
    resumen: { fontFamily: T.fontReg, fontSize: 11, color: T.textFaint },
    btnTexto: { paddingHorizontal: 14, paddingVertical: 11 },
    btnTextoLabel: { fontFamily: T.fontBold, fontSize: 13, color: T.textSub },
    btnPrimario: {
      paddingHorizontal: 20, paddingVertical: 11, borderRadius: T.rBtn || 12,
      backgroundColor: T.ink2, minWidth: 92, alignItems: 'center', justifyContent: 'center',
    },
    btnPrimarioLabel: { fontFamily: T.fontBlack, fontSize: 13, color: T.white },
  });
}
