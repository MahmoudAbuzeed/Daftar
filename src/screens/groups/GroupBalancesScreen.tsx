import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Balance, User, Settlement } from '../../types/database';
import { simplifyDebts, formatCurrency } from '../../utils/balance';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupBalances'>;

type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'bank';

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string }[] = [
  { key: 'cash', labelKey: 'settlements.cash' },
  { key: 'vodafone_cash', labelKey: 'settlements.vodafone_cash' },
  { key: 'instapay', labelKey: 'settlements.instapay' },
  { key: 'bank', labelKey: 'settlements.bank' },
];

export default function GroupBalancesScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();

  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  // Settlement modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<SimplifiedDebt | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

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
          userMap.set(m.user_id, m.user as User);
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
    setSelectedDebt(debt);
    setSettlementAmount(debt.net_amount.toFixed(2));
    setPaymentMethod('cash');
    setModalVisible(true);
  };

  const handleSettle = async () => {
    if (!user || !selectedDebt) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('groups.invalidAmount'));
      return;
    }

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

      setModalVisible(false);
      setSelectedDebt(null);
      fetchBalances();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSettling(false);
    }
  };

  const getUserName = (userId: string, userData?: User): string => {
    if (userId === user?.id) return t('common.you');
    return userData?.display_name || t('common.unknown');
  };

  const renderDebtRow = ({ item }: { item: SimplifiedDebt }) => {
    const fromName = getUserName(item.from_user, item.from_user_data);
    const toName = getUserName(item.to_user, item.to_user_data);
    const canSettle =
      item.from_user === user?.id || item.to_user === user?.id;

    return (
      <View style={styles.debtRow}>
        <View style={styles.debtRowLeft}>
          <View style={styles.avatarRow}>
            <LinearGradient
              colors={Gradients.danger}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {(item.from_user_data?.display_name || '?').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrowText}>{'\u2192'}</Text>
            </View>
            <LinearGradient
              colors={Gradients.success}
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
          <TouchableOpacity
            style={styles.settleButton}
            activeOpacity={0.7}
            onPress={() => openSettleModal(item)}
          >
            <LinearGradient
              colors={Gradients.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.settleButtonGradient}
            >
              <Text style={styles.settleButtonText}>{t('daftar.settle')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
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
        style={styles.headerBar}
      >
        <Text style={styles.headerTitle}>{t('groups.balances')}</Text>
        <Text style={styles.headerSubtitle}>
          {debts.length === 0
            ? t('groups.settled_up')
            : `${debts.length} ${debts.length === 1 ? t('groups.payment') : t('groups.payments')}`}
        </Text>
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
            <Text style={styles.emptyIcon}>{'\uD83C\uDF89'}</Text>
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
                    colors={Gradients.danger}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalAvatar}
                  >
                    <Text style={styles.modalAvatarText}>
                      {(selectedDebt.from_user_data?.display_name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.modalArrow}>{'\u2192'}</Text>
                  <LinearGradient
                    colors={Gradients.success}
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
                      {' \u2192 '}
                      {getUserName(selectedDebt.to_user, selectedDebt.to_user_data)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Amount */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{t('settlements.amount')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={settlementAmount}
                  onChangeText={setSettlementAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* Payment Method */}
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>{t('settlements.method')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.methodRow}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      style={[
                        styles.methodChip,
                        paymentMethod === m.key && styles.methodChipActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setPaymentMethod(m.key)}
                    >
                      <Text
                        style={[
                          styles.methodChipText,
                          paymentMethod === m.key && styles.methodChipTextActive,
                        ]}
                      >
                        {t(m.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.confirmButton}
                activeOpacity={0.8}
                onPress={handleSettle}
                disabled={settling}
              >
                {settling ? (
                  <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {t('settlements.confirm')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.7}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
  // Gradient header
  headerBar: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: Colors.textOnDark,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textOnDark,
    opacity: 0.7,
    marginTop: Spacing.xs,
    fontWeight: '500',
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  // Debt row card
  debtRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.md,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  arrowContainer: {
    width: 24,
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  debtRowText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  debtRowName: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  debtRowAmount: {
    ...Typography.amount,
    color: Colors.danger,
  },
  // Settle button
  settleButton: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  settleButtonGradient: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  settleButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xxl,
    paddingBottom: 40,
    ...Shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.md,
  },
  modalDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  modalAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  modalArrow: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  modalDirectionNames: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalField: {
    marginBottom: Spacing.xl,
  },
  modalLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  methodChip: {
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  methodChipActive: {
    backgroundColor: Colors.primary,
  },
  methodChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  methodChipTextActive: {
    color: Colors.textOnPrimary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
    ...Shadows.glow,
  },
  confirmButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.xs,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
