import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Group } from '../../types/database';
import { formatCurrency } from '../../utils/balance';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

interface GroupWithMeta extends Group {
  member_count: number;
  net_balance: number;
}

export default function GroupsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Fetch groups the user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberships.map((m) => m.group_id);

      // Fetch group details
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Fetch member counts for each group
      const { data: allMembers, error: membersError } = await supabase
        .from('group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds);

      if (membersError) throw membersError;

      // Fetch expenses and splits to calculate net balance
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id, group_id, paid_by, total_amount')
        .in('group_id', groupIds)
        .eq('is_deleted', false);

      if (expensesError) throw expensesError;

      const { data: splits, error: splitsError } = await supabase
        .from('expense_splits')
        .select('expense_id, user_id, amount')
        .in(
          'expense_id',
          (expenses || []).map((e) => e.id)
        );

      if (splitsError) throw splitsError;

      // Fetch settlements
      const { data: settlements, error: settlementsError } = await supabase
        .from('settlements')
        .select('group_id, paid_by, paid_to, amount')
        .in('group_id', groupIds);

      if (settlementsError) throw settlementsError;

      // Build enriched group list
      const enrichedGroups: GroupWithMeta[] = (groupsData || []).map((group) => {
        const memberCount = (allMembers || []).filter(
          (m) => m.group_id === group.id
        ).length;

        // Calculate net balance for current user in this group
        let netBalance = 0;
        const groupExpenses = (expenses || []).filter(
          (e) => e.group_id === group.id
        );

        for (const expense of groupExpenses) {
          // If user paid, they are owed the split amounts of others
          if (expense.paid_by === user.id) {
            const otherSplits = (splits || []).filter(
              (s) => s.expense_id === expense.id && s.user_id !== user.id
            );
            netBalance += otherSplits.reduce((sum, s) => sum + s.amount, 0);
          }
          // User's own split in expenses paid by others
          const userSplit = (splits || []).find(
            (s) => s.expense_id === expense.id && s.user_id === user.id
          );
          if (userSplit && expense.paid_by !== user.id) {
            netBalance -= userSplit.amount;
          }
        }

        // Factor in settlements
        const groupSettlements = (settlements || []).filter(
          (s) => s.group_id === group.id
        );
        for (const settlement of groupSettlements) {
          if (settlement.paid_by === user.id) {
            netBalance += settlement.amount;
          }
          if (settlement.paid_to === user.id) {
            netBalance -= settlement.amount;
          }
        }

        return {
          ...group,
          member_count: memberCount,
          net_balance: Math.round(netBalance * 100) / 100,
        };
      });

      setGroups(enrichedGroups);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups();
  }, [fetchGroups]);

  const renderBalanceText = (balance: number, currency: 'EGP' | 'USD') => {
    if (Math.abs(balance) < 0.01) {
      return (
        <View style={styles.balanceChipSettled}>
          <Text style={styles.balanceSettled}>{t('groups.settled_up')}</Text>
        </View>
      );
    }
    if (balance > 0) {
      return (
        <View style={styles.balanceChipPositive}>
          <Text style={styles.balancePositive}>
            +{formatCurrency(balance, currency)}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.balanceChipNegative}>
        <Text style={styles.balanceNegative}>
          -{formatCurrency(Math.abs(balance), currency)}
        </Text>
      </View>
    );
  };

  const renderGroupCard = ({ item }: { item: GroupWithMeta }) => (
    <TouchableOpacity
      style={[styles.card, Shadows.md]}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
    >
      <View style={styles.cardHeader}>
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardIcon}
        >
          <Text style={styles.cardIconText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardSubtitle}>
            {item.member_count} {t('groups.members').toLowerCase()}
          </Text>
        </View>
        <View style={styles.cardBalance}>
          {renderBalanceText(item.net_balance, item.currency)}
        </View>
      </View>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={1}>
          {item.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <LinearGradient
        colors={[Colors.primarySurface, '#E0E7FF']}
        style={styles.emptyIconCircle}
      >
        <Text style={styles.emptyIconText}>{'\uD83D\uDC65'}</Text>
      </LinearGradient>
      <Text style={styles.emptyTitle}>{t('groups.no_groups')}</Text>
      <Text style={styles.emptySubtitle}>{t('groups.no_groups_subtitle')}</Text>
    </View>
  );

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
        <Text style={styles.headerTitle}>{t('groups.title')}</Text>
        <TouchableOpacity
          style={styles.joinButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('JoinGroup')}
        >
          <Text style={styles.joinButtonText}>{t('groups.join')}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchGroups}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          groups.length === 0 ? styles.emptyList : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.fab, Shadows.glow]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: Colors.textOnDark,
  },
  joinButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  joinButtonText: {
    color: Colors.textOnDark,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: Colors.dangerSurface,
    padding: Spacing.md,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  list: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  cardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    ...Typography.cardTitle,
  },
  cardSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  cardBalance: {
    marginLeft: Spacing.md,
    alignItems: 'flex-end',
  },
  cardDescription: {
    ...Typography.caption,
    marginTop: Spacing.sm,
    marginLeft: 60,
  },
  balanceChipPositive: {
    backgroundColor: Colors.successSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  balanceChipNegative: {
    backgroundColor: Colors.dangerSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  balanceChipSettled: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  balancePositive: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
  },
  balanceNegative: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.danger,
  },
  balanceSettled: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  emptyContainer: {
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
  emptyIconText: {
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: Colors.textOnPrimary,
    fontSize: 28,
    fontWeight: '500',
    marginTop: -2,
  },
});
