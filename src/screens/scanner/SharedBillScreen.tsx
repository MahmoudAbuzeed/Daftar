import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { SharedBill, SharedBillItem, SharedBillClaim, GroupMember, User } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedBill'>;

// ── Helpers ──────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────

export default function SharedBillScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { billId, groupId } = route.params;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();

  const [bill, setBill] = useState<SharedBill | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchBill = useCallback(async () => {
    const { data } = await supabase
      .from('shared_bills')
      .select(
        `*, created_by_user:users!shared_bills_created_by_fkey(*), items:shared_bill_items(*, claims:shared_bill_claims(*, user:users(*)))`
      )
      .eq('id', billId)
      .single();

    if (data) {
      // Sort items by sort_order
      if (data.items) {
        data.items.sort(
          (a: SharedBillItem, b: SharedBillItem) => a.sort_order - b.sort_order
        );
      }
      setBill(data as SharedBill);
    }
    setLoading(false);
  }, [billId]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, user:users(*)')
      .eq('group_id', groupId);
    if (data) setMembers(data);
  }, [groupId]);

  useEffect(() => {
    fetchBill();
    fetchMembers();
  }, [fetchBill, fetchMembers]);

  // ── Realtime subscription ──────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`bill-${billId}`)
      // Listen for claim changes (item assignments)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_bill_claims',
          filter: `item_id=in.(SELECT id FROM shared_bill_items WHERE bill_id=eq.${billId})`,
        },
        () => fetchBill()
      )
      // Listen for bill status changes (e.g., finalization, tax/charge updates)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_bills',
          filter: `id=eq.${billId}`,
        },
        () => fetchBill()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billId, fetchBill]);

  // ── Toggle claim ───────────────────────────────────────────────

  const toggleClaim = useCallback(
    async (itemId: string) => {
      const item = bill?.items?.find((i) => i.id === itemId);
      if (!item || !user) return;

      const existingClaim = item.claims?.find((c) => c.user_id === user.id);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTogglingItem(itemId);

      try {
        if (existingClaim) {
          await supabase
            .from('shared_bill_claims')
            .delete()
            .eq('id', existingClaim.id);
        } else {
          await supabase
            .from('shared_bill_claims')
            .insert({ item_id: itemId, user_id: user.id });
        }
        // Realtime will trigger refetch
      } catch (err: any) {
        alert.error(t('common.error'), err.message);
      } finally {
        setTogglingItem(null);
      }
    },
    [bill, user, alert, t]
  );

  // ── Calculations ───────────────────────────────────────────────

  const items = bill?.items ?? [];
  const claimedCount = items.filter(
    (i) => (i.claims?.length ?? 0) > 0
  ).length;
  const totalItems = items.length;
  const progressPct = totalItems > 0 ? (claimedCount / totalItems) * 100 : 0;

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const extras = (bill?.tax ?? 0) + (bill?.service_charge ?? 0) + (bill?.tip ?? 0);
  const grandTotal = subtotal + extras;

  /** Per-user breakdown with proportional tax & service charge (same as AssignItemsScreen) */
  const perUserTotals = useMemo(() => {
    const splits = new Map<string, number>();

    for (const item of items) {
      const claimants = item.claims ?? [];
      if (claimants.length === 0) continue;
      const perPerson = item.total_price / claimants.length;
      for (const claim of claimants) {
        splits.set(claim.user_id, (splits.get(claim.user_id) || 0) + perPerson);
      }
    }

    // Distribute tax & service charge proportionally
    if (extras > 0 && subtotal > 0) {
      for (const [userId, amount] of splits.entries()) {
        const proportion = amount / subtotal;
        splits.set(userId, amount + extras * proportion);
      }
    }

    // Round to 2 decimals
    for (const [userId, amount] of splits.entries()) {
      splits.set(userId, Math.round(amount * 100) / 100);
    }

    return splits;
  }, [items, extras, subtotal]);

  const getMemberName = useCallback(
    (userId: string): string => {
      const member = members.find((m) => m.user_id === userId);
      return (member?.user as User | undefined)?.display_name || t('shared_bill.unknown');
    },
    [members, t]
  );

  const isCreator = bill?.created_by === user?.id;
  const isPending = bill?.status === 'pending';

  // ── Finalize ───────────────────────────────────────────────────

  const handleFinalize = useCallback(async () => {
    if (!bill) return;

    const unclaimed = items.filter((i) => (i.claims?.length ?? 0) === 0);

    if (unclaimed.length > 0) {
      alert.show('warning', t('shared_bill.unclaimed_items_warning'), undefined, [
        {
          text: t('shared_bill.split_unclaimed_equally'),
          onPress: async () => {
            // Auto-claim unclaimed items for all group members
            setFinalizing(true);
            try {
              const memberIds = members.map((m) => m.user_id);
              const inserts = unclaimed.flatMap((item) =>
                memberIds.map((uid) => ({ item_id: item.id, user_id: uid }))
              );
              if (inserts.length > 0) {
                await supabase.from('shared_bill_claims').insert(inserts);
              }
              // Wait a beat for realtime then finalize
              await doFinalize();
            } catch (err: any) {
              alert.error(t('common.error'), err.message);
              setFinalizing(false);
            }
          },
          style: 'default',
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }

    await doFinalize();
  }, [bill, items, members, alert, t]);

  const doFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const { error } = await supabase.rpc('finalize_shared_bill', {
        p_bill_id: billId,
      });
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Fetch the finalized bill to get the expense_id
      const { data: finalizedBill } = await supabase
        .from('shared_bills')
        .select('expense_id')
        .eq('id', billId)
        .single();

      if (finalizedBill?.expense_id) {
        // Navigate to Collection Summary
        navigation.replace('CollectionSummary', {
          groupId,
          expenseId: finalizedBill.expense_id,
        });
      } else {
        alert.success(t('shared_bill.finalized'));
        navigation.popToTop();
      }
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally {
      setFinalizing(false);
    }
  }, [billId, alert, t, navigation, groupId]);

  const handleCancel = useCallback(() => {
    alert.confirm(
      t('shared_bill.cancel_bill'),
      t('shared_bill.cancel_bill'),
      async () => {
        try {
          await supabase
            .from('shared_bills')
            .update({ status: 'cancelled' })
            .eq('id', billId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          navigation.popToTop();
        } catch (err: any) {
          alert.error(t('common.error'), err.message);
        }
      },
      t('shared_bill.cancel_bill'),
      t('common.cancel'),
      true
    );
  }, [billId, alert, t, navigation]);

  // ── Render item ────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: SharedBillItem; index: number }) => {
      const claims = item.claims ?? [];
      const claimants = claims.length;
      const userHasClaimed = claims.some((c) => c.user_id === user?.id);
      const isUnclaimed = claimants === 0;
      const isToggling = togglingItem === item.id;
      const perPerson =
        claimants > 0
          ? Math.round((item.total_price / claimants) * 100) / 100
          : 0;

      return (
        <AnimatedListItem index={index}>
          <ThemedCard
            style={[
              styles.itemCard,
              isUnclaimed && styles.itemCardUnclaimed,
            ]}
          >
            {/* Item header */}
            <View style={styles.itemHeader}>
              <View style={styles.itemNameRow}>
                <View
                  style={[
                    styles.itemDot,
                    {
                      backgroundColor: isUnclaimed
                        ? colors.danger
                        : userHasClaimed
                        ? colors.success
                        : colors.accent,
                    },
                  ]}
                />
                <View style={styles.itemNameCol}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} x {item.unit_price.toFixed(2)}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemPrice}>
                {item.total_price.toFixed(2)}
              </Text>
            </View>

            {/* Claim chips row */}
            {claimants > 0 && (
              <View style={styles.claimChipsRow}>
                {claims.map((claim) => {
                  const claimUser = claim.user as User | undefined;
                  const name = claimUser?.display_name || '?';
                  const initials = getInitials(name);
                  const gradient = colorForUser(claim.user_id);
                  const isMe = claim.user_id === user?.id;

                  return (
                    <View key={claim.id} style={styles.claimChipWrapper}>
                      <LinearGradient
                        colors={gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                          styles.claimAvatarCircle,
                          isMe && styles.claimAvatarCircleMe,
                        ]}
                      >
                        <Text style={styles.claimAvatarText}>{initials}</Text>
                      </LinearGradient>
                      <Text style={styles.claimChipName} numberOfLines={1}>
                        {name.split(' ')[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Per-person split hint */}
            {claimants > 1 && (
              <Text style={styles.splitHint}>
                {item.total_price.toFixed(2)} / {claimants} ={' '}
                <Text style={styles.splitHintBold}>
                  {perPerson.toFixed(2)} {t('shared_bill.per_person')}
                </Text>
              </Text>
            )}

            {/* Claim / Unclaim button */}
            <View style={styles.claimButtonRow}>
              {userHasClaimed ? (
                <BouncyPressable
                  onPress={() => toggleClaim(item.id)}
                  disabled={isToggling}
                  scaleDown={0.93}
                >
                  <View style={styles.unclaimButton}>
                    {isToggling ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.textSecondary}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.unclaimText}>
                          {t('shared_bill.unclaim')}
                        </Text>
                      </>
                    )}
                  </View>
                </BouncyPressable>
              ) : (
                <BouncyPressable
                  onPress={() => toggleClaim(item.id)}
                  disabled={isToggling}
                  scaleDown={0.93}
                >
                  <LinearGradient
                    colors={colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.claimButton}
                  >
                    {isToggling ? (
                      <ActivityIndicator size="small" color={colors.textOnPrimary} />
                    ) : (
                      <>
                        <Ionicons
                          name="hand-left-outline"
                          size={16}
                          color={colors.textOnPrimary}
                        />
                        <Text style={styles.claimButtonText}>
                          {t('shared_bill.claim')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </BouncyPressable>
              )}

              {isUnclaimed && (
                <View style={styles.unclaimedBadge}>
                  <Ionicons
                    name="alert-circle"
                    size={14}
                    color={colors.danger}
                  />
                  <Text style={styles.unclaimedBadgeText}>
                    {t('shared_bill.unclaimed')}
                  </Text>
                </View>
              )}
            </View>
          </ThemedCard>
        </AnimatedListItem>
      );
    },
    [bill, user, togglingItem, colors, styles, toggleClaim, t]
  );

  // ── Summary footer ─────────────────────────────────────────────

  const renderFooter = () => {
    const userEntries = Array.from(perUserTotals.entries());
    if (userEntries.length === 0 && !isCreator) return null;

    return (
      <View style={styles.footerContainer}>
        {/* Per-person breakdown */}
        {userEntries.length > 0 && (
          <ThemedCard style={styles.summaryCard} accent>
            <Text style={styles.summaryTitle}>
              {t('shared_bill.per_person')}
            </Text>

            {userEntries.map(([userId, amount]) => {
              const isMe = userId === user?.id;
              const name = getMemberName(userId);
              const gradient = colorForUser(userId);

              return (
                <View
                  key={userId}
                  style={[
                    styles.summaryRow,
                    isMe && styles.summaryRowHighlight,
                  ]}
                >
                  <View style={styles.summaryNameRow}>
                    <LinearGradient
                      colors={gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.summaryDot}
                    />
                    <Text
                      style={[
                        styles.summaryName,
                        isMe && styles.summaryNameBold,
                      ]}
                    >
                      {name}
                      {isMe ? ` (${t('shared_bill.your_total')})` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.summaryAmount,
                      isMe && styles.summaryAmountHighlight,
                    ]}
                  >
                    {amount.toFixed(2)} {bill?.currency ?? 'EGP'}
                  </Text>
                </View>
              );
            })}

            {/* Tax & service info */}
            {extras > 0 && (
              <View style={styles.extrasRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={colors.textTertiary}
                />
                <Text style={styles.extrasText}>
                  {t('shared_bill.paid_by')}: {bill?.tax?.toFixed(2)} tax +{' '}
                  {bill?.service_charge?.toFixed(2)} svc
                  {(bill?.tip ?? 0) > 0 ? ` + ${bill?.tip?.toFixed(2)} tip` : ''}{' '}
                  (split proportionally)
                </Text>
              </View>
            )}
          </ThemedCard>
        )}

        {/* Bottom actions */}
        <View style={styles.actionsContainer}>
          {isCreator && isPending ? (
            <>
              <FunButton
                title={
                  finalizing
                    ? t('shared_bill.finalizing')
                    : t('shared_bill.finalize')
                }
                onPress={handleFinalize}
                loading={finalizing}
                disabled={finalizing}
                icon={
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color={colors.textOnPrimary}
                  />
                }
              />
              <FunButton
                title={t('shared_bill.cancel_bill')}
                onPress={handleCancel}
                variant="ghost"
                icon={
                  <Ionicons
                    name="close-outline"
                    size={20}
                    color={colors.primary}
                  />
                }
                style={styles.cancelButton}
              />
            </>
          ) : isPending ? (
            <View style={styles.waitingRow}>
              <Ionicons
                name="time-outline"
                size={18}
                color={colors.textTertiary}
              />
              <Text style={styles.waitingText}>
                {t('shared_bill.created_by', {
                  name:
                    (bill?.created_by_user as User | undefined)?.display_name ??
                    '...',
                })}
              </Text>
            </View>
          ) : (
            <View style={styles.finalizedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.success}
              />
              <Text style={styles.finalizedText}>
                {t('shared_bill.finalized')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="receipt-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────

  const creatorName =
    (bill.created_by_user as User | undefined)?.display_name ?? '...';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header area */}
      <Animated.View style={[styles.header, entrance.style]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleColumn}>
            <Text style={styles.headerKicker}>
              {t('shared_bill.title')}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {bill.merchant_name || t('shared_bill.title')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('shared_bill.created_by', { name: creatorName })}
            </Text>
          </View>
          <View style={styles.totalBadge}>
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalBadgeGradient}
            >
              <Text style={styles.totalLabel}>{bill.currency}</Text>
              <Text style={styles.totalAmount}>
                {grandTotal.toFixed(2)}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor:
                    claimedCount === totalItems
                      ? colors.success
                      : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {t('shared_bill.items_claimed', {
              claimed: claimedCount,
              total: totalItems,
            })}
          </Text>
        </View>
      </Animated.View>

      {/* Item list */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderFooter}
        ListFooterComponentStyle={styles.listFooter}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

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
      gap: Spacing.md,
    },
    emptyText: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textTertiary,
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
      fontSize: 26,
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
    totalLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 2,
      color: c.textOnPrimary,
      opacity: 0.7,
      textTransform: 'uppercase',
    },
    totalAmount: {
      fontFamily: FontFamily.display,
      fontSize: 22,
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

    /* List */
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxxl,
    },
    listFooter: {
      marginTop: Spacing.sm,
    },

    /* Item cards */
    itemCard: {
      marginBottom: Spacing.sm,
    },
    itemCardUnclaimed: {
      borderColor: isDark
        ? 'rgba(234,88,12,0.25)'
        : 'rgba(220,38,38,0.15)',
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    itemNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: 10,
    },
    itemNameCol: {
      flex: 1,
    },
    itemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    itemName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    itemMeta: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 2,
    },
    itemPrice: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      color: c.text,
      marginLeft: Spacing.sm,
    },

    /* Claim chips */
    claimChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    claimChipWrapper: {
      alignItems: 'center',
      gap: 3,
    },
    claimAvatarCircle: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    claimAvatarCircleMe: {
      borderWidth: 2,
      borderColor: c.textOnPrimary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    claimAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: c.textOnPrimary,
    },
    claimChipName: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 10,
      color: c.textTertiary,
      maxWidth: 50,
      textAlign: 'center',
    },

    /* Split hint */
    splitHint: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: Spacing.sm,
    },
    splitHintBold: {
      fontFamily: FontFamily.bodySemibold,
      color: c.textSecondary,
    },

    /* Claim / Unclaim buttons */
    claimButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
    },
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      gap: 6,
    },
    claimButtonText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textOnPrimary,
    },
    unclaimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: isDark
        ? 'rgba(255,252,247,0.06)'
        : c.bgSubtle,
      borderWidth: 1,
      borderColor: c.borderLight,
      gap: 6,
    },
    unclaimText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
    },
    unclaimedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    unclaimedBadgeText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.danger,
    },

    /* Footer & Summary */
    footerContainer: {
      gap: Spacing.md,
    },
    summaryCard: {
      borderRadius: Radius.xl,
    },
    summaryTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: Spacing.xs,
      borderRadius: Radius.sm,
    },
    summaryRowHighlight: {
      backgroundColor: isDark
        ? 'rgba(27,122,108,0.12)'
        : 'rgba(13,148,136,0.07)',
    },
    summaryNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    summaryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    summaryName: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    summaryNameBold: {
      fontFamily: FontFamily.bodySemibold,
      color: c.text,
    },
    summaryAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    summaryAmountHighlight: {
      color: c.primary,
      fontSize: 15,
    },

    /* Extras info */
    extrasRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    extrasText: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      flex: 1,
    },

    /* Actions */
    actionsContainer: {
      gap: Spacing.sm,
    },
    cancelButton: {
      marginTop: 0,
    },
    waitingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
    waitingText: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
    },
    finalizedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.lg,
    },
    finalizedText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.success,
    },
  });
