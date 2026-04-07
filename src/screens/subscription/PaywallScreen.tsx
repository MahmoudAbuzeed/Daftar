import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { FREE_LIMITS, useSubscription } from '../../lib/subscription-context';
import { getPackages, purchasePackage, restorePurchases } from '../../lib/purchases';
import { useAlert } from '../../hooks/useAlert';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import BouncyPressable from '../../components/BouncyPressable';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

type PlanInterval = 'monthly' | 'yearly';

const { width: SW } = Dimensions.get('window');

const FEATURES = [
  { key: 'unlimitedGroups', icon: 'people' },
  { key: 'unlimitedScans', icon: 'scan' },
  { key: 'unlimitedContacts', icon: 'person-add' },
  { key: 'dataExport', icon: 'download' },
  { key: 'analytics', icon: 'bar-chart' },
  { key: 'recurringExpenses', icon: 'repeat' },
  { key: 'unlimitedReminders', icon: 'logo-whatsapp' },
  { key: 'proBadge', icon: 'ribbon' },
] as const;

export default function PaywallScreen({ navigation, route }: Props) {
  const { trigger } = route.params;
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { refreshSubscription } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanInterval>('yearly');
  const [subscribing, setSubscribing] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    getPackages().then(setPackages);
  }, []);

  // ── Entrance animations ──────────────────────────────────────
  const entrance = useScreenEntrance();

  // Staggered feature rows
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const featureTranslates = useRef(FEATURES.map(() => new Animated.Value(24))).current;

  // Star pulse
  const starScale = useRef(new Animated.Value(0)).current;
  const starRotate = useRef(new Animated.Value(0)).current;

  // Shimmer on hero
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Star entrance
    Animated.parallel([
      Animated.spring(starScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 8,
        stiffness: 100,
        delay: 200,
      }),
      Animated.timing(starRotate, {
        toValue: 1,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.back(1.8)),
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered features
    const featureAnimations = FEATURES.map((_, i) =>
      Animated.parallel([
        Animated.timing(featureAnims[i], {
          toValue: 1,
          duration: 400,
          delay: 400 + i * 60,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(featureTranslates[i], {
          toValue: 0,
          delay: 400 + i * 60,
          useNativeDriver: true,
          damping: 18,
          stiffness: 160,
        }),
      ]),
    );
    Animated.stagger(0, featureAnimations).start();

    // Shimmer loop
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  // ── Context banner text ──────────────────────────────────────
  const contextBannerText = useMemo(() => {
    switch (trigger) {
      case 'receipt_scan_limit':
        return t('subscription.scanLimitBody', {
          used: FREE_LIMITS.maxReceiptScans,
          limit: FREE_LIMITS.maxReceiptScans,
        });
      case 'group_limit':
        return t('subscription.groupLimitBody', {
          used: FREE_LIMITS.maxGroups,
          limit: FREE_LIMITS.maxGroups,
        });
      case 'ledger_limit':
        return t('subscription.ledgerLimitBody');
      case 'export':
        return t('subscription.exportTitle');
      default:
        return t('subscription.generalTitle');
    }
  }, [trigger, t]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSubscribe = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubscribing(true);
    try {
      // Find the matching package
      const pkg = packages.find(p =>
        selectedPlan === 'yearly'
          ? p.packageType === 'ANNUAL'
          : p.packageType === 'MONTHLY'
      ) || packages[0];

      if (!pkg) {
        // Fallback: no packages available (not configured yet)
        alert.info(t('subscription.successTitle'), t('subscription.successBody'));
        navigation.goBack();
        return;
      }

      const result = await purchasePackage(pkg);
      if (result.success) {
        await refreshSubscription();
        alert.success(t('subscription.successTitle'), t('subscription.successBody'));
        navigation.goBack();
      }
    } catch (err: any) {
      alert.error(t('subscription.errorTitle'), err.message || t('subscription.errorBody'));
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await restorePurchases();
      if (result.success) {
        await refreshSubscription();
        alert.success(t('subscription.successTitle'), t('subscription.successBody'));
        navigation.goBack();
      } else {
        alert.info(t('subscription.restorePurchases'), t('subscription.noActiveSubscription'));
      }
    } catch {
      alert.error(t('subscription.errorTitle'), t('subscription.errorBody'));
    }
  };

  const handleMaybeLater = () => {
    navigation.goBack();
  };

  // ── Derived animation values ─────────────────────────────────
  const starRotateInterp = starRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  });

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-SW, 0, SW],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={
          isDark
            ? ['#040D0B', '#0B1F1A', '#0F2722']
            : [colors.bg, colors.bgSubtle, colors.bg]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
      />

      {/* Decorative background orbs */}
      <View
        style={[
          styles.bgOrb,
          {
            backgroundColor: isDark
              ? 'rgba(201,162,39,0.06)'
              : 'rgba(166,124,0,0.04)',
          },
        ]}
      />
      <View
        style={[
          styles.bgOrbSmall,
          {
            backgroundColor: isDark
              ? 'rgba(27,122,108,0.06)'
              : 'rgba(13,148,136,0.03)',
          },
        ]}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleMaybeLater}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="close"
            size={24}
            color={isDark ? colors.textSecondary : colors.textTertiary}
          />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* ── Hero Section ──────────────────────────────────── */}
          <Animated.View style={[styles.heroSection, entrance.style]}>
            {/* Star icon with gold gradient background */}
            <Animated.View
              style={[
                styles.starContainer,
                {
                  transform: [
                    { scale: starScale },
                    { rotate: starRotateInterp },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={colors.accentGradient}
                style={styles.starGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Shimmer overlay */}
                <Animated.View
                  style={[
                    styles.shimmerOverlay,
                    {
                      transform: [{ translateX: shimmerTranslate }],
                    },
                  ]}
                />
                <Ionicons name="star" size={40} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.heroTitle}>{t('subscription.fiftiPro')}</Text>
            <Text style={styles.heroSubtitle}>
              {t('subscription.upgradeTitle')}
            </Text>

            {/* Decorative divider */}
            <View style={styles.heroDivider}>
              <View style={styles.heroDividerLine} />
              <View style={styles.heroDividerDiamond} />
              <View style={styles.heroDividerLine} />
            </View>
          </Animated.View>

          {/* ── Context Banner ────────────────────────────────── */}
          <Animated.View style={[styles.contextBanner, entrance.style]}>
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(201,162,39,0.12)', 'rgba(201,162,39,0.04)']
                  : ['rgba(166,124,0,0.08)', 'rgba(166,124,0,0.02)']
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons
              name="information-circle"
              size={20}
              color={colors.accent}
              style={styles.contextIcon}
            />
            <Text style={styles.contextText}>{contextBannerText}</Text>
          </Animated.View>

          {/* ── Feature List ──────────────────────────────────── */}
          <View style={styles.featureSection}>
            {FEATURES.map((feature, i) => (
              <Animated.View
                key={feature.key}
                style={[
                  styles.featureRow,
                  {
                    opacity: featureAnims[i],
                    transform: [{ translateY: featureTranslates[i] }],
                  },
                ]}
              >
                <LinearGradient
                  colors={colors.successGradient}
                  style={styles.featureCheckCircle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </LinearGradient>
                <Ionicons
                  name={feature.icon as any}
                  size={18}
                  color={isDark ? colors.textSecondary : colors.textTertiary}
                  style={styles.featureIcon}
                />
                <Text style={styles.featureText}>
                  {t(`subscription.features.${feature.key}`)}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* ── Pricing Pills ─────────────────────────────────── */}
          <View style={styles.pricingRow}>
            {/* Monthly */}
            <BouncyPressable
              onPress={() => setSelectedPlan('monthly')}
              style={styles.pricingPillWrap}
            >
              <View
                style={[
                  styles.pricingPill,
                  selectedPlan === 'monthly'
                    ? styles.pricingPillSelected
                    : styles.pricingPillUnselected,
                ]}
              >
                {selectedPlan === 'monthly' && (
                  <LinearGradient
                    colors={colors.primaryGradient}
                    style={styles.pricingPillBorderGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={styles.pricingPillInner}>
                  <View style={styles.pricingRadio}>
                    {selectedPlan === 'monthly' && (
                      <LinearGradient
                        colors={colors.primaryGradient}
                        style={styles.pricingRadioFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                  </View>
                  <View style={styles.pricingTextBlock}>
                    <Text style={styles.pricingLabel}>
                      {t('subscription.monthlyPrice')}
                    </Text>
                  </View>
                </View>
              </View>
            </BouncyPressable>

            {/* Yearly */}
            <BouncyPressable
              onPress={() => setSelectedPlan('yearly')}
              style={styles.pricingPillWrap}
            >
              <View
                style={[
                  styles.pricingPill,
                  selectedPlan === 'yearly'
                    ? styles.pricingPillSelected
                    : styles.pricingPillUnselected,
                ]}
              >
                {selectedPlan === 'yearly' && (
                  <LinearGradient
                    colors={colors.primaryGradient}
                    style={styles.pricingPillBorderGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={styles.pricingPillInner}>
                  <View style={styles.pricingRadio}>
                    {selectedPlan === 'yearly' && (
                      <LinearGradient
                        colors={colors.primaryGradient}
                        style={styles.pricingRadioFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                  </View>
                  <View style={styles.pricingTextBlock}>
                    <Text style={styles.pricingLabel}>
                      {t('subscription.yearlyPrice')}
                    </Text>
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>
                        {t('subscription.yearlySavings')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </BouncyPressable>
          </View>

          {/* ── Subscribe Button ──────────────────────────────── */}
          <View style={styles.subscribeWrap}>
            <FunButton
              title={t('subscription.subscribeButton')}
              onPress={handleSubscribe}
              icon={
                <Ionicons
                  name="star"
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
              }
              style={styles.subscribeBtn}
            />
          </View>

          {/* ── Maybe Later ───────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleMaybeLater}
            style={styles.maybeLaterBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.maybeLaterText}>
              {t('subscription.maybeLater')}
            </Text>
          </TouchableOpacity>

          {/* ── Restore Purchases ─────────────────────────────── */}
          <TouchableOpacity
            onPress={handleRestore}
            style={styles.restoreBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.restoreText}>
              {t('subscription.restorePurchases')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    safe: {
      flex: 1,
    },
    scroll: {
      paddingBottom: 60,
    },

    // Background orbs
    bgOrb: {
      position: 'absolute',
      width: SW * 0.8,
      height: SW * 0.8,
      borderRadius: SW * 0.4,
      top: -SW * 0.2,
      right: -SW * 0.3,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.4,
      height: SW * 0.4,
      borderRadius: SW * 0.2,
      bottom: SW * 0.3,
      left: -SW * 0.15,
    },

    // Close button
    closeBtn: {
      position: 'absolute',
      top: 8,
      right: Spacing.lg,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Hero
    heroSection: {
      alignItems: 'center',
      paddingTop: Spacing.huge,
      paddingBottom: Spacing.lg,
    },
    starContainer: {
      marginBottom: Spacing.lg,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    starGradient: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    shimmerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 40,
      height: '100%',
      backgroundColor: 'rgba(255,255,255,0.18)',
      transform: [{ skewX: '-20deg' }],
    },
    heroTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      color: isDark ? c.accentLight : c.accent,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: c.textSecondary,
      marginTop: Spacing.xs,
      textAlign: 'center',
      paddingHorizontal: Spacing.xxl,
    },
    heroDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: Spacing.xl,
    },
    heroDividerLine: {
      width: 32,
      height: 1,
      backgroundColor: isDark ? 'rgba(201,162,39,0.25)' : c.borderLight,
    },
    heroDividerDiamond: {
      width: 6,
      height: 6,
      backgroundColor: c.accent,
      transform: [{ rotate: '45deg' }],
      borderRadius: 1,
    },

    // Context banner
    contextBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.md,
      marginBottom: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.2)' : 'rgba(166,124,0,0.12)',
      overflow: 'hidden',
    },
    contextIcon: {
      marginRight: Spacing.sm,
    },
    contextText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 13,
      color: isDark ? c.accentLight : c.accent,
      flex: 1,
      lineHeight: 18,
    },

    // Feature list
    featureSection: {
      marginHorizontal: Spacing.xl,
      gap: 10,
      marginBottom: Spacing.xxl,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureCheckCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    featureIcon: {
      marginLeft: Spacing.md,
      width: 22,
    },
    featureText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: c.text,
      marginLeft: Spacing.sm,
      flex: 1,
    },

    // Pricing
    pricingRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginHorizontal: Spacing.xl,
      gap: Spacing.md,
      marginBottom: Spacing.xxl,
    },
    pricingPillWrap: {
      flex: 1,
    },
    pricingPill: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
      borderWidth: 2,
      flex: 1,
      justifyContent: 'center',
    },
    pricingPillSelected: {
      borderColor: 'transparent',
    },
    pricingPillUnselected: {
      borderColor: isDark ? c.borderLight : c.border,
    },
    pricingPillBorderGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: Radius.xl - 1,
    },
    pricingPillInner: {
      margin: 2,
      borderRadius: Radius.xl - 3,
      backgroundColor: isDark ? c.bgCard : c.bgCard,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    pricingRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: isDark ? c.borderLight : c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pricingRadioFill: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    pricingTextBlock: {
      alignItems: 'center',
      gap: Spacing.xs,
    },
    pricingLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.text,
      textAlign: 'center',
    },
    saveBadge: {
      backgroundColor: isDark ? 'rgba(201,162,39,0.2)' : '#FDF6E3',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.35)' : '#E8D88C',
    },
    saveBadgeText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      color: c.accent,
      textTransform: 'uppercase',
    },

    // Subscribe button
    subscribeWrap: {
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
    },
    subscribeBtn: {},

    // Maybe later
    maybeLaterBtn: {
      alignSelf: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    maybeLaterText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textTertiary,
    },

    // Restore
    restoreBtn: {
      alignSelf: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      marginTop: Spacing.xs,
    },
    restoreText: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      textDecorationLine: 'underline',
    },
  });
