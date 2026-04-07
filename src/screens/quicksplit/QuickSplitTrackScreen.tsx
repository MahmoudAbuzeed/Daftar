import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { QuickSplit, QuickSplitParticipant } from '../../types/database';
import { formatCurrency } from '../../utils/balance';
import {
  generateReminder,
  generateMultiDebtorNotification,
  shareViaWhatsApp,
} from '../../utils/whatsapp';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickSplitTrack'>;

const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#A67C00', '#D4AF37'],
  ['#7C3AED', '#A78BFA'],
  ['#DC2626', '#F87171'],
  ['#2563EB', '#60A5FA'],
  ['#D97706', '#FBBF24'],
  ['#059669', '#34D399'],
  ['#DB2777', '#F472B6'],
];

function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function QuickSplitTrackScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const { quickSplitId } = route.params;

  const [split, setSplit] = useState<QuickSplit | null>(null);
  const [participants, setParticipants] = useState<QuickSplitParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [{ data: splitData }, { data: partData }] = await Promise.all([
        supabase.from('quick_splits').select('*').eq('id', quickSplitId).single(),
        supabase
          .from('quick_split_participants')
          .select('*')
          .eq('quick_split_id', quickSplitId)
          .order('created_at', { ascending: true }),
      ]);

      if (splitData) setSplit(splitData as QuickSplit);
      if (partData) setParticipants(partData as QuickSplitParticipant[]);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [quickSplitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currency = split?.currency || 'EGP';
  const description = split?.description || '';
  const unpaid = participants.filter((p) => !p.is_settled);
  const totalToCollect = unpaid.reduce((sum, p) => sum + p.amount, 0);
  const allPaid = participants.length > 0 && unpaid.length === 0;

  const markPaid = async (participantId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId ? { ...p, is_settled: true } : p
      )
    );
    await supabase
      .from('quick_split_participants')
      .update({ is_settled: true })
      .eq('id', participantId);
  };

  const remindOne = (p: QuickSplitParticipant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const payerName = profile?.display_name || 'Someone';
    const message = generateReminder(payerName, p.name, p.amount, currency, lang);
    shareViaWhatsApp(message, p.phone || undefined);
  };

  const remindAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const payerName = profile?.display_name || 'Someone';
    const payerPhone = profile?.phone || null;
    const debtorList = unpaid.map((p) => ({ name: p.name, amount: p.amount }));
    const message = generateMultiDebtorNotification(
      payerName,
      payerPhone,
      debtorList,
      currency,
      description,
      lang
    );
    shareViaWhatsApp(message);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderParticipant = ({
    item,
    index,
  }: {
    item: QuickSplitParticipant;
    index: number;
  }) => {
    const grad = item.is_settled
      ? ([colors.success, colors.successLight || colors.success] as [string, string])
      : avatarGradient(item.name);
    const initials = getInitials(item.name);

    return (
      <AnimatedListItem index={index}>
        <ThemedCard
          style={[styles.personCard, item.is_settled && styles.personCardPaid]}
        >
          <View style={styles.personRow}>
            <LinearGradient
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              {item.is_settled ? (
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </LinearGradient>

            <View style={styles.personInfo}>
              <Text
                style={[
                  styles.personName,
                  item.is_settled && styles.personNamePaid,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[
                  styles.personAmount,
                  item.is_settled && styles.personAmountPaid,
                ]}
              >
                {item.is_settled
                  ? t('collection.paid')
                  : formatCurrency(item.amount, currency)}
              </Text>
            </View>
          </View>

          {!item.is_settled && (
            <View style={styles.actions}>
              <BouncyPressable
                onPress={() => remindOne(item)}
                scaleDown={0.93}
              >
                <View style={styles.remindButton}>
                  <Ionicons
                    name="logo-whatsapp"
                    size={16}
                    color={colors.success}
                  />
                  <Text style={styles.remindButtonText}>
                    {t('collection.remind')}
                  </Text>
                </View>
              </BouncyPressable>

              <BouncyPressable
                onPress={() => markPaid(item.id)}
                scaleDown={0.93}
              >
                <LinearGradient
                  colors={colors.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.paidButton}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.paidButtonText}>
                    {t('collection.markPaid')}
                  </Text>
                </LinearGradient>
              </BouncyPressable>
            </View>
          )}
        </ThemedCard>
      </AnimatedListItem>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <Animated.View style={[styles.header, entrance.style]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleColumn}>
            <Text style={styles.headerKicker}>
              {t('quick_split.trackKicker')}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {description || t('quick_split.title')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('collection.youPaidBill')}
            </Text>
          </View>
          <View style={styles.totalBadge}>
            <LinearGradient
              colors={
                allPaid
                  ? [colors.success, colors.success]
                  : colors.primaryGradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalBadgeGradient}
            >
              <Text style={styles.totalBadgeLabel}>
                {allPaid
                  ? t('collection.collected')
                  : t('collection.toCollect')}
              </Text>
              <Text style={styles.totalBadgeAmount}>
                {formatCurrency(allPaid ? 0 : totalToCollect, currency)}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Progress */}
        {participants.length > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((participants.length - unpaid.length) / participants.length) * 100}%`,
                    backgroundColor: allPaid ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {participants.length - unpaid.length}/{participants.length}{' '}
              {t('collection.paid')}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipant}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.footerContainer}>
            {allPaid && (
              <ThemedCard style={styles.celebrationCard} accent>
                <LinearGradient
                  colors={[colors.success, colors.success]}
                  style={styles.celebrationIcon}
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={28}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <Text style={styles.celebrationTitle}>
                  {t('collection.allCollected')}
                </Text>
                <Text style={styles.celebrationSubtitle}>
                  {t('collection.allCollectedSubtitle')}
                </Text>
              </ThemedCard>
            )}

            <View style={styles.bottomActions}>
              {unpaid.length > 0 && (
                <FunButton
                  title={t('collection.remindEveryone')}
                  onPress={remindAll}
                  variant="secondary"
                  icon={
                    <Ionicons
                      name="logo-whatsapp"
                      size={20}
                      color={colors.primary}
                    />
                  }
                />
              )}
              <FunButton
                title={t('collection.done')}
                onPress={() => navigation.popToTop()}
                variant="primary"
                icon={
                  <Ionicons
                    name={
                      allPaid
                        ? 'checkmark-circle-outline'
                        : 'arrow-forward-outline'
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                }
              />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Header */
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerTitleColumn: {
      flex: 1,
      marginRight: Spacing.md,
    },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: c.kicker,
      textTransform: 'uppercase',
      marginBottom: Spacing.xs,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 24,
      color: c.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
      marginTop: 2,
    },

    /* Total badge */
    totalBadge: { borderRadius: Radius.xl, overflow: 'hidden' },
    totalBadgeGradient: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: Radius.xl,
    },
    totalBadgeLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 9,
      letterSpacing: 2,
      color: 'rgba(255,255,255,0.7)',
      textTransform: 'uppercase',
    },
    totalBadgeAmount: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },

    /* Progress */
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.md,
      gap: 10,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.bgSubtle,
      overflow: 'hidden',
    },
    progressBarFill: { height: 6, borderRadius: 3 },
    progressText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: c.textSecondary,
      flexShrink: 0,
    },

    /* List */
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxxl,
    },

    /* Person card */
    personCard: { marginBottom: Spacing.sm },
    personCardPaid: { opacity: 0.7 },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: '#FFFFFF',
    },
    personInfo: { flex: 1 },
    personName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
    },
    personNamePaid: {
      textDecorationLine: 'line-through',
      color: c.textTertiary,
    },
    personAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      color: c.primary,
      marginTop: 2,
    },
    personAmountPaid: {
      color: c.success,
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
    },

    /* Actions */
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    remindButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgSubtle,
      borderWidth: 1,
      borderColor: c.borderLight,
      gap: 6,
    },
    remindButtonText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
    },
    paidButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      gap: 6,
    },
    paidButtonText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: '#FFFFFF',
    },

    /* Footer */
    footerContainer: { gap: Spacing.md, paddingTop: Spacing.md },

    /* Celebration */
    celebrationCard: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.sm,
    },
    celebrationIcon: {
      width: 56,
      height: 56,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    celebrationTitle: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: c.success,
      letterSpacing: -0.3,
    },
    celebrationSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
    },

    /* Bottom */
    bottomActions: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  });
