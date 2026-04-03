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
  Modal,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Group, Expense, GroupMember, Balance, User } from '../../types/database';
import { simplifyDebts, formatCurrency } from '../../utils/balance';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

type Tab = 'expenses' | 'balances';

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);
      navigation.setOptions({ title: groupData.name });

      // Fetch members with user data
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*, user:users(*)')
        .eq('group_id', groupId);

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch expenses with paid_by user
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*, paid_by_user:users!expenses_paid_by_fkey(*), splits:expense_splits(*)')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Fetch settlements
      const { data: settlements, error: settlementsError } = await supabase
        .from('settlements')
        .select('*')
        .eq('group_id', groupId);

      if (settlementsError) throw settlementsError;

      // Build raw balances from expenses
      const rawBalances: Balance[] = [];
      const userMap = new Map<string, User>();
      for (const m of membersData || []) {
        if (m.user) {
          userMap.set(m.user_id, m.user as User);
        }
      }

      for (const expense of expensesData || []) {
        for (const split of expense.splits || []) {
          if (split.user_id !== expense.paid_by) {
            rawBalances.push({
              from_user: split.user_id,
              to_user: expense.paid_by,
              net_amount: split.amount,
            });
          }
        }
      }

      // Add settlement offsets (reverse direction)
      for (const s of settlements || []) {
        rawBalances.push({
          from_user: s.paid_to,
          to_user: s.paid_by,
          net_amount: s.amount,
        });
      }

      const simplified = simplifyDebts(rawBalances);
      const enrichedDebts: SimplifiedDebt[] = simplified.map((d) => ({
        ...d,
        from_user_data: userMap.get(d.from_user),
        to_user_data: userMap.get(d.to_user),
      }));

      setDebts(enrichedDebts);
    } catch (err) {
      // Silently handle - the user can pull to refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, groupId, navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getUserName = (userId: string): string => {
    const member = members.find((m) => m.user_id === userId);
    if (member?.user) {
      return userId === user?.id ? t('common.you') || 'You' : member.user.display_name;
    }
    return 'Unknown';
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const paidByName =
      item.paid_by === user?.id
        ? t('common.you') || 'You'
        : item.paid_by_user?.display_name || 'Unknown';
    const date = new Date(item.created_at);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;

    return (
      <View style={styles.expenseCard}>
        <View style={styles.expenseLeft}>
          <LinearGradient
            colors={Gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.categoryDot}
          />
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={styles.expenseMeta}>
              {paidByName} {'\u2022'} {dateStr}
              {item.category ? ` \u2022 ${item.category}` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.expenseAmount}>
          {formatCurrency(item.total_amount, group?.currency || 'EGP')}
        </Text>
      </View>
    );
  };

  const renderDebtItem = ({ item }: { item: SimplifiedDebt }) => {
    const fromName = getUserName(item.from_user);
    const toName = getUserName(item.to_user);
    const isCurrentUserDebtor = item.from_user === user?.id;

    return (
      <View style={[styles.debtCard, isCurrentUserDebtor && styles.debtCardHighlight]}>
        <View style={styles.debtAvatarRow}>
          <LinearGradient
            colors={Gradients.danger}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.debtAvatar}
          >
            <Text style={styles.debtAvatarText}>
              {(item.from_user_data?.display_name || '?').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <Text style={styles.debtArrow}>{'\u2192'}</Text>
          <LinearGradient
            colors={Gradients.success}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.debtAvatar}
          >
            <Text style={styles.debtAvatarText}>
              {(item.to_user_data?.display_name || '?').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
        <View style={styles.debtInfo}>
          <Text style={styles.debtText}>
            <Text style={styles.debtName}>{fromName}</Text>
            {' '}{t('groups.you_owe').toLowerCase().includes('owe') ? 'owes' : t('groups.you_owe')}{' '}
            <Text style={styles.debtName}>{toName}</Text>
          </Text>
          <Text style={styles.debtAmount}>
            {formatCurrency(item.net_amount, group?.currency || 'EGP')}
          </Text>
        </View>
      </View>
    );
  };

  const renderQuickBalance = () => {
    if (debts.length === 0) {
      return (
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceBar}
        >
          <Text style={styles.balanceBarSettled}>{t('groups.settled_up')}</Text>
        </LinearGradient>
      );
    }

    // Find current user's debts
    const userDebts = debts.filter((d) => d.from_user === user?.id);
    const userCredits = debts.filter((d) => d.to_user === user?.id);

    const totalOwed = userDebts.reduce((s, d) => s + d.net_amount, 0);
    const totalOwedToYou = userCredits.reduce((s, d) => s + d.net_amount, 0);

    return (
      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceBar}
      >
        {totalOwed > 0 && (
          <View style={styles.balanceChip}>
            <Text style={styles.balanceChipLabelRed}>{t('groups.you_owe')}</Text>
            <Text style={styles.balanceChipAmountRed}>
              {formatCurrency(totalOwed, group?.currency || 'EGP')}
            </Text>
          </View>
        )}
        {totalOwedToYou > 0 && (
          <View style={styles.balanceChip}>
            <Text style={styles.balanceChipLabelGreen}>{t('groups.owes_you')}</Text>
            <Text style={styles.balanceChipAmountGreen}>
              {formatCurrency(totalOwedToYou, group?.currency || 'EGP')}
            </Text>
          </View>
        )}
        {totalOwed === 0 && totalOwedToYou === 0 && (
          <Text style={styles.balanceBarSettled}>{t('groups.settled_up')}</Text>
        )}
      </LinearGradient>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

      {/* Quick Balance Bar */}
      {renderQuickBalance()}

      {/* Pill-style Tabs */}
      <View style={styles.tabsOuter}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
            onPress={() => setActiveTab('expenses')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'expenses' && styles.tabTextActive,
              ]}
            >
              {t('groups.expenses')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
            onPress={() => setActiveTab('balances')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'balances' && styles.tabTextActive,
              ]}
            >
              {t('groups.balances')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'expenses' ? (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={
            expenses.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{'\uD83E\uDDFE'}</Text>
              <Text style={styles.emptyText}>{t('expenses.no_expenses')}</Text>
            </View>
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
      ) : (
        <FlatList
          data={debts}
          keyExtractor={(item, idx) => `${item.from_user}-${item.to_user}-${idx}`}
          renderItem={renderDebtItem}
          contentContainerStyle={
            debts.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{'\u2705'}</Text>
              <Text style={styles.emptyText}>{t('groups.settled_up')}</Text>
            </View>
          }
          ListFooterComponent={
            debts.length > 0 ? (
              <TouchableOpacity
                style={styles.viewAllBalances}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('GroupBalances', { groupId })}
              >
                <Text style={styles.viewAllBalancesText}>
                  {t('groups.balances')} {'\u2192'}
                </Text>
              </TouchableOpacity>
            ) : null
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
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setFabOpen(true)}
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

      {/* FAB Menu Modal */}
      <Modal
        visible={fabOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFabOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFabOpen(false)}>
          <View style={styles.fabMenu}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              activeOpacity={0.7}
              onPress={() => {
                setFabOpen(false);
                navigation.navigate('AddExpense', { groupId });
              }}
            >
              <LinearGradient
                colors={Gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabMenuIconCircle}
              >
                <Text style={styles.fabMenuIcon}>{'\uD83D\uDCB0'}</Text>
              </LinearGradient>
              <Text style={styles.fabMenuLabel}>{t('expenses.add')}</Text>
            </TouchableOpacity>

            <View style={styles.fabMenuDivider} />

            <TouchableOpacity
              style={styles.fabMenuItem}
              activeOpacity={0.7}
              onPress={() => {
                setFabOpen(false);
                navigation.navigate('ScanReceipt', { groupId });
              }}
            >
              <LinearGradient
                colors={Gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabMenuIconCircle}
              >
                <Text style={styles.fabMenuIcon}>{'\uD83D\uDCF7'}</Text>
              </LinearGradient>
              <Text style={styles.fabMenuLabel}>{t('expenses.scan_receipt')}</Text>
            </TouchableOpacity>

            <View style={styles.fabMenuDivider} />

            <TouchableOpacity
              style={styles.fabMenuItem}
              activeOpacity={0.7}
              onPress={() => {
                setFabOpen(false);
                navigation.navigate('GroupBalances', { groupId });
              }}
            >
              <LinearGradient
                colors={Gradients.success}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabMenuIconCircle}
              >
                <Text style={styles.fabMenuIcon}>{'\uD83E\uDD1D'}</Text>
              </LinearGradient>
              <Text style={styles.fabMenuLabel}>{t('settlements.record')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  // Balance bar with gradient
  balanceBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  balanceChipLabelRed: {
    fontSize: 13,
    color: Colors.dangerLight,
    fontWeight: '500',
  },
  balanceChipAmountRed: {
    fontSize: 15,
    color: '#FCA5A5',
    fontWeight: '800',
  },
  balanceChipLabelGreen: {
    fontSize: 13,
    color: Colors.successLight,
    fontWeight: '500',
  },
  balanceChipAmountGreen: {
    fontSize: 15,
    color: Colors.successLight,
    fontWeight: '800',
  },
  balanceBarSettled: {
    fontSize: 15,
    color: Colors.textOnDark,
    fontWeight: '600',
    opacity: 0.8,
  },
  // Pill tabs
  tabsOuter: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.textOnPrimary,
  },
  // Lists
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  // Expense cards
  expenseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.md,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    ...Typography.bodyBold,
    fontSize: 15,
  },
  expenseMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  // Debt cards
  debtCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  debtCardHighlight: {
    backgroundColor: Colors.dangerSurface,
  },
  debtAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  debtAvatar: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  debtArrow: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  debtInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  debtName: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.danger,
    marginLeft: Spacing.md,
  },
  // View all balances link
  viewAllBalances: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  viewAllBalancesText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    borderRadius: Radius.xl,
    ...Shadows.glow,
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
  // FAB Menu Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: Spacing.xl,
    paddingBottom: 100,
  },
  fabMenu: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xxl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    width: 240,
    ...Shadows.lg,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  fabMenuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fabMenuIcon: {
    fontSize: 16,
  },
  fabMenuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  fabMenuDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
});
