import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const FEATURE_EMOJIS = ['💸', '📊', '🧾'];

export default function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // ── Logo bounce on mount ──
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // ── Tagline emoji rotation ──
  const emojiSpin = useRef(new Animated.Value(0)).current;

  // ── Orb drift animations ──
  const orbTealX = useRef(new Animated.Value(0)).current;
  const orbTealY = useRef(new Animated.Value(0)).current;
  const orbBrassX = useRef(new Animated.Value(0)).current;
  const orbBrassY = useRef(new Animated.Value(0)).current;

  // ── Title entrance ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(24)).current;

  // ── Tagline entrance ──
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo: spring in with a satisfying bounce
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 8,
      stiffness: 140,
      mass: 0.9,
      delay: 200,
    }).start();

    // Logo: subtle continuous wobble
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: -1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Tagline emoji: continuous slow spin
    Animated.loop(
      Animated.timing(emojiSpin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Title entrance
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(titleSlide, {
        toValue: 0,
        delay: 500,
        damping: 16,
        stiffness: 160,
        useNativeDriver: true,
      }),
    ]).start();

    // Tagline entrance
    Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: 600,
      delay: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Floating orb drift
    const driftOrb = (
      animX: Animated.Value,
      animY: Animated.Value,
      rangeX: number,
      rangeY: number,
      durationX: number,
      durationY: number,
    ) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animX, {
            toValue: rangeX,
            duration: durationX,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animX, {
            toValue: -rangeX,
            duration: durationX,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(animY, {
            toValue: rangeY,
            duration: durationY,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animY, {
            toValue: -rangeY,
            duration: durationY,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    driftOrb(orbTealX, orbTealY, 18, 12, 6000, 8000);
    driftOrb(orbBrassX, orbBrassY, 14, 20, 7000, 5500);
  }, []);

  const logoAnimStyle = {
    transform: [
      {
        scale: logoScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        }),
      },
      {
        rotate: logoRotate.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-3deg', '0deg', '3deg'],
        }),
      },
    ],
  };

  const emojiSpinStyle = {
    transform: [
      {
        rotate: emojiSpin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const featureKeys = [
    'featureSplitBills',
    'featureTrackDebts',
    'featureScanReceipts',
  ] as const;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.headerGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Floating orbs with drift */}
      <Animated.View
        style={[
          styles.orbTeal,
          { transform: [{ translateX: orbTealX }, { translateY: orbTealY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orbBrass,
          { transform: [{ translateX: orbBrassX }, { translateY: orbBrassY }] },
        ]}
      />
      <View style={styles.orbDeep} />

      {/* Diagonal brass line accent */}
      <View style={styles.diagonalLine} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.bg}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLine} />
          <Text style={styles.topBarLabel}>{t('auth.est')}</Text>
          <View style={styles.topBarLine} />
        </View>

        <View style={styles.content}>
          {/* Hero zone */}
          <View style={styles.heroZone}>
            {/* Bouncy Logo */}
            <Animated.View style={[styles.logoWrap, logoAnimStyle]}>
              <LinearGradient
                colors={colors.accentGradient}
                style={styles.logoBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.logoCore}>
                  <Text style={styles.logoEmoji}>{'\uD83D\uDCD2'}</Text>
                </View>
              </LinearGradient>

              <View style={styles.logoCornerTL} />
              <View style={styles.logoCornerBR} />
            </Animated.View>

            {/* Title stack with entrance */}
            <Animated.View
              style={[
                styles.titleBlock,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleSlide }],
                },
              ]}
            >
              <Text style={styles.titleMain}>Daftar</Text>
              <View style={styles.titleDivider}>
                <View style={styles.titleDividerLine} />
                <View style={styles.titleDividerDiamond} />
                <View style={styles.titleDividerLine} />
              </View>
              <Text style={styles.titleArabic}>{'\u062F\u0641\u062A\u0631'}</Text>
            </Animated.View>

            {/* Tagline with rotating emoji */}
            <Animated.View
              style={[styles.taglineRow, { opacity: taglineOpacity }]}
            >
              <Text style={styles.tagline}>{t('auth.welcomeTagline')}</Text>
              <Animated.Text style={[styles.taglineEmoji, emojiSpinStyle]}>
                {'\u2728'}
              </Animated.Text>
            </Animated.View>
          </View>

          {/* Feature cards with staggered entrance */}
          <View style={styles.featureStrip}>
            {featureKeys.map((key, i) => (
              <AnimatedListItem key={key} index={i} delay={120}>
                <View style={styles.featureItem}>
                  <LinearGradient
                    colors={[
                      `rgba(201,162,39,0.25)`,
                      `rgba(201,162,39,0.05)`,
                    ]}
                    style={styles.featureNumBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.featureEmoji}>
                      {FEATURE_EMOJIS[i]}
                    </Text>
                  </LinearGradient>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureText}>
                      {t(`auth.${key}`)}
                    </Text>
                  </View>
                  {i < 2 && <View style={styles.featureSep} />}
                </View>
              </AnimatedListItem>
            ))}
          </View>

          {/* CTA */}
          <AnimatedListItem index={4} delay={120}>
            <View style={styles.ctaZone}>
              <FunButton
                title={t('auth.signIn')}
                onPress={() => navigation.navigate('SignIn')}
                variant="primary"
                icon={
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                }
              />

              <FunButton
                title={t('auth.signUp')}
                onPress={() => navigation.navigate('SignUp')}
                variant="secondary"
                icon={
                  <Ionicons
                    name="person-add-outline"
                    size={18}
                    color={isDark ? colors.primaryLight : colors.primary}
                  />
                }
              />

              <View style={styles.ctaFooter}>
                <View style={styles.ctaFooterDot} />
                <Text style={styles.ctaFooterText}>
                  {t('auth.taglineShort')}
                </Text>
                <View style={styles.ctaFooterDot} />
              </View>
            </View>
          </AnimatedListItem>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
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
      backgroundColor: isDark
        ? 'rgba(27, 122, 108, 0.12)'
        : 'rgba(13, 148, 136, 0.08)',
      top: SCREEN_H * 0.08,
      left: -SCREEN_W * 0.25,
    },
    orbBrass: {
      position: 'absolute',
      width: SCREEN_W * 0.5,
      height: SCREEN_W * 0.5,
      borderRadius: SCREEN_W * 0.25,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.06)'
        : 'rgba(166, 124, 0, 0.05)',
      top: SCREEN_H * 0.55,
      right: -SCREEN_W * 0.15,
    },
    orbDeep: {
      position: 'absolute',
      width: SCREEN_W * 0.6,
      height: SCREEN_W * 0.6,
      borderRadius: SCREEN_W * 0.3,
      backgroundColor: isDark
        ? 'rgba(20, 184, 166, 0.05)'
        : 'rgba(13, 148, 136, 0.04)',
      bottom: -SCREEN_W * 0.1,
      left: SCREEN_W * 0.2,
    },

    diagonalLine: {
      position: 'absolute',
      width: 1,
      height: SCREEN_H * 0.35,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.15)'
        : 'rgba(166, 124, 0, 0.1)',
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
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.4)'
        : 'rgba(166, 124, 0, 0.25)',
    },
    topBarLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 9,
      letterSpacing: 5,
      color: isDark ? 'rgba(212, 175, 55, 0.65)' : colors.accent,
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
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    logoCore: {
      flex: 1,
      borderRadius: 29,
      backgroundColor: isDark ? '#0A1614' : colors.bgCard,
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
      borderColor: isDark
        ? 'rgba(201, 162, 39, 0.5)'
        : 'rgba(166, 124, 0, 0.3)',
    },
    logoCornerBR: {
      position: 'absolute',
      bottom: -6,
      right: -6,
      width: 20,
      height: 20,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderColor: isDark
        ? 'rgba(201, 162, 39, 0.5)'
        : 'rgba(166, 124, 0, 0.3)',
    },

    titleBlock: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    titleMain: {
      fontFamily: FontFamily.display,
      fontSize: 56,
      letterSpacing: -3,
      color: colors.text,
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
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.55)'
        : 'rgba(166, 124, 0, 0.3)',
    },
    titleDividerDiamond: {
      width: 7,
      height: 7,
      backgroundColor: colors.accent,
      transform: [{ rotate: '45deg' }],
    },
    titleArabic: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      color: colors.accentLight,
      letterSpacing: 1,
    },
    taglineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 48,
      marginTop: Spacing.sm,
      gap: 8,
    },
    tagline: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 23,
      flexShrink: 1,
    },
    taglineEmoji: {
      fontSize: 20,
    },

    // Features
    featureStrip: {
      marginHorizontal: Spacing.xxl,
      backgroundColor: isDark
        ? 'rgba(255, 252, 247, 0.04)'
        : 'rgba(0,0,0,0.03)',
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
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
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    featureEmoji: {
      fontSize: 20,
    },
    featureTextWrap: {
      flex: 1,
    },
    featureText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: isDark ? 'rgba(244, 240, 232, 0.88)' : colors.text,
      lineHeight: 20,
    },
    featureSep: {
      position: 'absolute',
      bottom: 0,
      left: 70,
      right: Spacing.xl,
      height: 1,
      backgroundColor: colors.borderLight,
    },

    // CTA
    ctaZone: {
      paddingHorizontal: Spacing.xxl,
      gap: 12,
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
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.4)'
        : 'rgba(166, 124, 0, 0.25)',
    },
    ctaFooterText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textTertiary,
      textTransform: 'uppercase',
    },
  });
}
