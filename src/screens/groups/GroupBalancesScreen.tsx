import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Animated,
  I18nManager,
  AppState,
  AppStateStatus,
  Share,
} from 'react-native';
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
import { Balance, User, PaymentMethod } from '../../types/database';
import { simplifyDebts } from '../../utils/balance';
import { Spacing, Radius, FontFamily, tabularNums } from '../../theme';
import { displayFor } from '../../theme/fonts';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import PageScaffold from '../../components/PageScaffold';
import EditorialHeader from '../../components/EditorialHeader';
import EmptyState from '../../components/EmptyState';
import StateScreen from '../../components/StateScreen';
import AmountText from '../../components/AmountText';
import { useAlert } from '../../hooks/useAlert';
import { generateBalanceSummary, shareViaWhatsApp } from '../../utils/whatsapp';
import { sendNotificationsToUsers, saveInAppNotification } from '../../lib/notifications';
import { checkDebtFree } from '../../lib/achievements';
import {
  getPaymentDeepLink,
  canAttemptDeepLink,
  generatePaymentShareText,
  launchPaymentDeepLink,
  isInstantMethod,
  getInstapaySchemes,
} from '../../lib/paymentLinks';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupBalances'>;

interface SimplifiedDebt extends Balance {
  from_user_data?: User;
  to_user_data?: User;
}

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cash', labelKey: 'settlements.cash', icon: 'cash-outline' },
  { key: 'bank', labelKey: 'settlements.bank', icon: 'business-outline' },
  { key: 'paypal', labelKey: 'settlements.paypal', icon: 'logo-paypal' },
  { key: 'apple_pay', labelKey: 'settlements.apple_pay', icon: 'logo-apple' },
  { key: 'google_pay', labelKey: 'settlements.google_pay', icon: 'logo-google' },
  { key: 'vodafone_cash', labelKey: 'settlements.vodafone_cash', icon: 'phone-portrait-outline' },
  { key: 'instapay', labelKey: 'settlements.instapay', icon: 'flash-outline' },
  { key: 'wise', labelKey: 'settlements.wise', icon: 'swap-horizontal-outline' },
  { key: 'venmo', labelKey: 'settlements.venmo', icon: 'card-outline' },
  { key: 'other', labelKey: 'settlements.other', icon: 'ellipsis-horizontal-outline' },
];

// Avatar gradient hash for member initials
const AVATAR_GRADIENTS: [string, string][] = [
  ['#0D9488', '#14B8A6'],
  ['#7C3AED', '#A78BFA'],
  ['#DB2777', '#F472B6'],
  ['#2563EB', '#60A5FA'],
  ['#D97706', '#FBBF24'],
  ['#059669', '#34D399'],
];
function avatarGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function GroupBalancesScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [debts, setDebts] = useState<SimplifiedDebt[]>([]);
  const [currency, setCurrency] = useState<string>('EGP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  // Settlement modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<SimplifiedDebt | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Payment flow state machine
  const [modalStep, setModalStep] = useState<'configure' | 'launching' | 'return_confirm'>('configure');
  const [pendingExternalPayment, setPendingExternalPayment] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [launchTime, setLaunchTime] = useState<number | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
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
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [user, groupId, t]);

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances])
  );

  // AppState listener for return from payment app
  useEffect(() => {
    if (!pendingExternalPayment) return;

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // Debounce to avoid false triggers from launch
        setTimeout(() => {
          setModalStep('return_confirm');
        }, 500);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pendingExternalPayment]);

  const openSettleModal = (debt: SimplifiedDebt) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDebt(debt);
    setSettlementAmount(debt.net_amount.toFixed(2));
    setPaymentMethod('cash');
    setModalStep('configure');
    setPaymentReference('');
    setRecipientPhone('');
    setPendingExternalPayment(false);
    setLaunchTime(null);
    setModalVisible(true);
  };

  const handleSettle = async (forceImmediate: boolean = false) => {
    if (!user || !selectedDebt) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      alert.error(t('common.error'), t('groups.invalidAmount'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSettling(true);

    try {
      const isInstant = isInstantMethod(paymentMethod) || forceImmediate;
      const baseInsert = {
        group_id: groupId,
        paid_by: selectedDebt.from_user,
        paid_to: selectedDebt.to_user,
        amount,
        currency,
        method: paymentMethod,
        note: null,
        status: isInstant ? ('completed' as const) : ('pending' as const),
        payment_reference: paymentReference || null,
        initiated_at: isInstant ? null : new Date().toISOString(),
      };

      const { error } = await supabase.from('settlements').insert(baseInsert);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // For external payment methods, launch deep link and wait for return
      if (!isInstant) {
        const deepLink = getPaymentDeepLink(
          paymentMethod,
          amount,
          currency,
          recipientPhone || undefined
        );

        if (deepLink.type === 'url') {
          setLaunchTime(Date.now());
          setPendingExternalPayment(true);
          setModalStep('launching');
          await launchPaymentDeepLink(deepLink.url);
          return; // Don't proceed to settlement notification yet
        }
      }

      // For instant methods or if no deep link, complete settlement immediately
      await completeSettlement(amount);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('common.error'), err.message || t('common.error'));
    } finally {
      setSettling(false);
    }
  };

  const completeSettlement = async (amount: number) => {
    if (!user || !selectedDebt) return;

    // Check for debt-free achievement
    await checkDebtFree(selectedDebt.from_user, groupId);

    // Insert system message to group chat
    const fromUserName = selectedDebt.from_user_data?.display_name || 'Someone';
    const toUserName = selectedDebt.to_user_data?.display_name || 'Someone';
    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user!.id,
      content: `${fromUserName} settled ${amount.toFixed(2)} ${currency} with ${toUserName}`,
      type: 'settlement',
      metadata: { from_user: selectedDebt.from_user, to_user: selectedDebt.to_user, amount, currency },
    });

    // Send notification to the person who was paid
    const toUserId = selectedDebt.to_user;
    const lang = i18n.language === 'ar' ? 'ar' : 'en';

    const title = lang === 'ar' ? 'تم السداد' : 'Payment received';
    const body = lang === 'ar'
      ? `${fromUserName} دفع لك ${amount} ${currency}`
      : `${fromUserName} paid you ${amount} ${currency}`;

    await sendNotificationsToUsers({
      userIds: [toUserId],
      title,
      body,
      data: { groupId, type: 'settlement' },
    });

    await saveInAppNotification(
      toUserId,
      'settlement',
      title,
      body,
      { groupId }
    );

    setModalVisible(false);
    setSelectedDebt(null);
    setPendingExternalPayment(false);
    setModalStep('configure');
    fetchBalances();
  };

  const getUserName = (userId: string, userData?: User): string => {
    if (userId === user?.id) return t('common.you');
    return userData?.display_name || t('common.unknown');
  };

  const renderDebtRow = ({ item, index }: { item: SimplifiedDebt; index: number }) => {
    const fromName = getUserName(item.from_user, item.from_user_data);
    const toName = getUserName(item.to_user, item.to_user_data);
    const canSettle = item.from_user === user?.id || item.to_user === user?.id;
    const userPays = item.from_user === user?.id;
    const fromGrad = avatarGradient(fromName);
    const toGrad = avatarGradient(toName);

    return (
      <AnimatedListItem index={index}>
        <ThemedCard style={styles.debtRow}>
          <View style={styles.avatarRow}>
            <LinearGradient
              colors={fromGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                {initials(fromName)}
              </Text>
            </LinearGradient>
            <View style={styles.arrowCircle}>
              <Ionicons
                name={I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'}
                size={14}
                color={colors.textTertiary}
              />
            </View>
            <LinearGradient
              colors={toGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                {initials(toName)}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.debtRowMiddle}>
            <Text style={styles.debtRowText} numberOfLines={1}>
              <Text style={styles.debtRowName}>{fromName}</Text>
              {` ${t('groups.owes')} `}
              <Text style={styles.debtRowName}>{toName}</Text>
            </Text>
            <AmountText
              amount={item.net_amount}
              currency={currency}
              variant="amount"
              tone={userPays ? 'owe' : 'owed'}
              signMode="absolute"
            />
          </View>
          {canSettle && (
            <FunButton
              title={t('ledger.settle')}
              onPress={() => openSettleModal(item)}
              variant="primary"
              size="small"
              icon={<Ionicons name="checkmark-circle-outline" size={16} color={colors.textOnPrimary} />}
              style={styles.settleButtonWrap}
            />
          )}
        </ThemedCard>
      </AnimatedListItem>
    );
  };

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
        <StateScreen variant="error" body={error} onRetry={fetchBalances} />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold decor>
      <EditorialHeader
        kicker={
          debts.length === 0
            ? t('groups.allClear', 'All clear')
            : `${debts.length} ${debts.length === 1 ? t('groups.payment') : t('groups.payments')}`
        }
        title={t('groups.balances')}
      />

      {/* Remind All button - only if others owe the current user */}
      {debts.some((d) => d.to_user === user?.id) && (
        <View style={styles.remindAllRow}>
          <BouncyPressable
            onPress={() => {
              const lang = i18n.language === 'ar' ? 'ar' : 'en';
              const myDebts = debts
                .filter((d) => d.to_user === user?.id)
                .map((d) => ({
                  from: d.from_user_data?.display_name || '?',
                  to: d.to_user_data?.display_name || '?',
                  amount: d.net_amount,
                  currency,
                }));
              const groupName = '';
              const message = generateBalanceSummary(groupName, myDebts, lang as 'en' | 'ar');
              shareViaWhatsApp(message);
            }}
            scaleDown={0.95}
          >
            <View style={styles.remindAllBtn}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
              <Text style={styles.remindAllText}>{t('groups.remindAll')}</Text>
            </View>
          </BouncyPressable>
        </View>
      )}

      <FlatList
        data={debts}
        keyExtractor={(item, idx) => `${item.from_user}-${item.to_user}-${idx}`}
        renderItem={renderDebtRow}
        contentContainerStyle={
          debts.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title={t('groups.settled_up')}
            body={t('groups.allClearBody', 'No outstanding balances. Everyone is square.')}
          />
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

              <Text style={[styles.modalTitle, { fontFamily: displayFor(i18n.language, 'bold') }]}>{t('settlements.record')}</Text>

              {/* CONFIGURE STEP - Main settlement form */}
              {modalStep === 'configure' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
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
                            Haptics.selectionAsync();
                            setPaymentMethod(m.key);
                            if (m.key !== 'instapay') {
                              setRecipientPhone('');
                            }
                          }}
                          scaleDown={0.95}
                        >
                          <View
                            style={[
                              styles.methodChip,
                              paymentMethod === m.key && styles.methodChipActive,
                            ]}
                          >
                            <Ionicons
                              name={m.icon}
                              size={14}
                              color={paymentMethod === m.key ? colors.textOnPrimary : colors.textTertiary}
                              style={{ marginEnd: 6 }}
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

                  {/* InstaPay recipient phone field */}
                  {paymentMethod === 'instapay' && (
                    <ThemedInput
                      label={t('settlements.recipientPhone')}
                      value={recipientPhone}
                      onChangeText={setRecipientPhone}
                      keyboardType="phone-pad"
                      placeholder="01012345678"
                      containerStyle={styles.modalField}
                    />
                  )}

                  {/* Payment reference field (optional) */}
                  {paymentMethod !== 'cash' && paymentMethod !== 'apple_pay' && (
                    <ThemedInput
                      label={paymentMethod === 'instapay' ? t('settlements.transferRef') : t('settlements.transferRef')}
                      value={paymentReference}
                      onChangeText={setPaymentReference}
                      placeholder={t('common.optional')}
                      containerStyle={styles.modalField}
                    />
                  )}

                  {/* Action Buttons */}
                  <View style={styles.modalButtonRow}>
                    <FunButton
                      title={t('settlements.confirm')}
                      onPress={() => handleSettle()}
                      loading={settling}
                      icon={<Ionicons name="checkmark-circle" size={20} color={colors.textOnPrimary} />}
                      style={{ flex: 1, marginRight: Spacing.sm }}
                    />
                    {paymentMethod !== 'cash' && paymentMethod !== 'apple_pay' && (
                      <FunButton
                        title={t('settlements.shareRequest')}
                        onPress={async () => {
                          const amount = parseFloat(settlementAmount);
                          if (isNaN(amount) || amount <= 0) {
                            alert.error(t('common.error'), t('groups.invalidAmount'));
                            return;
                          }
                          const shareText = generatePaymentShareText({
                            fromName: selectedDebt?.from_user_data?.display_name || '?',
                            toName: selectedDebt?.to_user_data?.display_name || '?',
                            recipientPhone: recipientPhone || null,
                            amount,
                            currency,
                            method: paymentMethod,
                            lang: i18n.language === 'ar' ? 'ar' : 'en',
                          });
                          try {
                            await Share.share({
                              message: shareText,
                              url: undefined,
                              title: t('settlements.shareRequest'),
                            });
                          } catch (err) {
                            // User dismissed share sheet
                          }
                        }}
                        variant="secondary"
                        icon={<Ionicons name="share-social-outline" size={20} color={colors.primary} />}
                        style={{ flex: 1 }}
                      />
                    )}
                  </View>

                  <BouncyPressable
                    onPress={() => setModalVisible(false)}
                    scaleDown={0.97}
                  >
                    <View style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                    </View>
                  </BouncyPressable>
                </ScrollView>
              )}

              {/* LAUNCHING STEP - Payment app opening */}
              {modalStep === 'launching' && (
                <View style={styles.launchingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: Spacing.lg }} />
                  <Text style={styles.launchingText}>{t('settlements.launching')}</Text>
                </View>
              )}

              {/* RETURN_CONFIRM STEP - Payment confirmation */}
              {modalStep === 'return_confirm' && (
                <View style={styles.confirmContainer}>
                  <LinearGradient
                    colors={colors.successGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.confirmIconCircle}
                  >
                    <Ionicons name="checkmark-outline" size={48} color={colors.textOnPrimary} />
                  </LinearGradient>
                  <Text style={styles.confirmTitle}>{t('settlements.returnConfirmTitle')}</Text>
                  <Text style={styles.confirmBody}>
                    {t('settlements.returnConfirmBody', {
                      amount: parseFloat(settlementAmount).toFixed(2),
                      currency,
                      method: t(`settlements.${paymentMethod}`),
                    })}
                  </Text>

                  <View style={styles.confirmButtonRow}>
                    <FunButton
                      title={t('settlements.yesIPaid')}
                      onPress={async () => {
                        const amount = parseFloat(settlementAmount);
                        await completeSettlement(amount);
                      }}
                      icon={<Ionicons name="checkmark-circle" size={20} color={colors.textOnPrimary} />}
                      style={{ flex: 1, marginRight: Spacing.sm }}
                    />
                    <FunButton
                      title={t('settlements.noCancel')}
                      onPress={() => {
                        setModalStep('configure');
                        setPendingExternalPayment(false);
                      }}
                      variant="secondary"
                      icon={<Ionicons name="close-outline" size={20} color={colors.primary} />}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    // Remind All
    remindAllRow: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
    },
    remindAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(37,211,102,0.1)' : '#E8F8EE',
    },
    remindAllText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.success,
    },
    // List
    list: {
      padding: Spacing.lg,
      paddingTop: Spacing.md,
    },
    emptyList: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
    },
    // Debt row card — horizontal: avatars · text+amount · settle button
    debtRow: {
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 13,
      color: c.textOnPrimary,
      letterSpacing: -0.3,
    },
    arrowCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    debtRowMiddle: {
      flex: 1,
      gap: 4,
    },
    debtRowText: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textSecondary,
    },
    debtRowName: {
      fontFamily: FontFamily.bodyBold,
      color: c.text,
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
      fontSize: 26,
      letterSpacing: -0.4,
      lineHeight: 30,
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
      marginStart: Spacing.sm,
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
    },
    methodChipActive: {
      backgroundColor: c.primary,
    },
    methodChipText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
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
    // Payment flow states
    launchingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.xxxl,
      paddingHorizontal: Spacing.xl,
    },
    launchingText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    confirmContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.xl,
    },
    confirmIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.lg,
      shadowColor: c.success,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 8,
    },
    confirmTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      letterSpacing: -0.3,
      color: c.text,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    confirmBody: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    confirmButtonRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
  });
