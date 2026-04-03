import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows } from '../../theme';

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  groupName: string;
  amount: number;
  currency: 'EGP' | 'USD';
  createdAt: string;
  paidByName: string;
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!profile) return;

    try {
      // Fetch user's group IDs
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', profile.id);

      if (memberError) throw memberError;

      const groupIds = (memberships || []).map((m) => m.group_id);

      if (groupIds.length === 0) {
        setActivities([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch recent expenses from those groups
      const { data: expenses, error: expenseError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          total_amount,
          currency,
          created_at,
          group_id,
          is_deleted,
          paid_by_user:users!expenses_paid_by_fkey(display_name),
          group:groups!expenses_group_id_fkey(name)
        `)
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (expenseError) throw expenseError;

      // Fetch recent settlements from those groups
      const { data: settlements, error: settlementError } = await supabase
        .from('settlements')
        .select(`
          id,
          amount,
          currency,
          created_at,
          group_id,
          note,
          paid_by_user:users!settlements_paid_by_fkey(display_name),
          paid_to_user:users!settlements_paid_to_fkey(display_name),
          group:groups!settlements_group_id_fkey(name)
        `)
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (settlementError) throw settlementError;

      const expenseItems: ActivityItem[] = (expenses || []).map((e: any) => ({
        id: `expense-${e.id}`,
        type: 'expense' as const,
        description: e.description,
        groupName: e.group?.name || '',
        amount: e.total_amount,
        currency: e.currency,
        createdAt: e.created_at,
        paidByName: e.paid_by_user?.display_name || '',
      }));

      const settlementItems: ActivityItem[] = (settlements || []).map((s: any) => ({
        id: `settlement-${s.id}`,
        type: 'settlement' as const,
        description: `${s.paid_by_user?.display_name || ''} ${t('activity.paidTo')} ${s.paid_to_user?.display_name || ''}`,
        groupName: s.group?.name || '',
        amount: s.amount,
        currency: s.currency,
        createdAt: s.created_at,
        paidByName: s.paid_by_user?.display_name || '',
      }));

      const combined = [...expenseItems, ...settlementItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);

      setActivities(combined);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, t]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivity();
  }, [fetchActivity]);

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffMin < 1) return t('activity.justNow');
    if (diffMin < 60) return t('activity.minutesAgo', { count: diffMin });
    if (diffHr < 24) return t('activity.hoursAgo', { count: diffHr });
    if (diffDays < 7) return t('activity.daysAgo', { count: diffDays });

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount: number, currency: string): string => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const renderActivity = ({ item }: { item: ActivityItem }) => {
    const isExpense = item.type === 'expense';

    return (
      <View style={[styles.activityCard, Shadows.sm]}>
        <LinearGradient
          colors={isExpense ? Gradients.primary : Gradients.success}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activityIcon}
        >
          <Text style={styles.iconText}>{isExpense ? '\uD83D\uDCB3' : '\u2705'}</Text>
        </LinearGradient>

        <View style={styles.activityInfo}>
          <Text style={styles.activityDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <View style={styles.activityMeta}>
            <Text style={styles.activityGroup}>{item.groupName}</Text>
            <Text style={styles.metaDot}>{'\u00B7'}</Text>
            <Text style={styles.activityTime}>{getTimeAgo(item.createdAt)}</Text>
          </View>
          {isExpense && (
            <Text style={styles.activityPaidBy}>
              {t('activity.paidBy')} {item.paidByName}
            </Text>
          )}
        </View>

        <View style={[styles.amountChip, isExpense ? styles.amountChipExpense : styles.amountChipSettlement]}>
          <Text style={[styles.activityAmount, isExpense ? styles.expenseAmount : styles.settlementAmount]}>
            {formatAmount(item.amount, item.currency)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[Colors.primarySurface, '#E0E7FF']}
          style={styles.emptyIconCircle}
        >
          <Text style={styles.emptyIconEmoji}>{'\uD83D\uDCCA'}</Text>
        </LinearGradient>
        <Text style={styles.emptyTitle}>{t('activity.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('activity.emptySubtitle')}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{t('activity.title')}</Text>
      </LinearGradient>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        contentContainerStyle={activities.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: Colors.textOnDark,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  iconText: {
    fontSize: 18,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    ...Typography.bodyBold,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 6,
  },
  activityGroup: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  metaDot: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  activityTime: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  activityPaidBy: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginLeft: Spacing.sm,
  },
  amountChipExpense: {
    backgroundColor: Colors.primarySurface,
  },
  amountChipSettlement: {
    backgroundColor: Colors.successSurface,
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  expenseAmount: {
    color: Colors.textPrimary,
  },
  settlementAmount: {
    color: Colors.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
});
