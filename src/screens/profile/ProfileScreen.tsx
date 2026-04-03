import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  I18nManager,
  DevSettings,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { changeLanguage } from '../../lib/i18n';
import { Spacing, Radius, FontFamily } from '../../theme';

const { width: SW } = Dimensions.get('window');

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const isArabic = i18n.language === 'ar';
  const currentCurrency = profile?.preferred_currency || 'EGP';

  const heroScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 12,
      stiffness: 100,
      delay: 150,
    }).start();
  }, []);

  const handleLanguageToggle = async () => {
    const newLang = isArabic ? 'en' : 'ar';
    try {
      await changeLanguage(newLang);
      if (profile) await supabase.from('users').update({ preferred_lang: newLang }).eq('id', profile.id);
      const shouldBeRTL = newLang === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        I18nManager.allowRTL(shouldBeRTL);
        if (__DEV__) DevSettings.reload();
        else Alert.alert(t('profile.restartRequired'), t('profile.restartMessage'));
      }
    } catch (err) { console.error('Failed to change language:', err); }
  };

  const handleCurrencyToggle = async () => {
    if (!profile) return;
    const newCurrency = currentCurrency === 'EGP' ? 'USD' : 'EGP';
    try {
      const { error } = await supabase.from('users').update({ preferred_currency: newCurrency }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) { Alert.alert(t('common.error'), t('profile.updateFailed')); }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: async () => {
        setSigningOut(true);
        try { await signOut(); } catch { setSigningOut(false); }
      }},
    ]);
  };

  const getInitials = (): string => {
    if (!profile?.display_name) return '?';
    return profile.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const settingsItems: Array<{
    icon: string;
    label: string;
    value: string;
    onPress: () => void;
    gradColors: [string, string, ...string[]];
  }> = [
    {
      icon: 'moon-outline',
      label: t('profile.appearance') || 'Appearance',
      value: isDark ? t('profile.dark') : t('profile.light'),
      onPress: toggleTheme,
      gradColors: isDark ? ['#1B7A6C', '#14B8A6'] : ['#0D9488', '#14B8A6'],
    },
    {
      icon: 'globe-outline',
      label: t('profile.language'),
      value: isArabic ? t('profile.arabic') : t('profile.english'),
      onPress: handleLanguageToggle,
      gradColors: colors.primaryGradient,
    },
    {
      icon: 'cash-outline',
      label: t('profile.defaultCurrency'),
      value: currentCurrency,
      onPress: handleCurrencyToggle,
      gradColors: colors.successGradient,
    },
  ];

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
      <View style={styles.bgOrb} />

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <Animated.View style={[styles.hero, { transform: [{ scale: heroScale }] }]}>
            <View style={styles.avatarWrap}>
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
            </View>

            <Text style={styles.displayName}>{profile?.display_name || ''}</Text>
            <Text style={styles.email}>{profile?.email || ''}</Text>

            <View style={styles.heroDivider}>
              <View style={styles.heroDividerLine} />
              <View style={styles.heroDividerDiamond} />
              <View style={styles.heroDividerLine} />
            </View>
          </Animated.View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.preferences')}</Text>

            {settingsItems.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.settingRow}
                activeOpacity={0.8}
                onPress={s.onPress}
              >
                {isDark && (
                  <LinearGradient
                    colors={['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={styles.settingLeft}>
                  <LinearGradient
                    colors={s.gradColors}
                    style={styles.settingIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={s.icon as any} size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.settingLabel}>{s.label}</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>{s.value}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}

            {/* Notifications */}
            <View style={styles.settingRow}>
              {isDark && (
                <LinearGradient
                  colors={['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <View style={styles.settingLeft}>
                <LinearGradient colors={[colors.accentGradient[0], colors.accentGradient[1]]} style={styles.settingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.settingLabel}>{t('profile.notifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB', true: `${colors.primary}66` }}
                thumbColor={notificationsEnabled ? colors.primaryLight : isDark ? '#4A5F59' : '#9CA3AF'}
              />
            </View>

            {/* Pro */}
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.8}>
              {isDark ? (
                <LinearGradient
                  colors={['rgba(201,162,39,0.1)', 'rgba(201,162,39,0.03)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              <View style={styles.settingLeft}>
                <LinearGradient colors={[colors.accentGradient[0], colors.accentGradient[1]]} style={styles.settingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="star" size={18} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.settingLabel}>{t('profile.daftarPro')}</Text>
                  <Text style={styles.settingHint}>{t('profile.daftarProHint')}</Text>
                </View>
              </View>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>{t('profile.pro')}</Text>
              </View>
            </TouchableOpacity>

            {/* About */}
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.8}>
              {isDark && (
                <LinearGradient
                  colors={['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <View style={styles.settingLeft}>
                <LinearGradient colors={isDark ? ['#0B1F1A', '#122420'] : [colors.bgSubtle, colors.bgSubtle]} style={styles.settingIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="information-circle-outline" size={18} color={isDark ? '#FFFFFF' : colors.textSecondary} />
                </LinearGradient>
                <Text style={styles.settingLabel}>{t('profile.about')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            style={styles.signOutBtn}
            activeOpacity={0.85}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>
              {signingOut ? t('profile.signingOut') : t('profile.signOut')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.version}>{t('profile.version')}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    scroll: { paddingBottom: 40 },

    bgOrb: {
      position: 'absolute',
      width: SW * 0.7,
      height: SW * 0.7,
      borderRadius: SW * 0.35,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(13,148,136,0.03)',
      top: -SW * 0.15,
      right: -SW * 0.25,
    },

    hero: {
      alignItems: 'center',
      paddingTop: Spacing.xxxl,
      paddingBottom: Spacing.xl,
    },
    avatarWrap: { marginBottom: Spacing.xl },
    avatarBorder: {
      width: 96,
      height: 96,
      borderRadius: 30,
      padding: 3,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    avatarCore: {
      flex: 1,
      borderRadius: 27,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.display,
      fontSize: 32,
    },
    displayName: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: c.text,
      letterSpacing: -0.5,
    },
    email: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      marginTop: Spacing.xs,
    },
    heroDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: Spacing.xxl,
    },
    heroDividerLine: { width: 36, height: 1, backgroundColor: isDark ? 'rgba(201,162,39,0.35)' : c.border },
    heroDividerDiamond: { width: 6, height: 6, backgroundColor: c.accent, transform: [{ rotate: '45deg' }] },

    section: {
      marginHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    sectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: c.kicker,
      paddingHorizontal: Spacing.xs,
      marginBottom: Spacing.xs,
    },

    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: isDark ? c.border : c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      overflow: 'hidden',
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 8,
      elevation: isDark ? 0 : 2,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 14,
    },
    settingIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: {
      fontFamily: FontFamily.bodySemibold,
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
    settingValue: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textSecondary,
    },

    proBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
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

    signOutBtn: {
      marginTop: Spacing.xxl,
      marginHorizontal: Spacing.lg,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234,88,12,0.3)' : '#FECACA',
      backgroundColor: isDark ? 'rgba(234,88,12,0.08)' : '#FEF2F2',
    },
    signOutText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      color: c.danger,
    },
    version: {
      fontFamily: FontFamily.body,
      textAlign: 'center',
      fontSize: 12,
      color: c.textTertiary,
      marginTop: Spacing.xl,
    },
  });
