import React, { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { GroupMember, ParsedReceiptItem } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AssignItems'>;

interface AssignableItem extends ParsedReceiptItem {
  assignedTo: string[]; // user IDs
}

export default function AssignItemsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { groupId, items: rawItems, tax, serviceCharge } = route.params;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [items, setItems] = useState<AssignableItem[]>(
    rawItems.map((item) => ({ ...item, assignedTo: [] }))
  );
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
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

  const toggleAssignment = (itemIndex: number, userId: string) => {
    const updated = [...items];
    const assigned = updated[itemIndex].assignedTo;
    if (assigned.includes(userId)) {
      updated[itemIndex].assignedTo = assigned.filter((id) => id !== userId);
    } else {
      updated[itemIndex].assignedTo = [...assigned, userId];
    }
    setItems(updated);
  };

  const calculateSplits = (): Map<string, number> => {
    const splits = new Map<string, number>();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    for (const item of items) {
      if (item.assignedTo.length === 0) continue;
      const perPerson = item.total / item.assignedTo.length;
      for (const userId of item.assignedTo) {
        splits.set(userId, (splits.get(userId) || 0) + perPerson);
      }
    }

    // Distribute tax and service charge proportionally
    const extras = tax + serviceCharge;
    if (extras > 0 && subtotal > 0) {
      for (const [userId, amount] of splits.entries()) {
        const proportion = amount / subtotal;
        splits.set(userId, amount + extras * proportion);
      }
    }

    // Round to 2 decimals
    for (const [userId, amount] of splits.entries()) {
      splits.set(userId, Math.round(amount * 100) / 100);
    }

    return splits;
  };

  const handleSave = async () => {
    const unassigned = items.filter((item) => item.assignedTo.length === 0);
    if (unassigned.length > 0) {
      Alert.alert('Unassigned items', 'Please assign all items to at least one person.');
      return;
    }

    setSaving(true);
    try {
      const splits = calculateSplits();
      const totalAmount = Array.from(splits.values()).reduce((a, b) => a + b, 0);

      // Create the expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          paid_by: user!.id,
          description: 'Scanned receipt',
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

      // Create expense items
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

      // Create item assignments
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

      // Create expense splits
      const splitInserts = Array.from(splits.entries()).map(([userId, amount]) => ({
        expense_id: expense.id,
        user_id: userId,
        amount,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitInserts);
      if (splitsError) throw splitsError;

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
    return (member?.user as any)?.display_name || 'Unknown';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('scanner.assign_items')}</Text>
        <Text style={styles.headerSubtitle}>{t('scanner.assign_subtitle')}</Text>
      </View>

      {/* Gradient member avatars row */}
      <ScrollView horizontal style={styles.membersRow} showsHorizontalScrollIndicator={false}>
        {members.map((member) => {
          const name = (member.user as any)?.display_name || '?';
          const initial = name.charAt(0).toUpperCase();
          return (
            <View key={member.user_id} style={styles.memberChip}>
              <LinearGradient
                colors={[...Gradients.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.memberAvatar}
              >
                <Text style={styles.memberInitial}>{initial}</Text>
              </LinearGradient>
              <Text style={styles.memberName} numberOfLines={1}>
                {name.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.itemCard,
              selectedItemIndex === index && styles.itemCardSelected,
            ]}
            onPress={() => setSelectedItemIndex(selectedItemIndex === index ? null : index)}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{item.total.toFixed(2)}</Text>
            </View>

            {selectedItemIndex === index && (
              <View style={styles.assignRow}>
                {members.map((member) => {
                  const isAssigned = item.assignedTo.includes(member.user_id);
                  const name = (member.user as any)?.display_name || '?';
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[
                        styles.assignChip,
                        isAssigned && styles.assignChipActive,
                      ]}
                      onPress={() => toggleAssignment(index, member.user_id)}
                    >
                      {isAssigned ? (
                        <LinearGradient
                          colors={[...Gradients.primary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.assignChipGradient}
                        >
                          <Text style={styles.assignChipTextActive}>
                            {name.split(' ')[0]}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <Text style={styles.assignChipText}>
                          {name.split(' ')[0]}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {item.assignedTo.length > 0 && selectedItemIndex !== index && (
              <Text style={styles.assignedText}>
                {item.assignedTo.map((id) => getMemberName(id).split(' ')[0]).join(', ')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Elegant summary footer */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>{t('scanner.summary')}</Text>
        {Array.from(splits.entries()).map(([userId, amount]) => (
          <View key={userId} style={styles.summaryRow}>
            <Text style={styles.summaryName}>{getMemberName(userId)}</Text>
            <Text style={styles.summaryAmount}>{amount.toFixed(2)} EGP</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>
            {saving ? t('common.loading') : t('scanner.confirm_split')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  headerTitle: {
    ...Typography.sectionTitle,
  },
  headerSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  membersRow: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    maxHeight: 88,
  },
  memberChip: {
    alignItems: 'center',
    marginRight: Spacing.lg,
    width: 56,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  memberInitial: {
    color: Colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  memberName: {
    ...Typography.caption,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  itemCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  itemCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    ...Typography.bodyBold,
    flex: 1,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
  },
  assignRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  assignChip: {
    borderRadius: Radius.full,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  assignChipActive: {
    backgroundColor: 'transparent',
  },
  assignChipGradient: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  assignChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  assignChipTextActive: {
    fontSize: 13,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  assignedText: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  summaryContainer: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: 36,
    ...Shadows.lg,
  },
  summaryTitle: {
    ...Typography.cardTitle,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  summaryName: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.glow,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  confirmButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
});
