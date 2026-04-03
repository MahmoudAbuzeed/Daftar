import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { DaftarEntry } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DaftarContact'>;

export default function DaftarContactScreen({ route, navigation }: Props) {
  const { contactName } = route.params;
  const { t } = useTranslation();
  const { profile } = useAuth();

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

    Alert.alert(
      t('daftar.settleTitle'),
      t('daftar.settleConfirm', { name: contactName, amount: Math.abs(netBalance).toFixed(2) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('daftar.settle'), onPress: performSettle },
      ]
    );
  };

  const performSettle = async () => {
    if (!profile) return;

    setSettling(true);

    try {
      // Create a counter-entry to zero out the balance
      const direction: 'i_owe' | 'they_owe' = netBalance > 0 ? 'i_owe' : 'they_owe';

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
      Alert.alert(t('common.error'), t('daftar.settleFailed'));
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

  const renderEntry = ({ item }: { item: DaftarEntry }) => {
    const isTheyOwe = item.direction === 'they_owe';

    return (
      <View style={[styles.entryCard, item.is_settled && styles.entryCardSettled]}>
        <View style={styles.entryRow}>
          {/* Gradient circle badge */}
          <LinearGradient
            colors={isTheyOwe ? [...Gradients.success] : [...Gradients.danger]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.directionBadge}
          >
            <Text style={styles.directionIcon}>
              {isTheyOwe ? '\u2193' : '\u2191'}
            </Text>
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
            <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
          </View>

          <Text style={[styles.entryAmount, isTheyOwe ? styles.greenText : styles.redText]}>
            {isTheyOwe ? '+' : '-'}{formatAmount(item.amount)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>{t('daftar.noEntries')}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPositive = netBalance >= 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

      {/* Gradient Hero Balance Card */}
      <LinearGradient
        colors={[...Gradients.hero]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>{t('daftar.netBalance')}</Text>
        <Text style={[
          styles.balanceAmount,
          netBalance === 0
            ? styles.balanceAmountNeutral
            : isPositive
            ? styles.balanceAmountPositive
            : styles.balanceAmountNegative,
        ]}>
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
        <TouchableOpacity
          style={[styles.settleButton, netBalance === 0 && styles.settleButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleSettle}
          disabled={netBalance === 0 || settling}
        >
          {settling ? (
            <ActivityIndicator color={Colors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.settleButtonText}>{t('daftar.settle')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addEntryButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AddDaftarEntry')}
        >
          <Text style={styles.addEntryButtonText}>{t('daftar.addEntry')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  balanceLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  balanceAmount: {
    ...Typography.amountLarge,
  },
  balanceAmountPositive: {
    color: Colors.accentLight,
  },
  balanceAmountNegative: {
    color: Colors.dangerLight,
  },
  balanceAmountNeutral: {
    color: Colors.textOnDark,
  },
  balanceDirection: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.sm,
    color: Colors.textOnDark,
    opacity: 0.8,
  },
  greenText: {
    color: Colors.success,
  },
  redText: {
    color: Colors.danger,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  settleButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.glow,
  },
  settleButtonDisabled: {
    backgroundColor: Colors.primaryLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  settleButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
    fontSize: 15,
  },
  addEntryButton: {
    flex: 1,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addEntryButtonText: {
    color: Colors.primary,
    ...Typography.button,
    fontSize: 15,
  },
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
  entryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.md,
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
  directionIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  entryInfo: {
    flex: 1,
  },
  entryDirection: {
    ...Typography.bodyBold,
  },
  entryNote: {
    ...Typography.caption,
    marginTop: 2,
  },
  entryDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
