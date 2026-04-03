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
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';

const { width: SW } = Dimensions.get('window');

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  groupName: string;
  amount: number;
  currency: 'EGP' | 'USD';
  createdAt: string;
  paidByName: string;
}

function AnimatedListItem({ children, index }: { children: React.ReactNode; index: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index * 60, 350),
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!profile) return;
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('group_members').select('group_id').eq('user_id', profile.id);
      if (memberError) throw memberError;
      const groupIds = (memberships || []).map((m) => m.group_id);
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
      setActivities([...expenseItems, ...settlementItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50));
    } catch (err) { console.error('Failed to fetch activity:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [profile, t]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchActivity(); }, [fetchActivity]);

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
    return (
      <AnimatedListItem index={index}>
        <View style={styles.timelineRow}>
          <View style={styles.timelineTrack}>
            <View style={[styles.timelineDot, { backgroundColor: isExpense ? colors.primary : colors.primaryLight }]} />
            {index < activities.length - 1 && <View style={styles.timelineLine} />}
          </View>

          <View style={styles.activityCard}>
            {isDark && (
              <LinearGradient
                colors={colors.cardGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <View style={styles.cardRow}>
              <View style={styles.activityInfo}>
                <Text style={styles.activityDesc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.activityMeta}>
                  <Ionicons
                    name={isExpense ? 'receipt-outline' : 'swap-horizontal-outline'}
                    size={12}
                    color={colors.primaryLight}
                  />
                  <Text style={styles.activityGroup}>{item.groupName}</Text>
                  <Text style={styles.metaDot}>{'\u00B7'}</Text>
                  <Text style={styles.activityTime}>{getTimeAgo(item.createdAt)}</Text>
                </View>
                {isExpense && (
                  <Text style={styles.activityPaidBy}>{t('activity.paidBy')} {item.paidByName}</Text>
                )}
              </View>
              <View style={[styles.amountPill, isExpense ? styles.amountPillExpense : styles.amountPillSettlement]}>
                <Text style={[styles.amountText, { color: isExpense ? colors.primaryLight : colors.success }]}>
                  {item.amount.toFixed(2)} {item.currency}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </AnimatedListItem>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[`${colors.primary}22`, `${colors.primary}08`]}
          style={styles.emptyIcon}
        >
          <Ionicons name="pulse-outline" size={36} color={colors.primary} />
        </LinearGradient>
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

      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerKicker}>RECENT TRANSACTIONS</Text>
          <Text style={styles.headerTitle}>{t('activity.title')}</Text>
        </View>

        {activities.length > 0 && (
          <View style={styles.countStrip}>
            <Ionicons name="pulse" size={14} color={colors.primaryLight} />
            <Text style={styles.countText}>{activities.length} items</Text>
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

    header: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
    },
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

    countStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.md,
      gap: 8,
    },
    countText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textTertiary,
    },

    list: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxxl,
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
    timelineTrack: {
      width: 28,
      alignItems: 'center',
      paddingTop: 20,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: c.bg,
      zIndex: 1,
    },
    timelineLine: {
      flex: 1,
      width: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
      marginTop: -2,
    },

    activityCard: {
      flex: 1,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: isDark ? c.border : c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      overflow: 'hidden',
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 8,
      elevation: isDark ? 0 : 2,
    },
    cardRow: {
      flexDirection: 'row',
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
      marginTop: 4,
      gap: 6,
    },
    activityGroup: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
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
      marginTop: 2,
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
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? c.border : c.borderLight,
      marginBottom: Spacing.xl,
    },
    emptyTitle: { fontFamily: FontFamily.bodySemibold, fontSize: 18, color: c.text, marginBottom: Spacing.sm },
    emptySub: { fontFamily: FontFamily.body, fontSize: 14, color: c.textTertiary, textAlign: 'center', lineHeight: 20 },
  });
