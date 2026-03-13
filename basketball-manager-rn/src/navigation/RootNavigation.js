import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import TeamsListScreen from '../screens/TeamsListScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MatchListScreen from '../screens/MatchListScreen';
import MatchMatrixScreen from '../screens/MatchMatrixScreen';
import MatchAttendanceScreen from '../screens/MatchAttendanceScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tabs for authenticated users
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.slate400,
        tabBarStyle: {
          borderTopColor: COLORS.slate200,
        }
      }}
    >
      <Tab.Screen name="TeamsTab" component={TeamsListScreen} options={{ title: 'Mis Equipos' }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    // Optionally return a splash screen here while checking auth state
    return null; 
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated Stack
        <Stack.Group>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
          <Stack.Screen name="MatchList" component={MatchListScreen} />
          <Stack.Screen name="MatchMatrix" component={MatchMatrixScreen} />
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
  );
}

// Configure deep linking
const linking = {
  prefixes: ['basketballmanager://', 'https://tu-dominio.com'], // Ajustar dominio en despliegue
  config: {
    screens: {
      MatchAttendance: 'match/:teamId/:matchId',
    },
  },
};

export default function RootNavigation() {
  return (
    <NavigationContainer linking={linking}>
      <AppNavigator />
    </NavigationContainer>
  );
}
