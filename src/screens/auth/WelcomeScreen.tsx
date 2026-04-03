import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={Gradients.heroWarm}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={Gradients.gold}
              style={styles.logoCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logoIcon}>📒</Text>
            </LinearGradient>
            <Text style={styles.titleEn}>Daftar</Text>
            <Text style={styles.titleAr}>دفتر</Text>
            <Text style={styles.tagline}>{t('auth.welcomeTagline')}</Text>
          </View>

          {/* Feature Highlights */}
          <View style={styles.features}>
            <View style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{t('auth.featureSplitBills')}</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{t('auth.featureTrackDebts')}</Text>
            </View>
            <View style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{t('auth.featureScanReceipts')}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.signInButton, Shadows.glow]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SignIn')}
            >
              <Text style={styles.signInButtonText}>{t('auth.signIn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signUpButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={styles.signUpButtonText}>{t('auth.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxxl,
    justifyContent: 'space-between',
    paddingTop: 72,
    paddingBottom: 48,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    ...Shadows.goldGlow,
  },
  logoIcon: {
    fontSize: 52,
  },
  titleEn: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.textOnDark,
    letterSpacing: -1.2,
  },
  titleAr: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.accent,
    marginTop: Spacing.xs,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(248, 250, 252, 0.7)',
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  features: {
    gap: 18,
    paddingHorizontal: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(248, 250, 252, 0.9)',
    fontWeight: '500',
  },
  actions: {
    gap: 14,
  },
  signInButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
  signUpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  signUpButtonText: {
    color: Colors.textOnDark,
    ...Typography.button,
  },
});
