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

// "Sunlit Parchment" — warm cream, clean whites, teal & brass accents
export const lightPalette: ThemeColors = {
  bg: '#F5F0E6',
  bgCard: '#FFFFFF',
  bgSubtle: '#EDE8DC',
  bgGlass: 'rgba(255,253,247,0.92)',

  text: '#1C2420',
  textSecondary: '#526059',
  textTertiary: '#8A9690',
  textOnPrimary: '#FFFFFF',

  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#0F766E',
  primarySurface: '#E6FAF7',

  accent: '#A67C00',
  accentLight: '#D4AF37',

  success: '#059669',
  successLight: '#34D399',
  danger: '#DC2626',
  dangerLight: '#F87171',

  border: '#DDD7C9',
  borderLight: '#EBE6DA',

  shadowColor: '#5A4F3B',
  overlay: 'rgba(28,36,32,0.4)',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E8E2D4',
  tabActive: '#0D9488',
  tabInactive: '#A8B5B0',

  statusBarStyle: 'dark-content',

  positive: '#059669',
  negative: '#DC2626',
  kicker: '#A67C00',

  headerGradient: ['#F5F0E6', '#EDE8DC'],
  primaryGradient: ['#0D9488', '#14B8A6'],
  cardGradient: ['#FFFFFF', '#FDFAF3'],
  accentGradient: ['#A67C00', '#D4AF37', '#E8C547'],
  successGradient: ['#059669', '#34D399'],
  dangerGradient: ['#DC2626', '#EF4444'],
};

// "Midnight Ledger" — obsidian depths, brass glow, teal pulse
export const darkPalette: ThemeColors = {
  bg: '#040D0B',
  bgCard: '#0E1E1A',
  bgSubtle: '#0B1F1A',
  bgGlass: 'rgba(255,252,247,0.04)',

  text: '#F4F0E8',
  textSecondary: 'rgba(244,240,232,0.55)',
  textTertiary: 'rgba(244,240,232,0.35)',
  textOnPrimary: '#FFFFFF',

  primary: '#1B7A6C',
  primaryLight: '#2DD4BF',
  primaryDark: '#115E56',
  primarySurface: 'rgba(27,122,108,0.15)',

  accent: '#C9A227',
  accentLight: '#F5E6A8',

  success: '#14B8A6',
  successLight: '#5EEAD4',
  danger: '#EA580C',
  dangerLight: '#FDBA74',

  border: 'rgba(201,162,39,0.18)',
  borderLight: 'rgba(201,162,39,0.12)',

  shadowColor: '#000000',
  overlay: 'rgba(10,18,16,0.65)',

  tabBarBg: '#060F0D',
  tabBarBorder: 'rgba(201,162,39,0.15)',
  tabActive: '#14B8A6',
  tabInactive: 'rgba(244,240,232,0.3)',

  statusBarStyle: 'light-content',

  positive: '#14B8A6',
  negative: '#EA580C',
  kicker: 'rgba(212,175,55,0.6)',

  headerGradient: ['#040D0B', '#0B1F1A', '#0F2722'],
  primaryGradient: ['#1B7A6C', '#14B8A6'],
  cardGradient: ['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)'],
  accentGradient: ['#A67C00', '#D4AF37', '#E8C547'],
  successGradient: ['#0F766E', '#14B8A6'],
  dangerGradient: ['#9A3412', '#EA580C'],
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
