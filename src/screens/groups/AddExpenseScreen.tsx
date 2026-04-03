import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch,
  Animated,
  Easing,
  Image,
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
import { Spacing, Radius, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;
type SplitType = 'equal' | 'exact' | 'percentage';

interface MemberSplit {
  userId: string;
  displayName: string;
  included: boolean;
  amount: number;
  percentage: number;
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
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [memberSplits, setMemberSplits] = useState<MemberSplit[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paidByPickerOpen, setPaidByPickerOpen] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => { fetchGroupData(); }, []);

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
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setLoading(false);
    }
  };

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

  const getValidationError = (): string | null => {
    if (!description.trim()) return t('expenses.descriptionRequired');
    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) return t('expenses.invalidAmount');
    if (!paidBy) return t('expenses.selectPayer');
    const includedSplits = memberSplits.filter((m) => m.included);
    if (includedSplits.length === 0) return t('expenses.atLeastOneMember');
    if (splitType === 'exact') {
      const splitSum = includedSplits.reduce((s, m) => s + m.amount, 0);
      if (Math.abs(splitSum - totalAmount) > 0.02) return t('expenses.splitMismatch', { splitSum: splitSum.toFixed(2), total: totalAmount.toFixed(2) });
    }
    if (splitType === 'percentage') {
      const pctSum = includedSplits.reduce((s, m) => s + m.percentage, 0);
      if (Math.abs(pctSum - 100) > 0.1) return t('expenses.percentMismatch', { current: pctSum.toFixed(1) });
    }
    return null;
  };

  const handleSave = async () => {
    const error = getValidationError();
    if (error) { Alert.alert(t('common.error'), error); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const totalAmount = parseFloat(amount);
      const category = categorizeExpense(description);

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId, paid_by: paidBy, description: description.trim(),
          total_amount: totalAmount, currency, category, split_type: splitType,
          receipt_image: null, ai_parsed: false, created_by: user!.id, is_deleted: false,
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
      navigation.goBack();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePickReceipt = async (useCamera: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('expenses.permissionRequired')); return; }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const getPaidByName = (): string => {
    if (paidBy === user?.id) return t('common.you') || 'You';
    const member = members.find((m) => m.user_id === paidBy);
    return (member?.user as User)?.display_name || t('expenses.select');
  };

  const animateBtnPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }),
    ]).start();
  };

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
        <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('expenses.addExpenseTitle')}</Text>
              <Text style={styles.headerTitle}>{t('expenses.add')}</Text>
            </View>

            {/* Amount Hero */}
            <View style={styles.amountCard}>
              {isDark && <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}
              <View style={styles.amountCardAccent} />
              <Text style={styles.amountCardLabel}>{t('expenses.amount')}</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
                <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>{currency}</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Description + Paid By */}
            <View style={styles.formCard}>
              {isDark && <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}

              <View style={styles.field}>
                <Text style={styles.label}>{t('expenses.description')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="pencil-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('expenses.description')}
                    placeholderTextColor={colors.textTertiary}
                    maxLength={100}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('expenses.paid_by')}</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  activeOpacity={0.7}
                  onPress={() => { Haptics.selectionAsync(); setPaidByPickerOpen(!paidByPickerOpen); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={{ marginRight: 10 }} />
                    <Text style={styles.pickerButtonText}>{getPaidByName()}</Text>
                  </View>
                  <Ionicons name={paidByPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                </TouchableOpacity>
                {paidByPickerOpen && (
                  <View style={styles.pickerDropdown}>
                    {members.map((m) => (
                      <TouchableOpacity
                        key={m.user_id}
                        style={[styles.pickerOption, paidBy === m.user_id && styles.pickerOptionActive]}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setPaidBy(m.user_id); setPaidByPickerOpen(false); }}
                      >
                        <Text style={[styles.pickerOptionText, paidBy === m.user_id && styles.pickerOptionTextActive]}>
                          {m.user_id === user?.id ? `${(m.user as User)?.display_name} (${t('common.you')})` : (m.user as User)?.display_name || t('common.unknown')}
                        </Text>
                        {paidBy === m.user_id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Receipt Attachment */}
              <View style={styles.fieldLast}>
                <Text style={styles.label}>{t('expenses.attachReceipt')}</Text>
                {receiptImage ? (
                  <View style={styles.receiptPreview}>
                    <Image source={{ uri: receiptImage }} style={styles.receiptThumb} />
                    <View style={styles.receiptInfo}>
                      <Text style={styles.receiptFileName} numberOfLines={1}>{t('expenses.receiptAttached')}</Text>
                      <TouchableOpacity onPress={() => setReceiptImage(null)}>
                        <Text style={styles.receiptRemove}>{t('expenses.remove')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.receiptButtons}>
                    <TouchableOpacity style={styles.receiptBtn} activeOpacity={0.7} onPress={() => handlePickReceipt(true)}>
                      <Ionicons name="camera-outline" size={20} color={isDark ? colors.primaryLight : colors.primary} />
                      <Text style={styles.receiptBtnText}>{t('expenses.camera')}</Text>
                    </TouchableOpacity>
                    <View style={styles.receiptBtnDivider} />
                    <TouchableOpacity style={styles.receiptBtn} activeOpacity={0.7} onPress={() => handlePickReceipt(false)}>
                      <Ionicons name="images-outline" size={20} color={isDark ? colors.primaryLight : colors.primary} />
                      <Text style={styles.receiptBtnText}>{t('expenses.gallery')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Split Type */}
            <View style={styles.formCard}>
              {isDark && <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />}

              <View style={styles.field}>
                <Text style={styles.label}>{t('expenses.split_type')}</Text>
                <View style={styles.splitTypePillContainer}>
                  {(['equal', 'exact', 'percentage'] as SplitType[]).map((type) => {
                    const labelMap: Record<SplitType, string> = { equal: t('expenses.equal'), exact: t('expenses.exact'), percentage: t('expenses.percentage') };
                    const isActive = splitType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.splitTypePill, isActive && styles.splitTypePillActive]}
                        activeOpacity={0.7}
                        onPress={() => { Haptics.selectionAsync(); setSplitType(type); }}
                      >
                        <Text style={[styles.splitTypePillText, isActive && styles.splitTypePillTextActive]}>
                          {labelMap[type]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
                        <Text style={[styles.memberSplitName, splitType === 'equal' && !ms.included && styles.memberSplitNameDisabled]} numberOfLines={1}>
                          {ms.userId === user?.id ? `${ms.displayName} (${t('common.you')})` : ms.displayName}
                        </Text>
                      </View>
                      {splitType === 'equal' && (
                        <Text style={styles.memberSplitAmount}>{ms.included ? ms.amount.toFixed(2) : '-'}</Text>
                      )}
                      {splitType === 'exact' && (
                        <TextInput
                          style={styles.memberSplitInput}
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
                            style={styles.memberSplitInput}
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
                    <View style={styles.splitSummary}>
                      <Text style={styles.splitSummaryText}>
                        Total: {memberSplits.filter((m) => m.included).reduce((s, m) => s + m.amount, 0).toFixed(2)} / {parseFloat(amount || '0').toFixed(2)} {currency}
                      </Text>
                    </View>
                  ) : null}
                  {splitType === 'percentage' ? (
                    <View style={styles.splitSummary}>
                      <Text style={styles.splitSummaryText}>
                        Total: {memberSplits.reduce((s, m) => s + m.percentage, 0).toFixed(1)}% / 100%
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Save */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.saveButton, (!description.trim() || !amount) && styles.saveButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => { animateBtnPress(); handleSave(); }}
                disabled={saving}
              >
                <LinearGradient
                  colors={description.trim() && amount ? colors.primaryGradient : [colors.primaryDark, colors.primaryDark]}
                  style={styles.saveBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.5 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.saveButtonText}>{t('expenses.save')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 60 },

    headerBlock: { marginBottom: Spacing.xxl },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold, fontSize: 10, letterSpacing: 4,
      color: c.kicker, marginBottom: Spacing.xs,
    },
    headerTitle: {
      fontFamily: FontFamily.display, fontSize: 32, letterSpacing: -1, color: c.text,
    },

    amountCard: {
      borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 12, elevation: isDark ? 0 : 4,
    },
    amountCardAccent: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      backgroundColor: c.accent, opacity: isDark ? 0.5 : 0.35,
    },
    amountCardLabel: {
      fontFamily: FontFamily.bodySemibold, fontSize: 11, letterSpacing: 1.5,
      color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.md,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    amountInput: {
      flex: 1, fontSize: 36, fontFamily: FontFamily.display,
      color: c.text, letterSpacing: -1, paddingVertical: Spacing.sm,
    },
    currencyBadge: {
      borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
    },
    currencyBadgeText: { fontSize: 16, fontFamily: FontFamily.bodyBold, color: '#1A1408' },

    formCard: {
      borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.xl, marginBottom: Spacing.lg, overflow: 'hidden',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 12, elevation: isDark ? 0 : 4,
    },
    field: { marginBottom: Spacing.xl },
    fieldLast: { marginBottom: 0 },
    label: {
      fontFamily: FontFamily.bodySemibold, fontSize: 11, letterSpacing: 1.5,
      color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm,
    },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
    },
    inputIcon: { marginRight: Spacing.sm },
    inputWithIcon: {
      flex: 1, paddingVertical: 14, fontSize: 16, fontFamily: FontFamily.body, color: c.text,
    },

    pickerButton: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5, borderColor: c.border, borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    pickerButtonText: { fontSize: 16, fontFamily: FontFamily.body, color: c.text },
    pickerDropdown: {
      backgroundColor: isDark ? c.bgCard : c.bgCard,
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
    receiptInfo: { flex: 1, marginLeft: Spacing.lg },
    receiptFileName: { fontFamily: FontFamily.bodySemibold, fontSize: 14, color: c.text },
    receiptRemove: { fontFamily: FontFamily.bodySemibold, fontSize: 13, color: c.danger, marginTop: 4 },
    receiptButtons: {
      flexDirection: 'row', borderRadius: Radius.lg, overflow: 'hidden',
      borderWidth: 1.5, borderColor: isDark ? 'rgba(27,122,108,0.25)' : 'rgba(13,148,136,0.2)',
      backgroundColor: isDark ? 'rgba(27,122,108,0.08)' : '#E6FAF7',
    },
    receiptBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, gap: 8,
    },
    receiptBtnDivider: {
      width: 1, backgroundColor: isDark ? 'rgba(27,122,108,0.25)' : 'rgba(13,148,136,0.15)',
    },
    receiptBtnText: {
      fontFamily: FontFamily.bodySemibold, fontSize: 14,
      color: isDark ? c.primaryLight : c.primary,
    },

    splitTypePillContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight,
      borderRadius: Radius.full, padding: 4,
    },
    splitTypePill: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
    splitTypePillActive: { backgroundColor: c.primary },
    splitTypePillText: { fontSize: 13, fontFamily: FontFamily.bodySemibold, color: c.textTertiary },
    splitTypePillTextActive: { color: '#FFFFFF' },

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
    switchStyle: { marginRight: Spacing.sm, transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
    memberSplitInfo: { flex: 1 },
    memberSplitName: { fontFamily: FontFamily.bodySemibold, fontSize: 15, color: c.text },
    memberSplitNameDisabled: { color: c.textTertiary },
    memberSplitAmount: {
      fontSize: 15, fontFamily: FontFamily.bodyBold, color: c.text,
      minWidth: 60, textAlign: 'right',
    },
    memberSplitInput: {
      backgroundColor: isDark ? c.bgCard : c.bgCard,
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
    splitSummaryText: {
      fontSize: 13, fontFamily: FontFamily.bodySemibold, color: c.primary, textAlign: 'right',
    },

    saveButton: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.sm },
    saveButtonDisabled: { opacity: 0.5 },
    saveBtnGradient: {
      flexDirection: 'row', paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
      borderRadius: Radius.lg,
      shadowColor: c.primary, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    },
    saveButtonText: {
      color: '#FFFFFF', fontFamily: FontFamily.bodyBold, fontSize: 17, letterSpacing: 0.3,
    },
  });
