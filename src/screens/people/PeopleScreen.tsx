import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import useFabFloat from '../../hooks/useFabFloat';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/balance';
import { LedgerEntry } from '../../types/database';
import { MainTabParamList, RootStackParamList } from '../../navigation/AppNavigator';

// ---------------------------------------------------------------------------
// Navigation typing
// ---------------------------------------------------------------------------

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'PeopleTab'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

type Segment = 'friends' | 'personal';

interface FriendBalance {
  userId: string | null;
  displayName: string;
  netBalance: number;
  groupCount: number;
}

interface ContactSummary {
  contactName: string;
  netBalance: number;
  entryCount: number;
}

const { width: SW } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#7C3AED', '#A78BFA'],
  ['#DB2777', '#F472B6'],
  ['#EA580C', '#FB923C'],
  ['#2563EB', '#60A5FA'],
  ['#059669', '#34D399'],
  ['#D97706', '#FBBF24'],
  ['#4F46E5', '#818CF8'],
];

function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PeopleScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const fabFloat = useFabFloat();

  // ---------- segment toggle ----------
  const [activeSegment, setActiveSegment] = useState<Segment>('friends');
  const pillAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = (SW - Spacing.xxl * 2 - 8) / 2; // account for outer padding + container padding

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: activeSegment === 'friends' ? 0 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
    }).start();
  }, [activeSegment]);

  const handleSegmentChange = useCallback((segment: Segment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSegment(segment);
  }, []);

  // ---------- friends state ----------
  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsRefreshing, setFriendsRefreshing] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  // ---------- personal (ledger) state ----------
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalRefreshing, setPersonalRefreshing] = useState(false);

  // Totals for personal
  const [personalOwedToYou, setPersonalOwedToYou] = useState(0);
  const [personalYouOwe, setPersonalYouOwe] = useState(0);

  // Bouncing empty-state icon
  const emptyBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emptyBounce, {
          toValue: -12,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(emptyBounce, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // ---------- friends data fetching ----------
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const userId = user.id;

    try {
      setFriendsError(null);

      // 1. Fetch all groups user is in
      const { data: memberships, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);
      if (memberErr) throw memberErr;

      const groupIds = (memberships || []).map((m) => m.group_id);

      // Accumulator: key = personIdentifier, value = { displayName, netBalance, groupIds }
      const balanceMap = new Map<
        string,
        { displayName: string; netBalance: number; groupIds: Set<string>; isUser: boolean }
      >();

      const getOrCreate = (key: string, displayName: string, isUser: boolean) => {
        let entry = balanceMap.get(key);
        if (!entry) {
          entry = { displayName, netBalance: 0, groupIds: new Set(), isUser };
          balanceMap.set(key, entry);
        }
        return entry;
      };

      // Only do group-based queries if the user is in at least one group
      if (groupIds.length > 0) {
        // 2. Fetch all members to get user info
        const { data: allMembers, error: membersErr } = await supabase
          .from('group_members')
          .select('group_id, user_id, user:users(id, display_name)')
          .in('group_id', groupIds);
        if (membersErr) throw membersErr;

        // Build user id -> display_name map from members
        const userNameMap = new Map<string, string>();
        for (const m of allMembers || []) {
          const u = m.user as unknown as { id: string; display_name: string } | null;
          if (u) userNameMap.set(u.id, u.display_name);
          // Track which groups each person shares with the current user
          if (m.user_id !== userId) {
            const entry = getOrCreate(m.user_id, u?.display_name || t('common.unknown'), true);
            entry.groupIds.add(m.group_id);
          }
        }

        // 3. Fetch all expenses + splits across those groups
        const { data: expenses, error: expErr } = await supabase
          .from('expenses')
          .select('id, group_id, paid_by, total_amount')
          .in('group_id', groupIds)
          .eq('is_deleted', false);
        if (expErr) throw expErr;

        const expenseIds = (expenses || []).map((e) => e.id);
        let splits: { expense_id: string; user_id: string; amount: number }[] = [];
        if (expenseIds.length > 0) {
          const { data: splitsData, error: splitsErr } = await supabase
            .from('expense_splits')
            .select('expense_id, user_id, amount')
            .in('expense_id', expenseIds);
          if (splitsErr) throw splitsErr;
          splits = splitsData || [];
        }

        // 4. Fetch all settlements
        const { data: settlements, error: setErr } = await supabase
          .from('settlements')
          .select('paid_by, paid_to, amount')
          .in('group_id', groupIds);
        if (setErr) throw setErr;

        // 5. Calculate per-person balance from expenses
        for (const expense of expenses || []) {
          const expSplits = splits.filter((s) => s.expense_id === expense.id);

          if (expense.paid_by === userId) {
            // User paid -> others owe user their split amounts
            for (const split of expSplits) {
              if (split.user_id !== userId) {
                const name = userNameMap.get(split.user_id) || t('common.unknown');
                const entry = getOrCreate(split.user_id, name, true);
                entry.netBalance += split.amount;
              }
            }
          } else {
            // Someone else paid -> user owes payer their split amount
            const userSplit = expSplits.find((s) => s.user_id === userId);
            if (userSplit) {
              const payerName = userNameMap.get(expense.paid_by) || t('common.unknown');
              const entry = getOrCreate(expense.paid_by, payerName, true);
              entry.netBalance -= userSplit.amount;
            }
          }
        }

        // 6. Account for settlements
        for (const s of settlements || []) {
          if (s.paid_by === userId) {
            // User paid someone -> reduce what user owes them (or increase what they owe user)
            const name = userNameMap.get(s.paid_to) || t('common.unknown');
            const entry = getOrCreate(s.paid_to, name, true);
            entry.netBalance += s.amount;
          } else if (s.paid_to === userId) {
            // Someone paid user -> reduce what they owe user
            const name = userNameMap.get(s.paid_by) || t('common.unknown');
            const entry = getOrCreate(s.paid_by, name, true);
            entry.netBalance -= s.amount;
          }
        }
      }

      // 7. Fetch ledger entries
      const { data: ledgerEntries, error: ledgerErr } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_settled', false);
      if (ledgerErr) throw ledgerErr;

      for (const entry of ledgerEntries || []) {
        const amount = entry.direction === 'they_owe' ? entry.amount : -entry.amount;

        // If the ledger contact is linked to a real user, merge into their balance
        if (entry.contact_user_id) {
          const existing = balanceMap.get(entry.contact_user_id);
          if (existing) {
            existing.netBalance += amount;
          } else {
            const lEntry = getOrCreate(entry.contact_user_id, entry.contact_name, true);
            lEntry.netBalance += amount;
          }
        } else {
          // Non-linked ledger contact: use contact_name as key, prefixed to avoid collision
          const key = `ledger:${entry.contact_name}`;
          const lEntry = getOrCreate(key, entry.contact_name, false);
          lEntry.netBalance += amount;
        }
      }

      // 8. Build sorted result
      const result: FriendBalance[] = [];
      for (const [key, val] of balanceMap.entries()) {
        // Filter out people with near-zero balances and no shared groups
        const absBalance = Math.abs(val.netBalance);
        if (absBalance < 0.01 && val.groupIds.size === 0) continue;

        result.push({
          userId: val.isUser ? key : null,
          displayName: val.displayName,
          netBalance: Math.round(val.netBalance * 100) / 100,
          groupCount: val.groupIds.size,
        });
      }

      // Sort by absolute balance descending (biggest debts first)
      result.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
      setFriends(result);
    } catch (err: any) {
      setFriendsError(err.message || t('common.error'));
    } finally {
      setFriendsLoading(false);
      setFriendsRefreshing(false);
    }
  }, [user, t]);

  // ---------- personal data fetching ----------
  const fetchEntries = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_settled', false);
      if (error) throw error;

      const entries = (data || []) as LedgerEntry[];
      const grouped = new Map<string, { net: number; count: number }>();
      for (const entry of entries) {
        const existing = grouped.get(entry.contact_name) || { net: 0, count: 0 };
        const amount = entry.direction === 'they_owe' ? entry.amount : -entry.amount;
        existing.net += amount;
        existing.count += 1;
        grouped.set(entry.contact_name, existing);
      }

      const summaries: ContactSummary[] = Array.from(grouped.entries()).map(
        ([contactName, { net, count }]) => ({ contactName, netBalance: net, entryCount: count }),
      );
      summaries.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

      let owedToYou = 0;
      let youOwe = 0;
      for (const s of summaries) {
        if (s.netBalance > 0) owedToYou += s.netBalance;
        else youOwe += Math.abs(s.netBalance);
      }
      setContacts(summaries);
      setPersonalOwedToYou(owedToYou);
      setPersonalYouOwe(youOwe);
    } catch (err) {
      console.error('Failed to fetch ledger entries:', err);
    } finally {
      setPersonalLoading(false);
      setPersonalRefreshing(false);
    }
  }, [profile]);

  // ---------- focus effect ----------
  useFocusEffect(
    useCallback(() => {
      fetchFriends();
      fetchEntries();
    }, [fetchFriends, fetchEntries]),
  );

  const onRefreshFriends = useCallback(() => {
    setFriendsRefreshing(true);
    fetchFriends();
  }, [fetchFriends]);

  const onRefreshPersonal = useCallback(() => {
    setPersonalRefreshing(true);
    fetchEntries();
  }, [fetchEntries]);

  // ---------- computed (friends) ----------
  const friendsTotalOwed = useMemo(() => {
    let owed = 0;
    let owe = 0;
    for (const f of friends) {
      if (f.netBalance > 0) owed += f.netBalance;
      else owe += Math.abs(f.netBalance);
    }
    return { owed, owe };
  }, [friends]);

  // ---------- FAB action ----------
  const handleFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeSegment === 'friends') {
      navigation.navigate('AddFriends');
    } else {
      navigation.navigate('AddLedgerEntry');
    }
  }, [activeSegment, navigation]);

  // ---------- render: friend item ----------
  const renderFriendItem = ({ item, index }: { item: FriendBalance; index: number }) => {
    const absBalance = Math.abs(item.netBalance);
    const isPositive = item.netBalance > 0;
    const isSettled = absBalance < 0.01;
    const gradient = avatarGradient(item.displayName);

    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <ThemedCard>
            <View style={styles.friendRow}>
              <LinearGradient
                colors={gradient}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
              </LinearGradient>

              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.groupCount > 0 && (
                  <View style={styles.groupBadgeRow}>
                    <Ionicons name="people-outline" size={11} color={colors.textTertiary} />
                    <Text style={styles.groupBadgeText}>
                      {' '}{t('friends.inGroups', { count: item.groupCount })}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.friendBalance}>
                {isSettled ? (
                  <View style={styles.settledPill}>
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color={colors.textTertiary}
                      style={{ marginRight: 3 }}
                    />
                    <Text style={styles.settledText}>{t('friends.settledUp')}</Text>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.balanceAmount,
                        { color: isPositive ? colors.positive : colors.negative },
                      ]}
                    >
                      {formatCurrency(absBalance)}
                    </Text>
                    <View
                      style={[
                        styles.balanceBadge,
                        {
                          backgroundColor: isPositive
                            ? `${colors.success}18`
                            : `${colors.danger}18`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.balanceLabel,
                          { color: isPositive ? colors.positive : colors.negative },
                        ]}
                      >
                        {isPositive ? t('friends.owesYou') : t('friends.youOwe')}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

  // ---------- render: contact item (personal) ----------
  const formatAmount = (amount: number): string => formatCurrency(Math.abs(amount));

  const renderContactItem = ({ item, index }: { item: ContactSummary; index: number }) => {
    const isPositive = item.netBalance >= 0;
    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={() => navigation.navigate('LedgerContact', { contactName: item.contactName })}>
          <ThemedCard>
            <View style={[styles.cardAccent, { backgroundColor: isPositive ? colors.success : colors.danger }]} />

            <View style={styles.contactRow}>
              <View style={styles.cardLeft}>
                <LinearGradient
                  colors={isPositive ? colors.successGradient : colors.dangerGradient}
                  style={styles.contactAvatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.contactInitial}>{item.contactName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.contactName}</Text>
                  <View style={styles.contactEntriesRow}>
                    <Ionicons name="document-text-outline" size={11} color={colors.textTertiary} />
                    <Text style={styles.contactEntries}>
                      {' '}{item.entryCount} {item.entryCount === 1 ? t('ledger.entry') : t('ledger.entries')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.contactBalance}>
                <Text style={[styles.balanceAmount, { color: isPositive ? colors.positive : colors.negative }]}>
                  {formatAmount(item.netBalance)}
                </Text>
                <View style={[styles.balanceBadge, { backgroundColor: isPositive ? `${colors.success}18` : `${colors.danger}18` }]}>
                  <Text style={[styles.balanceLabel, { color: isPositive ? colors.positive : colors.negative }]}>
                    {isPositive ? t('ledger.owesYou') : t('ledger.youOwe')}
                  </Text>
                </View>
              </View>
            </View>
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

  // ---------- render: summary cards ----------
  const renderFriendsSummary = () => {
    if (friends.length === 0) return null;
    const netFriends = friendsTotalOwed.owed - friendsTotalOwed.owe;
    const isNetPositive = netFriends >= 0;

    return (
      <View style={styles.summaryWrap}>
        <ThemedCard accent>
          <View style={styles.summaryAccent} />
          <View style={styles.summaryNet}>
            <Text style={styles.summaryNetLabel}>{t('ledger.net')}</Text>
            <Text style={[styles.summaryNetAmount, { color: isNetPositive ? colors.positive : colors.negative }]}>
              {isNetPositive ? '+' : '-'}{formatCurrency(Math.abs(netFriends))}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <LinearGradient
                colors={colors.successGradient}
                style={styles.summaryDot}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.summarySmLabel}>{t('ledger.owedToYou')}</Text>
              <Text style={[styles.summarySmAmount, { color: colors.positive }]}>{formatCurrency(friendsTotalOwed.owed)}</Text>
            </View>
            <View style={styles.summaryColSep} />
            <View style={styles.summaryCol}>
              <LinearGradient
                colors={colors.dangerGradient}
                style={styles.summaryDot}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.summarySmLabel}>{t('ledger.youOweTotal')}</Text>
              <Text style={[styles.summarySmAmount, { color: colors.negative }]}>{formatCurrency(friendsTotalOwed.owe)}</Text>
            </View>
          </View>
        </ThemedCard>
      </View>
    );
  };

  const renderPersonalSummary = () => {
    if (contacts.length === 0) return null;
    const netPersonal = personalOwedToYou - personalYouOwe;
    const isNetPositive = netPersonal >= 0;

    return (
      <View style={styles.summaryWrap}>
        <ThemedCard accent>
          <View style={styles.summaryAccent} />
          <View style={styles.summaryNet}>
            <Text style={styles.summaryNetLabel}>{t('ledger.net')}</Text>
            <Text style={[styles.summaryNetAmount, { color: isNetPositive ? colors.positive : colors.negative }]}>
              {isNetPositive ? '+' : '-'}{formatCurrency(Math.abs(netPersonal))}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <LinearGradient
                colors={colors.successGradient}
                style={styles.summaryDot}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.summarySmLabel}>{t('ledger.owedToYou')}</Text>
              <Text style={[styles.summarySmAmount, { color: colors.positive }]}>{formatCurrency(personalOwedToYou)}</Text>
            </View>
            <View style={styles.summaryColSep} />
            <View style={styles.summaryCol}>
              <LinearGradient
                colors={colors.dangerGradient}
                style={styles.summaryDot}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.summarySmLabel}>{t('ledger.youOweTotal')}</Text>
              <Text style={[styles.summarySmAmount, { color: colors.negative }]}>{formatCurrency(personalYouOwe)}</Text>
            </View>
          </View>
        </ThemedCard>
      </View>
    );
  };

  // ---------- render: empty states ----------
  const renderFriendsEmpty = () => {
    if (friendsLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY: emptyBounce }] }]}>
          <LinearGradient
            colors={[`${colors.primary}22`, `${colors.primary}08`]}
            style={styles.emptyIconCircle}
          >
            <Ionicons name="people-outline" size={42} color={colors.primary} />
          </LinearGradient>
        </Animated.View>
        <Text style={styles.emptyTitle}>{t('friends.noFriends')}</Text>
        <Text style={styles.emptySubtitle}>{t('friends.noFriendsSubtitle')}</Text>
        <FunButton
          title={t('friends.addFriends')}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('AddFriends');
          }}
          variant="primary"
          icon={<Ionicons name="person-add-outline" size={18} color="#FFFFFF" />}
          style={{ marginTop: Spacing.xxl, alignSelf: 'center', paddingHorizontal: Spacing.xl }}
        />
      </View>
    );
  };

  const renderPersonalEmpty = () => {
    if (personalLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY: emptyBounce }] }]}>
          <LinearGradient
            colors={[`${colors.primary}22`, `${colors.primary}08`]}
            style={styles.emptyIconCircle}
          >
            <Ionicons name="book-outline" size={42} color={colors.primary} />
          </LinearGradient>
        </Animated.View>
        <Text style={styles.emptyTitle}>{t('ledger.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('ledger.emptySubtitle')}</Text>
      </View>
    );
  };

  // ---------- render: list label ----------
  const renderFriendsListLabel = () => {
    if (friends.length === 0) return null;
    return (
      <View style={styles.listLabel}>
        <View style={styles.listLabelLine} />
        <Text style={styles.listLabelText}>
          {friends.length} {friends.length === 1 ? 'PERSON' : 'PEOPLE'}
        </Text>
        <View style={styles.listLabelLine} />
      </View>
    );
  };

  const renderPersonalListLabel = () => {
    if (contacts.length === 0) return null;
    return (
      <View style={styles.listLabel}>
        <View style={styles.listLabelLine} />
        <Text style={styles.listLabelText}>{t('ledger.contactCount', { count: contacts.length })}</Text>
        <View style={styles.listLabelLine} />
      </View>
    );
  };

  // ---------- loading state ----------
  const isLoading = activeSegment === 'friends' ? friendsLoading : personalLoading;

  if (isLoading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ---------- main render ----------
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
      <View style={styles.bgOrb} />
      <View style={styles.bgOrbSmall} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <Animated.View style={[styles.header, entrance.style]}>
          <View>
            <Text style={styles.headerKicker}>YOUR CIRCLE</Text>
            <Text style={styles.headerTitle}>{t('people.title', { defaultValue: 'People' })}</Text>
          </View>
          <View style={styles.headerDecor}>
            <View style={styles.decorDiamond} />
          </View>
        </Animated.View>

        {/* Segmented toggle */}
        <View style={styles.tabsOuter}>
          <View style={styles.tabsContainer}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth,
                  transform: [{ translateX: Animated.multiply(pillAnim, tabWidth) }],
                },
              ]}
            >
              <LinearGradient
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <BouncyPressable
              style={styles.tab}
              onPress={() => handleSegmentChange('friends')}
            >
              <View style={styles.tabInner}>
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={activeSegment === 'friends' ? '#FFFFFF' : colors.textTertiary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeSegment === 'friends' && styles.tabTextActive]}>
                  {t('people.friends', { defaultValue: 'Friends' })}
                </Text>
              </View>
            </BouncyPressable>
            <BouncyPressable
              style={styles.tab}
              onPress={() => handleSegmentChange('personal')}
            >
              <View style={styles.tabInner}>
                <Ionicons
                  name="book-outline"
                  size={16}
                  color={activeSegment === 'personal' ? '#FFFFFF' : colors.textTertiary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeSegment === 'personal' && styles.tabTextActive]}>
                  {t('people.personal', { defaultValue: 'Personal' })}
                </Text>
              </View>
            </BouncyPressable>
          </View>
        </View>

        {/* Content */}
        {activeSegment === 'friends' ? (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.userId || `ledger:${item.displayName}`}
            renderItem={renderFriendItem}
            ListHeaderComponent={
              <>
                {renderFriendsSummary()}
                {renderFriendsListLabel()}
              </>
            }
            ListEmptyComponent={renderFriendsEmpty}
            contentContainerStyle={friends.length === 0 ? styles.emptyList : styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={friendsRefreshing}
                onRefresh={onRefreshFriends}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.contactName}
            renderItem={renderContactItem}
            ListHeaderComponent={
              <>
                {renderPersonalSummary()}
                {renderPersonalListLabel()}
              </>
            }
            ListEmptyComponent={renderPersonalEmpty}
            contentContainerStyle={contacts.length === 0 ? styles.emptyList : styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={personalRefreshing}
                onRefresh={onRefreshPersonal}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}

        {/* FAB */}
        <Animated.View style={[styles.fab, { transform: [{ translateY: fabFloat }] }]}>
          <BouncyPressable onPress={handleFabPress}>
            <LinearGradient
              colors={colors.primaryGradient}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </LinearGradient>
          </BouncyPressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Background orbs
    bgOrb: {
      position: 'absolute',
      width: SW * 0.7,
      height: SW * 0.7,
      borderRadius: SW * 0.35,
      backgroundColor: isDark ? 'rgba(27,122,108,0.06)' : 'rgba(13,148,136,0.04)',
      top: -SW * 0.15,
      right: -SW * 0.2,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.35,
      height: SW * 0.35,
      borderRadius: SW * 0.175,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(201,162,39,0.03)',
      bottom: SW * 0.1,
      left: -SW * 0.1,
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
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
      fontSize: 32,
      letterSpacing: -1,
      color: c.text,
    },
    headerDecor: { marginBottom: 8 },
    decorDiamond: {
      width: 10,
      height: 10,
      backgroundColor: c.accent,
      transform: [{ rotate: '45deg' }],
      opacity: 0.8,
    },

    // Segmented toggle
    tabsOuter: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.md },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      borderRadius: Radius.full,
      padding: 4,
      position: 'relative',
    },
    tabIndicator: {
      position: 'absolute',
      top: 4,
      left: 4,
      bottom: 4,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    tab: {
      flex: 1,
      zIndex: 1,
    },
    tabInner: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: Radius.full,
      flexDirection: 'row',
    },
    tabText: {
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
      color: c.textTertiary,
    },
    tabTextActive: { color: '#FFFFFF' },

    // Summary card
    summaryWrap: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    summaryAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: c.accent,
      opacity: 0.65,
    },
    summaryNet: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    summaryNetLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.kicker,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    summaryNetAmount: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      letterSpacing: -1,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
      marginBottom: Spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
    },
    summaryColSep: {
      width: 1,
      height: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.borderLight,
      alignSelf: 'center',
    },
    summaryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginBottom: 6,
    },
    summarySmLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.textTertiary,
      marginBottom: 4,
    },
    summarySmAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: -0.3,
    },

    // List label
    listLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    listLabelLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
    },
    listLabelText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },

    // List
    list: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 160,
      gap: Spacing.md,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },

    // Friend row
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.display,
      fontSize: 18,
      color: '#FFFFFF',
    },
    friendInfo: {
      flex: 1,
      marginLeft: Spacing.lg,
    },
    friendName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
      letterSpacing: -0.2,
    },
    groupBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    groupBadgeText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.textTertiary,
    },
    friendBalance: {
      alignItems: 'flex-end',
      marginLeft: Spacing.md,
    },
    settledPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.full,
    },
    settledText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: c.textSecondary,
    },

    // Contact row (personal)
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      opacity: 0.7,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    contactAvatar: {
      width: 46,
      height: 46,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    contactInitial: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: '#FFFFFF',
    },
    contactInfo: { flex: 1 },
    contactName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
      letterSpacing: -0.2,
    },
    contactEntriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    contactEntries: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textTertiary,
    },
    contactBalance: {
      alignItems: 'flex-end',
      marginLeft: Spacing.md,
    },

    // Shared balance styles
    balanceAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: -0.3,
    },
    balanceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.full,
      marginTop: 3,
    },
    balanceLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 0.3,
    },

    // Empty state
    emptyContainer: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xxxl,
    },
    emptyIconWrap: { marginBottom: Spacing.xl },
    emptyIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDark ? c.border : c.borderLight,
    },
    emptyTitle: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    emptySubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // FAB
    fab: {
      position: 'absolute',
      bottom: 100,
      end: 20,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
    },
    fabGradient: {
      width: 62,
      height: 62,
      borderRadius: Radius.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
