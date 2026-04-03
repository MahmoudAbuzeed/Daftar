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
  Modal,
  TouchableOpacity,
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
import { formatCurrency, simplifyDebts } from '../../utils/balance';
import { Balance } from '../../types/database';
import { shareViaWhatsApp } from '../../utils/whatsapp';
import { MainTabParamList, RootStackParamList } from '../../navigation/AppNavigator';

// ---------------------------------------------------------------------------
// Navigation typing
// ---------------------------------------------------------------------------

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'FriendsTab'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface FriendBalance {
  userId: string | null; // null for daftar-only contacts
  displayName: string;
  netBalance: number; // positive = they owe you, negative = you owe them
  groupCount: number; // how many groups you share
}

interface GroupPickerItem {
  id: string;
  name: string;
}

const { width: SW } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Gradient palette for avatars (cycle through these)
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

export default function FriendsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const fabFloat = useFabFloat();

  // ---------- state ----------
  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group picker modal for "Add expense"
  const [pickerVisible, setPickerVisible] = useState(false);
  const [userGroups, setUserGroups] = useState<GroupPickerItem[]>([]);

  // Simplify debts modal
  const [simplifyVisible, setSimplifyVisible] = useState(false);

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

  // ---------- data fetching ----------
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const userId = user.id;

    try {
      setError(null);

      // 1. Fetch all groups user is in
      const { data: memberships, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);
      if (memberErr) throw memberErr;

      const groupIds = (memberships || []).map((m) => m.group_id);

      // Store groups for the picker (need names)
      if (groupIds.length > 0) {
        const { data: groupsData } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds)
          .eq('is_archived', false);
        setUserGroups((groupsData || []) as GroupPickerItem[]);
      } else {
        setUserGroups([]);
      }

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

      // 7. Fetch daftar entries
      const { data: daftarEntries, error: daftarErr } = await supabase
        .from('daftar_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_settled', false);
      if (daftarErr) throw daftarErr;

      for (const entry of daftarEntries || []) {
        const amount = entry.direction === 'they_owe' ? entry.amount : -entry.amount;

        // If the daftar contact is linked to a real user, merge into their balance
        if (entry.contact_user_id) {
          const existing = balanceMap.get(entry.contact_user_id);
          if (existing) {
            existing.netBalance += amount;
          } else {
            const dEntry = getOrCreate(entry.contact_user_id, entry.contact_name, true);
            dEntry.netBalance += amount;
          }
        } else {
          // Non-linked daftar contact: use contact_name as key, prefixed to avoid collision
          const key = `daftar:${entry.contact_name}`;
          const dEntry = getOrCreate(key, entry.contact_name, false);
          dEntry.netBalance += amount;
        }
      }

      // 8. Build sorted result
      const result: FriendBalance[] = [];
      for (const [key, val] of balanceMap.entries()) {
        // Filter out people with near-zero balances and no shared groups
        // (keep them if they share groups even if settled, so user sees them)
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
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFriends();
  }, [fetchFriends]);

  // ---------- computed ----------

  const overallBalance = useMemo(() => {
    return friends.reduce((sum, f) => sum + f.netBalance, 0);
  }, [friends]);

  const overallAbs = Math.abs(overallBalance);
  const isOverallPositive = overallBalance >= 0;

  // ---------- actions ----------

  const handleAddFriends = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddFriends');
  }, [navigation]);

  const handleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Search');
  }, [navigation]);

  const handleAddExpense = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (userGroups.length === 0) {
      // No groups yet — navigate to groups tab
      navigation.navigate('GroupsTab');
      return;
    }
    if (userGroups.length === 1) {
      // Only one group — go directly
      navigation.navigate('AddExpense', { groupId: userGroups[0].id });
      return;
    }
    // Multiple groups — show picker
    setPickerVisible(true);
  }, [userGroups, navigation]);

  const handlePickGroup = useCallback(
    (groupId: string) => {
      setPickerVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('AddExpense', { groupId });
    },
    [navigation],
  );

  const handleFriendPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // No navigation yet — placeholder for future friend detail screen
  }, []);

  // ---------- render helpers ----------

  const renderFriendRow = ({ item, index }: { item: FriendBalance; index: number }) => {
    const absBalance = Math.abs(item.netBalance);
    const isPositive = item.netBalance > 0;
    const isSettled = absBalance < 0.01;
    const gradient = avatarGradient(item.displayName);

    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={handleFriendPress}>
          <ThemedCard>
            <View style={styles.friendRow}>
              {/* Avatar */}
              <LinearGradient
                colors={gradient}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
              </LinearGradient>

              {/* Name & group info */}
              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.groupCount > 0 && (
                  <View style={styles.groupBadgeRow}>
                    <Ionicons
                      name="people-outline"
                      size={11}
                      color={colors.textTertiary}
                    />
                    <Text style={styles.groupBadgeText}>
                      {' '}
                      {t('friends.inGroups', { count: item.groupCount })}
                    </Text>
                  </View>
                )}
              </View>

              {/* Balance */}
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

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Animated.View
          style={[styles.emptyIconWrap, { transform: [{ translateY: emptyBounce }] }]}
        >
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
          onPress={handleAddFriends}
          variant="secondary"
          size="small"
          icon={
            <Ionicons
              name="share-social-outline"
              size={16}
              color={isDark ? colors.primaryLight : colors.primary}
            />
          }
          style={{ marginTop: Spacing.xxl, paddingHorizontal: Spacing.xl }}
        />
      </View>
    );
  };

  // Compute simplified debts from friends data
  const simplifiedDebts = useMemo(() => {
    const balances: Balance[] = [];
    for (const f of friends) {
      if (Math.abs(f.netBalance) < 0.01 || !f.userId) continue;
      if (f.netBalance < 0) {
        // You owe them
        balances.push({ from_user: user?.id || '', to_user: f.userId, net_amount: Math.abs(f.netBalance) });
      } else {
        // They owe you
        balances.push({ from_user: f.userId, to_user: user?.id || '', net_amount: f.netBalance });
      }
    }
    return simplifyDebts(balances);
  }, [friends, user]);

  const friendNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of friends) {
      if (f.userId) map.set(f.userId, f.displayName);
    }
    if (user) map.set(user.id, t('common.you'));
    return map;
  }, [friends, user, t]);

  const renderHeader = () => {
    if (friends.length === 0) return null;
    return (
      <View style={styles.summaryCard}>
        <ThemedCard accent>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              {isOverallPositive
                ? t('friends.overallOwed', { amount: formatCurrency(overallAbs) })
                : t('friends.overallOwe', { amount: formatCurrency(overallAbs) })}
            </Text>
            <Text
              style={[
                styles.summaryAmount,
                { color: isOverallPositive ? colors.positive : colors.negative },
              ]}
            >
              {isOverallPositive ? '+' : '-'}
              {formatCurrency(overallAbs)}
            </Text>
          </View>
        </ThemedCard>
        {simplifiedDebts.length > 0 && (
          <BouncyPressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSimplifyVisible(true); }}>
            <View style={styles.simplifyLink}>
              <Ionicons name="git-merge-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.simplifyLinkText}>{t('simplify.simplifyAll')}</Text>
            </View>
          </BouncyPressable>
        )}
      </View>
    );
  };

  // ---------- group picker modal ----------

  const renderGroupPicker = () => (
    <Modal
      visible={pickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setPickerVisible(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('friends.addExpense')}</Text>
          <View style={styles.modalDivider} />
          <FlatList
            data={userGroups}
            keyExtractor={(item) => item.id}
            style={styles.modalList}
            renderItem={({ item }) => (
              <BouncyPressable onPress={() => handlePickGroup(item.id)}>
                <View style={styles.modalRow}>
                  <LinearGradient
                    colors={colors.primaryGradient}
                    style={styles.modalRowIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.modalRowIconText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.modalRowText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </BouncyPressable>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ---------- loading state ----------

  if (loading) {
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
          <View style={styles.headerLeft}>
            <Text style={styles.headerKicker}>{t('friends.title').toUpperCase()}</Text>
            <Text style={styles.headerTitle}>{t('friends.title')}</Text>
          </View>

          <View style={styles.headerActions}>
            <BouncyPressable onPress={handleSearch}>
              <View style={styles.headerIconBtn}>
                <Ionicons name="search-outline" size={18} color={colors.text} />
              </View>
            </BouncyPressable>
            <BouncyPressable onPress={handleAddFriends}>
              <View style={styles.headerBtn}>
                <Ionicons
                  name="person-add-outline"
                  size={15}
                  color={isDark ? colors.accentLight : colors.accent}
                />
                <Text style={styles.headerBtnText}>{t('friends.addFriends')}</Text>
              </View>
            </BouncyPressable>
          </View>
        </Animated.View>

        {/* Error bar */}
        {error ? (
          <View style={styles.errorBar}>
            <Ionicons
              name="alert-circle"
              size={16}
              color={isDark ? '#FDBA74' : colors.danger}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchFriends}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Friend list */}
        <FlatList
          data={friends}
          keyExtractor={(item) => item.userId || `daftar:${item.displayName}`}
          renderItem={renderFriendRow}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            friends.length === 0 ? styles.emptyList : styles.list
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />

        {/* FAB — Add expense */}
        <Animated.View style={[styles.fab, { transform: [{ translateY: fabFloat }] }]}>
          <BouncyPressable onPress={handleAddExpense}>
            <LinearGradient
              colors={colors.primaryGradient}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add" size={26} color="#FFFFFF" />
              <Text style={styles.fabLabel}>{t('friends.addExpense')}</Text>
            </LinearGradient>
          </BouncyPressable>
        </Animated.View>
      </SafeAreaView>

      {/* Group picker modal */}
      {renderGroupPicker()}

      {/* Simplify debts modal */}
      <Modal visible={simplifyVisible} transparent animationType="fade" onRequestClose={() => setSimplifyVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSimplifyVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('simplify.title')}</Text>
            <Text style={styles.simplifySubtitle}>{t('simplify.subtitle')}</Text>
            <View style={styles.modalDivider} />
            {simplifiedDebts.length === 0 ? (
              <Text style={styles.simplifyEmpty}>{t('simplify.noDebts')}</Text>
            ) : (
              <FlatList
                data={simplifiedDebts}
                keyExtractor={(_, i) => String(i)}
                style={styles.modalList}
                renderItem={({ item }) => {
                  const fromName = friendNameMap.get(item.from_user) || t('common.unknown');
                  const toName = friendNameMap.get(item.to_user) || t('common.unknown');
                  const isYouPaying = item.from_user === user?.id;
                  return (
                    <View style={styles.simplifyRow}>
                      <LinearGradient
                        colors={isYouPaying ? colors.dangerGradient : colors.successGradient}
                        style={styles.simplifyIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name={isYouPaying ? 'arrow-up' : 'arrow-down'} size={14} color="#FFF" />
                      </LinearGradient>
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <Text style={styles.simplifyText}>
                          {isYouPaying
                            ? `${t('simplify.youPay')} ${toName}`
                            : `${fromName} ${t('simplify.paysYou')}`}
                        </Text>
                      </View>
                      <Text style={[styles.simplifyAmount, { color: isYouPaying ? colors.negative : colors.positive }]}>
                        {formatCurrency(item.net_amount)}
                      </Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
      backgroundColor: isDark
        ? 'rgba(27,122,108,0.06)'
        : 'rgba(13,148,136,0.04)',
      top: -SW * 0.15,
      right: -SW * 0.2,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.35,
      height: SW * 0.35,
      borderRadius: SW * 0.175,
      backgroundColor: isDark
        ? 'rgba(201,162,39,0.04)'
        : 'rgba(201,162,39,0.03)',
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
    headerLeft: { flex: 1, marginRight: Spacing.md },
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 4,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? c.borderLight : c.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.bgCard,
    },
    headerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.35)' : c.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.bgCard,
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 6,
      elevation: isDark ? 0 : 2,
    },
    headerBtnText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 12,
      color: isDark ? c.accentLight : c.accent,
      letterSpacing: 0.4,
      marginLeft: 5,
    },

    // Error
    errorBar: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FEF2F2',
      padding: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234,88,12,0.25)' : '#FECACA',
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: {
      color: isDark ? '#FDBA74' : c.danger,
      fontSize: 13,
      fontFamily: FontFamily.body,
      flex: 1,
    },
    retryText: {
      color: c.primaryLight,
      fontSize: 13,
      fontFamily: FontFamily.bodyBold,
      marginLeft: Spacing.md,
    },

    // Summary card (list header)
    summaryCard: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    summaryContent: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    summaryLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
      marginBottom: Spacing.xs,
    },
    summaryAmount: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      letterSpacing: -1,
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: Radius.xl,
      gap: 6,
    },
    fabLabel: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },

    // Modal (group picker)
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xxl,
    },
    modalContent: {
      width: '100%',
      maxHeight: SW * 0.9,
      backgroundColor: c.bgCard,
      borderRadius: Radius.xxl,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: isDark ? c.border : c.borderLight,
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
      elevation: 10,
    },
    modalTitle: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: c.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    modalDivider: {
      height: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
      marginBottom: Spacing.md,
    },
    modalList: {
      maxHeight: SW * 0.55,
    },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? c.borderLight : c.border,
    },
    modalRowIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    modalRowIconText: {
      fontFamily: FontFamily.display,
      fontSize: 16,
      color: '#FFFFFF',
    },
    modalRowText: {
      flex: 1,
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },

    // Simplify
    simplifyLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    simplifyLinkText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.primary,
    },
    simplifySubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: Spacing.lg,
    },
    simplifyEmpty: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textTertiary,
      textAlign: 'center',
      paddingVertical: Spacing.xl,
    },
    simplifyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? c.borderLight : c.border,
    },
    simplifyIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    simplifyText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    simplifyAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: -0.3,
    },
  });
