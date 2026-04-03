import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  ScrollView,
  Animated,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Balance, User } from '../../types/database';
import { simplifyDebts, formatCurrency } from '../../utils/balance';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupBalances'>;

type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'bank';

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string; icon: string }[] = [
  { key: 'cash', labelKey: 'settlements.cash', icon: 'cash-outline' },
  { key: 'vodafone_cash', labelKey: 'settlements.vodafone_cash', icon: 'phone-portrait-outline' },
  { key: 'instapay', labelKey: 'settlements.instapay', icon: 'flash-outline' },
  { key: 'bank', labelKey: 'settlements.bank', icon: 'business-outline' },
];

export default function GroupBalancesScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  // Settlement modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<SimplifiedDebt | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const entrance = useScreenEntrance();

  const fetchBalances = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch group currency
      const { data: group } = await supabase
        .from('groups')
        .select('currency')
        .eq('id', groupId)
        .single();

      if (group) setCurrency(group.currency);

      // Fetch members
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, user:users(*)')
        .eq('group_id', groupId);

      const userMap = new Map<string, User>();
      for (const m of members || []) {
        if (m.user) {
          userMap.set(m.user_id, m.user as unknown as User);
        }
      }

      // Fetch expenses with splits
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, paid_by, splits:expense_splits(user_id, amount)')
        .eq('group_id', groupId)
        .eq('is_deleted', false);

      // Fetch settlements
      const { data: settlements } = await supabase
        .from('settlements')
        .select('paid_by, paid_to, amount')
        .eq('group_id', groupId);

      // Build raw balances
      const rawBalances: Balance[] = [];

      for (const expense of expenses || []) {
        for (const split of expense.splits || []) {
          if (split.user_id !== expense.paid_by) {
            rawBalances.push({
              from_user: split.user_id,
              to_user: expense.paid_by,
              net_amount: split.amount,
            });
          }
        }
      }

      // Settlements offset
      for (const s of settlements || []) {
        rawBalances.push({
          from_user: s.paid_to,
          to_user: s.paid_by,
          net_amount: s.amount,
        });
      }

      const simplified = simplifyDebts(rawBalances);
      const enriched: SimplifiedDebt[] = simplified.map((d) => ({
        ...d,
        from_user_data: userMap.get(d.from_user),
        to_user_data: userMap.get(d.to_user),
      }));

      setDebts(enriched);
    } catch (err) {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, [user, groupId]);

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances])
  );

  const openSettleModal = (debt: SimplifiedDebt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDebt(debt);
    setSettlementAmount(debt.net_amount.toFixed(2));
    setPaymentMethod('cash');
    setModalVisible(true);
  };

  const handleSettle = async () => {
    if (!user || !selectedDebt) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      alert.error(t('common.error'), t('groups.invalidAmount'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSettling(true);

    try {
      const { error } = await supabase.from('settlements').insert({
        group_id: groupId,
        paid_by: selectedDebt.from_user,
        paid_to: selectedDebt.to_user,
        amount,
        currency,
        method: paymentMethod,
        note: null,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setSelectedDebt(null);
      fetchBalances();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('common.error'), err.message || t('common.error'));
    } finally {
      setSettling(false);
    }
  };

  const getUserName = (userId: string, userData?: User): string => {
    if (userId === user?.id) return t('common.you');
    return userData?.display_name || t('common.unknown');
  };

  const renderDebtRow = ({ item, index }: { item: SimplifiedDebt; index: number }) => {
    const fromName = getUserName(item.from_user, item.from_user_data);
    const toName = getUserName(item.to_user, item.to_user_data);
    const canSettle =
      item.from_user === user?.id || item.to_user === user?.id;

    return (
      <AnimatedListItem index={index}>
        <ThemedCard style={styles.debtRow}>
          <View style={styles.debtRowLeft}>
            <View style={styles.avatarRow}>
              <LinearGradient
                colors={colors.dangerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(item.from_user_data?.display_name || '?').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={styles.arrowCircle}>
                <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
              </View>
              <LinearGradient
                colors={colors.successGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(item.to_user_data?.display_name || '?').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.debtRowText}>
              <Text style={styles.debtRowName}>{fromName}</Text>
              {` ${t('groups.owes')} `}
              <Text style={styles.debtRowName}>{toName}</Text>
            </Text>
            <Text style={styles.debtRowAmount}>
              {formatCurrency(item.net_amount, currency)}
            </Text>
          </View>
          {canSettle && (
            <FunButton
              title={t('daftar.settle')}
              onPress={() => openSettleModal(item)}
              variant="primary"
              size="small"
              icon={<Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />}
              style={styles.settleButtonWrap}
            />
          )}
        </ThemedCard>
      </AnimatedListItem>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'light-content'} />

      <LinearGradient
        colors={colors.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBar}
      >
        <Animated.View style={entrance.style}>
          <Text style={styles.headerTitle}>{t('groups.balances')}</Text>
          <Text style={styles.headerSubtitle}>
            {debts.length === 0
              ? t('groups.settled_up')
              : `${debts.length} ${debts.length === 1 ? t('groups.payment') : t('groups.payments')}`}
          </Text>
        </Animated.View>
      </LinearGradient>

      <FlatList
        data={debts}
        keyExtractor={(item, idx) => `${item.from_user}-${item.to_user}-${idx}`}
        renderItem={renderDebtRow}
        contentContainerStyle={
          debts.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={colors.successGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconCircle}
            >
              <Ionicons name="checkmark-done-outline" size={36} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t('groups.settled_up')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('groups.settled_up')}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Settlement Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>{t('settlements.record')}</Text>

              {selectedDebt && (
                <View style={styles.modalDirectionRow}>
                  <LinearGradient
                    colors={colors.dangerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalAvatar}
                  >
                    <Text style={styles.modalAvatarText}>
                      {(selectedDebt.from_user_data?.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <View style={styles.modalArrow}>
                    <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
                  </View>
                  <LinearGradient
                    colors={colors.successGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalAvatar}
                  >
                    <Text style={styles.modalAvatarText}>
                      {(selectedDebt.to_user_data?.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <View style={styles.modalDirectionNames}>
                    <Text style={styles.modalSubtitle}>
                      {getUserName(selectedDebt.from_user, selectedDebt.from_user_data)}
                      {I18nManager.isRTL ? ' \u2190 ' : ' \u2192 '}
                      {getUserName(selectedDebt.to_user, selectedDebt.to_user_data)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Amount */}
              <ThemedInput
                label={t('settlements.amount')}
                value={settlementAmount}
                onChangeText={setSettlementAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                containerStyle={styles.modalField}
                style={styles.amountInputStyle}
              />

              {/* Payment Method pills */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{t('settlements.method')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.methodRow}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <BouncyPressable
                      key={m.key}
                      onPress={() => {
                        setPaymentMethod(m.key);
                      }}
                      scaleDown={0.93}
                    >
                      <View
                        style={[
                          styles.methodChip,
                          paymentMethod === m.key && styles.methodChipActive,
                        ]}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={14}
                          color={paymentMethod === m.key ? '#FFFFFF' : colors.textTertiary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.methodChipText,
                            paymentMethod === m.key && styles.methodChipTextActive,
                          ]}
                        >
                          {t(m.labelKey)}
                        </Text>
                      </View>
                    </BouncyPressable>
                  ))}
                </ScrollView>
              </View>

              {/* Confirm Button */}
              <FunButton
                title={t('settlements.confirm')}
                onPress={handleSettle}
                loading={settling}
                icon={<Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
                style={{ marginTop: Spacing.sm }}
              />

              <BouncyPressable
                onPress={() => setModalVisible(false)}
                scaleDown={0.97}
              >
                <View style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </View>
              </BouncyPressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
    // Gradient header
    headerBar: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      letterSpacing: -0.6,
      color: c.text,
    },
    headerSubtitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textSecondary,
      opacity: 0.7,
      marginTop: Spacing.xs,
    },
    // List
    list: {
      padding: Spacing.xl,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xxxl,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      letterSpacing: -0.3,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    emptySubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
    },
    // Debt row card
    debtRow: {
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    debtRowLeft: {
      flex: 1,
      marginRight: Spacing.md,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: c.textOnPrimary,
    },
    arrowCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    debtRowText: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: Spacing.xs,
    },
    debtRowName: {
      fontFamily: FontFamily.bodyBold,
      color: c.text,
    },
    debtRowAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 24,
      letterSpacing: -0.5,
      color: c.danger,
    },
    // Settle button
    settleButtonWrap: {
      // Wrapper for FunButton
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      padding: Spacing.xxl,
      paddingBottom: 40,
      borderWidth: isDark ? 1 : 0,
      borderColor: c.border,
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
      elevation: 10,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: c.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.xl,
    },
    modalTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 20,
      letterSpacing: -0.3,
      color: c.text,
      marginBottom: Spacing.md,
    },
    modalDirectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.xxl,
      gap: Spacing.sm,
    },
    modalAvatar: {
      width: 34,
      height: 34,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalAvatarText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: c.textOnPrimary,
    },
    modalArrow: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalDirectionNames: {
      flex: 1,
      marginLeft: Spacing.sm,
    },
    modalSubtitle: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: c.textSecondary,
    },
    modalField: {
      marginBottom: Spacing.xl,
    },
    modalLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    amountInputStyle: {
      fontSize: 20,
      fontFamily: FontFamily.bodyBold,
      letterSpacing: -0.3,
    },
    methodRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    methodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.borderLight,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
    },
    methodChipActive: {
      backgroundColor: c.primary,
    },
    methodChipText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.textTertiary,
    },
    methodChipTextActive: {
      color: c.textOnPrimary,
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: Spacing.xs,
    },
    cancelButtonText: {
      fontFamily: FontFamily.bodySemibold,
      color: c.textSecondary,
      fontSize: 15,
    },
  });
