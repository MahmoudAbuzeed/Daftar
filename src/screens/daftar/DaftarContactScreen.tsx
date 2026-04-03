import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { DaftarEntry } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'DaftarContact'>;

export default function DaftarContactScreen({ route, navigation }: Props) {
  const { contactName } = route.params;
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();

  const [entries, setEntries] = useState<DaftarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

  const netBalance = entries
    .filter((e) => !e.is_settled)
    .reduce((sum, e) => {
      return sum + (e.direction === 'they_owe' ? e.amount : -e.amount);
    }, 0);

  const fetchEntries = useCallback(async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('daftar_entries')
        .select('*')
        .eq('user_id', profile.id)
        .eq('contact_name', contactName)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEntries((data || []) as DaftarEntry[]);
    } catch (err) {
      console.error('Failed to fetch contact entries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, contactName]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    navigation.setOptions({ title: contactName });
  }, [navigation, contactName]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, [fetchEntries]);

  const handleSettle = () => {
    if (netBalance === 0) return;

    alert.confirm(
      t('daftar.settleTitle'),
      t('daftar.settleConfirm', {
        name: contactName,
        amount: Math.abs(netBalance).toFixed(2),
      }),
      performSettle,
      t('daftar.settle'),
      t('common.cancel'),
    );
  };

  const performSettle = async () => {
    if (!profile) return;

    setSettling(true);

    try {
      const direction: 'i_owe' | 'they_owe' =
        netBalance > 0 ? 'i_owe' : 'they_owe';

      const { error } = await supabase.from('daftar_entries').insert({
        user_id: profile.id,
        contact_name: contactName,
        amount: Math.abs(netBalance),
        direction,
        note: t('daftar.settlementNote'),
        is_settled: false,
      });

      if (error) throw error;

      await fetchEntries();
    } catch (err) {
      console.error('Failed to settle:', err);
      alert.error(t('common.error'), t('daftar.settleFailed'));
    } finally {
      setSettling(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return `${amount.toFixed(2)} ${t('common.egp')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderEntry = ({ item, index }: { item: DaftarEntry; index: number }) => {
    const isTheyOwe = item.direction === 'they_owe';

    return (
      <AnimatedListItem index={index}>
        <ThemedCard
          style={[styles.entryCard, item.is_settled && styles.entryCardSettled]}
        >
          <View style={styles.entryRow}>
            {/* Gradient direction badge */}
            <LinearGradient
              colors={
                isTheyOwe ? colors.successGradient : colors.dangerGradient
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.directionBadge}
            >
              <Ionicons
                name={isTheyOwe ? 'arrow-down' : 'arrow-up'}
                size={18}
                color="#FFFFFF"
              />
            </LinearGradient>

            <View style={styles.entryInfo}>
              <Text style={styles.entryDirection}>
                {isTheyOwe ? t('daftar.theyOweYou') : t('daftar.youOweThem')}
              </Text>
              {item.note ? (
                <Text style={styles.entryNote} numberOfLines={1}>
                  {item.note}
                </Text>
              ) : null}
              <Text style={styles.entryDate}>
                {formatDate(item.created_at)}
              </Text>
            </View>

            <Text
              style={[
                styles.entryAmount,
                { color: isTheyOwe ? colors.positive : colors.negative },
              ]}
            >
              {isTheyOwe ? '+' : '-'}
              {formatAmount(item.amount)}
            </Text>
          </View>
        </ThemedCard>
      </AnimatedListItem>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <LinearGradient
            colors={[`${colors.primary}22`, `${colors.primary}08`]}
            style={styles.emptyIconCircle}
          >
            <Ionicons
              name="document-text-outline"
              size={36}
              color={colors.primary}
            />
          </LinearGradient>
        </View>
        <Text style={styles.emptyTitle}>{t('daftar.noEntries')}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPositive = netBalance >= 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      <Animated.View style={entrance.style}>
        {/* Gradient Hero Balance Card */}
        <LinearGradient
          colors={colors.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>{t('daftar.netBalance')}</Text>
          <Text
            style={[
              styles.balanceAmount,
              netBalance === 0
                ? styles.balanceAmountNeutral
                : isPositive
                ? styles.balanceAmountPositive
                : styles.balanceAmountNegative,
            ]}
          >
            {formatAmount(Math.abs(netBalance))}
          </Text>
          <Text style={styles.balanceDirection}>
            {netBalance === 0
              ? t('daftar.settledUp')
              : isPositive
              ? t('daftar.owesYou')
              : t('daftar.youOwe')}
          </Text>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <FunButton
            title={t('daftar.settle')}
            onPress={handleSettle}
            loading={settling}
            disabled={netBalance === 0}
            style={styles.actionBtn}
            icon={
              <Ionicons
                name="checkmark-done-outline"
                size={18}
                color="#FFFFFF"
              />
            }
          />
          <FunButton
            title={t('daftar.addEntry')}
            onPress={() => navigation.navigate('AddDaftarEntry')}
            variant="secondary"
            style={styles.actionBtn}
            icon={
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={isDark ? colors.primaryLight : colors.primary}
              />
            }
          />
        </View>
      </Animated.View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Hero balance */
    balanceCard: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg,
      borderRadius: Radius.xl,
      padding: Spacing.xxl,
      alignItems: 'center',
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0 : 0.14,
      shadowRadius: 28,
      elevation: isDark ? 0 : 10,
    },
    balanceLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    balanceAmount: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      letterSpacing: -1,
    },
    balanceAmountPositive: {
      color: isDark ? '#F5E6A8' : c.accentLight,
    },
    balanceAmountNegative: {
      color: c.dangerLight,
    },
    balanceAmountNeutral: {
      color: '#FFFFFF',
    },
    balanceDirection: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      marginTop: Spacing.sm,
      color: 'rgba(255,255,255,0.8)',
    },

    /* Action buttons */
    actionRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    actionBtn: {
      flex: 1,
    },

    /* List */
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxxl,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Entry cards */
    entryCard: {
      marginBottom: Spacing.sm,
    },
    entryCardSettled: {
      opacity: 0.5,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    directionBadge: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    entryInfo: {
      flex: 1,
    },
    entryDirection: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    entryNote: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginTop: 2,
    },
    entryDate: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textTertiary,
      marginTop: 4,
    },
    entryAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      marginLeft: Spacing.sm,
    },

    /* Empty state */
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xxxl,
    },
    emptyIconWrap: {
      marginBottom: Spacing.xl,
    },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? c.border : c.borderLight,
    },
    emptyTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 18,
      color: c.textSecondary,
    },
  });
