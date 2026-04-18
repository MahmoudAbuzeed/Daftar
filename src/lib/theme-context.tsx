import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@fifti/theme';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgSubtle: string;
  bgGlass: string;
  /** Warm off-white surface for editorial cards — distinct from bgCard. */
  paper: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  /** Deep ink for editorial titles — slightly darker than `text`. */
  ink: string;

  primary: string;
  primaryLight: string;
  primaryDark: string;
  primarySurface: string;

  /** Brand chrome — alias for primary. Use for app chrome and primary CTAs. */
  brand: string;
  brandLight: string;
  brandDark: string;

  accent: string;
  accentLight: string;

  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;

  border: string;
  borderLight: string;

  iconButtonBg: string;
  iconButtonBorder: string;
  tabBarDockBg: string;

  shadowColor: string;
  overlay: string;

  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  statusBarStyle: 'light-content' | 'dark-content';

  /** Money owed *to* the user — financial green, distinct from `success`. */
  owed: string;
  /** Money the user *owes* — financial red, distinct from `danger`. */
  owe: string;
  /** Neutral charcoal/paper for "all clear" pills. */
  settled: string;
  /** @deprecated Use `owed`. Kept for back-compat. */
  positive: string;
  /** @deprecated Use `owe`. Kept for back-compat. */
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
  paper: '#FBF8F1',

  text: '#1A1A2E',
  textSecondary: '#555770',
  textTertiary: '#8E8EA0',
  textOnPrimary: '#FFFFFF',
  ink: '#15131A',

  primary: '#1DB954',
  primaryLight: '#4AD97B',
  primaryDark: '#17A347',
  primarySurface: '#E8F9EF',

  brand: '#1DB954',
  brandLight: '#4AD97B',
  brandDark: '#17A347',

  accent: '#FF9500',
  accentLight: '#FFBB54',

  success: '#1DB954',
  successLight: '#4AD97B',
  danger: '#E53E3E',
  dangerLight: '#FC8181',

  border: '#E8E8EE',
  borderLight: '#F2F2F7',

  iconButtonBg: 'rgba(0,0,0,0.04)',
  iconButtonBorder: 'rgba(0,0,0,0.06)',
  tabBarDockBg: 'rgba(255,255,255,0.96)',

  shadowColor: '#1A1A2E',
  overlay: 'rgba(26,26,46,0.4)',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E8E8EE',
  tabActive: '#1DB954',
  tabInactive: '#B0B0C0',

  statusBarStyle: 'dark-content',

  owed: '#15A24A',
  owe: '#D9342C',
  settled: '#8E8EA0',
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

// "Night Ledger" — warm dark with paper undertones and brass accents
export const darkPalette: ThemeColors = {
  bg: '#0E0D12',
  bgCard: '#1A1822',
  bgSubtle: '#15131A',
  bgGlass: 'rgba(255,255,255,0.04)',
  paper: '#15131A',

  text: '#F0F0F5',
  textSecondary: 'rgba(240,240,245,0.6)',
  textTertiary: 'rgba(240,240,245,0.38)',
  textOnPrimary: '#FFFFFF',
  ink: '#FBF8F1',

  primary: '#1DB954',
  primaryLight: '#4AD97B',
  primaryDark: '#17A347',
  primarySurface: 'rgba(29,185,84,0.15)',

  brand: '#1DB954',
  brandLight: '#4AD97B',
  brandDark: '#17A347',

  accent: '#FF9500',
  accentLight: '#FFD080',

  success: '#4AD97B',
  successLight: '#76E8A0',
  danger: '#FC8181',
  dangerLight: '#FEB2B2',

  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.06)',

  iconButtonBg: 'rgba(255,252,247,0.06)',
  iconButtonBorder: 'rgba(255,255,255,0.10)',
  tabBarDockBg: 'rgba(8,7,12,0.94)',

  shadowColor: '#000000',
  overlay: 'rgba(13,13,20,0.7)',

  tabBarBg: '#0A0810',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  tabActive: '#4AD97B',
  tabInactive: 'rgba(240,240,245,0.28)',

  statusBarStyle: 'light-content',

  owed: '#5BE08E',
  owe: '#FC8181',
  settled: 'rgba(240,240,245,0.45)',
  positive: '#4AD97B',
  negative: '#FC8181',
  kicker: 'rgba(255,149,0,0.78)',

  headerGradient: ['#0E0D12', '#15131A', '#1A1822'],
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
