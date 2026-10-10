import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../constants/firebase';

/**
 * Registro de fallos propio.
 *
 * En un build de release no existe la pantalla roja: un error de JS no
 * capturado cierra la app sin dejar rastro. Esto lo intercepta antes, lo
 * guarda en Firestore y, si no hay conexión, lo encola en el dispositivo
 * para enviarlo al siguiente arranque.
 *
 * NO registra datos de jugadores ni de equipos: solo mensaje, traza, versión
 * y plataforma. La traza de un build de release viene minificada; es el
 * precio de no meter Sentry.
 */

const COLA = '@partits_crashes_pendientes';
const MAX_COLA = 20;
const MAX_STACK = 4000;

let appVersion = 'desconocida';
let pantallaActual = null;
let uidActual = null;

export const setCrashContext = ({ version, uid, screen } = {}) => {
  if (version !== undefined) appVersion = version;
  if (uid !== undefined) uidActual = uid;
  if (screen !== undefined) pantallaActual = screen;
};

/**
 * Agrupa errores iguales: mensaje + primera línea útil de la traza.
 * Sin esto, el panel sería una lista plana de miles de repeticiones.
 */
export const fingerprintOf = (message, stack) => {
  const primeraLinea = String(stack || '')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('at ')) || '';
  const base = `${message}|${primeraLinea}`;
  // Hash corto y estable (djb2). No necesita ser criptográfico.
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
  return `m${(h >>> 0).toString(36)}`;
};

const construirInforme = (error, extra = {}) => {
  const message = String(error?.message || error || 'Error desconocido').slice(0, 500);
  const stack = String(error?.stack || '').slice(0, MAX_STACK);
  return {
    message,
    stack,
    componentStack: String(extra.componentStack || '').slice(0, MAX_STACK) || null,
    fingerprint: fingerprintOf(message, stack),
    source: 'mobile',
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    appVersion,
    screen: extra.screen || pantallaActual || null,
    fatal: !!extra.fatal,
    userId: uidActual || null,
    createdAt: new Date().toISOString(),
    resolved: false,
  };
};

const encolar = async (informe) => {
  try {
    const crudo = await AsyncStorage.getItem(COLA);
    const cola = crudo ? JSON.parse(crudo) : [];
    cola.push(informe);
    // Si la app falla en bucle, no llenamos el disco del usuario.
    await AsyncStorage.setItem(COLA, JSON.stringify(cola.slice(-MAX_COLA)));
  } catch {
    // Si ni esto funciona, no hay nada más que hacer sin empeorar el fallo.
  }
};

const enviar = async (informe) => {
  await addDoc(collection(db, 'crashReports'), informe);
};

export const reportCrash = async (error, extra = {}) => {
  const informe = construirInforme(error, extra);
  try {
    await enviar(informe);
  } catch {
    await encolar(informe);
  }
  return informe;
};

/** Vacía la cola pendiente. Se llama al arrancar, sin bloquear el arranque. */
export const flushPendingCrashes = async () => {
  try {
    const crudo = await AsyncStorage.getItem(COLA);
    if (!crudo) return 0;
    const cola = JSON.parse(crudo);
    if (!cola.length) return 0;

    let enviados = 0;
    for (const informe of cola) {
      try { await enviar(informe); enviados++; } catch { break; }
    }
    await AsyncStorage.setItem(COLA, JSON.stringify(cola.slice(enviados)));
    return enviados;
  } catch {
    return 0;
  }
};

/**
 * Intercepta los errores de JS que nadie capturó. Es lo que en release
 * cierra la app en seco.
 */
export const installGlobalHandler = () => {
  if (typeof global.ErrorUtils?.setGlobalHandler !== 'function') return;
  const anterior = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportCrash(error, { fatal: isFatal });
    // Se respeta el comportamiento previo: no se traga el error.
    if (typeof anterior === 'function') anterior(error, isFatal);
  });
};
