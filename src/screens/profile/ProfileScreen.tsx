import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  I18nManager,
  DevSettings,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MoonIcon, GlobeAltIcon, CurrencyDollarIcon, StarIcon, InformationCircleIcon, ArrowRightOnRectangleIcon, ArrowDownTrayIcon } from 'react-native-heroicons/solid';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { changeLanguage } from '../../lib/i18n';
import { Spacing, Radius, FontFamily } from '../../theme';
import { chevronForward } from '../../utils/rtl';
import BouncyPressable from '../../components/BouncyPressable';
import ThemedCard from '../../components/ThemedCard';
import AnimatedListItem from '../../components/AnimatedListItem';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { CurrencyCode, UserAchievement } from '../../types/database';
import { Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ACHIEVEMENT_DEFS, getAchievementDef } from '../../data/achievementDefinitions';

const PROFILE_CURRENCIES: CurrencyCode[] = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'INR', 'PKR', 'TRY', 'CAD', 'AUD', 'BRL'];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [signingOut, setSigningOut] = useState(false);
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const isArabic = i18n.language === 'ar';
  const currentCurrency = profile?.preferred_currency || 'EGP';

  // Fetch earned achievements when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const fetchAchievements = async () => {
        if (!profile?.id) return;
        try {
          const { data, error } = await supabase
            .from('user_achievements')
            .select('type')
            .eq('user_id', profile.id);

          if (error) throw error;
          setEarnedAchievements(data?.map((d: any) => d.type) || []);
        } catch (err) {
          console.error('Error fetching achievements:', err);
        }
      };

      fetchAchievements();
    }, [profile?.id])
  );

  // Bouncy hero avatar
  const heroScale = useRef(new Animated.Value(0)).current;
  const heroRotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(heroScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 90,
        delay: 150,
      }),
      Animated.timing(heroRotate, {
        toValue: 1,
        duration: 600,
        delay: 150,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const [switchingLang, setSwitchingLang] = useState(false);

  const handleLanguageToggle = async () => {
    const newLang = isArabic ? 'en' : 'ar';
    const shouldBeRTL = newLang === 'ar';
    const needsRestart = I18nManager.isRTL !== shouldBeRTL;

    setSwitchingLang(true);

    try {
      // Save preference first
      if (profile) {
        await supabase.from('users').update({ preferred_lang: newLang }).eq('id', profile.id);
      }
      await changeLanguage(newLang);

      if (needsRestart) {
        I18nManager.forceRTL(shouldBeRTL);
        I18nManager.allowRTL(shouldBeRTL);
        // Small delay so user sees the loading state before reload
        setTimeout(() => {
          if (__DEV__) DevSettings.reload();
          else alert.warning(t('profile.restartRequired'), t('profile.restartMessage'));
        }, 300);
      } else {
        setSwitchingLang(false);
      }
    } catch (err) {
      console.error('Failed to change language:', err);
      setSwitchingLang(false);
    }
  };

  const handleCurrencyToggle = async () => {
    if (!profile) return;
    const idx = PROFILE_CURRENCIES.indexOf(currentCurrency as CurrencyCode);
    const newCurrency = PROFILE_CURRENCIES[(idx + 1) % PROFILE_CURRENCIES.length];
    try {
      const { error } = await supabase.from('users').update({ preferred_currency: newCurrency }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) { alert.error(t('common.error'), t('profile.updateFailed')); }
  };

  const handleSignOut = () => {
    alert.confirm(
      t('profile.signOutTitle'),
      t('profile.signOutConfirm'),
      async () => {
        setSigningOut(true);
        try { await signOut(); } catch { setSigningOut(false); }
      },
      t('profile.signOut'),
      t('common.cancel'),
      true,
    );
  };

  const getInitials = (): string => {
    if (!profile?.display_name) return '?';
    return profile.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleShareBadge = async (badgeType: string) => {
    const def = getAchievementDef(badgeType as any);
    if (!def) return;

    const shareText = t(def.shareTextKey);
    try {
      await Share.share({
        message: shareText,
        url: 'https://fifti.app', // App store/play store link would go here
        title: t(def.titleKey),
      });
    } catch (err) {
      console.error('Error sharing badge:', err);
    }
  };

  const quickTiles: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
    onPress: () => void;
    gradColors: [string, string, ...string[]];
  }> = [
    {
      icon: <MoonIcon size={18} color="#FFFFFF" strokeWidth={2.5} />,
      label: t('profile.appearance') || 'Appearance',
      value: isDark ? t('profile.dark') : t('profile.light'),
      onPress: toggleTheme,
      gradColors: isDark ? ['#1B7A6C', '#14B8A6'] : ['#0D9488', '#14B8A6'],
    },
    {
      icon: <GlobeAltIcon size={18} color="#FFFFFF" strokeWidth={2.5} />,
      label: t('profile.language'),
      value: isArabic ? t('profile.arabic') : t('profile.english'),
      onPress: handleLanguageToggle,
      gradColors: colors.primaryGradient,
    },
    {
      icon: <CurrencyDollarIcon size={18} color="#FFFFFF" strokeWidth={2.5} />,
      label: t('profile.defaultCurrency'),
      value: currentCurrency,
      onPress: handleCurrencyToggle,
      gradColors: colors.successGradient,
    },
  ];

  const rotateInterpolate = heroRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '0deg'],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient
          colors={colors.headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
        />
      )}

      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing.lg) }]}>
          {/* Compact Hero — avatar + info + sign-out icon */}
          <Animated.View style={[styles.hero, entrance.style]}>
            <Animated.View style={[styles.avatarWrap, { transform: [{ scale: heroScale }, { rotate: rotateInterpolate }] }]}>
              <LinearGradient
                colors={colors.accentGradient}
                style={styles.avatarBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.avatarCore, { backgroundColor: isDark ? '#0A1614' : colors.bgCard }]}>
                  <Text style={[styles.avatarText, { color: isDark ? colors.accentLight : colors.accent }]}>
                    {getInitials()}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>

            <View style={styles.heroInfo}>
              <Text style={styles.displayName} numberOfLines={1}>{profile?.display_name || ''}</Text>
              <Text style={styles.email} numberOfLines={1}>{profile?.email || ''}</Text>
            </View>

            <BouncyPressable onPress={handleSignOut} disabled={signingOut}>
              <View style={styles.signOutIcon}>
                {signingOut ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <ArrowRightOnRectangleIcon size={18} color={colors.danger} strokeWidth={2.5} />
                )}
              </View>
            </BouncyPressable>
          </Animated.View>

          {/* Achievements */}
          <AnimatedListItem index={0}>
            <BouncyPressable onPress={() => navigation.navigate('Achievements')}>
              <ThemedCard style={styles.compactCard}>
                <View style={styles.rowContent}>
                  <View style={styles.rowLeft}>
                    <LinearGradient
                      colors={colors.primaryGradient}
                      style={styles.rowIcon}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="trophy" size={18} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowTitle}>{t('achievements.sectionTitle')}</Text>
                      <Text style={styles.rowSubtitle}>
                        {earnedAchievements.length} / {ACHIEVEMENT_DEFS.length} {t('achievements.earned')}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
                </View>
              </ThemedCard>
            </BouncyPressable>
          </AnimatedListItem>

          {/* Pro */}
          <AnimatedListItem index={1}>
            <BouncyPressable onPress={() => navigation.navigate('Paywall', { trigger: 'general' })}>
              <ThemedCard style={styles.compactCard}>
                {isDark && (
                  <LinearGradient
                    colors={['rgba(201,162,39,0.1)', 'rgba(201,162,39,0.03)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={styles.rowContent}>
                  <View style={styles.rowLeft}>
                    <LinearGradient
                      colors={[colors.accentGradient[0], colors.accentGradient[1]]}
                      style={styles.rowIcon}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <StarIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowTitle}>{t('profile.fiftiPro')}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>{t('profile.fiftiProHint')}</Text>
                    </View>
                  </View>
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>{t('profile.pro')}</Text>
                  </View>
                </View>
              </ThemedCard>
            </BouncyPressable>
          </AnimatedListItem>

          {/* Quick settings tile grid */}
          <View style={styles.tileGrid}>
            {quickTiles.map((tile, i) => (
              <AnimatedListItem key={i} index={i + 2} style={styles.tileFlex}>
                <BouncyPressable onPress={tile.onPress}>
                  <ThemedCard style={styles.tileCard}>
                    <View style={styles.tileContent}>
                      <LinearGradient
                        colors={tile.gradColors}
                        style={styles.tileIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {tile.icon}
                      </LinearGradient>
                      <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
                      <Text style={styles.tileValue} numberOfLines={1}>{tile.value}</Text>
                    </View>
                  </ThemedCard>
                </BouncyPressable>
              </AnimatedListItem>
            ))}
          </View>

          {/* Data Export + About — 2 column row */}
          <View style={styles.tileGrid}>
            <AnimatedListItem index={5} style={styles.tileFlex}>
              <BouncyPressable onPress={() => navigation.navigate('DataExport')}>
                <ThemedCard style={styles.compactCard}>
                  <View style={styles.rowContent}>
                    <View style={styles.rowLeft}>
                      <LinearGradient
                        colors={colors.successGradient}
                        style={styles.rowIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <ArrowDownTrayIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={styles.rowTitle} numberOfLines={1}>{t('export.menuLabel')}</Text>
                    </View>
                  </View>
                </ThemedCard>
              </BouncyPressable>
            </AnimatedListItem>

            <AnimatedListItem index={6} style={styles.tileFlex}>
              <BouncyPressable onPress={() => navigation.navigate('About')}>
                <ThemedCard style={styles.compactCard}>
                  <View style={styles.rowContent}>
                    <View style={styles.rowLeft}>
                      <LinearGradient
                        colors={isDark ? ['#0B1F1A', '#122420'] : [colors.bgSubtle, colors.bgSubtle]}
                        style={styles.rowIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <InformationCircleIcon size={18} color={isDark ? '#FFFFFF' : colors.textSecondary} strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={styles.rowTitle} numberOfLines={1}>{t('profile.about')}</Text>
                    </View>
                  </View>
                </ThemedCard>
              </BouncyPressable>
            </AnimatedListItem>
          </View>

          <View style={styles.flexSpacer} />
          <Text style={styles.version}>{t('profile.version')}</Text>
        </View>
      </SafeAreaView>

      {/* Language switch loading overlay */}
      {switchingLang && (
        <View style={styles.langOverlay}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    container: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
    },

    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    avatarWrap: {},
    avatarBorder: {
      width: 56,
      height: 56,
      borderRadius: 18,
      padding: 2.5,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    avatarCore: {
      flex: 1,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
    },
    heroInfo: {
      flex: 1,
      minWidth: 0,
    },
    displayName: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      color: c.text,
      letterSpacing: -0.3,
    },
    email: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 2,
    },
    signOutIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.18)',
    },

    compactCard: {
      padding: 0,
    },
    rowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 11,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.text,
    },
    rowSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 1,
    },

    tileGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    tileFlex: {
      flex: 1,
    },
    tileCard: {
      padding: 0,
    },
    tileContent: {
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.md,
      gap: 6,
    },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    tileLabel: {
      fontFamily: FontFamily.body,
      fontSize: 10,
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tileValue: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.text,
    },

    proBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? 'rgba(201,162,39,0.2)' : '#FDF6E3',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.4)' : '#E8D88C',
    },
    proBadgeText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 9,
      letterSpacing: 1.5,
      color: c.accent,
    },

    flexSpacer: { flex: 1 },
    version: {
      fontFamily: FontFamily.body,
      textAlign: 'center',
      fontSize: 11,
      color: c.textTertiary,
      marginTop: Spacing.sm,
    },
    langOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
  });
