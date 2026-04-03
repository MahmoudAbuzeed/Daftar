import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@daftar/theme';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgSubtle: string;
  bgGlass: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;

  primary: string;
  primaryLight: string;
  primaryDark: string;
  primarySurface: string;

  accent: string;
  accentLight: string;

  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;

  border: string;
  borderLight: string;

  shadowColor: string;
  overlay: string;

  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  statusBarStyle: 'light-content' | 'dark-content';

  positive: string;
  negative: string;
  kicker: string;

  headerGradient: [string, string, ...string[]];
  primaryGradient: [string, string, ...string[]];
  cardGradient: [string, string, ...string[]];
  accentGradient: [string, string, ...string[]];
  successGradient: [string, string, ...string[]];
  dangerGradient: [string, string, ...string[]];
}

// "Clean & Bright" — white backgrounds, friendly green primary
export const lightPalette: ThemeColors = {
  bg: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgSubtle: '#F5F5F5',
  bgGlass: 'rgba(255,255,255,0.95)',

  text: '#1A1A2E',
  textSecondary: '#555770',
  textTertiary: '#8E8EA0',
  textOnPrimary: '#FFFFFF',

  primary: '#1DB954',
  primaryLight: '#4AD97B',
  primaryDark: '#17A347',
  primarySurface: '#E8F9EF',

  accent: '#FF9500',
  accentLight: '#FFBB54',

  success: '#1DB954',
  successLight: '#4AD97B',
  danger: '#E53E3E',
  dangerLight: '#FC8181',

  border: '#E8E8EE',
  borderLight: '#F2F2F7',

  shadowColor: '#1A1A2E',
  overlay: 'rgba(26,26,46,0.4)',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E8E8EE',
  tabActive: '#1DB954',
  tabInactive: '#B0B0C0',

  statusBarStyle: 'dark-content',

  positive: '#1DB954',
  negative: '#E53E3E',
  kicker: '#FF9500',

  headerGradient: ['#FFFFFF', '#F5F5F5'],
  primaryGradient: ['#1DB954', '#4AD97B'],
  cardGradient: ['#FFFFFF', '#FAFAFA'],
  accentGradient: ['#FF9500', '#FFBB54', '#FFD080'],
  successGradient: ['#1DB954', '#4AD97B'],
  dangerGradient: ['#E53E3E', '#FC8181'],
};

// "Night Mode" — clean dark with green accents
export const darkPalette: ThemeColors = {
  bg: '#0D0D14',
  bgCard: '#1A1A28',
  bgSubtle: '#151520',
  bgGlass: 'rgba(255,255,255,0.04)',

  text: '#F0F0F5',
  textSecondary: 'rgba(240,240,245,0.6)',
  textTertiary: 'rgba(240,240,245,0.38)',
  textOnPrimary: '#FFFFFF',

  primary: '#1DB954',
  primaryLight: '#4AD97B',
  primaryDark: '#17A347',
  primarySurface: 'rgba(29,185,84,0.15)',

  accent: '#FF9500',
  accentLight: '#FFD080',

  success: '#4AD97B',
  successLight: '#76E8A0',
  danger: '#FC8181',
  dangerLight: '#FEB2B2',

  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.06)',

  shadowColor: '#000000',
  overlay: 'rgba(13,13,20,0.7)',

  tabBarBg: '#0A0A12',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  tabActive: '#4AD97B',
  tabInactive: 'rgba(240,240,245,0.28)',

  statusBarStyle: 'light-content',

  positive: '#4AD97B',
  negative: '#FC8181',
  kicker: 'rgba(255,149,0,0.7)',

  headerGradient: ['#0D0D14', '#151520', '#1A1A28'],
  primaryGradient: ['#17A347', '#1DB954'],
  cardGradient: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'],
  accentGradient: ['#E08600', '#FF9500', '#FFBB54'],
  successGradient: ['#1DB954', '#4AD97B'],
  dangerGradient: ['#E53E3E', '#FC8181'],
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  ready: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  isDark: false,
  ready: false,
  colors: lightPalette,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light') setMode(v);
      setReady(true);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const setTheme = useCallback((m: ThemeMode) => {
    setMode(m);
    AsyncStorage.setItem(THEME_KEY, m);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      ready,
      colors: mode === 'dark' ? darkPalette : lightPalette,
      toggleTheme,
      setTheme,
    }),
    [mode, ready, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
