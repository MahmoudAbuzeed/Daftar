import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ParsedReceiptItem } from '../../types/database';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ParsedItems'>;

export default function ParsedItemsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { groupId, receiptData } = route.params;
  const [items, setItems] = useState<ParsedReceiptItem[]>(receiptData.items);
  const [tax, setTax] = useState(receiptData.tax || 0);
  const [serviceCharge, setServiceCharge] = useState(receiptData.service_charge || 0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + tax + serviceCharge;

  const updateItem = (index: number, field: keyof ParsedReceiptItem, value: string) => {
    const updated = [...items];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value };
    } else {
      const num = parseFloat(value) || 0;
      updated[index] = { ...updated[index], [field]: num };
      if (field === 'unit_price' || field === 'quantity') {
        updated[index].total = updated[index].unit_price * updated[index].quantity;
      }
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unit_price: 0, total: 0 }]);
    setEditingIndex(items.length);
  };

  const renderItem = ({ item, index }: { item: ParsedReceiptItem; index: number }) => {
    const isEditing = editingIndex === index;

    if (isEditing) {
      return (
        <View style={styles.itemCard}>
          <TextInput
            style={styles.editInput}
            value={item.name}
            onChangeText={(v) => updateItem(index, 'name', v)}
            placeholder="Item name"
            placeholderTextColor={Colors.textTertiary}
          />
          <View style={styles.editRow}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Qty</Text>
              <TextInput
                style={styles.editInputSmall}
                value={String(item.quantity)}
                onChangeText={(v) => updateItem(index, 'quantity', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Price</Text>
              <TextInput
                style={styles.editInputSmall}
                value={String(item.unit_price)}
                onChangeText={(v) => updateItem(index, 'unit_price', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Total</Text>
              <Text style={styles.totalText}>{item.total.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.editActions}>
            <TouchableOpacity onPress={() => setEditingIndex(null)}>
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeItem(index)}>
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.itemCard} onPress={() => setEditingIndex(index)}>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name || 'Unnamed item'}</Text>
            <Text style={styles.itemDetail}>
              {item.quantity} x {item.unit_price.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.itemTotal}>{item.total.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('scanner.parsed_items')}</Text>
        <Text style={styles.headerSubtitle}>{t('scanner.edit_items')}</Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <View>
            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Text style={styles.addItemText}>+ Add Item</Text>
            </TouchableOpacity>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.elegantDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('scanner.tax')}</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={String(tax)}
                  onChangeText={(v) => setTax(parseFloat(v) || 0)}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.elegantDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('scanner.service_charge')}</Text>
                <TextInput
                  style={styles.summaryInput}
                  value={String(serviceCharge)}
                  onChangeText={(v) => setServiceCharge(parseFloat(v) || 0)}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.totalDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>{t('scanner.total')}</Text>
                <Text style={styles.totalValue}>
                  {total.toFixed(2)} {receiptData.currency}
                </Text>
              </View>
            </View>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.nextButton}
        activeOpacity={0.8}
        onPress={() =>
          navigation.replace('AssignItems', {
            groupId,
            items,
            tax,
            serviceCharge,
          })
        }
      >
        <Text style={styles.nextButtonText}>{t('common.next')}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.sectionTitle,
  },
  headerSubtitle: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
  },
  itemCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.bodyBold,
  },
  itemDetail: {
    ...Typography.caption,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  editInput: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  editField: {
    flex: 1,
  },
  editLabel: {
    ...Typography.label,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  editInputSmall: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    padding: Spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  doneText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  deleteText: {
    color: Colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  addItemButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addItemText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    ...Shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body,
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  summaryInput: {
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 6,
    width: 80,
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  elegantDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  totalDivider: {
    height: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  nextButton: {
    position: 'absolute',
    bottom: 32,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.glow,
  },
  nextButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
});
