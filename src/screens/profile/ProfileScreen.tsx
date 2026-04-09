import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  I18nManager,
  DevSettings,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
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
import FunButton from '../../components/FunButton';
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

const { width: SW } = Dimensions.get('window');

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

  const renderAchievementsCard = () => {
    return (
      <View style={styles.section}>
        <AnimatedListItem index={0}>
          <BouncyPressable onPress={() => navigation.navigate('Achievements')}>
            <ThemedCard style={styles.achievementCardButton}>
              <View style={styles.achievementCardContent}>
                <View style={styles.achievementCardLeft}>
                  <LinearGradient
                    colors={colors.primaryGradient}
                    style={styles.achievementCardIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="trophy" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.achievementCardTitle}>{t('achievements.sectionTitle')}</Text>
                    <Text style={styles.achievementCardSubtitle}>
                      {earnedAchievements.length} / {ACHIEVEMENT_DEFS.length} {t('achievements.earned')}
                    </Text>
                  </View>
                </View>
                <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
              </View>
            </ThemedCard>
          </BouncyPressable>
        </AnimatedListItem>
      </View>
    );
  };

  const settingsItems: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
    onPress: () => void;
    gradColors: [string, string, ...string[]];
  }> = [
    {
      icon: <MoonIcon size={20} color="#FFFFFF" strokeWidth={2.5} />,
      label: t('profile.appearance') || 'Appearance',
      value: isDark ? t('profile.dark') : t('profile.light'),
      onPress: toggleTheme,
      gradColors: isDark ? ['#1B7A6C', '#14B8A6'] : ['#0D9488', '#14B8A6'],
    },
    {
      icon: <GlobeAltIcon size={20} color="#FFFFFF" strokeWidth={2.5} />,
      label: t('profile.language'),
      value: isArabic ? t('profile.arabic') : t('profile.english'),
      onPress: handleLanguageToggle,
      gradColors: colors.primaryGradient,
    },
    {
      icon: <CurrencyDollarIcon size={20} color="#FFFFFF" strokeWidth={2.5} />,
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
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl) }]} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
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

            <Text style={styles.displayName}>{profile?.display_name || ''}</Text>
            <Text style={styles.email}>{profile?.email || ''}</Text>

            <View style={styles.heroDivider}>
              <View style={styles.heroDividerLine} />
              <View style={styles.heroDividerDiamond} />
              <View style={styles.heroDividerLine} />
            </View>
          </Animated.View>

          {/* Achievements */}
          {renderAchievementsCard()}

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.preferences')}</Text>

            {settingsItems.map((s, i) => (
              <AnimatedListItem key={i} index={i}>
                <BouncyPressable onPress={s.onPress}>
                  <ThemedCard style={styles.settingRowCard}>
                    <View style={styles.settingRow}>
                      <View style={styles.settingLeft}>
                        <LinearGradient
                          colors={s.gradColors}
                          style={styles.settingIcon}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {s.icon}
                        </LinearGradient>
                        <Text style={styles.settingLabel}>{s.label}</Text>
                      </View>
                      <View style={styles.settingRight}>
                        <View style={styles.settingValueBadge}>
                          <Text style={styles.settingValue}>{s.value}</Text>
                        </View>
                        <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
                      </View>
                    </View>
                  </ThemedCard>
                </BouncyPressable>
              </AnimatedListItem>
            ))}

            {/* Pro */}
            <AnimatedListItem index={settingsItems.length + 1}>
              <BouncyPressable onPress={() => navigation.navigate('Paywall', { trigger: 'general' })}>
                <ThemedCard style={styles.settingRowCard}>
                  {isDark && (
                    <LinearGradient
                      colors={['rgba(201,162,39,0.1)', 'rgba(201,162,39,0.03)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  )}
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <LinearGradient
                        colors={[colors.accentGradient[0], colors.accentGradient[1]]}
                        style={styles.settingIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <StarIcon size={20} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.fiftiPro')}</Text>
                        <Text style={styles.settingHint}>{t('profile.fiftiProHint')}</Text>
                      </View>
                    </View>
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>{t('profile.pro')}</Text>
                    </View>
                  </View>
                </ThemedCard>
              </BouncyPressable>
            </AnimatedListItem>

            {/* Data Export */}
            <AnimatedListItem index={settingsItems.length + 2}>
              <BouncyPressable onPress={() => navigation.navigate('DataExport')}>
                <ThemedCard style={styles.settingRowCard}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <LinearGradient
                        colors={colors.successGradient}
                        style={styles.settingIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <ArrowDownTrayIcon size={20} color="#FFFFFF" strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={styles.settingLabel}>{t('export.menuLabel')}</Text>
                    </View>
                    <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
                  </View>
                </ThemedCard>
              </BouncyPressable>
            </AnimatedListItem>

            {/* About */}
            <AnimatedListItem index={settingsItems.length + 3}>
              <BouncyPressable onPress={() => navigation.navigate('About')}>
                <ThemedCard style={styles.settingRowCard}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <LinearGradient
                        colors={isDark ? ['#0B1F1A', '#122420'] : [colors.bgSubtle, colors.bgSubtle]}
                        style={styles.settingIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <InformationCircleIcon size={20} color={isDark ? '#FFFFFF' : colors.textSecondary} strokeWidth={2.5} />
                      </LinearGradient>
                      <Text style={styles.settingLabel}>{t('profile.about')}</Text>
                    </View>
                    <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
                  </View>
                </ThemedCard>
              </BouncyPressable>
            </AnimatedListItem>
          </View>

          {/* Sign out */}
          <View style={styles.signOutWrap}>
            <FunButton
              title={signingOut ? t('profile.signingOut') : t('profile.signOut')}
              onPress={handleSignOut}
              variant="danger"
              loading={signingOut}
              disabled={signingOut}
              icon={<ArrowRightOnRectangleIcon size={20} color="#FFFFFF" strokeWidth={2.5} />}
            />
          </View>

          <Text style={styles.version}>{t('profile.version')}</Text>
        </ScrollView>
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
    scroll: { paddingBottom: Spacing.xxl },

    bgOrb: {
      position: 'absolute',
      width: SW * 0.7,
      height: SW * 0.7,
      borderRadius: SW * 0.35,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(13,148,136,0.03)',
      top: -SW * 0.15,
      right: -SW * 0.25,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.35,
      height: SW * 0.35,
      borderRadius: SW * 0.175,
      backgroundColor: isDark ? 'rgba(27,122,108,0.04)' : 'rgba(201,162,39,0.03)',
      bottom: SW * 0.1,
      left: -SW * 0.1,
    },

    hero: {
      alignItems: 'center',
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    avatarWrap: { marginBottom: Spacing.lg },
    avatarBorder: {
      width: 80,
      height: 80,
      borderRadius: 26,
      padding: 3,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    avatarCore: {
      flex: 1,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 26,
    },
    displayName: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 22,
      color: c.text,
      letterSpacing: -0.3,
    },
    email: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginTop: 2,
    },
    heroDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: Spacing.lg,
    },
    heroDividerLine: { width: 28, height: 1, backgroundColor: isDark ? 'rgba(201,162,39,0.25)' : c.borderLight },
    heroDividerDiamond: { width: 6, height: 6, backgroundColor: c.accent, transform: [{ rotate: '45deg' }], borderRadius: 1 },

    section: {
      marginHorizontal: Spacing.lg,
      gap: 6,
    },
    sectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.kicker,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.xs,
      marginBottom: 4,
    },

    achievementCardButton: {
      padding: 0,
    },
    achievementCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 13,
    },
    achievementCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    achievementCardIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    achievementCardTitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: c.text,
    },
    achievementCardSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 2,
    },

    settingRowCard: {
      padding: 0,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 13,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: c.text,
    },
    settingHint: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 2,
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settingValueBadge: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgSubtle,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    settingValue: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 13,
      color: c.textSecondary,
    },

    proBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.sm,
      backgroundColor: isDark ? 'rgba(201,162,39,0.2)' : '#FDF6E3',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.4)' : '#E8D88C',
    },
    proBadgeText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 10,
      letterSpacing: 2,
      color: c.accent,
    },

    signOutWrap: {
      marginTop: Spacing.xl,
      marginHorizontal: Spacing.lg,
    },
    version: {
      fontFamily: FontFamily.body,
      textAlign: 'center',
      fontSize: 11,
      color: c.textTertiary,
      marginTop: Spacing.lg,
    },
    langOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
  });
