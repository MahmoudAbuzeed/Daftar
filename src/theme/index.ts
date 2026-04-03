import { Platform, StyleSheet } from 'react-native';

// ── Daftar Design System ──────────────────────────────────────
// "Papyrus & Indigo" — Egyptian heritage meets modern fintech

export const Colors = {
  // Core palette
  primary: '#4F46E5',        // Deep indigo
  primaryLight: '#818CF8',   // Soft indigo
  primaryDark: '#3730A3',    // Dark indigo
  primarySurface: '#EEF2FF', // Indigo tint

  accent: '#F59E0B',         // Amber gold
  accentLight: '#FDE68A',    // Soft gold
  accentDark: '#D97706',     // Deep gold

  // Semantic
  success: '#059669',        // Emerald
  successLight: '#D1FAE5',
  successSurface: '#ECFDF5',
  danger: '#E11D48',         // Rose
  dangerLight: '#FECDD3',
  dangerSurface: '#FFF1F2',

  // Backgrounds
  bg: '#FAF9F7',             // Warm parchment
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgDark: '#1E1B4B',        // Deep indigo surface (for hero sections)
  bgDarkCard: '#2E2A5E',    // Elevated dark card

  // Text
  textPrimary: '#1E1B4B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnDark: '#F8FAFC',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#1E1B4B',

  // Borders & Dividers
  border: '#E8E5E0',
  borderLight: '#F3F0EB',
  borderFocus: '#818CF8',

  // Misc
  overlay: 'rgba(30, 27, 75, 0.6)',
  shimmer: '#F5F3EF',
};

export const Gradients = {
  primary: ['#4F46E5', '#7C3AED'] as const,       // Indigo → Purple
  hero: ['#1E1B4B', '#312E81'] as const,           // Deep navy
  heroWarm: ['#1E1B4B', '#3B1E5E'] as const,       // Navy → Plum
  gold: ['#F59E0B', '#FBBF24'] as const,           // Amber → Gold
  success: ['#059669', '#10B981'] as const,         // Emerald gradient
  danger: ['#E11D48', '#F43F5E'] as const,          // Rose gradient
  card: ['#FFFFFF', '#FEFCF9'] as const,            // Warm white
  warmBg: ['#FAF9F7', '#F5F0EB'] as const,          // Parchment
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
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1.2,
    color: Colors.textOnDark,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    color: Colors.textPrimary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  amount: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
};

export const Shadows = StyleSheet.create({
  sm: {
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  goldGlow: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});

// Common component styles
export const CommonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  inputField: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
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
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  secondaryButtonText: {
    color: Colors.primary,
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
    fontWeight: '500' as const,
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
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
});
