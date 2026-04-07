import { Platform, StyleSheet } from 'react-native';
import { FontFamily } from './fonts';

// ── Fifti Design System ──────────────────────────────────────
// "Clean & Bright" — white backgrounds, friendly green, orange accents

export const Colors = {
  primary: '#1DB954',
  primaryLight: '#4AD97B',
  primaryDark: '#17A347',
  primarySurface: '#E8F9EF',

  accent: '#FF9500',
  accentLight: '#FFBB54',
  accentDark: '#E08600',

  success: '#1DB954',
  successLight: '#4AD97B',
  successSurface: '#E8F9EF',

  danger: '#E53E3E',
  dangerLight: '#FC8181',
  dangerSurface: '#FEF2F2',

  bg: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgDark: '#0D0D14',
  bgDarkMid: '#151520',
  bgDarkCard: '#1A1A28',

  textPrimary: '#1A1A2E',
  textSecondary: '#555770',
  textTertiary: '#8E8EA0',
  textOnDark: '#F0F0F5',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#1A1A2E',

  border: '#E8E8EE',
  borderLight: '#F2F2F7',
  borderFocus: '#1DB954',
  borderBrass: 'rgba(255, 149, 0, 0.35)',

  overlay: 'rgba(26, 26, 46, 0.4)',
  shimmer: '#F2F2F7',
};

export const Gradients = {
  primary: ['#1DB954', '#4AD97B'] as const,
  primarySoft: ['#E8F9EF', '#F5FFF9'] as const,
  hero: ['#0D0D14', '#151520', '#1A1A28'] as const,
  heroWarm: ['#0D0D14', '#1A1A28', '#1E1E30'] as const,
  brass: ['#E08600', '#FF9500', '#FFBB54'] as const,
  gold: ['#E08600', '#FF9500', '#FFBB54'] as const,
  brassMuted: ['#CC7A00', '#FF9500'] as const,
  success: ['#1DB954', '#4AD97B'] as const,
  danger: ['#E53E3E', '#FC8181'] as const,
  card: ['#FFFFFF', '#FAFAFA'] as const,
  warmBg: ['#FFFFFF', '#F5F5F5'] as const,
  tabBar: ['#0A0A12', '#0D0D14'] as const,
  meshAccent: ['rgba(29,185,84,0.25)', 'rgba(255,149,0,0.1)'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Typography = {
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    letterSpacing: -1.4,
    color: Colors.textOnDark,
  },
  screenTitle: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    letterSpacing: -0.6,
    color: Colors.textPrimary,
  },
  screenSubtitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    letterSpacing: 0.4,
    color: 'rgba(244, 240, 232, 0.55)',
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  cardTitle: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  caption: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    color: Colors.textTertiary,
  },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  amount: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  amountLarge: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    letterSpacing: -1,
  },
  button: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
};

export const Shadows = StyleSheet.create({
  sm: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: {
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  goldGlow: {
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cardLift: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
});

export const CommonStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  /** @deprecated Use ThemedCard component which is theme-aware */
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderBrass,
    ...Shadows.cardLift,
  },
  inputField: {
    backgroundColor: '#F7F4ED',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: FontFamily.body,
    color: Colors.textPrimary,
  },
  inputFieldFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Shadows.glow,
  },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.borderBrass,
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    ...Typography.button,
  },
  fab: {
    position: 'absolute' as const,
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...Shadows.glow,
  },
  fabText: {
    color: Colors.textOnPrimary,
    fontSize: 28,
    fontFamily: FontFamily.bodyMedium,
    marginTop: -2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
  },
  chipText: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemibold,
    color: Colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
});

export { FontFamily };
