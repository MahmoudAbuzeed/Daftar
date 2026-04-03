import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { Colors, Gradients, Spacing, Radius, Shadows, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#040D0B', '#0B1F1A', '#0A1916']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Atmospheric glow orbs */}
      <View style={styles.orbTeal} />
      <View style={styles.orbBrass} />
      <View style={styles.orbDeep} />

      {/* Diagonal brass line accent */}
      <View style={styles.diagonalLine} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#040D0B" />

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLine} />
          <Text style={styles.topBarLabel}>{t('auth.est')}</Text>
          <View style={styles.topBarLine} />
        </View>

        <View style={styles.content}>
          {/* Hero zone */}
          <View style={styles.heroZone}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={['#C9A227', '#E8C547', '#D4AF37']}
                style={styles.logoBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.logoCore}>
                  <Text style={styles.logoEmoji}>📒</Text>
                </View>
              </LinearGradient>

              <View style={styles.logoCornerTL} />
              <View style={styles.logoCornerBR} />
            </View>

            {/* Title stack */}
            <View style={styles.titleBlock}>
              <Text style={styles.titleMain}>Daftar</Text>
              <View style={styles.titleDivider}>
                <View style={styles.titleDividerLine} />
                <View style={styles.titleDividerDiamond} />
                <View style={styles.titleDividerLine} />
              </View>
              <Text style={styles.titleArabic}>دفتر</Text>
            </View>

            <Text style={styles.tagline}>{t('auth.welcomeTagline')}</Text>
          </View>

          {/* Feature strip */}
          <View style={styles.featureStrip}>
            {(['featureSplitBills', 'featureTrackDebts', 'featureScanReceipts'] as const).map((key, i) => (
              <View key={key} style={styles.featureItem}>
                <LinearGradient
                  colors={['rgba(201,162,39,0.25)', 'rgba(201,162,39,0.05)']}
                  style={styles.featureNumBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.featureNum}>{i + 1}</Text>
                </LinearGradient>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureText}>{t(`auth.${key}`)}</Text>
                </View>
                {i < 2 && <View style={styles.featureSep} />}
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.ctaZone}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SignIn')}
            >
              <LinearGradient
                colors={['#1B7A6C', '#14B8A6']}
                style={[styles.ctaPrimary, Shadows.glow]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.5 }}
              >
                <Text style={styles.ctaPrimaryText}>{t('auth.signIn')}</Text>
                <View style={styles.ctaArrow}>
                  <Text style={styles.ctaArrowText}>{'\u2192'}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctaSecondary}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.ctaSecondaryText}>{t('auth.signUp')}</Text>
            </TouchableOpacity>

            <View style={styles.ctaFooter}>
              <View style={styles.ctaFooterDot} />
              <Text style={styles.ctaFooterText}>{t('auth.taglineShort')}</Text>
              <View style={styles.ctaFooterDot} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040D0B',
  },
  safeArea: {
    flex: 1,
  },

  // Atmospheric orbs
  orbTeal: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    backgroundColor: 'rgba(27, 122, 108, 0.12)',
    top: SCREEN_H * 0.08,
    left: -SCREEN_W * 0.25,
  },
  orbBrass: {
    position: 'absolute',
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    borderRadius: SCREEN_W * 0.25,
    backgroundColor: 'rgba(201, 162, 39, 0.06)',
    top: SCREEN_H * 0.55,
    right: -SCREEN_W * 0.15,
  },
  orbDeep: {
    position: 'absolute',
    width: SCREEN_W * 0.6,
    height: SCREEN_W * 0.6,
    borderRadius: SCREEN_W * 0.3,
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
    bottom: -SCREEN_W * 0.1,
    left: SCREEN_W * 0.2,
  },

  diagonalLine: {
    position: 'absolute',
    width: 1,
    height: SCREEN_H * 0.35,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    top: SCREEN_H * 0.1,
    right: 40,
    transform: [{ rotate: '25deg' }],
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  topBarLine: {
    height: 1,
    width: 36,
    backgroundColor: 'rgba(201, 162, 39, 0.4)',
  },
  topBarLabel: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 9,
    letterSpacing: 5,
    color: 'rgba(212, 175, 55, 0.65)',
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 36,
  },

  // Hero
  heroZone: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  logoWrap: {
    marginBottom: 28,
  },
  logoBorder: {
    width: 110,
    height: 110,
    borderRadius: 32,
    padding: 3,
    ...Shadows.goldGlow,
  },
  logoCore: {
    flex: 1,
    borderRadius: 29,
    backgroundColor: '#0A1614',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 48,
  },
  logoCornerTL: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 20,
    height: 20,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(201, 162, 39, 0.5)',
  },
  logoCornerBR: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(201, 162, 39, 0.5)',
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  titleMain: {
    fontFamily: FontFamily.display,
    fontSize: 56,
    letterSpacing: -3,
    color: '#F4F0E8',
    includeFontPadding: false,
  },
  titleDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  titleDividerLine: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(201, 162, 39, 0.55)',
  },
  titleDividerDiamond: {
    width: 7,
    height: 7,
    backgroundColor: Colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  titleArabic: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.accentLight,
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: 'rgba(244, 240, 232, 0.55)',
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 48,
    marginTop: Spacing.sm,
  },

  // Features
  featureStrip: {
    marginHorizontal: Spacing.xxl,
    backgroundColor: 'rgba(255, 252, 247, 0.04)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.2)',
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  featureNumBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureNum: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.accent,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    color: 'rgba(244, 240, 232, 0.88)',
    lineHeight: 20,
  },
  featureSep: {
    position: 'absolute',
    bottom: 0,
    left: 70,
    right: Spacing.xl,
    height: 1,
    backgroundColor: 'rgba(201, 162, 39, 0.12)',
  },

  // CTA
  ctaZone: {
    paddingHorizontal: Spacing.xxl,
    gap: 12,
  },
  ctaPrimary: {
    borderRadius: Radius.lg,
    paddingVertical: 18,
    paddingHorizontal: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ctaArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  ctaArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FontFamily.bodySemibold,
  },
  ctaSecondary: {
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201, 162, 39, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  ctaSecondaryText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 17,
    color: 'rgba(244, 240, 232, 0.85)',
    letterSpacing: 0.3,
  },
  ctaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  ctaFooterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(201, 162, 39, 0.4)',
  },
  ctaFooterText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(244, 240, 232, 0.3)',
    textTransform: 'uppercase',
  },
});
