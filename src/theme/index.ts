import { Platform, StyleSheet } from 'react-native';
import { FontFamily } from './fonts';

// ── Daftar Design System ──────────────────────────────────────
// "Midnight ledger & brass" — obsidian teal, warm metal, cream paper

export const Colors = {
  primary: '#1B7A6C',
  primaryLight: '#2DD4BF',
  primaryDark: '#115E56',
  primarySurface: '#CCFBF1',

  accent: '#C9A227',
  accentLight: '#F5E6A8',
  accentDark: '#8B6914',

  success: '#0D9488',
  successLight: '#5EEAD4',
  successSurface: '#ECFEFF',

  danger: '#C2410C',
  dangerLight: '#FDBA74',
  dangerSurface: '#FFF7ED',

  bg: '#F2EFE8',
  bgCard: '#FFFCF7',
  bgElevated: '#FFFFFF',
  bgDark: '#0A1210',
  bgDarkMid: '#122420',
  bgDarkCard: '#1A2E28',

  textPrimary: '#0F1A17',
  textSecondary: '#4A5F59',
  textTertiary: '#7A9189',
  textOnDark: '#F4F0E8',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#1A1408',

  border: '#D9D3C7',
  borderLight: '#EBE7DE',
  borderFocus: '#1B7A6C',
  borderBrass: 'rgba(201, 162, 39, 0.45)',

  overlay: 'rgba(10, 18, 16, 0.65)',
  shimmer: '#E8E4DC',
};

export const Gradients = {
  primary: ['#115E56', '#1B7A6C'] as const,
  primarySoft: ['#CCFBF1', '#F0FDFA'] as const,
  hero: ['#061210', '#122420', '#0F2722'] as const,
  heroWarm: ['#0A1614', '#1A2E28', '#142820'] as const,
  brass: ['#A67C00', '#D4AF37', '#E8C547'] as const,
  /** @deprecated Use brass — kept for existing screen references */
  gold: ['#A67C00', '#D4AF37', '#E8C547'] as const,
  brassMuted: ['#8B7355', '#C9A227'] as const,
  success: ['#0F766E', '#14B8A6'] as const,
  danger: ['#9A3412', '#EA580C'] as const,
  card: ['#FFFCF7', '#FAF6EF'] as const,
  warmBg: ['#F2EFE8', '#E8E2D6'] as const,
  tabBar: ['#0C1815', '#0F221C'] as const,
  meshAccent: ['rgba(27,122,108,0.35)', 'rgba(201,162,39,0.12)'] as const,
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
    shadowColor: '#041210',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  md: {
    shadowColor: '#041210',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  lg: {
    shadowColor: '#041210',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: {
    shadowColor: '#1B7A6C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  goldGlow: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  cardLift: {
    shadowColor: '#1A1408',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
});

export const CommonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
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
