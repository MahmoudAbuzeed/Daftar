// @ts-nocheck — DEPRECATED: This screen has been merged into ParsedItemsScreen
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Animated,
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
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { generateMultiDebtorNotification, shareViaWhatsApp } from '../../utils/whatsapp';

// This screen has been merged into ParsedItemsScreen
type Props = NativeStackScreenProps<RootStackParamList, 'ParsedItems'>;

interface AssignableItem extends ParsedReceiptItem {
  assignedTo: string[];
}

export default function AssignItemsScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { groupId, items: rawItems, tax, serviceCharge, tip = 0 } = route.params;
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();

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
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    for (const item of items) {
      if (item.assignedTo.length === 0) continue;
      const perPerson = item.total / item.assignedTo.length;
      for (const userId of item.assignedTo) {
        splits.set(userId, (splits.get(userId) || 0) + perPerson);
      }
    }

    const extras = tax + serviceCharge + tip;
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
  }, [items, tax, serviceCharge, tip]);

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
  const getMemberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return (member?.user as any)?.display_name || t('scanner.unknown');
  };

  const assignedCount = items.filter((i) => i.assignedTo.length > 0).length;
  const totalItems = items.length;
  const progressPct = totalItems > 0 ? (assignedCount / totalItems) * 100 : 0;

  const renderItem = useCallback(
    ({ item, index }: { item: AssignableItem; index: number }) => (
      <AnimatedListItem index={index}>
        <ThemedCard style={styles.itemCard}>
          {/* Item header */}
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

          {/* Assignment chips */}
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
        </ThemedCard>
      </AnimatedListItem>
    ),
    [members, colors, styles, toggleAssignment]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, entrance.style]}>
        <Text style={styles.headerKicker}>{t('scanner.assign_items')}</Text>
        <Text style={styles.headerTitle}>{t('scanner.assign_subtitle')}</Text>

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
      </Animated.View>

      {/* Quick-assign member avatars */}
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

      {/* Item list */}
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />

      {/* Summary footer */}
      <ThemedCard style={styles.summaryContainer} accent>
        <Text style={styles.summaryTitle}>{t('scanner.summary')}</Text>

        {Array.from(splits.entries()).map(([userId, amount]) => (
          <View key={userId} style={styles.summaryRow}>
            <View style={styles.summaryNameRow}>
              <LinearGradient
                colors={colors.primaryGradient}
                style={styles.summaryDot}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.summaryName}>{getMemberName(userId)}</Text>
            </View>
            <Text style={styles.summaryAmount}>
              {amount.toFixed(2)} {t('common.egp')}
            </Text>
          </View>
        ))}

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
          style={styles.confirmButton}
        />
      </ThemedCard>
    </View>
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
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
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
      color: c.text,
      letterSpacing: -0.5,
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

    /* Quick-assign avatars */
    quickAssignRow: {
      maxHeight: 90,
      marginTop: Spacing.md,
    },
    quickAssignContent: {
      paddingHorizontal: Spacing.lg,
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

    /* List */
    list: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },

    /* Item cards */
    itemCard: {
      marginBottom: Spacing.sm,
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

    /* Assignment chips */
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

    /* Summary footer */
    summaryContainer: {
      borderRadius: 0,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderBottomWidth: 0,
      paddingBottom: 36,
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
      alignItems: 'center',
      paddingVertical: 4,
    },
    summaryNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
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
      marginTop: Spacing.md,
    },
  });
