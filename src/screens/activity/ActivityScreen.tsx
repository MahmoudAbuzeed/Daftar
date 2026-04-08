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
  I18nManager,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { RootStackParamList } from '../../navigation/AppNavigator';

const { width: SW } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'member_joined';
  description: string;
  groupName: string;
  amount: number;
  currency: string;
  createdAt: string;
  paidByName: string;
}

export default function ActivityScreen({ route }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const preFilteredGroupId = route?.params?.groupId || null;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchActivity = useCallback(async () => {
    if (!profile) return;
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('group_members').select('group_id').eq('user_id', profile.id);
      if (memberError) throw memberError;
      let groupIds = (memberships || []).map((m) => m.group_id);

      // If pre-filtered to a specific group, use only that
      if (preFilteredGroupId) {
        groupIds = groupIds.filter(id => id === preFilteredGroupId);
      }

      if (groupIds.length === 0) { setActivities([]); setLoading(false); setRefreshing(false); return; }

      const { data: expenses, error: expenseError } = await supabase
        .from('expenses')
        .select(`id, description, total_amount, currency, created_at, group_id, is_deleted,
          paid_by_user:users!expenses_paid_by_fkey(display_name),
          group:groups!expenses_group_id_fkey(name)`)
        .in('group_id', groupIds).eq('is_deleted', false).order('created_at', { ascending: false }).limit(30);
      if (expenseError) throw expenseError;

      const { data: settlements, error: settlementError } = await supabase
        .from('settlements')
        .select(`id, amount, currency, created_at, group_id, note,
          paid_by_user:users!settlements_paid_by_fkey(display_name),
          paid_to_user:users!settlements_paid_to_fkey(display_name),
          group:groups!settlements_group_id_fkey(name)`)
        .in('group_id', groupIds).order('created_at', { ascending: false }).limit(20);
      if (settlementError) throw settlementError;

      const { data: memberJoins, error: memberJoinError } = await supabase
        .from('group_members')
        .select(`id, joined_at, group_id,
          user:users!group_members_user_id_fkey(display_name),
          group:groups!group_members_group_id_fkey(name)`)
        .in('group_id', groupIds)
        .order('joined_at', { ascending: false })
        .limit(20);
      if (memberJoinError) throw memberJoinError;

      const expenseItems: ActivityItem[] = (expenses || []).map((e: any) => ({
        id: `expense-${e.id}`, type: 'expense' as const, description: e.description,
        groupName: e.group?.name || '', amount: e.total_amount, currency: e.currency,
        createdAt: e.created_at, paidByName: e.paid_by_user?.display_name || '',
      }));

      const settlementItems: ActivityItem[] = (settlements || []).map((s: any) => ({
        id: `settlement-${s.id}`, type: 'settlement' as const,
        description: `${s.paid_by_user?.display_name || ''} ${t('activity.paidTo')} ${s.paid_to_user?.display_name || ''}`,
        groupName: s.group?.name || '', amount: s.amount, currency: s.currency,
        createdAt: s.created_at, paidByName: s.paid_by_user?.display_name || '',
      }));

      const memberJoinItems: ActivityItem[] = (memberJoins || []).map((m: any) => ({
        id: `member-${m.id}`, type: 'member_joined' as const,
        description: t('activity.memberJoined', { name: m.user?.display_name || '' }),
        groupName: m.group?.name || '', amount: 0, currency: '',
        createdAt: m.joined_at, paidByName: '',
      }));

      setActivities([...expenseItems, ...settlementItems, ...memberJoinItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 80));
    } catch (err) { console.error('Failed to fetch activity:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [profile, t, preFilteredGroupId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchActivity(); }, [fetchActivity]);

  // Realtime subscription
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'expenses' },
        () => fetchActivity()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'settlements' },
        () => fetchActivity()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_members' },
        () => fetchActivity()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchActivity]);

  const getTimeAgo = (dateString: string): string => {
    const now = new Date(); const date = new Date(dateString);
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHr = Math.floor(diffMin / 60); const diffDays = Math.floor(diffHr / 24);
    if (diffMin < 1) return t('activity.justNow');
    if (diffMin < 60) return t('activity.minutesAgo', { count: diffMin });
    if (diffHr < 24) return t('activity.hoursAgo', { count: diffHr });
    if (diffDays < 7) return t('activity.daysAgo', { count: diffDays });
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };


  const renderActivity = ({ item, index }: { item: ActivityItem; index: number }) => {
    const isExpense = item.type === 'expense';
    const isSettlement = item.type === 'settlement';
    const isMemberJoined = item.type === 'member_joined';

    const getIcon = () => {
      if (isExpense) return 'receipt-outline';
      if (isSettlement) return 'swap-horizontal-outline';
      return 'person-add-outline';
    };

    const getGradient = () => {
      if (isExpense) return colors.primaryGradient;
      if (isSettlement) return colors.successGradient;
      return colors.accentGradient;
    };

    const getDotIcon = () => {
      if (isExpense) return 'receipt';
      if (isSettlement) return 'checkmark';
      return 'person-add';
    };

    return (
      <AnimatedListItem index={index}>
        <View style={[styles.timelineRow, I18nManager.isRTL && styles.timelineRowRTL]}>
          {/* Timeline track */}
          <View style={styles.timelineTrack}>
            <LinearGradient
              colors={getGradient()}
              style={styles.timelineDotGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name={getDotIcon() as any}
                size={10}
                color="#FFFFFF"
              />
            </LinearGradient>
            {index < activities.length - 1 && <View style={styles.timelineLine} />}
          </View>

          {/* Activity card */}
          <ThemedCard style={styles.activityCard}>
            <View style={styles.cardRow}>
              <View style={styles.activityIconWrap}>
                <LinearGradient
                  colors={getGradient()}
                  style={styles.activityIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={getIcon() as any}
                    size={16}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </View>

              <View style={styles.activityInfo}>
                <Text style={styles.activityDesc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.activityMeta}>
                  <View style={[styles.groupTag, { backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}10` }]}>
                    <Ionicons name="people" size={10} color={colors.primaryLight} />
                    <Text style={styles.activityGroup}>{item.groupName}</Text>
                  </View>
                  <Text style={styles.metaDot}>{'\u00B7'}</Text>
                  <Text style={styles.activityTime}>{getTimeAgo(item.createdAt)}</Text>
                </View>
                {isExpense && (
                  <Text style={styles.activityPaidBy}>
                    <Ionicons name="person-outline" size={10} color={colors.textTertiary} />
                    {' '}{t('activity.paidBy')} {item.paidByName}
                  </Text>
                )}
              </View>

              {!isMemberJoined && (
                <View style={[styles.amountPill, isExpense ? styles.amountPillExpense : styles.amountPillSettlement]}>
                  <Text style={[styles.amountText, { color: isExpense ? colors.primaryLight : colors.success }]}>
                    {item.amount.toFixed(2)} {item.currency}
                  </Text>
                </View>
              )}
            </View>
          </ThemedCard>
        </View>
      </AnimatedListItem>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Animated.View style={{ transform: [{ translateY: emptyBounce }] }}>
          <LinearGradient
            colors={[`${colors.primary}22`, `${colors.primary}08`]}
            style={styles.emptyIcon}
          >
            <Ionicons name="pulse-outline" size={42} color={colors.primary} />
          </LinearGradient>
        </Animated.View>
        <Text style={styles.emptyTitle}>{t('activity.emptyTitle')}</Text>
        <Text style={styles.emptySub}>{t('activity.emptySubtitle')}</Text>
      </View>
    );
  };

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
          <Text style={styles.headerKicker}>{t('activity.recentTransactions')}</Text>
          <Text style={styles.headerTitle}>{t('activity.title')}</Text>
        </Animated.View>

        {activities.length > 0 && (
          <View style={styles.countStrip}>
            <LinearGradient
              colors={colors.primaryGradient}
              style={styles.countDot}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.countText}>{t('activity.itemCount', { count: activities.length })}</Text>
          </View>
        )}

        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivity}
          contentContainerStyle={activities.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
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
      width: SW * 0.6,
      height: SW * 0.6,
      borderRadius: SW * 0.3,
      backgroundColor: isDark ? 'rgba(27,122,108,0.05)' : 'rgba(13,148,136,0.03)',
      bottom: -SW * 0.1,
      right: -SW * 0.15,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.3,
      height: SW * 0.3,
      borderRadius: SW * 0.15,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(201,162,39,0.03)',
      top: SW * 0.2,
      left: -SW * 0.1,
    },

    header: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
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

    countStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.sm,
      marginTop: -Spacing.sm,
      gap: 6,
    },
    countDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    countText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textTertiary,
    },

    list: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 120,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },


    timelineRow: {
      flexDirection: 'row',
      marginBottom: 0,
    },
    timelineRowRTL: {
      flexDirection: 'row-reverse',
    },
    timelineTrack: {
      width: 32,
      alignItems: 'center',
      paddingTop: 18,
    },
    timelineDotGradient: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.bg,
      zIndex: 1,
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: isDark ? c.borderLight : c.border,
      marginTop: -2,
      borderRadius: 1,
    },

    activityCard: {
      flex: 1,
      marginBottom: Spacing.md,
      marginLeft: Spacing.xs,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    activityIconWrap: {
      marginRight: Spacing.md,
    },
    activityIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activityInfo: { flex: 1 },
    activityDesc: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
      letterSpacing: -0.2,
    },
    activityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
      gap: 6,
    },
    groupTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.full,
      gap: 4,
    },
    activityGroup: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: c.primaryLight,
    },
    metaDot: { fontSize: 12, color: c.textTertiary },
    activityTime: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      fontStyle: 'italic',
    },
    activityPaidBy: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 3,
    },

    amountPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.full,
      marginLeft: Spacing.sm,
    },
    amountPillExpense: {
      backgroundColor: isDark ? 'rgba(27,122,108,0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(27,122,108,0.3)' : '#A7F3D0',
    },
    amountPillSettlement: {
      backgroundColor: isDark ? 'rgba(20,184,166,0.12)' : '#F0FDFA',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(20,184,166,0.25)' : '#99F6E4',
    },
    amountText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      letterSpacing: -0.2,
    },

    emptyState: { alignItems: 'center', paddingHorizontal: Spacing.xxxl },
    emptyIcon: {
      width: 96,
      height: 96,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDark ? c.border : c.borderLight,
      marginBottom: Spacing.xl,
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
  });
