import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch,
  Animated,
  Image,
  I18nManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { GroupMember, User } from '../../types/database';
import { Spacing, Radius, FontFamily, tabularNums } from '../../theme';
import { displayFor } from '../../theme/fonts';
import AnimatedListItem from '../../components/AnimatedListItem';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import SegmentedControl from '../../components/SegmentedControl';
import SectionDivider from '../../components/SectionDivider';
import AmountText from '../../components/AmountText';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generatePaymentNotification, shareViaWhatsApp } from '../../utils/whatsapp';
import { sendNotificationsToUsers, saveInAppNotification } from '../../lib/notifications';
import { checkFirstExpense, awardAchievement } from '../../lib/achievements';
import { formatCurrency } from '../../utils/balance';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;
type SplitType = 'equal' | 'exact' | 'percentage';

interface MemberSplit {
  userId: string;
  displayName: string;
  included: boolean;
  amount: number;
  percentage: number;
}

// Avatar gradient hash
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

function categorizeExpense(description: string): string | null {
  const desc = description.toLowerCase();
  const categories: Record<string, string[]> = {
    'Food & Dining': ['restaurant','food','lunch','dinner','breakfast','cafe','coffee','pizza','burger','sushi','shawarma','koshary','foul','ta3meya','falafel','meal','eat','snack','bakery','dessert','ice cream','juice','drink','bar','grill','bbq','chicken','meat','fish','delivery','talabat','elmenus'],
    'Groceries': ['grocery','groceries','supermarket','carrefour','spinneys','hyper','market','vegetables','fruits','milk','bread','eggs'],
    'Transport': ['uber','careem','taxi','bus','metro','fuel','gas','petrol','parking','toll','ride','swvl','indriver','transport'],
    'Shopping': ['shopping','clothes','shoes','electronics','amazon','noon','jumia','gift','present','mall'],
    'Bills & Utilities': ['bill','electricity','water','internet','wifi','phone','mobile','rent','subscription','netflix','spotify'],
    'Entertainment': ['movie','cinema','game','concert','ticket','party','club','bowling','karaoke','fun','outing'],
    'Health': ['pharmacy','medicine','doctor','hospital','clinic','dental','gym','health','medical'],
    'Travel': ['hotel','flight','airbnb','travel','trip','vacation','booking','resort','sahel','gouna'],
  };
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) return category;
    }
  }
  return null;
}

export default function AddExpenseScreen({ route, navigation }: Props) {
  const { groupId, prefillAmount, prefillDescription, prefillSplitType } = route.params;
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [description, setDescription] = useState(prefillDescription || '');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState(prefillAmount ? prefillAmount.toString() : '');
  const [currency, setCurrency] = useState<string>('EGP');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>((prefillSplitType as SplitType) || 'equal');
  const [memberSplits, setMemberSplits] = useState<MemberSplit[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paidByPickerOpen, setPaidByPickerOpen] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const entrance = useScreenEntrance();

  useEffect(() => {
    fetchGroupData();
  }, []);

  const fetchGroupData = async () => {
    try {
      const { data: group } = await supabase.from('groups').select('currency').eq('id', groupId).single();
      if (group) setCurrency(group.currency);

      const { data: membersData, error } = await supabase
        .from('group_members').select('*, user:users(*)').eq('group_id', groupId);
      if (error) throw error;

      setMembers(membersData || []);
      if (user) setPaidBy(user.id);

      const splits: MemberSplit[] = (membersData || []).map((m) => ({
        userId: m.user_id,
        displayName: (m.user as User)?.display_name || t('common.unknown'),
        included: true,
        amount: 0,
        percentage: 0,
      }));
      setMemberSplits(splits);
    } catch (err) {
      alert.error(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Recompute equal splits live as amount or member inclusion changes
  useEffect(() => {
    if (splitType !== 'equal') return;
    const totalAmount = parseFloat(amount) || 0;
    const includedMembers = memberSplits.filter((m) => m.included);
    const count = includedMembers.length;
    if (count === 0) return;

    const equalShare = Math.round((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - equalShare * count) * 100) / 100;

    setMemberSplits((prev) =>
      prev.map((m, i) => {
        if (!m.included) return { ...m, amount: 0 };
        const isFirst = i === prev.findIndex((p) => p.included);
        return {
          ...m,
          amount: isFirst ? equalShare + remainder : equalShare,
          percentage: Math.round((100 / count) * 100) / 100,
        };
      }),
    );
  }, [amount, splitType, memberSplits.map((m) => m.included).join(',')]);

  const toggleMemberInclusion = (userId: string) => {
    Haptics.selectionAsync();
    setMemberSplits((prev) => prev.map((m) => m.userId === userId ? { ...m, included: !m.included } : m));
  };

  const updateMemberAmount = (userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMemberSplits((prev) => prev.map((m) => m.userId === userId ? { ...m, amount: numValue } : m));
  };

  const updateMemberPercentage = (userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const totalAmount = parseFloat(amount) || 0;
    setMemberSplits((prev) => prev.map((m) =>
      m.userId === userId ? { ...m, percentage: numValue, amount: Math.round((totalAmount * numValue) / 100 * 100) / 100 } : m,
    ));
  };

  const totalAmount = parseFloat(amount) || 0;
  const includedSplits = memberSplits.filter((m) => m.included);
  const splitSum = includedSplits.reduce((s, m) => s + m.amount, 0);
  const pctSum = includedSplits.reduce((s, m) => s + m.percentage, 0);

  const getValidationError = (): string | null => {
    if (!description.trim()) return t('expenses.descriptionRequired');
    if (isNaN(totalAmount) || totalAmount <= 0) return t('expenses.invalidAmount');
    if (!paidBy) return t('expenses.selectPayer');
    if (includedSplits.length === 0) return t('expenses.atLeastOneMember');
    if (splitType === 'exact') {
      if (Math.abs(splitSum - totalAmount) > 0.02) return t('expenses.splitMismatch', { splitSum: splitSum.toFixed(2), total: totalAmount.toFixed(2) });
    }
    if (splitType === 'percentage') {
      if (Math.abs(pctSum - 100) > 0.1) return t('expenses.percentMismatch', { current: pctSum.toFixed(1) });
    }
    return null;
  };

  const handleSave = async () => {
    const error = getValidationError();
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      alert.error(t('common.error'), error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const category = categorizeExpense(description);

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId, paid_by: paidBy, description: description.trim(),
          total_amount: totalAmount, currency, category, split_type: splitType,
          receipt_image: receiptImage || null, notes: notes.trim() || null,
          ai_parsed: false, created_by: user!.id, is_deleted: false,
        })
        .select().single();

      if (expenseError) throw expenseError;

      const splitsToInsert = memberSplits
        .filter((m) => m.included && m.amount > 0)
        .map((m) => ({
          expense_id: expense.id, user_id: m.userId, amount: m.amount,
          percentage: splitType === 'percentage' ? m.percentage : null, is_settled: false,
        }));

      const { error: splitsError } = await supabase.from('expense_splits').insert(splitsToInsert);
      if (splitsError) throw splitsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await checkFirstExpense(user!.id);
      if (receiptImage) {
        await awardAchievement(user!.id, 'receipt_scanner');
      }

      const payerMember = members.find(m => m.user_id === paidBy);
      const payerName = (payerMember?.user as any)?.display_name || 'Someone';
      await supabase.from('group_messages').insert({
        group_id: groupId,
        user_id: user!.id,
        content: `${payerName} added '${description.trim()}' — ${totalAmount.toFixed(2)} ${currency}`,
        type: 'expense',
        metadata: { expense_id: expense.id, amount: totalAmount, currency, description },
      });

      const payerPhone = profile?.phone || null;
      const usersWhoOwe = splitsToInsert.filter(s => s.user_id !== paidBy);

      if (usersWhoOwe.length > 0) {
        const debtorIds = usersWhoOwe.map(s => s.user_id);
        const lang = i18n.language === 'ar' ? 'ar' : 'en';
        const title = lang === 'ar' ? 'مستحق جديد' : 'New expense added';
        const body = lang === 'ar'
          ? `عليك ${usersWhoOwe[0].amount} ${currency} لـ ${payerName} عن "${description.trim()}"`
          : `You owe ${usersWhoOwe[0].amount} ${currency} to ${payerName} for "${description.trim()}"`;

        await sendNotificationsToUsers({
          userIds: debtorIds,
          title,
          body,
          data: { groupId, expenseId: expense.id, type: 'expense' },
        });

        for (const split of usersWhoOwe) {
          await saveInAppNotification(
            split.user_id,
            'expense',
            title,
            body,
            { groupId, expenseId: expense.id }
          );
        }

        alert.show('success', t('notify.expenseSaved'), t('notify.notifyFriends'), [
          {
            text: t('notify.skip'),
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: t('notify.notifyViaWhatsApp'),
            style: 'default',
            onPress: () => {
              const message = generatePaymentNotification(
                payerName, payerPhone, usersWhoOwe[0].amount, currency, description.trim(), lang
              );
              shareViaWhatsApp(message);
              navigation.goBack();
            },
          },
        ]);
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePickReceipt = async (useCamera: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { alert.warning(t('expenses.permissionRequired')); return; }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);

      if (result.assets[0].base64) {
        setExtracting(true);
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'Extract ONLY the total amount and merchant/restaurant name from this receipt. Return JSON: {"total": number, "merchant": "string"}. If you can\'t read it, return {"total": 0, "merchant": ""}' },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${result.assets[0].base64}` } },
                ],
              }],
              max_tokens: 100,
              temperature: 0,
            }),
          });
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.total > 0 && !amount) setAmount(parsed.total.toString());
            if (parsed.merchant && !description) setDescription(parsed.merchant);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } catch {
          // Silent fail — user can still enter manually
        } finally {
          setExtracting(false);
        }
      }
    }
  };

  const getPaidByName = (): string => {
    if (paidBy === user?.id) return t('common.you') || 'You';
    const member = members.find((m) => m.user_id === paidBy);
    return (member?.user as User)?.display_name || t('expenses.select');
  };

  const splitTypeOptions: { value: SplitType; label: string }[] = [
    { value: 'equal', label: t('expenses.equal') },
    { value: 'exact', label: t('expenses.exact') },
    { value: 'percentage', label: t('expenses.percentage') },
  ];

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

  // ── Live split preview component ─────────────────────────────
  const renderLiveSplitPreview = () => {
    if (totalAmount <= 0 || includedSplits.length === 0) {
      return (
        <View style={[styles.livePreview, styles.livePreviewEmpty]}>
          <Text style={styles.livePreviewHint}>{t('expenses.livePreviewHint', 'Add an amount to see the split')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.livePreview}>
        <View style={styles.livePreviewHeader}>
          <Text style={styles.livePreviewLabel}>{t('expenses.perPerson', 'Per person')}</Text>
          <Text style={[styles.livePreviewCount]}>
            {includedSplits.length} {t('groups.members').toLowerCase()}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.previewScroll}
        >
          {includedSplits.map((m) => {
            const grad = avatarGradient(m.displayName);
            return (
              <View key={m.userId} style={styles.previewChip}>
                <LinearGradient
                  colors={grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.previewAvatar}
                >
                  <Text style={[styles.previewAvatarText, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                    {initials(m.displayName)}
                  </Text>
                </LinearGradient>
                <Text style={[styles.previewAmount, tabularNums]}>
                  {m.amount.toFixed(2)}
                </Text>
                <Text style={styles.previewName} numberOfLines={1}>
                  {m.userId === user?.id ? t('common.you') : m.displayName.split(' ')[0]}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md, paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={entrance.style}>
            {/* Editorial header */}
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('expenses.addExpenseTitle')}</Text>
              <Text style={[styles.headerTitle, { fontFamily: displayFor(i18n.language, 'bold') }]}>
                {t('expenses.add')}
              </Text>
            </View>

            {/* Amount Hero Card with editorial typography */}
            <AnimatedListItem index={0}>
              <ThemedCard accent style={styles.amountCard}>
                <Text style={styles.amountCardLabel}>{t('expenses.amount')}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={[styles.amountInput, { fontFamily: displayFor(i18n.language, 'bold') }, tabularNums]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    allowFontScaling={false}
                  />
                  <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.currencyBadge}>
                    <Text style={styles.currencyBadgeText}>{currency}</Text>
                  </LinearGradient>
                </View>
              </ThemedCard>
            </AnimatedListItem>

            {/* Live split preview — the key UX improvement */}
            <AnimatedListItem index={1}>
              {renderLiveSplitPreview()}
            </AnimatedListItem>

            {/* ── DETAILS section ─────────────────────────────── */}
            <SectionDivider label={t('expenses.detailsSection', 'Details')} marginHorizontal={0} />

            <AnimatedListItem index={2}>
              <ThemedCard style={styles.formCardSpacing}>
                <ThemedInput
                  label={t('expenses.description')}
                  icon="pencil-outline"
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('expenses.description')}
                  maxLength={100}
                  containerStyle={styles.field}
                />
                <View style={styles.fieldLast}>
                  <Text style={styles.label}>{t('expenses.paid_by')}</Text>
                  <BouncyPressable
                    onPress={() => { setPaidByPickerOpen(!paidByPickerOpen); Haptics.selectionAsync(); }}
                    scaleDown={0.98}
                  >
                    <View style={styles.pickerButton}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={{ marginEnd: 10 }} />
                        <Text style={styles.pickerButtonText}>{getPaidByName()}</Text>
                      </View>
                      <Ionicons name={paidByPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                    </View>
                  </BouncyPressable>
                  {paidByPickerOpen && (
                    <View style={styles.pickerDropdown}>
                      {members.map((m) => (
                        <BouncyPressable
                          key={m.user_id}
                          onPress={() => { setPaidBy(m.user_id); setPaidByPickerOpen(false); Haptics.selectionAsync(); }}
                          scaleDown={0.98}
                        >
                          <View style={[styles.pickerOption, paidBy === m.user_id && styles.pickerOptionActive]}>
                            <Text style={[styles.pickerOptionText, paidBy === m.user_id && styles.pickerOptionTextActive]}>
                              {m.user_id === user?.id ? `${(m.user as User)?.display_name} (${t('common.you')})` : (m.user as User)?.display_name || t('common.unknown')}
                            </Text>
                            {paidBy === m.user_id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                          </View>
                        </BouncyPressable>
                      ))}
                    </View>
                  )}
                </View>
              </ThemedCard>
            </AnimatedListItem>

            {/* ── SPLIT section ─────────────────────────────── */}
            <SectionDivider label={t('expenses.splitSection', 'Split')} marginHorizontal={0} />

            <AnimatedListItem index={3}>
              <ThemedCard style={styles.formCardSpacing}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('expenses.split_type')}</Text>
                  <SegmentedControl
                    options={splitTypeOptions}
                    value={splitType}
                    onChange={(v) => { setSplitType(v); Haptics.selectionAsync(); }}
                    gradient
                  />
                </View>

                <View style={styles.fieldLast}>
                  <Text style={styles.label}>{t('groups.members')}</Text>
                  <View style={styles.splitsContainer}>
                    {memberSplits.map((ms, index) => (
                      <View key={ms.userId} style={[styles.memberSplitRow, index === memberSplits.length - 1 && styles.memberSplitRowLast]}>
                        {splitType === 'equal' && (
                          <Switch
                            value={ms.included}
                            onValueChange={() => toggleMemberInclusion(ms.userId)}
                            trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB', true: `${colors.primary}66` }}
                            thumbColor={ms.included ? colors.primaryLight : isDark ? '#4A5F59' : '#9CA3AF'}
                            style={styles.switchStyle}
                          />
                        )}
                        <View style={styles.memberSplitInfo}>
                          <Text
                            style={[
                              styles.memberSplitName,
                              splitType === 'equal' && !ms.included && styles.memberSplitNameDisabled,
                            ]}
                            numberOfLines={1}
                          >
                            {ms.userId === user?.id ? `${ms.displayName} (${t('common.you')})` : ms.displayName}
                          </Text>
                        </View>
                        {splitType === 'equal' && (
                          <Text style={[styles.memberSplitAmount, tabularNums]}>
                            {ms.included ? ms.amount.toFixed(2) : '—'}
                          </Text>
                        )}
                        {splitType === 'exact' && (
                          <TextInput
                            style={[styles.memberSplitInput, tabularNums]}
                            value={ms.amount > 0 ? ms.amount.toString() : ''}
                            onChangeText={(val) => updateMemberAmount(ms.userId, val)}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={colors.textTertiary}
                          />
                        )}
                        {splitType === 'percentage' && (
                          <View style={styles.percentageInput}>
                            <TextInput
                              style={[styles.memberSplitInput, tabularNums]}
                              value={ms.percentage > 0 ? ms.percentage.toString() : ''}
                              onChangeText={(val) => updateMemberPercentage(ms.userId, val)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={colors.textTertiary}
                            />
                            <Text style={styles.percentSign}>%</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {splitType === 'exact' && amount ? (
                      <View style={[
                        styles.splitSummary,
                        Math.abs(splitSum - totalAmount) > 0.02 && styles.splitSummaryError,
                      ]}>
                        <Text
                          style={[
                            styles.splitSummaryText,
                            Math.abs(splitSum - totalAmount) > 0.02 && styles.splitSummaryTextError,
                            tabularNums,
                          ]}
                        >
                          {splitSum.toFixed(2)} / {totalAmount.toFixed(2)} {currency}
                        </Text>
                      </View>
                    ) : null}
                    {splitType === 'percentage' ? (
                      <View style={[
                        styles.splitSummary,
                        Math.abs(pctSum - 100) > 0.1 && styles.splitSummaryError,
                      ]}>
                        <Text
                          style={[
                            styles.splitSummaryText,
                            Math.abs(pctSum - 100) > 0.1 && styles.splitSummaryTextError,
                            tabularNums,
                          ]}
                        >
                          {pctSum.toFixed(1)}% / 100%
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </ThemedCard>
            </AnimatedListItem>

            {/* ── EXTRAS section ────────────────────────────── */}
            <SectionDivider label={t('expenses.extrasSection', 'Extras')} marginHorizontal={0} />

            <AnimatedListItem index={4}>
              <ThemedCard style={styles.formCardSpacing}>
                <ThemedInput
                  label={t('expenses.notes')}
                  icon="chatbubble-outline"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('expenses.notesPlaceholder')}
                  multiline
                  numberOfLines={2}
                  containerStyle={styles.field}
                />

                <View style={styles.fieldLast}>
                  <Text style={styles.label}>{t('expenses.attachReceipt')}</Text>
                  {receiptImage ? (
                    <View style={styles.receiptPreview}>
                      <Image source={{ uri: receiptImage }} style={styles.receiptThumb} />
                      <View style={styles.receiptInfo}>
                        {extracting ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.receiptFileName, { color: colors.primary }]}>
                              {t('expenses.extracting') || 'Extracting...'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.receiptFileName} numberOfLines={1}>{t('expenses.receiptAttached')}</Text>
                        )}
                        <BouncyPressable onPress={() => setReceiptImage(null)} scaleDown={0.95}>
                          <Text style={styles.receiptRemove}>{t('expenses.remove')}</Text>
                        </BouncyPressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.receiptButtons}>
                      <BouncyPressable onPress={() => handlePickReceipt(true)} scaleDown={0.96} style={styles.receiptBtn}>
                        <View style={styles.receiptBtnInner}>
                          <Ionicons name="camera-outline" size={20} color={isDark ? colors.primaryLight : colors.primary} />
                          <Text style={styles.receiptBtnText}>{t('expenses.camera')}</Text>
                        </View>
                      </BouncyPressable>
                      <View style={styles.receiptBtnDivider} />
                      <BouncyPressable onPress={() => handlePickReceipt(false)} scaleDown={0.96} style={styles.receiptBtn}>
                        <View style={styles.receiptBtnInner}>
                          <Ionicons name="images-outline" size={20} color={isDark ? colors.primaryLight : colors.primary} />
                          <Text style={styles.receiptBtnText}>{t('expenses.gallery')}</Text>
                        </View>
                      </BouncyPressable>
                    </View>
                  )}
                </View>
              </ThemedCard>
            </AnimatedListItem>
          </Animated.View>
        </ScrollView>

        {/* Sticky save bar */}
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <View style={styles.saveBarTotal}>
            <Text style={styles.saveBarLabel}>{t('expenses.total', 'Total')}</Text>
            <AmountText
              amount={totalAmount}
              currency={currency}
              variant="amount"
              tone={totalAmount > 0 ? 'ink' : 'neutral'}
              signMode="absolute"
            />
          </View>
          <TouchableOpacity
            disabled={!description.trim() || !amount || saving}
            onPress={handleSave}
            activeOpacity={0.85}
            style={[
              styles.saveBarBtn,
              { opacity: !description.trim() || !amount || saving ? 0.5 : 1 },
            ]}
          >
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBarBtnInner}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBarBtnText}>{t('expenses.save')}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: Spacing.lg, paddingBottom: 120 },

    headerBlock: { marginBottom: Spacing.xxl },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold, fontSize: 10, letterSpacing: 2.4,
      color: c.kicker, marginBottom: Spacing.xs, textTransform: 'uppercase',
    },
    headerTitle: {
      fontSize: 32, letterSpacing: -0.6, color: c.text, lineHeight: 36,
    },

    amountCard: {
      marginBottom: Spacing.lg,
    },
    amountCardLabel: {
      fontFamily: FontFamily.bodySemibold, fontSize: 10, letterSpacing: 2.4,
      color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.md,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    amountInput: {
      flex: 1, fontSize: 48,
      color: c.text, letterSpacing: -1.5, paddingVertical: Spacing.sm,
      lineHeight: 56,
    },
    currencyBadge: {
      borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    },
    currencyBadgeText: { fontSize: 14, fontFamily: FontFamily.bodyBold, color: '#1A1408' },

    // Live split preview
    livePreview: {
      marginBottom: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : c.paper,
      borderWidth: 1,
      borderColor: isDark ? c.border : 'rgba(255,149,0,0.18)',
    },
    livePreviewEmpty: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    livePreviewHint: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      fontStyle: 'italic',
    },
    livePreviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    livePreviewLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: c.kicker,
    },
    livePreviewCount: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.textTertiary,
    },
    previewScroll: {
      gap: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    previewChip: {
      alignItems: 'center',
      width: 64,
    },
    previewAvatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    previewAvatarText: {
      fontSize: 14,
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    previewAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: c.text,
      letterSpacing: -0.2,
    },
    previewName: {
      fontFamily: FontFamily.body,
      fontSize: 10,
      color: c.textTertiary,
      marginTop: 1,
    },

    formCardSpacing: {
      marginBottom: Spacing.lg,
    },
    field: { marginBottom: Spacing.xl },
    fieldLast: { marginBottom: 0 },
    label: {
      fontFamily: FontFamily.bodySemibold, fontSize: 10, letterSpacing: 2.2,
      color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm,
    },

    pickerButton: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    pickerButtonText: { fontSize: 16, fontFamily: FontFamily.body, color: c.text },
    pickerDropdown: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg, marginTop: Spacing.sm, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border,
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.08, shadowRadius: 12, elevation: isDark ? 0 : 4,
    },
    pickerOption: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: c.borderLight,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    pickerOptionActive: { backgroundColor: isDark ? c.primarySurface : '#E6FAF7' },
    pickerOptionText: { fontSize: 15, fontFamily: FontFamily.body, color: c.textSecondary },
    pickerOptionTextActive: { color: c.primary, fontFamily: FontFamily.bodySemibold },

    receiptPreview: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: c.border,
    },
    receiptThumb: { width: 56, height: 56, borderRadius: Radius.md },
    receiptInfo: { flex: 1, marginStart: Spacing.lg },
    receiptFileName: { fontFamily: FontFamily.bodySemibold, fontSize: 14, color: c.text },
    receiptRemove: { fontFamily: FontFamily.bodySemibold, fontSize: 13, color: c.danger, marginTop: 4 },
    receiptButtons: {
      flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(27,122,108,0.25)' : 'rgba(13,148,136,0.2)',
      backgroundColor: isDark ? 'rgba(27,122,108,0.08)' : '#E6FAF7',
    },
    receiptBtn: { flex: 1 },
    receiptBtnInner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, gap: 8,
    },
    receiptBtnDivider: {
      width: 1, backgroundColor: isDark ? 'rgba(27,122,108,0.25)' : 'rgba(13,148,136,0.15)',
    },
    receiptBtnText: {
      fontFamily: FontFamily.bodySemibold, fontSize: 14,
      color: isDark ? c.primaryLight : c.primary,
    },

    splitsContainer: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.03)' : '#F8F7F5',
      borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.borderLight,
    },
    memberSplitRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.borderLight,
    },
    memberSplitRowLast: { borderBottomWidth: 0 },
    switchStyle: { marginEnd: Spacing.sm, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
    memberSplitInfo: { flex: 1 },
    memberSplitName: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    memberSplitNameDisabled: { color: c.textTertiary },
    memberSplitAmount: {
      fontSize: 15, fontFamily: FontFamily.bodyBold, color: c.text,
      minWidth: 60, textAlign: 'right',
    },
    memberSplitInput: {
      backgroundColor: c.bgCard,
      borderWidth: 1, borderColor: c.border, borderRadius: Radius.sm,
      paddingHorizontal: 10, paddingVertical: 8,
      fontSize: 15, fontFamily: FontFamily.bodySemibold, color: c.text,
      minWidth: 80, textAlign: 'right',
    },
    percentageInput: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    percentSign: { fontSize: 15, fontFamily: FontFamily.bodySemibold, color: c.textSecondary },
    splitSummary: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: isDark ? c.primarySurface : '#E6FAF7',
    },
    splitSummaryError: {
      backgroundColor: isDark ? 'rgba(252,129,129,0.12)' : '#FEF2F2',
    },
    splitSummaryText: {
      fontSize: 13, fontFamily: FontFamily.bodySemibold, color: c.primary,
      textAlign: I18nManager.isRTL ? 'left' : 'right',
    },
    splitSummaryTextError: {
      color: c.owe,
    },

    // Sticky save bar
    saveBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.md,
      backgroundColor: isDark ? 'rgba(14,13,18,0.96)' : 'rgba(255,255,255,0.96)',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    saveBarTotal: {
      flex: 1,
    },
    saveBarLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 9,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: c.textTertiary,
      marginBottom: 2,
    },
    saveBarBtn: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 8,
    },
    saveBarBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 14,
    },
    saveBarBtnText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
  });
