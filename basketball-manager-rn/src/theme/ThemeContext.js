import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './tokens';

const STORAGE_KEY = '@partits_theme';

const ThemeContext = createContext(lightTheme);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  // null = seguir sistema, 'light' / 'dark' = preferencia manual
  const [override, setOverride] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark') setOverride(val);
      setLoaded(true);
    });
  }, []);

  const effectiveScheme = override ?? systemScheme ?? 'light';
  const theme = effectiveScheme === 'dark' ? darkTheme : lightTheme;

  const setTheme = useCallback(async (mode) => {
    // mode: 'light' | 'dark' | 'system'
    if (mode === 'system') {
      setOverride(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      setOverride(mode);
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    }
  }, []);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ ...theme, setTheme, themeMode: override ?? 'system' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
