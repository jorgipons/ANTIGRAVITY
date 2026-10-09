import React, { useState, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { NotificationsProvider } from '../hooks/useNotifications';
import { useLayout } from '../hooks/useLayout';
import AppDrawer from '../components/AppDrawer';

// Screens
import LoginScreen from '../screens/LoginScreen';
import TeamsListScreen from '../screens/TeamsListScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MatchListScreen from '../screens/MatchListScreen';
import MatchMatrixScreen from '../screens/MatchMatrixScreen';
import MatchAttendanceScreen from '../screens/MatchAttendanceScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MatchSummaryScreen from '../screens/MatchSummaryScreen';
import HelpScreen from '../screens/HelpScreen';

const Stack = createNativeStackNavigator();

const NAV_STATE_KEY = 'NAV_STATE_V1';


// Main Stack Navigator
function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NotificationsProvider user={user}>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated Stack
        <Stack.Group>
          <Stack.Screen name="TeamsTab" component={TeamsListScreen} />
          <Stack.Screen name="SettingsTab" component={SettingsScreen} />
          <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
          <Stack.Screen name="MatchList" component={MatchListScreen} />
          <Stack.Screen name="MatchMatrix" component={MatchMatrixScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
        </Stack.Group>
      ) : (
        // Unauthenticated Stack
        <Stack.Screen name="Login" component={LoginScreen} />
      )}

      {/* Publicly accessible routes (Deep Linking targets) */}
      <Stack.Screen
        name="MatchAttendance"
        component={MatchAttendanceScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
    </NotificationsProvider>
  );
}

// Configure deep linking
const linking = {
  prefixes: ['basketballmanager://', 'https://basketmanager-ed370.web.app'],
  config: {
    screens: {
      MatchAttendance: 'match/:teamId/:matchId',
    },
  },
};

export default function RootNavigation() {
  const [isReady, setIsReady]       = useState(Platform.OS !== 'web');
  const [initialState, setInitialState] = useState(undefined);
  const saveTimerRef = useRef(null);
  const { IS_TABLET_LANDSCAPE } = useLayout();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    AsyncStorage.getItem(NAV_STATE_KEY)
      .then(raw => { if (raw) setInitialState(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

  const handleStateChange = (state) => {
    if (Platform.OS !== 'web') return;
    // Debounce saves — don't write on every tiny state change
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state)).catch(() => {});
    }, 500);
  };

  const noop = React.useCallback(() => {}, []);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1, flexDirection: IS_TABLET_LANDSCAPE ? 'row' : 'column' }}>
      {IS_TABLET_LANDSCAPE && (
        <AppDrawer
          persistent
          visible={true}
          onClose={noop}
          navigation={navigationRef}
        />
      )}
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          initialState={initialState}
          onStateChange={handleStateChange}
        >
          <AppNavigator />
        </NavigationContainer>
      </View>
    </View>
  );
}
