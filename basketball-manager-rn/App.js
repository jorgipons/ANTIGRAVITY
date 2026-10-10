import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigation from './src/navigation/RootNavigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { installGlobalHandler, flushPendingCrashes, setCrashContext } from './src/utils/crashReporter';
import Constants from 'expo-constants';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  Outfit_500Medium,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

// La barra de estado, una sola vez y atada al tema. Sin backgroundColor,
// Android la pinta blanca y los iconos claros se vuelven invisibles; era lo que
// pasaba en todas las pantallas que no la declaraban por su cuenta.
function ThemedStatusBar() {
  const T = useTheme();
  return <StatusBar style="light" backgroundColor={T.ink2} />;
}

// Se instala una sola vez, antes de que React monte nada: en un build de
// release un error de JS no capturado cierra la app sin dejar rastro, y este
// manejador es lo unico que lo ve pasar.
installGlobalHandler();
setCrashContext({ version: Constants.expoConfig?.version || 'desconocida' });

export default function App() {
  // Reenvia lo que quedo encolado por no haber conexion. No bloquea el arranque.
  React.useEffect(() => { flushPendingCrashes(); }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Outfit_500Medium,
    Outfit_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedStatusBar />
            <RootNavigation />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
