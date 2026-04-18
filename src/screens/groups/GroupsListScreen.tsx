import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
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
import { Spacing, Radius, FontFamily } from '../../theme';
import { displayFor } from '../../theme/fonts';
import { SkeletonList } from '../../components/SkeletonLoader';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import PageScaffold from '../../components/PageScaffold';
import EditorialHeader from '../../components/EditorialHeader';
import EmptyState from '../../components/EmptyState';
import BalancePill from '../../components/BalancePill';
import SectionDivider from '../../components/SectionDivider';
import useFabFloat from '../../hooks/useFabFloat';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'GroupsTab'>,
  NativeStackScreenProps<RootStackParamList, 'MainTabs'>
>;

interface GroupWithMeta extends Group {
  member_count: number;
  net_balance: number;
  is_favorite: boolean;
}

export default function GroupsListScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const fabFloat = useFabFloat();

  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data: memberships, error: memberError } = await supabase
        .from('group_members').select('group_id, is_favorite').eq('user_id', user.id);
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

      const favMap = new Map((memberships || []).map((m) => [m.group_id, m.is_favorite ?? false]));
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
        return { ...group, member_count: memberCount, net_balance: Math.round(netBalance * 100) / 100, is_favorite: favMap.get(group.id) || false };
      });
      enrichedGroups.sort((a, b) => (a.is_favorite === b.is_favorite ? 0 : a.is_favorite ? -1 : 1));
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

  const toggleFavorite = async (groupId: string, current: boolean) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGroups((prev) => {
      const updated = prev.map((g) => g.id === groupId ? { ...g, is_favorite: !current } : g);
      updated.sort((a, b) => (a.is_favorite === b.is_favorite ? 0 : a.is_favorite ? -1 : 1));
      return updated;
    });
    await supabase
      .from('group_members')
      .update({ is_favorite: !current })
      .eq('group_id', groupId)
      .eq('user_id', user.id);
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
              <Text style={[styles.cardIconText, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>

            <View style={styles.cardTitleBlock}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <View style={styles.cardSubRow}>
                <Ionicons name="people" size={12} color={colors.textTertiary} />
                <Text style={styles.cardSub}>
                  {' '}{item.member_count} {t('groups.members').toLowerCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => toggleFavorite(item.id, item.is_favorite)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.starBtn}
            >
              <Ionicons
                name={item.is_favorite ? 'star' : 'star-outline'}
                size={20}
                color={item.is_favorite ? colors.accent : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardBottom}>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            ) : <View />}
            <BalancePill amount={item.net_balance} currency={item.currency} compact />
          </View>
        </ThemedCard>
      </BouncyPressable>
    </AnimatedListItem>
  );

  const headerRight = (
    <View style={styles.headerActions}>
      <BouncyPressable onPress={() => navigation.navigate('QuickSplit')} scaleDown={0.92}>
        <View style={styles.actionBtn}>
          <Ionicons name="flash" size={16} color={isDark ? colors.accentLight : colors.accent} />
        </View>
      </BouncyPressable>
      <BouncyPressable onPress={() => navigation.navigate('JoinGroup')} scaleDown={0.96}>
        <View style={styles.joinBtn}>
          <Ionicons
            name="enter-outline"
            size={14}
            color={isDark ? colors.accentLight : colors.accent}
          />
          <Text style={styles.joinBtnText}>{t('groups.join')}</Text>
        </View>
      </BouncyPressable>
    </View>
  );

  if (loading) {
    return (
      <PageScaffold decor>
        <SkeletonList count={4} />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold decor>
      <EditorialHeader
        kicker={t('groups.yourCircles')}
        title={t('groups.title')}
        rightAction={headerRight}
      />

      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={16} color={isDark ? '#FDBA74' : colors.danger} style={{ marginEnd: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchGroups}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {groups.length > 0 && (
        <SectionDivider label={t('groups.groupCount', { count: groups.length })} variant="subtle" />
      )}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={t('groups.no_groups')}
            body={t('groups.no_groups_subtitle')}
            action={
              <FunButton
                title={t('groups.createFirst')}
                onPress={() => navigation.navigate('CreateGroup')}
                icon={<Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
              />
            }
          />
        }
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
    </PageScaffold>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    actionBtn: {
      width: 38,
      height: 38,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.35)' : c.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(201,162,39,0.35)' : c.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.bgCard,
    },
    joinBtnText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 12,
      color: isDark ? c.accentLight : c.accent,
      letterSpacing: 0.4,
    },

    errorBar: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FEF2F2',
      padding: Spacing.md,
      marginHorizontal: Spacing.gutter,
      marginBottom: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(234,88,12,0.25)' : '#FECACA',
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: { color: isDark ? '#FDBA74' : c.danger, fontSize: 13, fontFamily: FontFamily.body, flex: 1 },
    retryText: { color: c.primary, fontSize: 13, fontFamily: FontFamily.bodyBold, marginStart: Spacing.md },

    list: { paddingHorizontal: Spacing.lg, paddingBottom: 160, gap: Spacing.md },
    emptyList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },

    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardIconText: {
      fontSize: 24,
      color: '#FFFFFF',
      letterSpacing: -0.6,
      lineHeight: 28,
    },
    starBtn: { paddingHorizontal: Spacing.sm },
    cardTitleBlock: { flex: 1, marginStart: Spacing.lg },
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
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
      marginStart: 64,
      gap: Spacing.md,
    },
    cardDesc: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
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
