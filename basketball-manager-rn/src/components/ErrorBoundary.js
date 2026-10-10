import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { reportCrash } from '../utils/crashReporter';
import { lightTheme } from '../theme/tokens';

/**
 * Red de seguridad de la app.
 *
 * Sin esto, un error al renderizar deja la pantalla en blanco o cierra la app
 * sin decir nada. Aquí se registra el fallo y se muestra al usuario con un
 * botón para copiarlo.
 *
 * Es un componente de clase porque componentDidCatch no existe en hooks.
 * No usa useTheme: si el fallo viene del propio proveedor de tema, el
 * boundary tiene que seguir pintando algo.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copiado: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    reportCrash(error, { componentStack: info?.componentStack, fatal: false });
  }

  copiar = async () => {
    const { error, info } = this.state;
    const texto = [
      `Mensaje: ${error?.message || error}`,
      '',
      'Traza:',
      error?.stack || '(sin traza)',
      '',
      'Componente:',
      info?.componentStack || '(sin pila de componentes)',
      '',
      `Plataforma: ${Platform.OS} ${Platform.Version}`,
    ].join('\n');
    try {
      await Clipboard.setStringAsync(texto);
      this.setState({ copiado: true });
      setTimeout(() => this.setState({ copiado: false }), 2500);
    } catch {
      // Si el portapapeles falla, el texto sigue visible en pantalla.
    }
  };

  reintentar = () => this.setState({ error: null, info: null });

  render() {
    const { error, info, copiado } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.contenedor}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.titulo}>La app ha encontrado un error</Text>
          <Text style={s.intro}>
            Ya se ha registrado. Si quieres ayudar a arreglarlo, copia el detalle
            y envíamelo.
          </Text>

          <Text style={s.etiqueta}>MENSAJE</Text>
          <Text style={s.mensaje}>{String(error?.message || error)}</Text>

          {!!error?.stack && (
            <React.Fragment>
              <Text style={s.etiqueta}>TRAZA</Text>
              <Text style={s.traza}>{error.stack}</Text>
            </React.Fragment>
          )}

          {!!info?.componentStack && (
            <React.Fragment>
              <Text style={s.etiqueta}>COMPONENTE</Text>
              <Text style={s.traza}>{info.componentStack}</Text>
            </React.Fragment>
          )}
        </ScrollView>

        <View style={s.pie}>
          <TouchableOpacity onPress={this.reintentar} style={s.btnSec}>
            <Text style={s.btnSecTexto}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={this.copiar} style={s.btnPri}>
            <Text style={s.btnPriTexto}>{copiado ? 'Copiado' : 'Copiar detalle'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const T = lightTheme;
const s = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: T.bg, paddingTop: 48 },
  scroll: { padding: 20, paddingBottom: 24 },
  titulo: { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 6 },
  intro: { fontSize: 13, color: T.textSub, marginBottom: 20, lineHeight: 19 },
  etiqueta: { fontSize: 10, fontWeight: '800', color: T.textFaint, letterSpacing: 1.2, marginTop: 14, marginBottom: 5 },
  mensaje: { fontSize: 14, fontWeight: '600', color: T.neg, lineHeight: 20 },
  traza: {
    fontSize: 11, color: T.textSub, lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: T.panel, padding: 10, borderRadius: 8,
  },
  pie: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.white,
  },
  btnSec: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.borderHard, alignItems: 'center' },
  btnSecTexto: { fontSize: 14, fontWeight: '700', color: T.textSub },
  btnPri: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: T.ink2, alignItems: 'center' },
  btnPriTexto: { fontSize: 14, fontWeight: '800', color: T.white },
});
