import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Group, Expense, GroupMember, Balance, User } from '../../types/database';
import { simplifyDebts, formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;
type Tab = 'expenses' | 'balances';
const { width: SW } = Dimensions.get('window');

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

function AnimatedListItem({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 400, delay: Math.min(index * 70, 350),
      easing: Easing.out(Easing.back(1.2)), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const tabIndicator = useRef(new Animated.Value(0)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const fabMenuScale = useRef(new Animated.Value(0)).current;
  const fabMenuOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(tabIndicator, {
      toValue: activeTab === 'expenses' ? 0 : 1,
      useNativeDriver: true, damping: 18, stiffness: 200,
    }).start();
  }, [activeTab]);

  const toggleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const opening = !fabOpen;
    setFabOpen(opening);
    Animated.parallel([
      Animated.spring(fabRotation, { toValue: opening ? 1 : 0, useNativeDriver: true, damping: 12, stiffness: 150 }),
      Animated.spring(fabMenuScale, { toValue: opening ? 1 : 0, useNativeDriver: true, damping: 14, stiffness: 180 }),
      Animated.timing(fabMenuOpacity, { toValue: opening ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeFab = () => {
    setFabOpen(false);
    Animated.parallel([
      Animated.spring(fabRotation, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 150 }),
      Animated.spring(fabMenuScale, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 180 }),
      Animated.timing(fabMenuOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: groupData, error: groupError } = await supabase.from('groups').select('*').eq('id', groupId).single();
      if (groupError) throw groupError;
      setGroup(groupData);
      navigation.setOptions({ title: groupData.name });

      const { data: membersData, error: membersError } = await supabase
        .from('group_members').select('*, user:users(*)').eq('group_id', groupId);
      if (membersError) throw membersError;
      setMembers(membersData || []);

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*, paid_by_user:users!expenses_paid_by_fkey(*), splits:expense_splits(*)')
        .eq('group_id', groupId).eq('is_deleted', false).order('created_at', { ascending: false });
      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      const { data: settlements, error: settlementsError } = await supabase
        .from('settlements').select('*').eq('group_id', groupId);
      if (settlementsError) throw settlementsError;

      const rawBalances: Balance[] = [];
      const userMap = new Map<string, User>();
      for (const m of membersData || []) {
        if (m.user) userMap.set(m.user_id, m.user as User);
      }
      for (const expense of expensesData || []) {
        for (const split of expense.splits || []) {
          if (split.user_id !== expense.paid_by) {
            rawBalances.push({ from_user: split.user_id, to_user: expense.paid_by, net_amount: split.amount });
          }
        }
      }
      for (const s of settlements || []) {
        rawBalances.push({ from_user: s.paid_to, to_user: s.paid_by, net_amount: s.amount });
      }

      const simplified = simplifyDebts(rawBalances);
      setDebts(simplified.map((d) => ({ ...d, from_user_data: userMap.get(d.from_user), to_user_data: userMap.get(d.to_user) })));
    } catch (err) {
      // Pull to refresh will retry
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, groupId, navigation]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const getUserName = (userId: string): string => {
    const member = members.find((m) => m.user_id === userId);
    if (member?.user) return userId === user?.id ? t('common.you') : member.user.display_name;
    return t('common.unknown');
  };

  const renderExpenseItem = ({ item, index }: { item: Expense; index: number }) => {
    const paidByName = item.paid_by === user?.id ? t('common.you') : item.paid_by_user?.display_name || t('common.unknown');
    const date = new Date(item.created_at);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
    return (
      <AnimatedListItem index={index}>
        <View style={styles.expenseCard}>
          {isDark && <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
          <View style={styles.expenseLeft}>
            <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryDot}>
              <Ionicons name="receipt-outline" size={14} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDescription} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.expenseMeta}>
                {paidByName} {'\u2022'} {dateStr}{item.category ? ` \u2022 ${item.category}` : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.expenseAmount}>{formatCurrency(item.total_amount, group?.currency || 'EGP')}</Text>
        </View>
      </AnimatedListItem>
    );
  };

  const renderDebtItem = ({ item, index }: { item: SimplifiedDebt; index: number }) => {
    const fromName = getUserName(item.from_user);
    const toName = getUserName(item.to_user);
    const isCurrentUserDebtor = item.from_user === user?.id;
    return (
      <AnimatedListItem index={index}>
        <View style={[styles.debtCard, isCurrentUserDebtor && styles.debtCardHighlight]}>
          {isDark && <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
          <View style={styles.debtAvatarRow}>
            <LinearGradient colors={colors.dangerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.debtAvatar}>
              <Text style={styles.debtAvatarText}>{(item.from_user_data?.display_name || '?').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
            <LinearGradient colors={colors.successGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.debtAvatar}>
              <Text style={styles.debtAvatarText}>{(item.to_user_data?.display_name || '?').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          </View>
          <View style={styles.debtInfo}>
            <Text style={styles.debtText}>
              <Text style={styles.debtName}>{fromName}</Text> {t('groups.owes')} <Text style={styles.debtName}>{toName}</Text>
            </Text>
            <Text style={styles.debtAmount}>{formatCurrency(item.net_amount, group?.currency || 'EGP')}</Text>
          </View>
        </View>
      </AnimatedListItem>
    );
  };

  const renderQuickBalance = () => {
    if (debts.length === 0) {
      return (
        <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceBar}>
          <Ionicons name="checkmark-circle" size={20} color={colors.successLight} style={{ marginRight: 8 }} />
          <Text style={styles.balanceBarSettled}>{t('groups.settled_up')}</Text>
        </LinearGradient>
      );
    }
    const userDebts = debts.filter((d) => d.from_user === user?.id);
    const userCredits = debts.filter((d) => d.to_user === user?.id);
    const totalOwed = userDebts.reduce((s, d) => s + d.net_amount, 0);
    const totalOwedToYou = userCredits.reduce((s, d) => s + d.net_amount, 0);
    return (
      <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceBar}>
        {totalOwed > 0 && (
          <View style={styles.balanceChip}>
            <Ionicons name="arrow-up-circle-outline" size={16} color={colors.dangerLight} style={{ marginRight: 4 }} />
            <Text style={styles.balanceChipLabelRed}>{t('groups.you_owe')}</Text>
            <Text style={styles.balanceChipAmountRed}>{formatCurrency(totalOwed, group?.currency || 'EGP')}</Text>
          </View>
        )}
        {totalOwedToYou > 0 && (
          <View style={styles.balanceChip}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={colors.successLight} style={{ marginRight: 4 }} />
            <Text style={styles.balanceChipLabelGreen}>{t('groups.owes_you')}</Text>
            <Text style={styles.balanceChipAmountGreen}>{formatCurrency(totalOwedToYou, group?.currency || 'EGP')}</Text>
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
      <View style={styles.root}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  const tabWidth = (SW - Spacing.xl * 2 - 8) / 2;
  const fabSpin = fabRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}

      {renderQuickBalance()}

      {/* Animated Tabs */}
      <View style={styles.tabsOuter}>
        <View style={styles.tabsContainer}>
          <Animated.View style={[styles.tabIndicator, {
            width: tabWidth,
            transform: [{ translateX: Animated.multiply(tabIndicator, tabWidth) }],
          }]} />
          <TouchableOpacity
            style={styles.tab}
            onPress={() => { Haptics.selectionAsync(); setActiveTab('expenses'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={16} color={activeTab === 'expenses' ? '#FFFFFF' : colors.textTertiary} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>{t('groups.expenses')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => { Haptics.selectionAsync(); setActiveTab('balances'); }}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={activeTab === 'balances' ? '#FFFFFF' : colors.textTertiary} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>{t('groups.balances')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'expenses' ? (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={expenses.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t('expenses.no_expenses')}</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={debts}
          keyExtractor={(item, idx) => `${item.from_user}-${item.to_user}-${idx}`}
          renderItem={renderDebtItem}
          contentContainerStyle={debts.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.successLight} />
              <Text style={styles.emptyText}>{t('groups.settled_up')}</Text>
            </View>
          }
          ListFooterComponent={debts.length > 0 ? (
            <TouchableOpacity style={styles.viewAllBalances} activeOpacity={0.7}
              onPress={() => navigation.navigate('GroupBalances', { groupId })}>
              <Text style={styles.viewAllBalancesText}>{t('groups.balances')} →</Text>
            </TouchableOpacity>
          ) : null}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB overlay */}
      {fabOpen && (
        <Pressable style={styles.fabOverlay} onPress={closeFab}>
          <Animated.View style={[styles.fabMenu, {
            opacity: fabMenuOpacity,
            transform: [{ scale: fabMenuScale }, { translateY: fabMenuScale.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }]}>
            {isDark && <LinearGradient colors={colors.cardGradient} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xxl }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
            {[
              { icon: 'cash-outline', label: t('expenses.add'), grad: colors.primaryGradient, onPress: () => { closeFab(); navigation.navigate('AddExpense', { groupId }); } },
              { icon: 'scan-outline', label: t('expenses.scan_receipt'), grad: colors.accentGradient, onPress: () => { closeFab(); navigation.navigate('ScanReceipt', { groupId }); } },
              { icon: 'swap-horizontal-outline', label: t('settlements.record'), grad: colors.successGradient, onPress: () => { closeFab(); navigation.navigate('GroupBalances', { groupId }); } },
            ].map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.fabMenuDivider} />}
                <TouchableOpacity style={styles.fabMenuItem} activeOpacity={0.7} onPress={() => { Haptics.selectionAsync(); item.onPress(); }}>
                  <LinearGradient colors={item.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabMenuIconCircle}>
                    <Ionicons name={item.icon as any} size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.fabMenuLabel}>{item.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </Animated.View>
        </Pressable>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={toggleFab}>
        <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
          <Animated.View style={{ transform: [{ rotate: fabSpin }] }}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    balanceBar: {
      flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
      gap: Spacing.md, justifyContent: 'center', alignItems: 'center',
    },
    balanceChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    },
    balanceChipLabelRed: { fontSize: 13, color: c.dangerLight, fontFamily: FontFamily.body },
    balanceChipAmountRed: { fontSize: 15, color: c.dangerLight, fontFamily: FontFamily.bodyBold },
    balanceChipLabelGreen: { fontSize: 13, color: c.successLight, fontFamily: FontFamily.body },
    balanceChipAmountGreen: { fontSize: 15, color: c.successLight, fontFamily: FontFamily.bodyBold },
    balanceBarSettled: { fontSize: 15, color: '#F4F0E8', fontFamily: FontFamily.bodySemibold, opacity: 0.8 },

    tabsOuter: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      borderRadius: Radius.full, padding: 4, position: 'relative',
    },
    tabIndicator: {
      position: 'absolute', top: 4, left: 4, bottom: 4,
      backgroundColor: c.primary, borderRadius: Radius.full,
    },
    tab: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: Radius.full, flexDirection: 'row',
      zIndex: 1,
    },
    tabText: { fontSize: 14, fontFamily: FontFamily.bodySemibold, color: c.textTertiary },
    tabTextActive: { color: '#FFFFFF' },

    list: { padding: Spacing.xl, paddingBottom: 100 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: Spacing.md },
    emptyText: { fontSize: 16, color: c.textTertiary, fontFamily: FontFamily.body },

    expenseCard: {
      borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 10, elevation: isDark ? 0 : 3,
    },
    expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.md },
    categoryDot: {
      width: 32, height: 32, borderRadius: 10, marginRight: Spacing.md,
      justifyContent: 'center', alignItems: 'center',
    },
    expenseInfo: { flex: 1 },
    expenseDescription: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    expenseMeta: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary, marginTop: 2 },
    expenseAmount: { fontSize: 16, fontFamily: FontFamily.bodyBold, color: c.text, letterSpacing: -0.3 },

    debtCard: {
      borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.lg, marginBottom: Spacing.md, overflow: 'hidden',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 10, elevation: isDark ? 0 : 3,
    },
    debtCardHighlight: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.08)' : '#FFF7ED',
      borderColor: isDark ? 'rgba(234,88,12,0.2)' : '#FECACA',
    },
    debtAvatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
    debtAvatar: { width: 34, height: 34, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
    debtAvatarText: { fontSize: 14, fontFamily: FontFamily.bodyBold, color: '#FFFFFF' },
    debtInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    debtText: { fontSize: 14, fontFamily: FontFamily.body, color: c.textSecondary, flex: 1 },
    debtName: { fontFamily: FontFamily.bodyBold, color: c.text },
    debtAmount: { fontSize: 16, fontFamily: FontFamily.bodyBold, color: c.danger, marginLeft: Spacing.md },

    viewAllBalances: { alignItems: 'center', paddingVertical: 14 },
    viewAllBalancesText: { color: c.primary, fontSize: 15, fontFamily: FontFamily.bodyBold },

    fab: {
      position: 'absolute', bottom: 24, right: 20,
      shadowColor: c.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    },
    fabGradient: { width: 60, height: 60, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center' },

    fabOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay, zIndex: 10,
      justifyContent: 'flex-end', alignItems: 'flex-end',
      paddingRight: Spacing.xl, paddingBottom: 100,
    },
    fabMenu: {
      backgroundColor: isDark ? c.bgCard : c.bgCard,
      borderRadius: Radius.xxl, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
      width: 240, borderWidth: 1, borderColor: c.border, overflow: 'hidden',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2, shadowRadius: 24, elevation: 16,
    },
    fabMenuItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.lg,
    },
    fabMenuIconCircle: { width: 36, height: 36, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    fabMenuLabel: { fontSize: 15, fontFamily: FontFamily.bodySemibold, color: c.text },
    fabMenuDivider: { height: 1, backgroundColor: c.borderLight, marginHorizontal: Spacing.md },
  });
