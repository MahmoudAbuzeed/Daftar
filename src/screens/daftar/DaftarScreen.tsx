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
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { DaftarEntry } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ContactSummary {
  contactName: string;
  netBalance: number; // positive = they owe you, negative = you owe them
  entryCount: number;
}

export default function DaftarScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();

  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

  const fetchEntries = useCallback(async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('daftar_entries')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_settled', false);

      if (error) throw error;

      const entries = (data || []) as DaftarEntry[];
      const grouped = new Map<string, { net: number; count: number }>();

      for (const entry of entries) {
        const existing = grouped.get(entry.contact_name) || { net: 0, count: 0 };
        const amount = entry.direction === 'they_owe' ? entry.amount : -entry.amount;
        existing.net += amount;
        existing.count += 1;
        grouped.set(entry.contact_name, existing);
      }

      const summaries: ContactSummary[] = Array.from(grouped.entries()).map(
        ([contactName, { net, count }]) => ({
          contactName,
          netBalance: net,
          entryCount: count,
        })
      );

      summaries.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

      let owedToYou = 0;
      let youOwe = 0;
      for (const s of summaries) {
        if (s.netBalance > 0) owedToYou += s.netBalance;
        else youOwe += Math.abs(s.netBalance);
      }

      setContacts(summaries);
      setTotalOwedToYou(owedToYou);
      setTotalYouOwe(youOwe);
    } catch (err) {
      console.error('Failed to fetch daftar entries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, [fetchEntries]);

  const formatAmount = (amount: number): string => {
    return `${Math.abs(amount).toFixed(2)} ${t('common.egp')}`;
  };

  const renderContact = ({ item }: { item: ContactSummary }) => {
    const isPositive = item.netBalance >= 0;

    return (
      <TouchableOpacity
        style={[styles.contactCard, Shadows.sm]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('DaftarContact', { contactName: item.contactName })}
      >
        <LinearGradient
          colors={isPositive ? Gradients.success : Gradients.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.contactAvatar}
        >
          <Text style={styles.contactInitial}>
            {item.contactName.charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.contactName}</Text>
          <Text style={styles.contactEntries}>
            {item.entryCount} {item.entryCount === 1 ? t('daftar.entry') : t('daftar.entries')}
          </Text>
        </View>

        <View style={styles.contactBalance}>
          <View style={[styles.balanceChip, isPositive ? styles.balanceChipPositive : styles.balanceChipNegative]}>
            <Text style={[styles.balanceAmount, isPositive ? styles.positiveText : styles.negativeText]}>
              {formatAmount(item.netBalance)}
            </Text>
          </View>
          <Text style={[styles.balanceLabel, isPositive ? styles.positiveText : styles.negativeText]}>
            {isPositive ? t('daftar.owesYou') : t('daftar.youOwe')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={[Colors.primarySurface, '#E0E7FF']}
          style={styles.emptyIconCircle}
        >
          <Text style={styles.emptyIconEmoji}>{'\uD83D\uDCD2'}</Text>
        </LinearGradient>
        <Text style={styles.emptyTitle}>{t('daftar.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('daftar.emptySubtitle')}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgDark} />

      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{t('daftar.title')}</Text>
      </LinearGradient>

      {/* Summary Card - Dark Indigo Surface */}
      <View style={styles.summaryWrapper}>
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.summaryCard, Shadows.lg]}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>{t('daftar.owedToYou')}</Text>
              <Text style={styles.summaryAmountGold}>
                {formatAmount(totalOwedToYou)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>{t('daftar.youOweTotal')}</Text>
              <Text style={styles.summaryAmountRose}>
                {formatAmount(totalYouOwe)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.contactName}
        renderItem={renderContact}
        contentContainerStyle={contacts.length === 0 ? styles.emptyList : styles.list}
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, Shadows.glow]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AddDaftarEntry')}
      >
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: Colors.textOnDark,
  },
  summaryWrapper: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  summaryCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: Spacing.sm,
  },
  summaryAmountGold: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.accentLight,
    letterSpacing: -0.3,
  },
  summaryAmountRose: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dangerLight,
    letterSpacing: -0.3,
  },
  positiveText: {
    color: Colors.success,
  },
  negativeText: {
    color: Colors.danger,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  contactInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...Typography.cardTitle,
  },
  contactEntries: {
    ...Typography.caption,
    marginTop: 2,
  },
  contactBalance: {
    alignItems: 'flex-end',
  },
  balanceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  balanceChipPositive: {
    backgroundColor: Colors.successSurface,
  },
  balanceChipNegative: {
    backgroundColor: Colors.dangerSurface,
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyIconEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 28,
    color: Colors.textOnPrimary,
    fontWeight: '500',
    marginTop: -2,
  },
});
