import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Group, Expense, GroupMember, Balance, User } from '../../types/database';
import { simplifyDebts } from '../../utils/balance';
import { Spacing, Radius, FontFamily, tabularNums } from '../../theme';
import { displayFor } from '../../theme/fonts';
import { generateReminder } from '../../utils/whatsapp';
import { useWhatsAppReminder } from '../../hooks/useWhatsAppReminder';
import { SkeletonList } from '../../components/SkeletonLoader';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import StateScreen from '../../components/StateScreen';
import EmptyState from '../../components/EmptyState';
import AmountText from '../../components/AmountText';
import SectionDivider from '../../components/SectionDivider';
import useFabFloat from '../../hooks/useFabFloat';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

// Avatar gradient hash for member initials
const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#7C3AED', '#A78BFA'],
  ['#DB2777', '#F472B6'],
  ['#2563EB', '#60A5FA'],
  ['#D97706', '#FBBF24'],
  ['#059669', '#34D399'],
];
function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const sendReminder = useWhatsAppReminder();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerBounce = useRef(new Animated.Value(0)).current;
  const fabFloat = useFabFloat();

  useEffect(() => {
    Animated.spring(headerBounce, {
      toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120, mass: 0.8,
    }).start();
  }, []);

  // Header actions: primary scan (brass) + secondary outlined icon buttons
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Activity', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.headerIconBtn, { backgroundColor: colors.iconButtonBg, borderColor: colors.iconButtonBorder }]}
          >
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupChat', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.headerIconBtn, { backgroundColor: colors.iconButtonBg, borderColor: colors.iconButtonBorder }]}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.headerIconBtn, { backgroundColor: colors.iconButtonBg, borderColor: colors.iconButtonBorder }]}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {/* Primary action: Scan — brass gradient circle */}
          <BouncyPressable onPress={() => navigation.navigate('ScanReceipt', { groupId })} scaleDown={0.92}>
            <LinearGradient
              colors={colors.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.headerPrimaryBtn, { shadowColor: colors.accent }]}
            >
              <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
            </LinearGradient>
          </BouncyPressable>
        </View>
      ),
    });
  }, [navigation, groupId, colors, styles]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
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
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, groupId, navigation, t]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const getUserName = (userId: string): string => {
    const member = members.find((m) => m.user_id === userId);
    if (member?.user) return userId === user?.id ? t('common.you') : member.user.display_name;
    return t('common.unknown');
  };

  // ── Hero balance card ────────────────────────────────────────
  const renderHero = () => {
    const userDebts = debts.filter((d) => d.from_user === user?.id);
    const userCredits = debts.filter((d) => d.to_user === user?.id);
    const totalOwed = userDebts.reduce((s, d) => s + d.net_amount, 0);
    const totalOwedToYou = userCredits.reduce((s, d) => s + d.net_amount, 0);
    const net = totalOwedToYou - totalOwed;
    const isSettled = Math.abs(net) < 0.01;

    return (
      <Animated.View
        style={{
          opacity: headerBounce,
          transform: [{ translateY: headerBounce.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }}
      >
        <LinearGradient
          colors={isDark ? colors.headerGradient : ['#FBF8F1', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>
            {isSettled ? t('groups.settled_up') : net >= 0 ? t('groups.you_are_owed') : t('groups.you_owe_total')}
          </Text>
          <AmountText
            amount={Math.abs(net)}
            currency={group?.currency || 'EGP'}
            variant="display"
            tone={isSettled ? 'neutral' : net >= 0 ? 'owed' : 'owe'}
            signMode="absolute"
          />
          {!isSettled ? (
            <View style={styles.heroBreakdown}>
              {totalOwed > 0 ? (
                <BouncyPressable onPress={() => navigation.navigate('GroupBalances', { groupId })} scaleDown={0.96}>
                  <View style={styles.heroChip}>
                    <View style={[styles.heroDot, { backgroundColor: colors.owe }]} />
                    <Text style={styles.heroChipLabel}>{t('groups.you_owe')}</Text>
                    <AmountText amount={totalOwed} currency={group?.currency || 'EGP'} variant="inline" tone="owe" signMode="absolute" />
                  </View>
                </BouncyPressable>
              ) : null}
              {totalOwedToYou > 0 ? (
                <BouncyPressable onPress={() => navigation.navigate('GroupBalances', { groupId })} scaleDown={0.96}>
                  <View style={styles.heroChip}>
                    <View style={[styles.heroDot, { backgroundColor: colors.owed }]} />
                    <Text style={styles.heroChipLabel}>{t('groups.owes_you')}</Text>
                    <AmountText amount={totalOwedToYou} currency={group?.currency || 'EGP'} variant="inline" tone="owed" signMode="absolute" />
                  </View>
                </BouncyPressable>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>
    );
  };

  // ── Compact debt list above expenses ──────────────────────────
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
              <Text style={[styles.debtRowAmount, tabularNums]}>
                {(group?.currency || 'EGP')} {item.net_amount.toFixed(2)}
              </Text>
              <TouchableOpacity
                style={styles.debtRowRemind}
                onPress={() => {
                  const lang = i18n.language === 'ar' ? 'ar' : 'en';
                  const message = generateReminder(toName, fromName, item.net_amount, group?.currency || 'EGP', lang as 'en' | 'ar');
                  sendReminder(message);
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

  // ── Expense card with payer avatar ────────────────────────────
  const renderExpenseItem = ({ item, index }: { item: Expense; index: number }) => {
    const isMine = item.paid_by === user?.id;
    const paidByName = isMine ? t('common.you') : item.paid_by_user?.display_name || t('common.unknown');
    const date = new Date(item.created_at);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
    const grad = avatarGradient(paidByName);

    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={() => {}} scaleDown={0.98}>
          <ThemedCard style={styles.expenseCard}>
            <View style={styles.expenseLeft}>
              <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payerAvatar}>
                <Text style={[styles.payerAvatarText, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                  {initials(paidByName)}
                </Text>
              </LinearGradient>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDescription} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.expenseMeta} numberOfLines={1}>
                  {paidByName} {t('expenses.paid')} {'\u2022'} {dateStr}
                  {item.category ? ` \u2022 ${item.category}` : ''}
                </Text>
              </View>
            </View>
            <AmountText
              amount={item.total_amount}
              currency={group?.currency || 'EGP'}
              variant="amount"
              tone={isMine ? 'owed' : 'neutral'}
              signMode="absolute"
            />
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

  // ── Loading / error states ────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <SkeletonList count={5} />
      </View>
    );
  }

  if (error) {
    return <StateScreen variant="error" body={error} onRetry={fetchData} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}

      {renderHero()}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpenseItem}
        contentContainerStyle={expenses.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={
          <View>
            {renderDebtSection()}
            {expenses.length > 0 ? <SectionDivider label={t('groups.expenses', 'Expenses')} variant="subtle" /> : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t('expenses.no_expenses')}
            body={t('expenses.tapToAdd')}
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      />

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

    headerIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerPrimaryBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
    },

    // Hero balance card
    hero: {
      paddingHorizontal: Spacing.gutter,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: isDark ? c.border : 'rgba(255,149,0,0.2)',
      gap: Spacing.sm,
    },
    heroKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 2.4,
      textTransform: 'uppercase',
      color: c.kicker,
      marginBottom: Spacing.xs,
    },
    heroBreakdown: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.md,
      flexWrap: 'wrap',
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.65)',
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? c.border : c.borderLight,
    },
    heroDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroChipLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textSecondary,
    },

    // Debt section
    debtSection: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
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
      fontSize: 10,
      letterSpacing: 2.2,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },
    debtSectionLink: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
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
      fontSize: 13,
      color: c.textSecondary,
    },
    debtRowName: {
      fontFamily: FontFamily.bodySemibold,
      color: c.text,
    },
    debtRowAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: c.owe,
    },
    debtRowRemind: {
      padding: 6,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(37,211,102,0.1)' : '#E8F8EE',
    },

    // Lists
    list: { padding: Spacing.lg, paddingBottom: 100 },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },

    // Expense cards
    expenseCard: {
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginEnd: Spacing.md },
    payerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      marginEnd: Spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    payerAvatarText: {
      fontSize: 14,
      color: '#FFFFFF',
      letterSpacing: -0.4,
    },
    expenseInfo: { flex: 1 },
    expenseDescription: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    expenseMeta: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary, marginTop: 2 },

    // FAB
    fab: {
      position: 'absolute', bottom: 24, end: 20,
      shadowColor: c.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    },
    fabGradient: { width: 60, height: 60, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center' },
  });
