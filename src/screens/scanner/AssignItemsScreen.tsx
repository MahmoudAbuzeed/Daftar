import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { GroupMember, ParsedReceiptItem } from '../../types/database';
import { Spacing, Radius, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AssignItems'>;

interface AssignableItem extends ParsedReceiptItem {
  assignedTo: string[];
}

export default function AssignItemsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { groupId, items: rawItems, tax, serviceCharge } = route.params;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [items, setItems] = useState<AssignableItem[]>(
    rawItems.map((item) => ({ ...item, assignedTo: [] }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, user:users(*)')
      .eq('group_id', groupId);
    if (data) setMembers(data);
  };

  const toggleAssignment = useCallback((itemIndex: number, userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const isAssigned = item.assignedTo.includes(userId);
        return {
          ...item,
          assignedTo: isAssigned
            ? item.assignedTo.filter((id) => id !== userId)
            : [...item.assignedTo, userId],
        };
      })
    );
  }, []);

  const assignAllToUser = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems((prev) =>
      prev.map((item) => {
        if (item.assignedTo.includes(userId)) return item;
        return { ...item, assignedTo: [...item.assignedTo, userId] };
      })
    );
  }, []);

  const unassignAllFromUser = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((id) => id !== userId),
      }))
    );
  }, []);

  const isEveryItemAssignedToUser = useCallback(
    (userId: string) => items.every((item) => item.assignedTo.includes(userId)),
    [items]
  );

  const calculateSplits = useCallback((): Map<string, number> => {
    const splits = new Map<string, number>();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    for (const item of items) {
      if (item.assignedTo.length === 0) continue;
      const perPerson = item.total / item.assignedTo.length;
      for (const userId of item.assignedTo) {
        splits.set(userId, (splits.get(userId) || 0) + perPerson);
      }
    }

    const extras = tax + serviceCharge;
    if (extras > 0 && subtotal > 0) {
      for (const [userId, amount] of splits.entries()) {
        const proportion = amount / subtotal;
        splits.set(userId, amount + extras * proportion);
      }
    }

    for (const [userId, amount] of splits.entries()) {
      splits.set(userId, Math.round(amount * 100) / 100);
    }

    return splits;
  }, [items, tax, serviceCharge]);

  const handleSave = async () => {
    const unassigned = items.filter((item) => item.assignedTo.length === 0);
    if (unassigned.length > 0) {
      Alert.alert(t('scanner.unassignedItems'), t('scanner.assignAllItems'));
      return;
    }

    setSaving(true);
    try {
      const splits = calculateSplits();
      const totalAmount = Array.from(splits.values()).reduce((a, b) => a + b, 0);

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: user!.id,
          description: t('scanner.scannedReceipt'),
          total_amount: totalAmount,
          currency: 'EGP',
          split_type: 'by_item',
          ai_parsed: true,
          created_by: user!.id,
          category: 'food',
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      const itemInserts = items.map((item, index) => ({
        expense_id: expense.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total,
        sort_order: index,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('expense_items')
        .insert(itemInserts)
        .select();

      if (itemsError) throw itemsError;

      const assignments = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dbItem = insertedItems[i];
        for (const userId of item.assignedTo) {
          assignments.push({
            item_id: dbItem.id,
            user_id: userId,
            share_amount: item.total / item.assignedTo.length,
          });
        }
      }

      if (assignments.length > 0) {
        const { error: assignError } = await supabase
          .from('item_assignments')
          .insert(assignments);
        if (assignError) throw assignError;
      }

      const splitInserts = Array.from(splits.entries()).map(([userId, amount]) => ({
        expense_id: expense.id,
        user_id: userId,
        amount,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitInserts);
      if (splitsError) throw splitsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.popToTop();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setSaving(false);
    }
  };

  const splits = calculateSplits();
  const getMemberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return (member?.user as any)?.display_name || t('scanner.unknown');
  };

  const assignedCount = items.filter((i) => i.assignedTo.length > 0).length;
  const totalItems = items.length;

  const renderItem = useCallback(
    ({ item, index }: { item: AssignableItem; index: number }) => (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemNameRow}>
            <View
              style={[
                styles.itemDot,
                {
                  backgroundColor:
                    item.assignedTo.length > 0 ? colors.success : colors.danger,
                },
              ]}
            />
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
          </View>
          <Text style={styles.itemPrice}>{item.total.toFixed(2)}</Text>
        </View>

        <View style={styles.assignRow}>
          {members.map((member) => {
            const isAssigned = item.assignedTo.includes(member.user_id);
            const name = (member.user as any)?.display_name || '?';
            const initial = name.charAt(0).toUpperCase();
            return (
              <TouchableOpacity
                key={member.user_id}
                activeOpacity={0.7}
                onPress={() => toggleAssignment(index, member.user_id)}
                style={[
                  styles.assignChip,
                  isAssigned && styles.assignChipActive,
                ]}
              >
                {isAssigned ? (
                  <LinearGradient
                    colors={colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.assignChipGradient}
                  >
                    <Text style={styles.chipInitialActive}>{initial}</Text>
                    <Text style={styles.assignChipTextActive} numberOfLines={1}>
                      {name.split(' ')[0]}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.assignChipInner}>
                    <Text style={styles.chipInitial}>{initial}</Text>
                    <Text style={styles.assignChipText} numberOfLines={1}>
                      {name.split(' ')[0]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    ),
    [members, colors, styles, toggleAssignment]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('scanner.assign_items')}</Text>
        <Text style={styles.headerSubtitle}>{t('scanner.assign_subtitle')}</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${totalItems > 0 ? (assignedCount / totalItems) * 100 : 0}%`,
                  backgroundColor:
                    assignedCount === totalItems ? colors.success : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {assignedCount}/{totalItems}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.quickAssignRow}
        contentContainerStyle={styles.quickAssignContent}
        showsHorizontalScrollIndicator={false}
      >
        {members.map((member) => {
          const name = (member.user as any)?.display_name || '?';
          const initial = name.charAt(0).toUpperCase();
          const allAssigned = isEveryItemAssignedToUser(member.user_id);
          return (
            <TouchableOpacity
              key={member.user_id}
              activeOpacity={0.7}
              onPress={() =>
                allAssigned
                  ? unassignAllFromUser(member.user_id)
                  : assignAllToUser(member.user_id)
              }
              style={[
                styles.quickChip,
                allAssigned && styles.quickChipActive,
              ]}
            >
              <LinearGradient
                colors={
                  allAssigned
                    ? colors.primaryGradient
                    : [colors.bgSubtle, colors.bgSubtle]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickChipGradient}
              >
                <Text
                  style={[
                    styles.quickChipInitial,
                    allAssigned && { color: '#FFFFFF' },
                  ]}
                >
                  {initial}
                </Text>
                <Text
                  style={[
                    styles.quickChipName,
                    allAssigned && { color: '#FFFFFF' },
                  ]}
                  numberOfLines={1}
                >
                  {name.split(' ')[0]}
                </Text>
                <Ionicons
                  name={allAssigned ? 'checkmark-circle' : 'add-circle-outline'}
                  size={16}
                  color={allAssigned ? '#FFFFFF' : colors.textTertiary}
                />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>{t('scanner.summary')}</Text>
        {Array.from(splits.entries()).map(([userId, amount]) => (
          <View key={userId} style={styles.summaryRow}>
            <Text style={styles.summaryName}>{getMemberName(userId)}</Text>
            <Text style={styles.summaryAmount}>
              {amount.toFixed(2)} {t('common.egp')}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.confirmGradient}
          >
            <Text style={styles.confirmButtonText}>
              {saving ? t('common.loading') : t('scanner.confirm_split')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 26,
      color: c.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
      marginTop: 4,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: 10,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.bgSubtle,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
    },
    progressText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
    },

    quickAssignRow: {
      maxHeight: 54,
      marginTop: Spacing.sm,
    },
    quickAssignContent: {
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    quickChip: {
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    quickChipActive: {},
    quickChipGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.full,
      gap: 6,
    },
    quickChipInitial: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    quickChipName: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 13,
      color: c.textSecondary,
      maxWidth: 80,
    },

    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    itemCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: c.borderLight,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    itemNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    itemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    itemName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
      flex: 1,
    },
    itemPrice: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: c.text,
      marginLeft: Spacing.sm,
    },
    assignRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: Spacing.sm,
      gap: 6,
    },
    assignChip: {
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    assignChipActive: {},
    assignChipGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      gap: 4,
    },
    assignChipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: c.bgSubtle,
      borderRadius: Radius.full,
      gap: 4,
    },
    chipInitial: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 12,
      color: c.textTertiary,
    },
    chipInitialActive: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 12,
      color: '#FFFFFF',
    },
    assignChipText: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textSecondary,
    },
    assignChipTextActive: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: '#FFFFFF',
    },

    summaryContainer: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      padding: Spacing.lg,
      paddingBottom: 36,
      borderTopWidth: 1,
      borderColor: c.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 8,
    },
    summaryTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    summaryName: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    summaryAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    confirmButton: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.md,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmGradient: {
      paddingVertical: 15,
      alignItems: 'center',
      borderRadius: Radius.lg,
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      letterSpacing: 0.3,
    },
  });
