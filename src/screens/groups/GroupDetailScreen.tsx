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
  Dimensions,
} from 'react-native';
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
import { generateReminder, shareViaWhatsApp } from '../../utils/whatsapp';
import { SkeletonList } from '../../components/SkeletonLoader';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useFabFloat from '../../hooks/useFabFloat';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;
const { width: SW } = Dimensions.get('window');

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerBounce = useRef(new Animated.Value(0)).current;
  const fabFloat = useFabFloat();

  useEffect(() => {
    Animated.spring(headerBounce, {
      toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120, mass: 0.8,
    }).start();
  }, []);

  // Add activity + scan + settings buttons to header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Activity', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupChat', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ScanReceipt', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="scan-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, groupId, colors]);

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

  // ── Render: Balance summary bar ───────────────────────────────
  const renderQuickBalance = () => {
    if (debts.length === 0) {
      return (
        <Animated.View style={{ opacity: headerBounce, transform: [{ scale: headerBounce.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
          <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceBar}>
            <Ionicons name="checkmark-circle" size={20} color={colors.successLight} style={{ marginRight: 8 }} />
            <Text style={styles.balanceBarSettled}>{t('groups.settled_up')}</Text>
          </LinearGradient>
        </Animated.View>
      );
    }
    const userDebts = debts.filter((d) => d.from_user === user?.id);
    const userCredits = debts.filter((d) => d.to_user === user?.id);
    const totalOwed = userDebts.reduce((s, d) => s + d.net_amount, 0);
    const totalOwedToYou = userCredits.reduce((s, d) => s + d.net_amount, 0);
    return (
      <Animated.View style={{ opacity: headerBounce, transform: [{ translateY: headerBounce.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
        <LinearGradient colors={colors.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceBar}>
          {totalOwed > 0 && (
            <BouncyPressable onPress={() => navigation.navigate('GroupBalances', { groupId })} scaleDown={0.95}>
              <View style={styles.balanceChip}>
                <Ionicons name="arrow-up-circle-outline" size={16} color={colors.dangerLight} style={{ marginRight: 4 }} />
                <Text style={styles.balanceChipLabelRed}>{t('groups.you_owe')}</Text>
                <Text style={styles.balanceChipAmountRed}>{formatCurrency(totalOwed, group?.currency || 'EGP')}</Text>
              </View>
            </BouncyPressable>
          )}
          {totalOwedToYou > 0 && (
            <BouncyPressable onPress={() => navigation.navigate('GroupBalances', { groupId })} scaleDown={0.95}>
              <View style={styles.balanceChip}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={colors.successLight} style={{ marginRight: 4 }} />
                <Text style={styles.balanceChipLabelGreen}>{t('groups.owes_you')}</Text>
                <Text style={styles.balanceChipAmountGreen}>{formatCurrency(totalOwedToYou, group?.currency || 'EGP')}</Text>
              </View>
            </BouncyPressable>
          )}
          {totalOwed === 0 && totalOwedToYou === 0 && (
            <Text style={styles.balanceBarSettled}>{t('groups.settled_up')}</Text>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  // ── Render: Compact debt row (shown inline above expenses) ────
  const renderDebtSection = () => {
    if (debts.length === 0) return null;
    return (
      <View style={styles.debtSection}>
        <View style={styles.debtSectionHeader}>
          <Text style={styles.debtSectionTitle}>{t('groups.balances')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('GroupBalances', { groupId })}>
            <Text style={styles.debtSectionLink}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>
        {debts.slice(0, 3).map((item, index) => {
          const fromName = getUserName(item.from_user);
          const toName = getUserName(item.to_user);
          return (
            <View key={`${item.from_user}-${item.to_user}-${index}`} style={styles.debtRow}>
              <Text style={styles.debtRowText} numberOfLines={1}>
                <Text style={styles.debtRowName}>{fromName}</Text>
                {' → '}
                <Text style={styles.debtRowName}>{toName}</Text>
              </Text>
              <Text style={styles.debtRowAmount}>{formatCurrency(item.net_amount, group?.currency || 'EGP')}</Text>
              <TouchableOpacity
                style={styles.debtRowRemind}
                onPress={() => {
                  const lang = i18n.language === 'ar' ? 'ar' : 'en';
                  const message = generateReminder(toName, fromName, item.net_amount, group?.currency || 'EGP', lang as 'en' | 'ar');
                  shareViaWhatsApp(message);
                }}
              >
                <Ionicons name="logo-whatsapp" size={14} color={colors.success} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  // ── Render: Expense card (simplified) ─────────────────────────
  const renderExpenseItem = ({ item, index }: { item: Expense; index: number }) => {
    const paidByName = item.paid_by === user?.id ? t('common.you') : item.paid_by_user?.display_name || t('common.unknown');
    const date = new Date(item.created_at);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={() => {}} scaleDown={0.98}>
          <ThemedCard style={styles.expenseCard}>
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
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <SkeletonList count={5} />
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}

      {renderQuickBalance()}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        contentContainerStyle={expenses.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={renderDebtSection}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>{t('expenses.no_expenses')}</Text>
            <Text style={styles.emptySubtitle}>{t('expenses.tapToAdd')}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Single FAB → Add Expense */}
      <Animated.View style={[styles.fab, { transform: [{ translateY: fabFloat }] }]}>
        <BouncyPressable onPress={() => navigation.navigate('AddExpense', { groupId })}>
          <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </BouncyPressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Balance bar
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

    // Debt section (compact inline)
    debtSection: {
      marginBottom: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    debtSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    debtSectionTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      letterSpacing: 2,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },
    debtSectionLink: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.primary,
    },
    debtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      gap: Spacing.sm,
    },
    debtRowText: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    debtRowName: {
      fontFamily: FontFamily.bodySemibold,
      color: c.text,
    },
    debtRowAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.danger,
    },
    debtRowRemind: {
      padding: 4,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(37,211,102,0.1)' : '#E8F8EE',
    },

    // List
    list: { padding: Spacing.xl, paddingBottom: 100 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
    emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: Spacing.md },
    emptyIconWrap: { marginBottom: Spacing.sm },
    emptyIconCircle: {
      width: 64, height: 64, borderRadius: 32,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: c.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
    },
    emptyTitle: { fontSize: 18, color: c.text, fontFamily: FontFamily.bodyBold, letterSpacing: -0.3 },
    emptySubtitle: { fontSize: 14, color: c.textTertiary, fontFamily: FontFamily.body },

    // Expense cards (simplified)
    expenseCard: {
      marginBottom: Spacing.md, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between',
    },
    expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.md },
    categoryDot: {
      width: 34, height: 34, borderRadius: 11, marginRight: Spacing.md,
      justifyContent: 'center', alignItems: 'center',
    },
    expenseInfo: { flex: 1 },
    expenseDescription: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    expenseMeta: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary, marginTop: 2 },
    expenseAmount: { fontSize: 16, fontFamily: FontFamily.bodyBold, color: c.text, letterSpacing: -0.3 },

    // FAB (single action)
    fab: {
      position: 'absolute', bottom: 24, end: 20,
      shadowColor: c.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    },
    fabGradient: { width: 60, height: 60, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center' },
  });
