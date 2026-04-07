import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ParsedReceiptItem, GroupMember } from '../../types/database';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { generateMultiDebtorNotification, shareViaWhatsApp } from '../../utils/whatsapp';

type Props = NativeStackScreenProps<RootStackParamList, 'ParsedItems'>;

interface AssignableItem extends ParsedReceiptItem {
  assignedTo: string[];
}

export default function ParsedItemsScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { user, profile } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const { groupId, receiptData } = route.params;

  const [items, setItems] = useState<AssignableItem[]>(
    receiptData.items.map((item: ParsedReceiptItem) => ({ ...item, assignedTo: user ? [user.id] : [] }))
  );
  const [tax, setTax] = useState(receiptData.tax || 0);
  const [serviceCharge, setServiceCharge] = useState(
    receiptData.service_charge || 0
  );
  const [tip, setTip] = useState(0);
  const [tipPct, setTipPct] = useState<number | null>(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + tax + serviceCharge + tip;

  const TIP_PRESETS = [0, 5, 10, 15, 20];

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

  const applyTipPct = (pct: number) => {
    setTipPct(pct);
    setTip(Math.round(subtotal * pct) / 100);
  };

  const updateItem = (
    index: number,
    field: keyof ParsedReceiptItem,
    value: string
  ) => {
    const updated = [...items];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value };
    } else {
      const num = parseFloat(value) || 0;
      updated[index] = { ...updated[index], [field]: num };
      if (field === 'unit_price' || field === 'quantity') {
        updated[index].total =
          updated[index].unit_price * updated[index].quantity;
      }
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems(items.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const addItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems([
      ...items,
      { name: '', quantity: 1, unit_price: 0, total: 0, assignedTo: user ? [user.id] : [] },
    ]);
    setEditingIndex(items.length);
  };

  const toggleAssignment = useCallback(
    (itemIndex: number, userId: string) => {
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
    },
    []
  );

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
    const sub = items.reduce((sum, item) => sum + item.total, 0);

    for (const item of items) {
      if (item.assignedTo.length === 0) continue;
      const perPerson = item.total / item.assignedTo.length;
      for (const userId of item.assignedTo) {
        splits.set(userId, (splits.get(userId) || 0) + perPerson);
      }
    }

    const extras = tax + serviceCharge + tip;
    if (extras > 0 && sub > 0) {
      for (const [userId, amount] of splits.entries()) {
        const proportion = amount / sub;
        splits.set(userId, amount + extras * proportion);
      }
    }

    for (const [userId, amount] of splits.entries()) {
      splits.set(userId, Math.round(amount * 100) / 100);
    }

    return splits;
  }, [items, tax, serviceCharge, tip]);

  const getMemberName = useCallback(
    (userId: string) => {
      const member = members.find((m) => m.user_id === userId);
      return (member?.user as any)?.display_name || t('scanner.unknown');
    },
    [members, t]
  );

  const createSharedBill = async () => {
    if (!user) return;
    setSharing(true);
    try {
      const { data: bill, error: billError } = await supabase
        .from('shared_bills')
        .insert({
          group_id: groupId,
          created_by: user.id,
          paid_by: user.id,
          currency: receiptData.currency || 'EGP',
          tax: tax,
          service_charge: serviceCharge,
          tip: tip,
          merchant_name: receiptData.merchant_name || null,
          receipt_image: receiptData.receiptImage || null,
        })
        .select()
        .single();

      if (billError) throw billError;

      const itemInserts = items.map((item, index) => ({
        bill_id: bill.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase
        .from('shared_bill_items')
        .insert(itemInserts);

      if (itemsError) throw itemsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('SharedBill', { billId: bill.id, groupId });
    } catch (err: any) {
      alert.error(t('common.error'), err.message || t('common.error'));
    } finally {
      setSharing(false);
    }
  };

  const handleSave = async () => {
    const unassigned = items.filter((item) => item.assignedTo.length === 0);
    if (unassigned.length > 0) {
      alert.warning(t('scanner.unassignedItems'), t('scanner.assignAllItems'));
      return;
    }

    setSaving(true);
    try {
      const splits = calculateSplits();
      const totalAmount = Array.from(splits.values()).reduce(
        (a, b) => a + b,
        0
      );

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
          tip_amount: tip,
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

      const splitInserts = Array.from(splits.entries()).map(
        ([userId, amount]) => ({
          expense_id: expense.id,
          user_id: userId,
          amount,
        })
      );

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitInserts);
      if (splitsError) throw splitsError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Get users who owe money (splits where user_id !== current user)
      const usersWhoOwe = Array.from(splits.entries()).filter(([userId]) => userId !== user!.id);
      const payerName = profile?.display_name || 'Someone';
      const payerPhone = profile?.phone || null;

      if (usersWhoOwe.length > 0) {
        const lang = i18n.language === 'ar' ? 'ar' : 'en';
        alert.show('success', t('notify.expenseSaved'), t('notify.notifyFriends'), [
          {
            text: t('notify.skip'),
            style: 'cancel',
            onPress: () => navigation.popToTop(),
          },
          {
            text: t('notify.notifyViaWhatsApp'),
            style: 'default',
            onPress: () => {
              const debtors = usersWhoOwe.map(([userId, amount]) => ({
                name: getMemberName(userId),
                amount,
              }));
              const message = generateMultiDebtorNotification(
                payerName, payerPhone, debtors, 'EGP', t('scanner.scannedReceipt'), lang
              );
              shareViaWhatsApp(message);
              navigation.popToTop();
            },
          },
        ]);
      } else {
        navigation.popToTop();
      }
    } catch (error: any) {
      alert.error(t('common.error'), error.message);
    } finally {
      setSaving(false);
    }
  };

  const splits = calculateSplits();
  const assignedCount = items.filter((i) => i.assignedTo.length > 0).length;
  const totalItems = items.length;
  const progressPct = totalItems > 0 ? (assignedCount / totalItems) * 100 : 0;

  const renderItem = useCallback(
    ({ item, index }: { item: AssignableItem; index: number }) => {
      const isEditing = editingIndex === index;

      if (isEditing) {
        return (
          <AnimatedListItem index={index}>
            <ThemedCard style={styles.itemCard} accent>
              <ThemedInput
                value={item.name}
                onChangeText={(v) => updateItem(index, 'name', v)}
                placeholder={t('scanner.itemName')}
                containerStyle={styles.editNameInput}
              />

              <View style={styles.editRow}>
                <ThemedInput
                  label={t('scanner.qty')}
                  value={String(item.quantity)}
                  onChangeText={(v) => updateItem(index, 'quantity', v)}
                  keyboardType="numeric"
                  containerStyle={styles.editField}
                  style={styles.editInputCenter}
                />
                <ThemedInput
                  label={t('scanner.price')}
                  value={String(item.unit_price)}
                  onChangeText={(v) => updateItem(index, 'unit_price', v)}
                  keyboardType="numeric"
                  containerStyle={styles.editField}
                  style={styles.editInputCenter}
                />
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>{t('scanner.total')}</Text>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalBoxText}>
                      {item.total.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.editActions}>
                <BouncyPressable onPress={() => setEditingIndex(null)}>
                  <View style={styles.doneChip}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.doneText}>{t('common.done')}</Text>
                  </View>
                </BouncyPressable>
                <BouncyPressable onPress={() => removeItem(index)}>
                  <View style={styles.deleteChip}>
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.danger}
                    />
                    <Text style={styles.deleteText}>{t('common.delete')}</Text>
                  </View>
                </BouncyPressable>
              </View>

              {/* Assignment chips in edit mode */}
              {members.length > 0 && (
                <View style={styles.assignRow}>
                  {members.map((member) => {
                    const isAssigned = item.assignedTo.includes(member.user_id);
                    const name = (member.user as any)?.display_name || '?';
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <BouncyPressable
                        key={member.user_id}
                        onPress={() => toggleAssignment(index, member.user_id)}
                        scaleDown={0.9}
                      >
                        {isAssigned ? (
                          <LinearGradient
                            colors={colors.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.assignChipGradient}
                          >
                            <Text style={styles.chipInitialActive}>{initial}</Text>
                            <Text
                              style={styles.assignChipTextActive}
                              numberOfLines={1}
                            >
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
                      </BouncyPressable>
                    );
                  })}
                </View>
              )}
            </ThemedCard>
          </AnimatedListItem>
        );
      }

      return (
        <AnimatedListItem index={index}>
          <BouncyPressable
            onPress={() => {
              setEditingIndex(index);
            }}
            scaleDown={0.97}
          >
            <ThemedCard style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameWithDot}>
                    <View
                      style={[
                        styles.itemDot,
                        {
                          backgroundColor:
                            item.assignedTo.length > 0 ? colors.success : colors.danger,
                        },
                      ]}
                    />
                    <Text style={styles.itemName}>
                      {item.name || t('scanner.unnamedItem')}
                    </Text>
                  </View>
                  <Text style={styles.itemDetail}>
                    {item.quantity} x {item.unit_price.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{item.total.toFixed(2)}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  color={colors.textTertiary}
                  style={styles.editIcon}
                />
              </View>

              {/* Assignment chips */}
              {members.length > 0 && (
                <View style={styles.assignRow}>
                  {members.map((member) => {
                    const isAssigned = item.assignedTo.includes(member.user_id);
                    const name = (member.user as any)?.display_name || '?';
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <BouncyPressable
                        key={member.user_id}
                        onPress={() => toggleAssignment(index, member.user_id)}
                        scaleDown={0.9}
                      >
                        {isAssigned ? (
                          <LinearGradient
                            colors={colors.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.assignChipGradient}
                          >
                            <Text style={styles.chipInitialActive}>{initial}</Text>
                            <Text
                              style={styles.assignChipTextActive}
                              numberOfLines={1}
                            >
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
                      </BouncyPressable>
                    );
                  })}
                </View>
              )}
            </ThemedCard>
          </BouncyPressable>
        </AnimatedListItem>
      );
    },
    [editingIndex, members, colors, styles, toggleAssignment, items, t]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={colors.statusBarStyle} />

      <Animated.View style={[styles.header, entrance.style]}>
        <Text style={styles.headerKicker}>{t('scanner.parsed_items')}</Text>
        <Text style={styles.headerTitle}>{t('scanner.edit_items')}</Text>
        <View style={styles.itemCountRow}>
          <LinearGradient
            colors={colors.primaryGradient}
            style={styles.itemCountBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.itemCountText}>{items.length}</Text>
          </LinearGradient>
          <Text style={styles.itemCountLabel}>
            {items.length === 1 ? 'item found' : 'items found'}
          </Text>
        </View>
      </Animated.View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View>
            {/* Add Item Link */}
            <BouncyPressable onPress={addItem}>
              <View style={styles.addItemRow}>
                <LinearGradient
                  colors={colors.primaryGradient}
                  style={styles.addItemIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.addItemText}>{t('scanner.addItem')}</Text>
              </View>
            </BouncyPressable>

            {/* Summary Card */}
            <ThemedCard accent style={styles.summaryCard}>
              <View style={styles.summaryRowFinancial}>
                <Text style={styles.summaryLabel}>{t('scanner.subtotal')}</Text>
                <Text style={styles.summaryValue}>
                  {subtotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.elegantDivider} />

              <View style={styles.summaryRowFinancial}>
                <Text style={styles.summaryLabel}>{t('scanner.tax')}</Text>
                <ThemedInput
                  value={String(tax)}
                  onChangeText={(v) => setTax(parseFloat(v) || 0)}
                  keyboardType="numeric"
                  containerStyle={styles.summaryInputWrap}
                  style={styles.summaryInputStyle}
                />
              </View>

              <View style={styles.elegantDivider} />

              <View style={styles.summaryRowFinancial}>
                <Text style={styles.summaryLabel}>
                  {t('scanner.service_charge')}
                </Text>
                <ThemedInput
                  value={String(serviceCharge)}
                  onChangeText={(v) => setServiceCharge(parseFloat(v) || 0)}
                  keyboardType="numeric"
                  containerStyle={styles.summaryInputWrap}
                  style={styles.summaryInputStyle}
                />
              </View>

              <View style={styles.elegantDivider} />

              {/* Tip */}
              <View style={styles.tipSection}>
                <Text style={styles.summaryLabel}>{t('scanner.tip')}</Text>
                <View style={styles.tipPillsRow}>
                  {TIP_PRESETS.map((pct) => (
                    <BouncyPressable
                      key={pct}
                      onPress={() => applyTipPct(pct)}
                      scaleDown={0.92}
                    >
                      <View style={[styles.tipPill, tipPct === pct && styles.tipPillActive]}>
                        <Text style={[styles.tipPillText, tipPct === pct && styles.tipPillTextActive]}>
                          {pct}%
                        </Text>
                      </View>
                    </BouncyPressable>
                  ))}
                  <BouncyPressable
                    onPress={() => setTipPct(null)}
                    scaleDown={0.92}
                  >
                    <View style={[styles.tipPill, tipPct === null && styles.tipPillActive]}>
                      <Text style={[styles.tipPillText, tipPct === null && styles.tipPillTextActive]}>
                        {t('scanner.custom')}
                      </Text>
                    </View>
                  </BouncyPressable>
                </View>
                {tipPct === null && (
                  <ThemedInput
                    value={String(tip)}
                    onChangeText={(v) => setTip(parseFloat(v) || 0)}
                    keyboardType="numeric"
                    containerStyle={styles.summaryInputWrap}
                    style={styles.summaryInputStyle}
                  />
                )}
                {tipPct !== null && tip > 0 && (
                  <Text style={styles.tipAmount}>{tip.toFixed(2)}</Text>
                )}
              </View>

              <View style={styles.totalDivider} />

              <View style={styles.summaryRowFinancial}>
                <Text style={styles.totalLabel}>{t('scanner.total')}</Text>
                <Text style={styles.totalValue}>
                  {total.toFixed(2)} {receiptData.currency}
                </Text>
              </View>
            </ThemedCard>

            {/* Section 2: Split Assignment */}
            <View style={styles.assignSectionHeader}>
              <Text style={styles.assignSectionKicker}>{t('scanner.assign_items')}</Text>
              <Text style={styles.assignSectionTitle}>{t('scanner.assign_subtitle')}</Text>

              {/* Progress bar */}
              <View style={styles.progressRow}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progressPct}%`,
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

            {/* Quick-assign member avatars */}
            {members.length > 0 && (
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
                    <BouncyPressable
                      key={member.user_id}
                      onPress={() =>
                        allAssigned
                          ? unassignAllFromUser(member.user_id)
                          : assignAllToUser(member.user_id)
                      }
                      scaleDown={0.92}
                    >
                      <View style={styles.quickAvatarColumn}>
                        <LinearGradient
                          colors={
                            allAssigned
                              ? colors.primaryGradient
                              : isDark
                              ? [colors.bgSubtle, colors.bgSubtle]
                              : [colors.borderLight, colors.borderLight]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.quickAvatarCircle}
                        >
                          <Text
                            style={[
                              styles.quickAvatarInitial,
                              allAssigned && styles.quickAvatarInitialActive,
                            ]}
                          >
                            {initial}
                          </Text>
                        </LinearGradient>
                        <Text
                          style={[
                            styles.quickAvatarName,
                            allAssigned && { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {name.split(' ')[0]}
                        </Text>
                        {allAssigned && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={colors.success}
                            style={styles.quickCheck}
                          />
                        )}
                      </View>
                    </BouncyPressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Split summary per member */}
            {splits.size > 0 && (
              <ThemedCard accent style={styles.splitSummaryCard}>
                <Text style={styles.splitSummaryTitle}>{t('scanner.summary')}</Text>
                {Array.from(splits.entries()).map(([userId, amount]) => (
                  <View key={userId} style={styles.splitSummaryRow}>
                    <View style={styles.splitSummaryNameRow}>
                      <LinearGradient
                        colors={colors.primaryGradient}
                        style={styles.splitSummaryDot}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      <Text style={styles.splitSummaryName}>{getMemberName(userId)}</Text>
                    </View>
                    <Text style={styles.splitSummaryAmount}>
                      {amount.toFixed(2)} {t('common.egp')}
                    </Text>
                  </View>
                ))}
              </ThemedCard>
            )}

            {/* Spacer for bottom buttons */}
            <View style={{ height: 140 }} />
          </View>
        }
      />

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity onPress={createSharedBill} disabled={sharing}>
          <Text style={styles.shareLink}>
            {sharing ? t('common.loading') : t('shared_bill.share_with_group')}
          </Text>
        </TouchableOpacity>
        <FunButton
          title={saving ? t('common.loading') : t('scanner.confirm_split')}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          icon={
            <Ionicons
              name="checkmark-done-outline"
              size={20}
              color="#FFFFFF"
            />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    /* Header */
    header: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
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
      fontSize: 26,
      letterSpacing: -0.5,
      color: c.text,
    },
    itemCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    itemCountBadge: {
      width: 28,
      height: 28,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemCountText: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 13,
      color: '#FFFFFF',
    },
    itemCountLabel: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textTertiary,
    },

    /* List */
    list: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: 20,
    },

    /* Item cards */
    itemCard: {
      marginTop: Spacing.sm,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
    },
    itemNameWithDot: {
      flexDirection: 'row',
      alignItems: 'center',
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
    itemDetail: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginTop: 2,
      marginLeft: 16,
    },
    itemTotal: {
      fontSize: 16,
      fontFamily: FontFamily.bodyBold,
      color: c.text,
    },
    editIcon: {
      marginLeft: Spacing.sm,
    },

    /* Edit mode */
    editNameInput: {
      marginBottom: Spacing.sm,
    },
    editRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    editField: {
      flex: 1,
    },
    editInputCenter: {
      textAlign: 'center',
    },
    editLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    totalBox: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    totalBoxText: {
      fontSize: 16,
      fontFamily: FontFamily.bodySemibold,
      color: c.text,
    },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
    },
    doneChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(27,122,108,0.12)' : c.primarySurface,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
    },
    doneText: {
      color: c.primary,
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
    },
    deleteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(234,88,12,0.1)' : c.dangerLight + '22',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
    },
    deleteText: {
      color: c.danger,
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
    },

    /* Add item */
    addItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    addItemIcon: {
      width: 28,
      height: 28,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addItemText: {
      color: c.primary,
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
    },

    /* Summary card (financial) */
    summaryCard: {
      marginTop: Spacing.lg,
    },
    summaryRowFinancial: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    summaryLabel: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
      color: c.text,
    },
    summaryInputWrap: {
      width: 90,
    },
    summaryInputStyle: {
      textAlign: 'center',
      fontSize: 14,
      paddingVertical: 8,
    },
    elegantDivider: {
      height: 1,
      backgroundColor: c.borderLight,
    },
    /* Tip section */
    tipSection: {
      paddingVertical: Spacing.sm,
    },
    tipPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: Spacing.sm,
    },
    tipPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F2',
    },
    tipPillActive: {
      backgroundColor: c.primary,
    },
    tipPillText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: c.textSecondary,
    },
    tipPillTextActive: {
      color: '#FFFFFF',
    },
    tipAmount: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.primary,
      textAlign: 'right',
      marginTop: Spacing.sm,
    },

    totalDivider: {
      height: 2,
      backgroundColor: c.border,
      marginTop: Spacing.sm,
    },
    totalLabel: {
      fontSize: 16,
      fontFamily: FontFamily.bodyBold,
      color: c.text,
    },
    totalValue: {
      fontSize: 16,
      fontFamily: FontFamily.bodyBold,
      color: c.primary,
    },

    /* Assignment section header */
    assignSectionHeader: {
      marginTop: Spacing.xl,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    assignSectionKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: c.kicker,
      textTransform: 'uppercase',
      marginBottom: Spacing.xs,
    },
    assignSectionTitle: {
      fontFamily: FontFamily.display,
      fontSize: 22,
      color: c.text,
      letterSpacing: -0.5,
    },

    /* Progress bar */
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

    /* Quick-assign avatars */
    quickAssignRow: {
      maxHeight: 90,
      marginTop: Spacing.md,
    },
    quickAssignContent: {
      gap: Spacing.lg,
    },
    quickAvatarColumn: {
      alignItems: 'center',
      width: 60,
    },
    quickAvatarCircle: {
      width: 48,
      height: 48,
      borderRadius: Radius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickAvatarInitial: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
      color: c.textSecondary,
    },
    quickAvatarInitialActive: {
      color: '#FFFFFF',
    },
    quickAvatarName: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 4,
    },
    quickCheck: {
      position: 'absolute',
      top: 0,
      right: 4,
    },

    /* Assignment chips on items */
    assignRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: Spacing.sm,
      gap: 6,
    },
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

    /* Split summary card */
    splitSummaryCard: {
      marginTop: Spacing.lg,
    },
    splitSummaryTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    splitSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    splitSummaryNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    splitSummaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    splitSummaryName: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    splitSummaryAmount: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 14,
      color: c.text,
    },

    /* Bottom buttons */
    bottomButtons: {
      position: 'absolute',
      bottom: 32,
      left: Spacing.xl,
      right: Spacing.xl,
      gap: Spacing.sm,
    },
    shareLink: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: c.primary,
      textAlign: 'center',
      paddingVertical: Spacing.sm,
      textDecorationLine: 'underline',
    },
  });
