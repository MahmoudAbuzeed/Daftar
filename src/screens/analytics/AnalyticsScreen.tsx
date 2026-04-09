import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import AnimatedListItem from '../../components/AnimatedListItem';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAuth } from '../../lib/auth-context';
import { useSubscription } from '../../lib/subscription-context';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/balance';
import FunButton from '../../components/FunButton';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;

const { width: SW } = Dimensions.get('window');

const PERIODS = ['thisWeek', 'thisMonth', 'threeMonths', 'allTime'] as const;
type Period = (typeof PERIODS)[number];

const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant-outline',
  transport: 'car-outline',
  shopping: 'bag-outline',
  bills: 'receipt-outline',
  entertainment: 'game-controller-outline',
  health: 'medkit-outline',
  travel: 'airplane-outline',
  groceries: 'cart-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const CATEGORY_COLORS: Record<string, [string, string]> = {
  food: ['#EA580C', '#FB923C'],
  transport: ['#2563EB', '#60A5FA'],
  shopping: ['#DB2777', '#F472B6'],
  bills: ['#7C3AED', '#A78BFA'],
  entertainment: ['#059669', '#34D399'],
  health: ['#DC2626', '#F87171'],
  travel: ['#D97706', '#FBBF24'],
  groceries: ['#0D9488', '#14B8A6'],
  other: ['#6B7280', '#9CA3AF'],
};

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}

interface MonthData {
  label: string;
  amount: number;
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'thisWeek': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    case 'thisMonth': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'threeMonths': return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case 'allTime': return new Date(2020, 0, 1);
  }
}

// Animated horizontal bar
function AnimatedBar({ width, colors: barColors, delay }: { width: number; colors: [string, string]; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: width,
      duration: 600,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [width]);

  return (
    <Animated.View style={{ width: anim, height: 24, borderRadius: 12, overflow: 'hidden' }}>
      <LinearGradient colors={barColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 12 }} />
    </Animated.View>
  );
}

// Animated vertical bar for monthly trend
function VerticalBar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: height,
      delay,
      useNativeDriver: false,
      damping: 14,
      stiffness: 120,
    }).start();
  }, [height]);

  return (
    <Animated.View style={{ height: anim, backgroundColor: color, borderRadius: 6, width: '100%' }} />
  );
}

export default function AnalyticsScreen({ route, navigation }: Props) {
  const { groupId } = route.params || {};
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [period, setPeriod] = useState<Period>('thisMonth');
  const [loading, setLoading] = useState(true);
  const [totalSpending, setTotalSpending] = useState(0);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthData[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!isPro) { setLoading(false); return; }
    setLoading(true);

    try {
      // Get user's groups
      const { data: memberships } = await supabase
        .from('group_members').select('group_id').eq('user_id', user.id);
      let groupIds = (memberships || []).map(m => m.group_id);
      if (groupId) groupIds = [groupId];
      if (groupIds.length === 0) { setLoading(false); return; }

      const periodStart = getPeriodStart(period);

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, description, total_amount, currency, category, created_at, group_id')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .gte('created_at', periodStart.toISOString())
        .order('total_amount', { ascending: false });

      const items = expenses || [];
      const total = items.reduce((sum, e) => sum + e.total_amount, 0);
      setTotalSpending(total);

      // Category breakdown
      const catMap = new Map<string, number>();
      for (const e of items) {
        const cat = e.category || 'other';
        catMap.set(cat, (catMap.get(cat) || 0) + e.total_amount);
      }
      const maxCat = Math.max(...catMap.values(), 1);
      const catArr: CategoryData[] = Array.from(catMap.entries())
        .map(([name, amount]) => ({ name, amount, percentage: (amount / maxCat) * 100 }))
        .sort((a, b) => b.amount - a.amount);
      setCategories(catArr);

      // Top 5 expenses
      setTopExpenses(items.slice(0, 5));

      // Monthly trend (last 6 months)
      const months: MonthData[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString(undefined, { month: 'short' });
        const monthStart = d;
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        // Fetch month total (from all expenses regardless of period filter)
        const monthItems = (expenses || []).filter(e => {
          const ed = new Date(e.created_at);
          return ed >= monthStart && ed <= monthEnd;
        });
        // For "allTime" period, requery without date filter for trend
        months.push({ label, amount: monthItems.reduce((s, e) => s + e.total_amount, 0) });
      }
      setMonthlyTrend(months);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, period, groupId, isPro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxMonth = Math.max(...monthlyTrend.map(m => m.amount), 1);
  const BAR_MAX_WIDTH = SW - Spacing.xxl * 2 - Spacing.xl * 2 - 120; // space for label + amount

  if (!isPro) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}
        <SafeAreaView style={styles.safe}>
          <Animated.View style={[styles.proGateWrap, entrance.style]}>
            <LinearGradient
              colors={colors.accentGradient}
              style={styles.proGateIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="bar-chart" size={36} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.proGateTitle}>{t('subscription.analyticsTitle')}</Text>
            <Text style={styles.proGateBody}>{t('subscription.features.analytics')}</Text>
            <View style={styles.proGateButton}>
              <FunButton
                title={t('subscription.subscribeButton')}
                onPress={() => navigation.navigate('Paywall', { trigger: 'analytics' })}
                icon={<Ionicons name="star" size={18} color="#FFFFFF" />}
              />
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

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
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={entrance.style}>
            {/* Period selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
              {PERIODS.map((p) => (
                <BouncyPressable key={p} onPress={() => { Haptics.selectionAsync(); setPeriod(p); }} scaleDown={0.95}>
                  <View style={[styles.periodPill, period === p && styles.periodPillActive]}>
                    <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                      {t(`analytics.${p}`)}
                    </Text>
                  </View>
                </BouncyPressable>
              ))}
            </ScrollView>

            {/* Total spending */}
            <ThemedCard accent style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('analytics.totalSpending')}</Text>
              <Text style={[styles.totalAmount, { color: colors.text }]}>{formatCurrency(totalSpending)}</Text>
            </ThemedCard>

            {/* Category breakdown */}
            {categories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('analytics.categoryBreakdown')}</Text>
                <ThemedCard>
                  {categories.map((cat, i) => (
                    <AnimatedListItem key={cat.name} index={i} delay={80}>
                      <View style={styles.catRow}>
                        <View style={styles.catLeft}>
                          <LinearGradient
                            colors={CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.other}
                            style={styles.catIcon}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                          >
                            <Ionicons name={(CATEGORY_ICONS[cat.name] || CATEGORY_ICONS.other) as any} size={14} color="#FFF" />
                          </LinearGradient>
                          <Text style={styles.catName}>{cat.name}</Text>
                        </View>
                        <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
                      </View>
                      <View style={styles.barWrap}>
                        <AnimatedBar
                          width={Math.max((cat.percentage / 100) * BAR_MAX_WIDTH, 8)}
                          colors={CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.other}
                          delay={i * 100}
                        />
                      </View>
                      {i < categories.length - 1 && <View style={styles.catDivider} />}
                    </AnimatedListItem>
                  ))}
                </ThemedCard>
              </View>
            )}

            {/* Monthly trend */}
            {monthlyTrend.some(m => m.amount > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('analytics.monthlyTrend')}</Text>
                <ThemedCard>
                  <View style={styles.trendRow}>
                    {monthlyTrend.map((m, i) => (
                      <View key={i} style={styles.trendCol}>
                        <View style={styles.trendBarWrap}>
                          <VerticalBar
                            height={Math.max((m.amount / maxMonth) * 120, 4)}
                            color={colors.primary}
                            delay={i * 80}
                          />
                        </View>
                        <Text style={styles.trendLabel}>{m.label}</Text>
                      </View>
                    ))}
                  </View>
                </ThemedCard>
              </View>
            )}

            {/* Top expenses */}
            {topExpenses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('analytics.topExpenses')}</Text>
                {topExpenses.map((exp, i) => (
                  <AnimatedListItem key={exp.id} index={i}>
                    <ThemedCard style={styles.topCard}>
                      <View style={styles.topRow}>
                        <View style={styles.topInfo}>
                          <Text style={styles.topDesc} numberOfLines={1}>{exp.description}</Text>
                          <Text style={styles.topMeta}>
                            {new Date(exp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            {exp.category ? ` · ${exp.category}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.topAmount}>{formatCurrency(exp.total_amount, exp.currency)}</Text>
                      </View>
                    </ThemedCard>
                  </AnimatedListItem>
                ))}
              </View>
            )}

            {/* Empty state */}
            {categories.length === 0 && (
              <View style={styles.emptyWrap}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>{t('analytics.noData')}</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { paddingBottom: 40 },

    periodRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.sm },
    periodPill: {
      paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
    },
    periodPillActive: { backgroundColor: c.primary },
    periodText: { fontFamily: FontFamily.bodySemibold, fontSize: 13, color: c.textTertiary },
    periodTextActive: { color: '#FFFFFF' },

    totalCard: { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    totalLabel: { fontFamily: FontFamily.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm },
    totalAmount: { fontFamily: FontFamily.bodyBold, fontSize: 36, letterSpacing: -1 },

    section: { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    sectionTitle: { fontFamily: FontFamily.bodySemibold, fontSize: 11, letterSpacing: 2, color: c.kicker, textTransform: 'uppercase', marginBottom: Spacing.md, paddingHorizontal: Spacing.xs },

    catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    catLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    catIcon: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    catName: { fontFamily: FontFamily.bodyMedium, fontSize: 14, color: c.text, textTransform: 'capitalize' },
    catAmount: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: c.text, letterSpacing: -0.3 },
    barWrap: { marginBottom: Spacing.md },
    catDivider: { height: 1, backgroundColor: c.borderLight, marginBottom: Spacing.md },

    trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150 },
    trendCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    trendBarWrap: { flex: 1, justifyContent: 'flex-end', width: '100%' },
    trendLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: c.textTertiary, marginTop: 6 },

    topCard: { marginBottom: Spacing.sm },
    topRow: { flexDirection: 'row', alignItems: 'center' },
    topInfo: { flex: 1, marginRight: Spacing.md },
    topDesc: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    topMeta: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary, marginTop: 2 },
    topAmount: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: c.text, letterSpacing: -0.3 },

    emptyWrap: { alignItems: 'center', paddingVertical: Spacing.huge, gap: Spacing.md },
    emptyText: { fontFamily: FontFamily.body, fontSize: 15, color: c.textTertiary },

    proGateWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.lg,
    },
    proGateIcon: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    proGateTitle: {
      fontFamily: FontFamily.display,
      fontSize: 26,
      color: c.text,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    proGateBody: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: Spacing.md,
    },
    proGateButton: {
      alignSelf: 'stretch',
      marginTop: Spacing.xl,
    },
  });
