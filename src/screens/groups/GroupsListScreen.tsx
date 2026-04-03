import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { MainTabParamList, RootStackParamList } from '../../navigation/AppNavigator';
import { Group } from '../../types/database';
import { formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';
import DailyBanner from '../../components/DailyBanner';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'GroupsTab'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

const { width: SW } = Dimensions.get('window');

interface GroupWithMeta extends Group {
  member_count: number;
  net_balance: number;
}

function AnimatedListItem({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index * 70, 350),
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function GroupsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fabFloat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabFloat, { toValue: -5, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fabFloat, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data: memberships, error: memberError } = await supabase
        .from('group_members').select('group_id').eq('user_id', user.id);
      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) { setGroups([]); return; }
      const groupIds = memberships.map((m) => m.group_id);

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups').select('*').in('id', groupIds).eq('is_archived', false).order('created_at', { ascending: false });
      if (groupsError) throw groupsError;

      const { data: allMembers, error: membersError } = await supabase
        .from('group_members').select('group_id, user_id').in('group_id', groupIds);
      if (membersError) throw membersError;

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses').select('id, group_id, paid_by, total_amount').in('group_id', groupIds).eq('is_deleted', false);
      if (expensesError) throw expensesError;

      const { data: splits, error: splitsError } = await supabase
        .from('expense_splits').select('expense_id, user_id, amount').in('expense_id', (expenses || []).map((e) => e.id));
      if (splitsError) throw splitsError;

      const { data: settlements, error: settlementsError } = await supabase
        .from('settlements').select('group_id, paid_by, paid_to, amount').in('group_id', groupIds);
      if (settlementsError) throw settlementsError;

      const enrichedGroups: GroupWithMeta[] = (groupsData || []).map((group) => {
        const memberCount = (allMembers || []).filter((m) => m.group_id === group.id).length;
        let netBalance = 0;
        const ge = (expenses || []).filter((e) => e.group_id === group.id);
        for (const expense of ge) {
          if (expense.paid_by === user.id) {
            netBalance += (splits || []).filter((s) => s.expense_id === expense.id && s.user_id !== user.id).reduce((sum, s) => sum + s.amount, 0);
          }
          const us = (splits || []).find((s) => s.expense_id === expense.id && s.user_id === user.id);
          if (us && expense.paid_by !== user.id) netBalance -= us.amount;
        }
        for (const s of (settlements || []).filter((s) => s.group_id === group.id)) {
          if (s.paid_by === user.id) netBalance += s.amount;
          if (s.paid_to === user.id) netBalance -= s.amount;
        }
        return { ...group, member_count: memberCount, net_balance: Math.round(netBalance * 100) / 100 };
      });
      setGroups(enrichedGroups);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(useCallback(() => { fetchGroups(); }, [fetchGroups]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchGroups(); }, [fetchGroups]);

  const renderBalancePill = (balance: number, currency: 'EGP' | 'USD') => {
    if (Math.abs(balance) < 0.01) {
      return (
        <View style={styles.pillSettled}>
          <Text style={styles.pillSettledText}>{t('groups.settled_up')}</Text>
        </View>
      );
    }
    const isPos = balance > 0;
    return (
      <View style={[styles.pill, isPos ? styles.pillPos : styles.pillNeg]}>
        <Text style={[styles.pillText, { color: isPos ? colors.positive : colors.negative }]}>
          {isPos ? '+' : '-'}{formatCurrency(Math.abs(balance), currency)}
        </Text>
      </View>
    );
  };

  const renderGroupCard = ({ item, index }: { item: GroupWithMeta; index: number }) => (
    <AnimatedListItem index={index}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      >
        {isDark && (
          <LinearGradient
            colors={colors.cardGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={styles.cardAccentBar} />

        <View style={styles.cardTop}>
          <LinearGradient
            colors={colors.primaryGradient}
            style={styles.cardIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.cardIconText}>{item.name.charAt(0).toUpperCase()}</Text>
          </LinearGradient>

          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSub}>
              <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
              {' '}{item.member_count} {t('groups.members').toLowerCase()}
            </Text>
          </View>

          {renderBalancePill(item.net_balance, item.currency)}
        </View>

        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </TouchableOpacity>
    </AnimatedListItem>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <LinearGradient
          colors={[`${colors.primary}22`, `${colors.primary}08`]}
          style={styles.emptyIconCircle}
        >
          <Ionicons name="people-outline" size={36} color={colors.primary} />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>{t('groups.no_groups')}</Text>
      <Text style={styles.emptySub}>{t('groups.no_groups_subtitle')}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

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

      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerKicker}>{t('groups.yourCircles')}</Text>
            <Text style={styles.headerTitle}>{t('groups.title')}</Text>
          </View>
          <TouchableOpacity
            style={styles.joinBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('JoinGroup')}
          >
            <Ionicons name="enter-outline" size={16} color={colors.accentLight} style={{ marginRight: 4 }} />
            <Text style={styles.joinBtnText}>{t('groups.join')}</Text>
          </TouchableOpacity>
        </View>

        <DailyBanner />

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchGroups}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {groups.length > 0 && (
          <View style={styles.listLabel}>
            <View style={styles.listLabelLine} />
            <Text style={styles.listLabelText}>{t('groups.groupCount', { count: groups.length })}</Text>
            <View style={styles.listLabelLine} />
          </View>
        )}

        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={groups.length === 0 ? styles.emptyList : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />

        <Animated.View style={[styles.fab, { transform: [{ translateY: fabFloat }] }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CreateGroup')}
            style={styles.fabInner}
          >
            <LinearGradient colors={colors.primaryGradient} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    bgOrb: {
      position: 'absolute',
      width: SW * 0.7,
      height: SW * 0.7,
      borderRadius: SW * 0.35,
      backgroundColor: isDark ? 'rgba(27,122,108,0.06)' : 'rgba(13,148,136,0.04)',
      top: -SW * 0.15,
      left: -SW * 0.2,
    },

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
      marginBottom: Spacing.xs,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1,
      color: c.text,
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.35)' : c.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.bgCard,
      marginBottom: 4,
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 6,
      elevation: isDark ? 0 : 2,
    },
    joinBtnText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: isDark ? c.accentLight : c.accent,
      letterSpacing: 0.5,
    },

    errorBar: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FEF2F2',
      padding: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234,88,12,0.25)' : '#FECACA',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { color: isDark ? '#FDBA74' : c.danger, fontSize: 13, fontFamily: FontFamily.body, flex: 1 },
    retryText: { color: c.primaryLight, fontSize: 13, fontFamily: FontFamily.bodyBold, marginLeft: Spacing.md },

    listLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    listLabelLine: { flex: 1, height: 1, backgroundColor: isDark ? c.borderLight : c.border },
    listLabelText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.textTertiary,
    },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },

    card: {
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: isDark ? c.border : c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.xl,
      marginBottom: Spacing.md,
      overflow: 'hidden',
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 10,
      elevation: isDark ? 0 : 3,
    },
    cardAccentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.accent,
      opacity: isDark ? 0.5 : 0.35,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardIconText: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: '#FFFFFF',
    },
    cardTitleBlock: { flex: 1, marginLeft: Spacing.lg },
    cardTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17,
      color: c.text,
      letterSpacing: -0.2,
    },
    cardSub: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 2,
    },
    cardDesc: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginTop: Spacing.sm,
      marginLeft: 62,
    },

    pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full },
    pillPos: {
      backgroundColor: isDark ? 'rgba(20,184,166,0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(20,184,166,0.3)' : '#A7F3D0',
    },
    pillNeg: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FEF2F2',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234,88,12,0.25)' : '#FECACA',
    },
    pillSettled: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.bgSubtle,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.full,
    },
    pillText: { fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: -0.2 },
    pillSettledText: { fontFamily: FontFamily.bodySemibold, fontSize: 12, color: c.textTertiary },

    emptyContainer: { alignItems: 'center', paddingHorizontal: Spacing.xxxl },
    emptyIconWrap: { marginBottom: Spacing.xl },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? c.border : c.borderLight,
    },
    emptyTitle: { fontFamily: FontFamily.bodySemibold, fontSize: 18, color: c.text, marginBottom: Spacing.sm },
    emptySub: { fontFamily: FontFamily.body, fontSize: 14, color: c.textTertiary, textAlign: 'center', lineHeight: 20 },

    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
    },
    fabInner: { width: 60, height: 60, borderRadius: Radius.xl },
    fabGradient: { width: 60, height: 60, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center' },
  });
