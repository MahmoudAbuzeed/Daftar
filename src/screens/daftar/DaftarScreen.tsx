import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { DaftarEntry } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import useFabFloat from '../../hooks/useFabFloat';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width: SW } = Dimensions.get('window');

interface ContactSummary {
  contactName: string;
  netBalance: number;
  entryCount: number;
}

export default function DaftarScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const fabFloat = useFabFloat();

  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

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
        ([contactName, { net, count }]) => ({ contactName, netBalance: net, entryCount: count }),
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

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchEntries(); }, [fetchEntries]);

  const formatAmount = (amount: number): string => `${Math.abs(amount).toFixed(2)} ${t('common.egp')}`;

  const renderContact = ({ item, index }: { item: ContactSummary; index: number }) => {
    const isPositive = item.netBalance >= 0;
    return (
      <AnimatedListItem index={index}>
        <BouncyPressable onPress={() => navigation.navigate('DaftarContact', { contactName: item.contactName })}>
          <ThemedCard>
            <View style={[styles.cardAccent, { backgroundColor: isPositive ? colors.success : colors.danger }]} />

            <View style={styles.contactRow}>
              <View style={styles.cardLeft}>
                <LinearGradient
                  colors={isPositive ? colors.successGradient : colors.dangerGradient}
                  style={styles.contactAvatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.contactInitial}>{item.contactName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.contactName}</Text>
                  <View style={styles.contactEntriesRow}>
                    <Ionicons name="document-text-outline" size={11} color={colors.textTertiary} />
                    <Text style={styles.contactEntries}>
                      {' '}{item.entryCount} {item.entryCount === 1 ? t('daftar.entry') : t('daftar.entries')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.contactBalance}>
                <Text style={[styles.balanceAmount, { color: isPositive ? colors.positive : colors.negative }]}>
                  {formatAmount(item.netBalance)}
                </Text>
                <View style={[styles.balanceBadge, { backgroundColor: isPositive ? `${colors.success}18` : `${colors.danger}18` }]}>
                  <Text style={[styles.balanceLabel, { color: isPositive ? colors.positive : colors.negative }]}>
                    {isPositive ? t('daftar.owesYou') : t('daftar.youOwe')}
                  </Text>
                </View>
              </View>
            </View>
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY: emptyBounce }] }]}>
          <LinearGradient
            colors={[`${colors.primary}22`, `${colors.primary}08`]}
            style={styles.emptyIconCircle}
          >
            <Ionicons name="book-outline" size={42} color={colors.primary} />
          </LinearGradient>
        </Animated.View>
        <Text style={styles.emptyTitle}>{t('daftar.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('daftar.emptySubtitle')}</Text>
      </View>
    );
  };

  const netTotal = totalOwedToYou - totalYouOwe;
  const isNetPositive = netTotal >= 0;

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
          <View>
            <Text style={styles.headerKicker}>{t('daftar.yourLedger')}</Text>
            <Text style={styles.headerTitle}>{t('daftar.title')}</Text>
          </View>
          <View style={styles.headerDecor}>
            <View style={styles.decorDiamond} />
          </View>
        </Animated.View>

        {/* Summary Card */}
        <View style={styles.summaryWrap}>
          <ThemedCard accent>
            <View style={styles.summaryAccent} />

            <View style={styles.summaryNet}>
              <Text style={styles.summaryNetLabel}>{t('daftar.net')}</Text>
              <Text style={[styles.summaryNetAmount, { color: isNetPositive ? colors.positive : colors.negative }]}>
                {isNetPositive ? '+' : '-'}{formatAmount(Math.abs(netTotal))}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <LinearGradient
                  colors={colors.successGradient}
                  style={styles.summaryDot}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.summarySmLabel}>{t('daftar.owedToYou')}</Text>
                <Text style={[styles.summarySmAmount, { color: colors.positive }]}>{formatAmount(totalOwedToYou)}</Text>
              </View>
              <View style={styles.summaryColSep} />
              <View style={styles.summaryCol}>
                <LinearGradient
                  colors={colors.dangerGradient}
                  style={styles.summaryDot}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.summarySmLabel}>{t('daftar.youOweTotal')}</Text>
                <Text style={[styles.summarySmAmount, { color: colors.negative }]}>{formatAmount(totalYouOwe)}</Text>
              </View>
            </View>
          </ThemedCard>
        </View>

        {contacts.length > 0 && (
          <View style={styles.listLabel}>
            <View style={styles.listLabelLine} />
            <Text style={styles.listLabelText}>{t('daftar.contactCount', { count: contacts.length })}</Text>
            <View style={styles.listLabelLine} />
          </View>
        )}

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.contactName}
          renderItem={renderContact}
          contentContainerStyle={contacts.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        />

        <Animated.View style={[styles.fab, { transform: [{ translateY: fabFloat }] }]}>
          <BouncyPressable onPress={() => navigation.navigate('AddDaftarEntry')}>
            <LinearGradient
              colors={colors.primaryGradient}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    bgOrb: {
      position: 'absolute',
      width: SW * 0.8,
      height: SW * 0.8,
      borderRadius: SW * 0.4,
      backgroundColor: isDark ? 'rgba(27,122,108,0.06)' : 'rgba(13,148,136,0.04)',
      top: -SW * 0.1,
      right: -SW * 0.3,
    },
    bgOrbSmall: {
      position: 'absolute',
      width: SW * 0.35,
      height: SW * 0.35,
      borderRadius: SW * 0.175,
      backgroundColor: isDark ? 'rgba(201,162,39,0.04)' : 'rgba(201,162,39,0.03)',
      bottom: SW * 0.05,
      left: -SW * 0.1,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
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
    headerDecor: { marginBottom: 8 },
    decorDiamond: {
      width: 10,
      height: 10,
      backgroundColor: c.accent,
      transform: [{ rotate: '45deg' }],
      opacity: 0.8,
    },

    summaryWrap: {
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    summaryAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: c.accent,
      opacity: 0.65,
    },
    summaryNet: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    summaryNetLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.kicker,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    summaryNetAmount: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      letterSpacing: -1,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
      marginBottom: Spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
    },
    summaryColSep: {
      width: 1,
      height: 36,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.borderLight,
      alignSelf: 'center',
    },
    summaryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginBottom: 6,
    },
    summarySmLabel: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.textTertiary,
      marginBottom: 4,
    },
    summarySmAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: -0.3,
    },

    listLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    listLabelLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? c.borderLight : c.border,
    },
    listLabelText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 3,
      color: c.textTertiary,
      textTransform: 'uppercase',
    },
    list: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: 160,
      gap: Spacing.md,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      opacity: 0.7,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    contactAvatar: {
      width: 46,
      height: 46,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.lg,
    },
    contactInitial: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      color: '#FFFFFF',
    },
    contactInfo: { flex: 1 },
    contactName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
      letterSpacing: -0.2,
    },
    contactEntriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    contactEntries: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 12,
      color: c.textTertiary,
    },
    contactBalance: {
      alignItems: 'flex-end',
      marginLeft: Spacing.md,
    },
    balanceAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: -0.3,
    },
    balanceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radius.full,
      marginTop: 3,
    },
    balanceLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 0.3,
    },

    emptyState: { alignItems: 'center', paddingHorizontal: Spacing.xxxl },
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
    emptySubtitle: {
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
