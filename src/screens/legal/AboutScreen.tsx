import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Spacing, Radius, FontFamily } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import { chevronForward } from '../../utils/rtl';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const linkRows = [
    {
      icon: 'shield-checkmark-outline' as const,
      label: t('legal.privacyPolicy'),
      onPress: () => navigation.navigate('PrivacyPolicy'),
    },
    {
      icon: 'document-text-outline' as const,
      label: t('legal.terms'),
      onPress: () => navigation.navigate('Terms'),
    },
    {
      icon: 'mail-outline' as const,
      label: t('legal.contactUs'),
      onPress: () => Linking.openURL('mailto:support@fifti.app'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <View style={styles.logoSection}>
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoCircle}
        >
          <Text style={styles.logoEmoji}>{'\u2696\uFE0F'}</Text>
        </LinearGradient>
        <Text style={styles.appName}>Fifti</Text>
        <Text style={styles.version}>{t('legal.version')} 1.0.0</Text>
        <Text style={styles.description}>{t('legal.description')}</Text>
      </View>

      {/* Link Rows */}
      <ThemedCard style={styles.linksCard}>
        {linkRows.map((row, index) => (
          <BouncyPressable key={index} onPress={row.onPress} scaleDown={0.98}>
            <View style={[styles.linkRow, index === linkRows.length - 1 && styles.linkRowLast]}>
              <View style={styles.linkLeft}>
                <Ionicons name={row.icon} size={20} color={colors.primary} />
                <Text style={styles.linkLabel}>{row.label}</Text>
              </View>
              <Ionicons name={chevronForward() as any} size={16} color={colors.textTertiary} />
            </View>
          </BouncyPressable>
        ))}
      </ThemedCard>

      {/* Footer */}
      <Text style={styles.footer}>{t('legal.madeInEgypt')}</Text>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      padding: Spacing.xl,
      paddingBottom: 60,
    },

    logoSection: {
      alignItems: 'center',
      marginTop: Spacing.xxl,
      marginBottom: Spacing.xxxl,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    logoEmoji: {
      fontSize: 36,
    },
    appName: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    version: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      marginBottom: Spacing.lg,
    },
    description: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: Spacing.xl,
    },

    linksCard: {
      marginBottom: Spacing.xxl,
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    linkRowLast: {
      borderBottomWidth: 0,
    },
    linkLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    linkLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },

    footer: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      textAlign: 'center',
    },
  });
