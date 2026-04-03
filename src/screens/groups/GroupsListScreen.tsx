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
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { MainTabParamList, RootStackParamList } from '../../navigation/AppNavigator';
import { Group } from '../../types/database';
import { formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import useFabFloat from '../../hooks/useFabFloat';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'GroupsTab'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

const { width: SW } = Dimensions.get('window');

interface GroupWithMeta extends Group {
  member_count: number;
  net_balance: number;
}

export default function GroupsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const fabFloat = useFabFloat();

  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bouncing empty-state icon
  const emptyBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(emptyBounce, { toValue: -12, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(emptyBounce, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
          <Ionicons name="checkmark-circle" size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
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
      <BouncyPressable onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}>
        <ThemedCard accent>
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
              <View style={styles.cardSubRow}>
                <Ionicons name="people" size={12} color={colors.primaryLight} />
                <Text style={styles.cardSub}>
                  {' '}{item.member_count} {t('groups.members').toLowerCase()}
                </Text>
              </View>
            </View>

            {renderBalancePill(item.net_balance, item.currency)}
          </View>

          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </ThemedCard>
      </BouncyPressable>
    </AnimatedListItem>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY: emptyBounce }] }]}>
        <LinearGradient
          colors={[`${colors.primary}22`, `${colors.primary}08`]}
          style={styles.emptyIconCircle}
        >
          <Ionicons name="people-outline" size={42} color={colors.primary} />
        </LinearGradient>
      </Animated.View>
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
      <View style={styles.bgOrbSmall} />

      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.header, entrance.style]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerKicker}>{t('groups.yourCircles')}</Text>
            <Text style={styles.headerTitle}>{t('groups.title')}</Text>
          </View>
          <BouncyPressable onPress={() => navigation.navigate('JoinGroup')}>
            <View style={styles.joinBtn}>
              <Ionicons name="enter-outline" size={16} color={isDark ? colors.accentLight : colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.joinBtnText}>{t('groups.join')}</Text>
            </View>
          </BouncyPressable>
        </Animated.View>

        {error ? (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle" size={16} color={isDark ? '#FDBA74' : colors.danger} style={{ marginRight: 8 }} />
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
          <BouncyPressable onPress={() => navigation.navigate('CreateGroup')}>
            <LinearGradient colors={colors.primaryGradient} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </LinearGradient>
          </BouncyPressable>
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
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.35,
      height: SW * 0.35,
      borderRadius: SW * 0.175,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(201,162,39,0.03)',
      bottom: SW * 0.1,
      right: -SW * 0.1,
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
      textTransform: 'uppercase',
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
      textTransform: 'uppercase',
    },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 160, gap: Spacing.md },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },

    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardIconText: {
      fontFamily: FontFamily.display,
      fontSize: 22,
      color: '#FFFFFF',
    },
    cardTitleBlock: { flex: 1, marginLeft: Spacing.lg },
    cardTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17,
      color: c.text,
      letterSpacing: -0.2,
    },
    cardSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    cardSub: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textSecondary,
    },
    cardDesc: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
      marginTop: Spacing.sm,
      marginLeft: 64,
    },

    pill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.full,
      flexDirection: 'row',
      alignItems: 'center',
    },
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.full,
      flexDirection: 'row',
      alignItems: 'center',
    },
    pillText: { fontFamily: FontFamily.bodyBold, fontSize: 13, letterSpacing: -0.2 },
    pillSettledText: { fontFamily: FontFamily.bodySemibold, fontSize: 12, color: c.textSecondary },

    emptyContainer: { alignItems: 'center', paddingHorizontal: Spacing.xxxl },
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
    emptySub: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 22,
    },

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
