import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily, tabularNums } from '../../theme';
import { displayFor } from '../../theme/fonts';
import ThemedCard from '../../components/ThemedCard';
import AnimatedListItem from '../../components/AnimatedListItem';
import PageScaffold from '../../components/PageScaffold';
import EditorialHeader from '../../components/EditorialHeader';
import EmptyState from '../../components/EmptyState';
import StateScreen from '../../components/StateScreen';
import SegmentedControl from '../../components/SegmentedControl';
import AmountText from '../../components/AmountText';
import SectionDivider from '../../components/SectionDivider';
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

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
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
      duration: 700,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [width]);

  return (
    <Animated.View style={{ width: anim, height: 8, borderRadius: 4, overflow: 'hidden' }}>
      <LinearGradient colors={barColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 4 }} />
    </Animated.View>
  );
}

// Animated vertical bar for monthly trend — gradient fill, top label
function VerticalBar({ height, gradient, delay, isPeak }: { height: number; gradient: [string, string]; delay: number; isPeak: boolean }) {
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
    <Animated.View style={{ height: anim, width: '100%', borderRadius: 6, overflow: 'hidden' }}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1, opacity: isPeak ? 1 : 0.55 }}
      />
    </Animated.View>
  );
}

export default function AnalyticsScreen({ route, navigation }: Props) {
  const { groupId } = route.params || {};
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [period, setPeriod] = useState<Period>('thisMonth');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSpending, setTotalSpending] = useState(0);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthData[]>([]);
  const [topExpenses, setTopExpenses] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!isPro) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      const { data: memberships } = await supabase
        .from('group_members').select('group_id').eq('user_id', user.id);
      let groupIds = (memberships || []).map(m => m.group_id);
      if (groupId) groupIds = [groupId];
      if (groupIds.length === 0) { setLoading(false); return; }

      const periodStart = getPeriodStart(period);

      const { data: expenses, error: fetchError } = await supabase
        .from('expenses')
        .select('id, description, total_amount, currency, category, created_at, group_id')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .gte('created_at', periodStart.toISOString())
        .order('total_amount', { ascending: false });

      if (fetchError) throw fetchError;

      const items = expenses || [];
      const total = items.reduce((sum, e) => sum + e.total_amount, 0);
      setTotalSpending(total);

      const catMap = new Map<string, number>();
      for (const e of items) {
        const cat = e.category || 'other';
        catMap.set(cat, (catMap.get(cat) || 0) + e.total_amount);
      }
      const totalForBars = Math.max(total, 1);
      const catArr: CategoryData[] = Array.from(catMap.entries())
        .map(([name, amount]) => ({ name, amount, percentage: (amount / totalForBars) * 100 }))
        .sort((a, b) => b.amount - a.amount);
      setCategories(catArr);

      setTopExpenses(items.slice(0, 5));

      const months: MonthData[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString(undefined, { month: 'short' });
        const monthStart = d;
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        const monthItems = (expenses || []).filter(e => {
          const ed = new Date(e.created_at);
          return ed >= monthStart && ed <= monthEnd;
        });
        months.push({ label, amount: monthItems.reduce((s, e) => s + e.total_amount, 0) });
      }
      setMonthlyTrend(months);
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [user, period, groupId, isPro, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxMonth = Math.max(...monthlyTrend.map(m => m.amount), 1);
  const peakIndex = monthlyTrend.reduce((peak, m, i) => (m.amount > monthlyTrend[peak].amount ? i : peak), 0);
  const BAR_MAX_WIDTH = SW - Spacing.gutter * 2 - Spacing.xl * 2 - 40;

  const periodOptions = PERIODS.map((p) => ({ value: p, label: t(`analytics.${p}`) }));

  // ─── Non-Pro paywall ──────────────────────────────────────
  if (!isPro) {
    return (
      <PageScaffold decor>
        <EditorialHeader
          kicker={t('analytics.title') || 'Analytics'}
          title={t('subscription.analyticsTitle')}
          subtitle={t('subscription.features.analytics')}
        />
        <Animated.View style={[styles.proGateWrap, entrance.style]}>
          <View style={[styles.proGateIconShadow, { shadowColor: colors.accent }]}>
            <LinearGradient
              colors={colors.accentGradient}
              style={styles.proGateIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="bar-chart" size={40} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.proGateButton}>
            <FunButton
              title={t('subscription.subscribeButton')}
              onPress={() => navigation.navigate('Paywall', { trigger: 'analytics' })}
              icon={<Ionicons name="star" size={18} color="#FFFFFF" />}
            />
          </View>
        </Animated.View>
      </PageScaffold>
    );
  }

  if (loading) {
    return (
      <PageScaffold>
        <StateScreen variant="loading" />
      </PageScaffold>
    );
  }

  if (error) {
    return (
      <PageScaffold>
        <StateScreen variant="error" body={error} onRetry={fetchData} />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold decor>
      <EditorialHeader
        kicker={t(`analytics.${period}`)}
        title={t('analytics.totalSpending')}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={entrance.style}>
          {/* Hero amount — the typographic anchor of the screen */}
          <View style={styles.heroAmount}>
            <AmountText
              amount={totalSpending}
              variant="hero"
              tone="ink"
              signMode="absolute"
            />
          </View>

          {/* Period selector */}
          <View style={styles.periodWrap}>
            <SegmentedControl
              options={periodOptions}
              value={period}
              onChange={setPeriod}
              compact
            />
          </View>

          {categories.length === 0 ? (
            <EmptyState
              icon="bar-chart-outline"
              title={t('analytics.noData')}
              body={t('analytics.noDataBody', 'Spending will appear here once you log expenses for this period.')}
            />
          ) : (
            <>
              {/* Category breakdown */}
              <SectionDivider label={t('analytics.categoryBreakdown')} />
              <View style={styles.section}>
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
                            <Ionicons name={CATEGORY_ICONS[cat.name] || CATEGORY_ICONS.other} size={14} color="#FFF" />
                          </LinearGradient>
                          <View style={styles.catTextBlock}>
                            <Text style={styles.catName}>{cat.name}</Text>
                            <Text style={styles.catPct}>{cat.percentage.toFixed(0)}%</Text>
                          </View>
                        </View>
                        <Text style={[styles.catAmount, tabularNums]}>{formatCurrency(cat.amount)}</Text>
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

              {/* Monthly trend */}
              {monthlyTrend.some(m => m.amount > 0) && (
                <>
                  <SectionDivider label={t('analytics.monthlyTrend')} />
                  <View style={styles.section}>
                    <ThemedCard>
                      <View style={styles.trendPeakRow}>
                        <Text style={styles.trendPeakLabel}>
                          {t('analytics.peak', 'Peak')}
                        </Text>
                        <Text style={[styles.trendPeakValue, tabularNums]}>
                          {formatCurrency(maxMonth)}
                        </Text>
                      </View>
                      <View style={styles.trendRow}>
                        {monthlyTrend.map((m, i) => (
                          <View key={i} style={styles.trendCol}>
                            <View style={styles.trendBarWrap}>
                              <VerticalBar
                                height={Math.max((m.amount / maxMonth) * 120, 4)}
                                gradient={colors.primaryGradient as any}
                                delay={i * 80}
                                isPeak={i === peakIndex}
                              />
                            </View>
                            <Text style={[styles.trendLabel, i === peakIndex && styles.trendLabelActive]}>{m.label}</Text>
                          </View>
                        ))}
                      </View>
                    </ThemedCard>
                  </View>
                </>
              )}

              {/* Top expenses */}
              {topExpenses.length > 0 && (
                <>
                  <SectionDivider label={t('analytics.topExpenses')} />
                  <View style={styles.section}>
                    {topExpenses.map((exp, i) => (
                      <AnimatedListItem key={exp.id} index={i}>
                        <ThemedCard style={styles.topCard}>
                          <View style={styles.topRow}>
                            <View style={[styles.topRank, { backgroundColor: i === 0 ? colors.accent + '22' : colors.borderLight }]}>
                              <Text style={[styles.topRankText, { color: i === 0 ? colors.accent : colors.textSecondary, fontFamily: displayFor(i18n.language, 'bold') }]}>
                                {i + 1}
                              </Text>
                            </View>
                            <View style={styles.topInfo}>
                              <Text style={styles.topDesc} numberOfLines={1}>{exp.description}</Text>
                              <Text style={styles.topMeta}>
                                {new Date(exp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                {exp.category ? ` · ${exp.category}` : ''}
                              </Text>
                            </View>
                            <AmountText amount={exp.total_amount} currency={exp.currency} variant="amount" tone="ink" signMode="absolute" />
                          </View>
                        </ThemedCard>
                      </AnimatedListItem>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </PageScaffold>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    scroll: { paddingBottom: 80 },

    heroAmount: {
      paddingHorizontal: Spacing.gutter,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.xl,
    },

    periodWrap: {
      paddingHorizontal: Spacing.gutter,
      marginBottom: Spacing.lg,
    },

    section: { marginHorizontal: Spacing.gutter, marginBottom: Spacing.xl },

    catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    catLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    catIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    catTextBlock: { flex: 1 },
    catName: { fontFamily: FontFamily.bodySemibold, fontSize: 14, color: c.text, textTransform: 'capitalize' },
    catPct: { fontFamily: FontFamily.body, fontSize: 11, color: c.textTertiary, marginTop: 1 },
    catAmount: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: c.text, letterSpacing: -0.3 },
    barWrap: { marginBottom: Spacing.md, marginTop: 4 },
    catDivider: { height: 1, backgroundColor: c.borderLight, marginBottom: Spacing.md },

    trendPeakRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: Spacing.md,
    },
    trendPeakLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: c.textTertiary,
    },
    trendPeakValue: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150 },
    trendCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    trendBarWrap: { flex: 1, justifyContent: 'flex-end', width: '100%' },
    trendLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 10, color: c.textTertiary, marginTop: 8 },
    trendLabelActive: { color: c.accent, fontFamily: FontFamily.bodyBold },

    topCard: { marginBottom: Spacing.sm },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    topRank: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topRankText: {
      fontSize: 16,
      lineHeight: 20,
    },
    topInfo: { flex: 1 },
    topDesc: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    topMeta: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary, marginTop: 2 },

    proGateWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.lg,
    },
    proGateIconShadow: {
      borderRadius: 32,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 14,
      marginBottom: Spacing.md,
    },
    proGateIcon: {
      width: 96,
      height: 96,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    proGateButton: {
      alignSelf: 'stretch',
      marginTop: Spacing.xl,
    },
  });
