import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { useSubscription } from '../../lib/subscription-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { exportAndShare, fetchExportData, ExportFormat } from '../../utils/dataExport';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExport'>;

export default function DataExportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { isPro, incrementUsage } = useSubscription();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!profile) return;

    if (!isPro) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      navigation.replace('Paywall', { trigger: 'export' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);

    try {
      const data = await fetchExportData(profile.id, profile.display_name || 'User');
      await exportAndShare(data, format);
      incrementUsage('data_export').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('common.error'), err?.message || t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  const FormatOption = ({
    value,
    icon,
    label,
    description,
  }: {
    value: ExportFormat;
    icon: string;
    label: string;
    description: string;
  }) => {
    const selected = format === value;
    return (
      <BouncyPressable
        onPress={() => {
          Haptics.selectionAsync();
          setFormat(value);
        }}
        scaleDown={0.97}
      >
        <ThemedCard style={[styles.formatCard, selected && styles.formatCardSelected]}>
          <View style={styles.formatRow}>
            <LinearGradient
              colors={selected ? colors.primaryGradient : (isDark ? ['#1F2937', '#111827'] : [colors.bgSubtle, colors.bgSubtle])}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.formatIcon}
            >
              <Ionicons
                name={icon as any}
                size={22}
                color={selected ? '#FFFFFF' : colors.textSecondary}
              />
            </LinearGradient>
            <View style={styles.formatText}>
              <Text style={styles.formatLabel}>{label}</Text>
              <Text style={styles.formatDesc}>{description}</Text>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected && <View style={styles.radioDot} />}
            </View>
          </View>
        </ThemedCard>
      </BouncyPressable>
    );
  };

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

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={entrance.style}>
            {/* Hero */}
            <View style={styles.hero}>
              <LinearGradient
                colors={colors.accentGradient}
                style={styles.heroIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="download" size={36} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.heroTitle}>{t('export.title')}</Text>
              <Text style={styles.heroSubtitle}>{t('export.subtitle')}</Text>
            </View>

            {/* Format selector */}
            <Text style={styles.sectionLabel}>{t('export.chooseFormat')}</Text>
            <View style={styles.formatList}>
              <FormatOption
                value="pdf"
                icon="document-text"
                label={t('export.pdfTitle')}
                description={t('export.pdfDesc')}
              />
              <FormatOption
                value="csv"
                icon="grid"
                label={t('export.csvTitle')}
                description={t('export.csvDesc')}
              />
            </View>

            {/* What's included */}
            <Text style={styles.sectionLabel}>{t('export.includes')}</Text>
            <ThemedCard style={styles.includesCard}>
              {[
                { icon: 'receipt-outline', text: t('export.includesExpenses') },
                { icon: 'swap-horizontal-outline', text: t('export.includesSettlements') },
                { icon: 'pie-chart-outline', text: t('export.includesSummary') },
                { icon: 'people-outline', text: t('export.includesAllGroups') },
              ].map((item, i) => (
                <View key={i} style={styles.includesRow}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  <Text style={styles.includesText}>{item.text}</Text>
                </View>
              ))}
            </ThemedCard>

            {!isPro && (
              <ThemedCard style={styles.proNoticeCard}>
                <View style={styles.proNoticeRow}>
                  <Ionicons name="star" size={18} color={colors.accent} />
                  <Text style={styles.proNoticeText}>{t('export.proRequired')}</Text>
                </View>
              </ThemedCard>
            )}

            <View style={styles.buttonWrap}>
              <FunButton
                title={isPro ? t('export.exportButton') : t('subscription.subscribeButton')}
                onPress={handleExport}
                loading={exporting}
                icon={
                  <Ionicons
                    name={isPro ? 'download' : 'star'}
                    size={20}
                    color="#FFFFFF"
                  />
                }
              />
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    scroll: { padding: Spacing.xl, paddingBottom: Spacing.xxl },

    hero: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.md,
    },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    },
    heroTitle: {
      fontFamily: FontFamily.display,
      fontSize: 26,
      color: c.text,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
      lineHeight: 20,
    },

    sectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 2,
      color: c.kicker,
      textTransform: 'uppercase',
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },

    formatList: {
      gap: Spacing.sm,
    },
    formatCard: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    formatCardSelected: {
      borderWidth: 2,
      borderColor: c.primary,
    },
    formatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    formatIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    formatText: { flex: 1 },
    formatLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    formatDesc: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 2,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: c.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary,
    },

    includesCard: {
      gap: Spacing.md,
    },
    includesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    includesText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.text,
      flex: 1,
    },

    proNoticeCard: {
      marginTop: Spacing.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.3)' : 'rgba(166,124,0,0.2)',
    },
    proNoticeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    proNoticeText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 13,
      color: isDark ? c.accentLight : c.accent,
      flex: 1,
    },

    buttonWrap: {
      marginTop: Spacing.xxl,
    },
  });
