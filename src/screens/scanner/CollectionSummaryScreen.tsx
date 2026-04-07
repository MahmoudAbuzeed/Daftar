import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
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
import { Expense, ExpenseSplit, User, PaymentMethod } from '../../types/database';
import { formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import {
  generateReminder,
  generateMultiDebtorNotification,
  shareViaWhatsApp,
} from '../../utils/whatsapp';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectionSummary'>;

interface DebtorInfo {
  userId: string;
  name: string;
  amount: number;
  phone: string | null;
  isPaid: boolean;
}

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string; icon: string }[] = [
  { key: 'cash', labelKey: 'settlements.cash', icon: 'cash-outline' },
  { key: 'bank', labelKey: 'settlements.bank', icon: 'business-outline' },
  { key: 'vodafone_cash', labelKey: 'settlements.vodafone_cash', icon: 'phone-portrait-outline' },
  { key: 'instapay', labelKey: 'settlements.instapay', icon: 'flash-outline' },
  { key: 'paypal', labelKey: 'settlements.paypal', icon: 'logo-paypal' },
  { key: 'apple_pay', labelKey: 'settlements.apple_pay', icon: 'logo-apple' },
  { key: 'wise', labelKey: 'settlements.wise', icon: 'swap-horizontal-outline' },
  { key: 'other', labelKey: 'settlements.other', icon: 'ellipsis-horizontal-outline' },
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#A67C00', '#D4AF37'],
  ['#7C3AED', '#A78BFA'],
  ['#DC2626', '#F87171'],
  ['#2563EB', '#60A5FA'],
  ['#D97706', '#FBBF24'],
  ['#059669', '#34D399'],
  ['#DB2777', '#F472B6'],
];

const colorForUser = (userId: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function CollectionSummaryScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();
  const { groupId, expenseId } = route.params;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [debtors, setDebtors] = useState<DebtorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [settling, setSettling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: exp } = await supabase
        .from('expenses')
        .select(
          '*, paid_by_user:users!expenses_paid_by_fkey(*), splits:expense_splits(*, user:users(*))'
        )
        .eq('id', expenseId)
        .single();

      if (!exp) return;
      setExpense(exp as Expense);

      // Check existing settlements
      const { data: settlements } = await supabase
        .from('settlements')
        .select('paid_by, paid_to, amount')
        .eq('group_id', groupId);

      const splits = (exp.splits || []) as (ExpenseSplit & { user: User })[];
      const debtorList: DebtorInfo[] = splits
        .filter((s) => s.user_id !== exp.paid_by)
        .map((s) => {
          const settled = (settlements || [])
            .filter(
              (st: any) => st.paid_by === s.user_id && st.paid_to === exp.paid_by
            )
            .reduce((sum: number, st: any) => sum + st.amount, 0);

          return {
            userId: s.user_id,
            name: (s.user as User)?.display_name || t('common.unknown'),
            amount: s.amount,
            phone: (s.user as User)?.phone || null,
            isPaid: settled >= s.amount,
          };
        });

      setDebtors(debtorList);
    } catch (err) {
      // handled
    } finally {
      setLoading(false);
    }
  }, [expenseId, groupId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalToCollect = debtors
    .filter((d) => !d.isPaid)
    .reduce((sum, d) => sum + d.amount, 0);

  const currency = expense?.currency || 'EGP';
  const description = expense?.description || '';

  const remindOne = (debtor: DebtorInfo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const payerName = profile?.display_name || 'Someone';
    const message = generateReminder(
      payerName,
      debtor.name,
      debtor.amount,
      currency,
      lang
    );
    shareViaWhatsApp(message, debtor.phone || undefined);
  };

  const remindAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const lang = (i18n.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
    const payerName = profile?.display_name || 'Someone';
    const payerPhone = profile?.phone || null;
    const unpaid = debtors.filter((d) => !d.isPaid);
    const debtorList = unpaid.map((d) => ({ name: d.name, amount: d.amount }));
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

  const openSettleModal = (debtor: DebtorInfo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDebtor(debtor);
    setPaymentMethod('cash');
    setSettleModalVisible(true);
  };

  const handleSettle = async () => {
    if (!user || !selectedDebtor) return;
    setSettling(true);

    try {
      const { error } = await supabase.from('settlements').insert({
        group_id: groupId,
        paid_by: selectedDebtor.userId,
        paid_to: user.id,
        amount: selectedDebtor.amount,
        currency,
        method: paymentMethod,
        note: null,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSettleModalVisible(false);
      setSelectedDebtor(null);

      setDebtors((prev) =>
        prev.map((d) =>
          d.userId === selectedDebtor.userId ? { ...d, isPaid: true } : d
        )
      );
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally {
      setSettling(false);
    }
  };

  const allPaid = debtors.length > 0 && debtors.every((d) => d.isPaid);
  const unpaidCount = debtors.filter((d) => !d.isPaid).length;

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderDebtor = ({
    item,
    index,
  }: {
    item: DebtorInfo;
    index: number;
  }) => {
    const gradient = colorForUser(item.userId);
    const initials = getInitials(item.name);

    return (
      <AnimatedListItem index={index}>
        <ThemedCard
          style={[styles.debtorCard, item.isPaid && styles.debtorCardPaid]}
        >
          <View style={styles.debtorRow}>
            {/* Avatar */}
            <LinearGradient
              colors={item.isPaid ? [colors.success, colors.successLight || colors.success] : gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.debtorAvatar}
            >
              {item.isPaid ? (
                <Ionicons name="checkmark" size={20} color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.debtorAvatarText}>{initials}</Text>
              )}
            </LinearGradient>

            {/* Name & amount */}
            <View style={styles.debtorInfo}>
              <Text
                style={[styles.debtorName, item.isPaid && styles.debtorNamePaid]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[
                  styles.debtorAmount,
                  item.isPaid && styles.debtorAmountPaid,
                ]}
              >
                {item.isPaid
                  ? t('collection.paid')
                  : `${formatCurrency(item.amount, currency)}`}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {!item.isPaid && (
            <View style={styles.debtorActions}>
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
                onPress={() => openSettleModal(item)}
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
                    color={colors.textOnPrimary}
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
              {t('collection.kicker')}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {description || t('collection.title')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('collection.youPaidBill')}
            </Text>
          </View>
          <View style={styles.totalBadge}>
            <LinearGradient
              colors={allPaid ? [colors.success, colors.success] : colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalBadgeGradient}
            >
              <Text style={styles.totalBadgeLabel}>
                {allPaid ? t('collection.collected') : t('collection.toCollect')}
              </Text>
              <Text style={styles.totalBadgeAmount}>
                {formatCurrency(allPaid ? 0 : totalToCollect, currency)}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Progress */}
        {debtors.length > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((debtors.length - unpaidCount) / debtors.length) * 100}%`,
                    backgroundColor: allPaid ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {debtors.length - unpaidCount}/{debtors.length} {t('collection.paid')}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Expense breakdown summary */}
      {expense && (expense.tip_amount > 0 || expense.total_amount > 0) && (
        <View style={styles.summaryContainer}>
          <ThemedCard style={styles.summaryCard}>
            {/* Items subtotal */}
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{t('scanner.subtotal')}</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(
                  expense.total_amount - expense.tip_amount,
                  currency
                )}
              </Text>
            </View>

            {/* Tip breakdown (if exists) */}
            {expense.tip_amount > 0 && (
              <>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{t('scanner.tip')}</Text>
                  <Text style={[styles.breakdownValue, styles.tipAmount]}>
                    +{formatCurrency(expense.tip_amount, currency)}
                  </Text>
                </View>
              </>
            )}

            {/* Total */}
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelTotal}>{t('scanner.total')}</Text>
              <Text style={styles.breakdownValueTotal}>
                {formatCurrency(expense.total_amount, currency)}
              </Text>
            </View>
          </ThemedCard>
        </View>
      )}

      {/* Debtor list */}
      <FlatList
        data={debtors}
        keyExtractor={(item) => item.userId}
        renderItem={renderDebtor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-done-outline"
              size={48}
              color={colors.success}
            />
            <Text style={styles.emptyTitle}>{t('collection.noDebts')}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerContainer}>
            {/* All paid celebration */}
            {allPaid && (
              <ThemedCard style={styles.celebrationCard} accent>
                <LinearGradient
                  colors={[colors.success, colors.success]}
                  style={styles.celebrationIcon}
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={28}
                    color={colors.textOnPrimary}
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

            {/* Bottom actions */}
            <View style={styles.bottomActions}>
              {unpaidCount > 0 && (
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
                    name={allPaid ? 'checkmark-circle-outline' : 'arrow-forward-outline'}
                    size={20}
                    color={colors.textOnPrimary}
                  />
                }
              />
            </View>
          </View>
        }
      />

      {/* Settlement Modal */}
      <Modal
        visible={settleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettleModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSettleModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>
                {t('collection.receivedFrom')}
              </Text>

              {selectedDebtor && (
                <View style={styles.modalDebtorRow}>
                  <LinearGradient
                    colors={colorForUser(selectedDebtor.userId)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalAvatar}
                  >
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedDebtor.name)}
                    </Text>
                  </LinearGradient>
                  <View>
                    <Text style={styles.modalDebtorName}>
                      {selectedDebtor.name}
                    </Text>
                    <Text style={styles.modalDebtorAmount}>
                      {formatCurrency(selectedDebtor.amount, currency)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.modalSectionLabel}>
                {t('settlements.method')}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.methodsRow}
              >
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.key;
                  return (
                    <BouncyPressable
                      key={method.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPaymentMethod(method.key);
                      }}
                      scaleDown={0.92}
                    >
                      <View
                        style={[
                          styles.methodChip,
                          isSelected && styles.methodChipActive,
                        ]}
                      >
                        <Ionicons
                          name={method.icon as any}
                          size={18}
                          color={isSelected ? colors.textOnPrimary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.methodChipText,
                            isSelected && styles.methodChipTextActive,
                          ]}
                        >
                          {t(method.labelKey)}
                        </Text>
                      </View>
                    </BouncyPressable>
                  );
                })}
              </ScrollView>

              <FunButton
                title={
                  settling
                    ? t('common.loading')
                    : t('collection.confirmReceived')
                }
                onPress={handleSettle}
                loading={settling}
                disabled={settling}
                icon={
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={colors.textOnPrimary}
                  />
                }
                style={styles.modalButton}
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    /* Loading */
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
    totalBadge: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
    },
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
      color: c.textOnPrimary,
      opacity: 0.7,
      textTransform: 'uppercase',
    },
    totalBadgeAmount: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: c.textOnPrimary,
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
    progressBarFill: {
      height: 6,
      borderRadius: 3,
    },
    progressText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: c.textSecondary,
      flexShrink: 0,
    },

    /* Expense breakdown summary */
    summaryContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    summaryCard: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    breakdownLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
    },
    breakdownValue: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.text,
    },
    breakdownLabelTotal: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    breakdownValueTotal: {
      fontFamily: FontFamily.display,
      fontSize: 16,
      color: c.primary,
      letterSpacing: -0.3,
    },
    breakdownDivider: {
      height: 1,
      backgroundColor: c.borderLight,
      marginVertical: Spacing.sm,
    },
    tipAmount: {
      color: c.success,
    },

    /* List */
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxxl,
    },

    /* Debtor card */
    debtorCard: {
      marginBottom: Spacing.sm,
    },
    debtorCardPaid: {
      opacity: 0.7,
    },
    debtorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    debtorAvatar: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    debtorAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: c.textOnPrimary,
    },
    debtorInfo: {
      flex: 1,
    },
    debtorName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
    },
    debtorNamePaid: {
      textDecorationLine: 'line-through',
      color: c.textTertiary,
    },
    debtorAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      color: c.primary,
      marginTop: 2,
    },
    debtorAmountPaid: {
      color: c.success,
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
    },

    /* Debtor actions */
    debtorActions: {
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
      color: c.textOnPrimary,
    },

    /* Empty */
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.md,
    },
    emptyTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.textTertiary,
    },

    /* Footer */
    footerContainer: {
      gap: Spacing.md,
      paddingTop: Spacing.md,
    },

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

    /* Bottom actions */
    bottomActions: {
      gap: Spacing.sm,
      paddingBottom: Spacing.lg,
    },

    /* Modal */
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay,
    },
    modalContent: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Spacing.xl,
      paddingBottom: Spacing.huge,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderLight,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: c.text,
      marginBottom: Spacing.lg,
      letterSpacing: -0.3,
    },
    modalDebtorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
      paddingBottom: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    modalAvatar: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: c.textOnPrimary,
    },
    modalDebtorName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
    },
    modalDebtorAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      color: c.primary,
      marginTop: 2,
    },
    modalSectionLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1.2,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    methodsRow: {
      gap: Spacing.sm,
      paddingBottom: Spacing.lg,
    },
    methodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgSubtle,
      borderWidth: 1,
      borderColor: c.borderLight,
      gap: 6,
    },
    methodChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    methodChipText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: c.textSecondary,
    },
    methodChipTextActive: {
      color: c.textOnPrimary,
    },
    modalButton: {
      marginTop: Spacing.sm,
    },
  });
