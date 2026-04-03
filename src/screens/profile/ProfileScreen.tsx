import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  I18nManager,
  DevSettings,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { changeLanguage } from '../../lib/i18n';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows } from '../../theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { profile, signOut, refreshProfile } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const isArabic = i18n.language === 'ar';
  const currentCurrency = profile?.preferred_currency || 'EGP';

  const handleLanguageToggle = async () => {
    const newLang = isArabic ? 'en' : 'ar';

    try {
      await changeLanguage(newLang);

      if (profile) {
        await supabase
          .from('users')
          .update({ preferred_lang: newLang })
          .eq('id', profile.id);
      }

      const shouldBeRTL = newLang === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        I18nManager.allowRTL(shouldBeRTL);
        // Restart the app to apply RTL changes
        if (__DEV__) {
          DevSettings.reload();
        } else {
          Alert.alert(t('profile.restartRequired'), t('profile.restartMessage'));
        }
      }
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  const handleCurrencyToggle = async () => {
    if (!profile) return;

    const newCurrency = currentCurrency === 'EGP' ? 'USD' : 'EGP';

    try {
      const { error } = await supabase
        .from('users')
        .update({ preferred_currency: newCurrency })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
    } catch (err) {
      console.error('Failed to update currency:', err);
      Alert.alert(t('common.error'), t('profile.updateFailed'));
    }
  };

  const handleNotificationsToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    // TODO: Implement push notification preferences
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (err) {
            console.error('Sign out failed:', err);
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const getInitials = (): string => {
    if (!profile?.display_name) return '?';
    return profile.display_name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Hero */}
        <LinearGradient
          colors={Gradients.heroWarm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          <LinearGradient
            colors={Gradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </LinearGradient>
          <Text style={styles.displayName}>{profile?.display_name || ''}</Text>
          <Text style={styles.email}>{profile?.email || ''}</Text>
        </LinearGradient>

        {/* Settings List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

          {/* Language */}
          <TouchableOpacity
            style={[styles.settingRow, Shadows.sm]}
            activeOpacity={0.7}
            onPress={handleLanguageToggle}
          >
            <View style={styles.settingLeft}>
              <LinearGradient
                colors={Gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingIcon}
              >
                <Text style={styles.settingIconText}>{'\uD83C\uDF10'}</Text>
              </LinearGradient>
              <Text style={styles.settingLabel}>{t('profile.language')}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {isArabic ? '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' : 'English'}
              </Text>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </View>
          </TouchableOpacity>

          {/* Currency */}
          <TouchableOpacity
            style={[styles.settingRow, Shadows.sm]}
            activeOpacity={0.7}
            onPress={handleCurrencyToggle}
          >
            <View style={styles.settingLeft}>
              <LinearGradient
                colors={Gradients.success}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingIcon}
              >
                <Text style={styles.settingIconText}>{'\uD83D\uDCB0'}</Text>
              </LinearGradient>
              <Text style={styles.settingLabel}>{t('profile.defaultCurrency')}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{currentCurrency}</Text>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </View>
          </TouchableOpacity>

          {/* Notifications */}
          <View style={[styles.settingRow, Shadows.sm]}>
            <View style={styles.settingLeft}>
              <LinearGradient
                colors={Gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingIcon}
              >
                <Text style={styles.settingIconText}>{'\uD83D\uDD14'}</Text>
              </LinearGradient>
              <Text style={styles.settingLabel}>{t('profile.notifications')}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={notificationsEnabled ? Colors.primary : '#F3F4F6'}
            />
          </View>

          {/* Daftar Pro */}
          <TouchableOpacity style={[styles.settingRow, Shadows.sm]} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
              <LinearGradient
                colors={['#A855F7', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingIcon}
              >
                <Text style={styles.settingIconText}>{'\u2B50'}</Text>
              </LinearGradient>
              <View>
                <Text style={styles.settingLabel}>{t('profile.daftarPro')}</Text>
                <Text style={styles.settingHint}>{t('profile.daftarProHint')}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </TouchableOpacity>

          {/* About */}
          <TouchableOpacity style={[styles.settingRow, Shadows.sm]} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
              <LinearGradient
                colors={Gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.settingIcon}
              >
                <Text style={styles.settingIconText}>{'\u2139\uFE0F'}</Text>
              </LinearGradient>
              <Text style={styles.settingLabel}>{t('profile.about')}</Text>
            </View>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutButton, Shadows.sm]}
          activeOpacity={0.8}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>
            {signingOut ? t('profile.signingOut') : t('profile.signOut')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.version}>Daftar v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  profileHero: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.huge,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textOnAccent,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textOnDark,
    letterSpacing: -0.5,
  },
  email: {
    fontSize: 14,
    color: 'rgba(248, 250, 252, 0.6)',
    marginTop: Spacing.xs,
  },
  section: {
    marginTop: -Spacing.xxl,
    marginHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
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
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingIconText: {
    fontSize: 18,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  signOutButton: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dangerSurface,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: Spacing.xl,
  },
});
