import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { GroupMember, User } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

type SplitType = 'equal' | 'exact' | 'percentage';

interface MemberSplit {
  userId: string;
  displayName: string;
  included: boolean;
  amount: number;
  percentage: number;
}

// Simple keyword-based auto-categorization
function categorizeExpense(description: string): string | null {
  const desc = description.toLowerCase();

  const categories: Record<string, string[]> = {
    'Food & Dining': [
      'restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'cafe', 'coffee',
      'pizza', 'burger', 'sushi', 'shawarma', 'koshary', 'foul', 'ta3meya',
      'falafel', 'meal', 'eat', 'snack', 'bakery', 'dessert', 'ice cream',
      'juice', 'drink', 'bar', 'grill', 'bbq', 'chicken', 'meat', 'fish',
      'delivery', 'talabat', 'elmenus',
    ],
    'Groceries': [
      'grocery', 'groceries', 'supermarket', 'carrefour', 'spinneys',
      'hyper', 'market', 'vegetables', 'fruits', 'milk', 'bread', 'eggs',
    ],
    'Transport': [
      'uber', 'careem', 'taxi', 'bus', 'metro', 'fuel', 'gas', 'petrol',
      'parking', 'toll', 'ride', 'swvl', 'indriver', 'transport',
    ],
    'Shopping': [
      'shopping', 'clothes', 'shoes', 'electronics', 'amazon', 'noon',
      'jumia', 'gift', 'present', 'mall',
    ],
    'Bills & Utilities': [
      'bill', 'electricity', 'water', 'internet', 'wifi', 'phone',
      'mobile', 'rent', 'subscription', 'netflix', 'spotify',
    ],
    'Entertainment': [
      'movie', 'cinema', 'game', 'concert', 'ticket', 'party',
      'club', 'bowling', 'karaoke', 'fun', 'outing',
    ],
    'Health': [
      'pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'dental',
      'gym', 'health', 'medical',
    ],
    'Travel': [
      'hotel', 'flight', 'airbnb', 'travel', 'trip', 'vacation',
      'booking', 'resort', 'sahel', 'gouna',
    ],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

export default function AddExpenseScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();

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

  useEffect(() => {
    fetchGroupData();
  }, []);

  const fetchGroupData = async () => {
    try {
      // Fetch group currency
      const { data: group } = await supabase
        .from('groups')
        .select('currency')
        .eq('id', groupId)
        .single();

      if (group) setCurrency(group.currency);

      // Fetch members
      const { data: membersData, error } = await supabase
        .from('group_members')
        .select('*, user:users(*)')
        .eq('group_id', groupId);

      if (error) throw error;

      setMembers(membersData || []);

      // Default: paid by current user
      if (user) {
        setPaidBy(user.id);
      }

      // Initialize splits
      const splits: MemberSplit[] = (membersData || []).map((m) => ({
        userId: m.user_id,
        displayName: (m.user as User)?.display_name || 'Unknown',
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

  // Recalculate equal splits when amount or inclusions change
  useEffect(() => {
    if (splitType !== 'equal') return;

    const totalAmount = parseFloat(amount) || 0;
    const includedMembers = memberSplits.filter((m) => m.included);
    const count = includedMembers.length;

    if (count === 0) return;

    const equalShare = Math.round((totalAmount / count) * 100) / 100;
    // Handle rounding: give remainder to first person
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
      })
    );
  }, [amount, splitType, memberSplits.map((m) => m.included).join(',')]);

  const toggleMemberInclusion = (userId: string) => {
    setMemberSplits((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, included: !m.included } : m
      )
    );
  };

  const updateMemberAmount = (userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMemberSplits((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, amount: numValue } : m
      )
    );
  };

  const updateMemberPercentage = (userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const totalAmount = parseFloat(amount) || 0;
    setMemberSplits((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? {
              ...m,
              percentage: numValue,
              amount: Math.round((totalAmount * numValue) / 100 * 100) / 100,
            }
          : m
      )
    );
  };

  const getValidationError = (): string | null => {
    if (!description.trim()) return 'Description is required.';
    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) return 'Enter a valid amount.';
    if (!paidBy) return 'Select who paid.';

    const includedSplits = memberSplits.filter((m) => m.included);
    if (includedSplits.length === 0) return 'At least one member must be included.';

    if (splitType === 'exact') {
      const splitSum = includedSplits.reduce((s, m) => s + m.amount, 0);
      if (Math.abs(splitSum - totalAmount) > 0.02) {
        return `Split amounts (${splitSum.toFixed(2)}) must equal total (${totalAmount.toFixed(2)}).`;
      }
    }

    if (splitType === 'percentage') {
      const pctSum = includedSplits.reduce((s, m) => s + m.percentage, 0);
      if (Math.abs(pctSum - 100) > 0.1) {
        return `Percentages must sum to 100% (currently ${pctSum.toFixed(1)}%).`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const error = getValidationError();
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }

    setSaving(true);

    try {
      const totalAmount = parseFloat(amount);
      const category = categorizeExpense(description);

      // Insert expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: paidBy,
          description: description.trim(),
          total_amount: totalAmount,
          currency,
          category,
          split_type: splitType,
          receipt_image: null,
          ai_parsed: false,
          created_by: user!.id,
          is_deleted: false,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Insert splits
      const splitsToInsert = memberSplits
        .filter((m) => m.included && m.amount > 0)
        .map((m) => ({
          expense_id: expense.id,
          user_id: m.userId,
          amount: m.amount,
          percentage: splitType === 'percentage' ? m.percentage : null,
          is_settled: false,
        }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const getPaidByName = (): string => {
    if (paidBy === user?.id) return t('common.you') || 'You';
    const member = members.find((m) => m.user_id === paidBy);
    return (member?.user as User)?.display_name || 'Select';
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>{t('expenses.add')}</Text>

          {/* Amount Card - Hero section */}
          <View style={styles.amountCard}>
            <Text style={styles.amountCardLabel}>{t('expenses.amount')}</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <LinearGradient
                colors={Gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.currencyBadge}
              >
                <Text style={styles.currencyBadgeText}>{currency}</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Description Card */}
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('expenses.description')}</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t('expenses.description')}
                placeholderTextColor={Colors.textTertiary}
                maxLength={100}
                autoFocus
              />
            </View>

            {/* Paid By */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('expenses.paid_by')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                activeOpacity={0.7}
                onPress={() => setPaidByPickerOpen(!paidByPickerOpen)}
              >
                <Text style={styles.pickerButtonText}>{getPaidByName()}</Text>
                <Text style={styles.pickerArrow}>{paidByPickerOpen ? '\u25B2' : '\u25BC'}</Text>
              </TouchableOpacity>
              {paidByPickerOpen && (
                <View style={styles.pickerDropdown}>
                  {members.map((m) => (
                    <TouchableOpacity
                      key={m.user_id}
                      style={[
                        styles.pickerOption,
                        paidBy === m.user_id && styles.pickerOptionActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setPaidBy(m.user_id);
                        setPaidByPickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          paidBy === m.user_id && styles.pickerOptionTextActive,
                        ]}
                      >
                        {m.user_id === user?.id
                          ? `${(m.user as User)?.display_name} (${t('common.you') || 'You'})`
                          : (m.user as User)?.display_name || 'Unknown'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Split Type Card */}
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('expenses.split_type')}</Text>
              <View style={styles.splitTypePillContainer}>
                {(['equal', 'exact', 'percentage'] as SplitType[]).map((type) => {
                  const labelMap: Record<SplitType, string> = {
                    equal: t('expenses.equal'),
                    exact: t('expenses.exact'),
                    percentage: t('expenses.percentage'),
                  };
                  const isActive = splitType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.splitTypePill,
                        isActive && styles.splitTypePillActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSplitType(type)}
                    >
                      <Text
                        style={[
                          styles.splitTypePillText,
                          isActive && styles.splitTypePillTextActive,
                        ]}
                      >
                        {labelMap[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Member Splits */}
            <View style={styles.fieldLast}>
              <Text style={styles.label}>{t('groups.members')}</Text>
              <View style={styles.splitsContainer}>
                {memberSplits.map((ms, index) => (
                  <View
                    key={ms.userId}
                    style={[
                      styles.memberSplitRow,
                      index === memberSplits.length - 1 && styles.memberSplitRowLast,
                    ]}
                  >
                    {/* Inclusion toggle (for equal split) */}
                    {splitType === 'equal' && (
                      <Switch
                        value={ms.included}
                        onValueChange={() => toggleMemberInclusion(ms.userId)}
                        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                        thumbColor={ms.included ? Colors.primary : Colors.textTertiary}
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
                        {ms.userId === user?.id
                          ? `${ms.displayName} (${t('common.you') || 'You'})`
                          : ms.displayName}
                      </Text>
                    </View>

                    {/* Amount display / input */}
                    {splitType === 'equal' && (
                      <Text style={styles.memberSplitAmount}>
                        {ms.included ? ms.amount.toFixed(2) : '-'}
                      </Text>
                    )}

                    {splitType === 'exact' && (
                      <TextInput
                        style={styles.memberSplitInput}
                        value={ms.amount > 0 ? ms.amount.toString() : ''}
                        onChangeText={(val) => updateMemberAmount(ms.userId, val)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={Colors.textTertiary}
                      />
                    )}

                    {splitType === 'percentage' && (
                      <View style={styles.percentageInput}>
                        <TextInput
                          style={styles.memberSplitInput}
                          value={ms.percentage > 0 ? ms.percentage.toString() : ''}
                          onChangeText={(val) =>
                            updateMemberPercentage(ms.userId, val)
                          }
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textTertiary}
                        />
                        <Text style={styles.percentSign}>%</Text>
                      </View>
                    )}
                  </View>
                ))}

                {/* Validation summary */}
                {splitType === 'exact' && amount && (
                  <View style={styles.splitSummary}>
                    <Text style={styles.splitSummaryText}>
                      Total:{' '}
                      {memberSplits
                        .filter((m) => m.included)
                        .reduce((s, m) => s + m.amount, 0)
                        .toFixed(2)}{' '}
                      / {parseFloat(amount || '0').toFixed(2)} {currency}
                    </Text>
                  </View>
                )}
                {splitType === 'percentage' && (
                  <View style={styles.splitSummary}>
                    <Text style={styles.splitSummaryText}>
                      Total:{' '}
                      {memberSplits
                        .reduce((s, m) => s + m.percentage, 0)
                        .toFixed(1)}
                      % / 100%
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!description.trim() || !amount) && styles.saveButtonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('expenses.save')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  sectionTitle: {
    ...Typography.screenTitle,
    marginBottom: Spacing.xxl,
  },
  // Amount hero card
  amountCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  amountCardLabel: {
    ...Typography.label,
    marginBottom: Spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
    paddingVertical: Spacing.sm,
  },
  currencyBadge: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Shadows.goldGlow,
  },
  currencyBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textOnAccent,
  },
  // Form cards
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  field: {
    marginBottom: Spacing.xl,
  },
  fieldLast: {
    marginBottom: 0,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerButton: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  pickerArrow: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  pickerDropdown: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  pickerOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primarySurface,
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  // Split type pills
  splitTypePillContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    padding: 4,
  },
  splitTypePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  splitTypePillActive: {
    backgroundColor: Colors.primary,
  },
  splitTypePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  splitTypePillTextActive: {
    color: Colors.textOnPrimary,
  },
  // Member splits
  splitsContainer: {
    backgroundColor: '#F8F7F5',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  memberSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  memberSplitRowLast: {
    borderBottomWidth: 0,
  },
  switchStyle: {
    marginRight: Spacing.sm,
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  memberSplitInfo: {
    flex: 1,
  },
  memberSplitName: {
    ...Typography.bodyBold,
  },
  memberSplitNameDisabled: {
    color: Colors.textTertiary,
  },
  memberSplitAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 60,
    textAlign: 'right',
  },
  memberSplitInput: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    minWidth: 80,
    textAlign: 'right',
  },
  percentageInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  percentSign: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  splitSummary: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primarySurface,
  },
  splitSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'right',
  },
  // Save button
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
    ...Shadows.glow,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.primaryLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
});
