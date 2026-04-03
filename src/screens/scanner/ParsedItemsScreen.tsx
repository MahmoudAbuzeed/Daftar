import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { ParsedReceiptItem } from '../../types/database';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ParsedItems'>;

export default function ParsedItemsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const { groupId, receiptData } = route.params;

  const [items, setItems] = useState<ParsedReceiptItem[]>(receiptData.items);
  const [tax, setTax] = useState(receiptData.tax || 0);
  const [serviceCharge, setServiceCharge] = useState(
    receiptData.service_charge || 0
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal + tax + serviceCharge;

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
    setItems([...items, { name: '', quantity: 1, unit_price: 0, total: 0 }]);
    setEditingIndex(items.length);
  };

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

  const renderItem = ({
    item,
    index,
  }: {
    item: ParsedReceiptItem;
    index: number;
  }) => {
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
                <Text style={styles.itemName}>
                  {item.name || t('scanner.unnamedItem')}
                </Text>
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
          </ThemedCard>
        </BouncyPressable>
      </AnimatedListItem>
    );
  };

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
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('scanner.subtotal')}</Text>
                <Text style={styles.summaryValue}>
                  {subtotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.elegantDivider} />

              <View style={styles.summaryRow}>
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

              <View style={styles.summaryRow}>
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

              <View style={styles.totalDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>{t('scanner.total')}</Text>
                <Text style={styles.totalValue}>
                  {total.toFixed(2)} {receiptData.currency}
                </Text>
              </View>
            </ThemedCard>
          </View>
        }
      />

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <FunButton
          title={t('shared_bill.share_with_group')}
          onPress={createSharedBill}
          loading={sharing}
          icon={<Ionicons name="people-outline" size={18} color="#FFFFFF" />}
        />
        <FunButton
          title={t('shared_bill.assign_myself')}
          onPress={() =>
            navigation.replace('AssignItems', {
              groupId,
              items,
              tax,
              serviceCharge,
            })
          }
          variant="secondary"
          icon={<Ionicons name="person-outline" size={18} color={colors.primary} />}
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
      paddingBottom: 120,
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
    itemName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.text,
    },
    itemDetail: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginTop: 2,
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

    /* Summary card */
    summaryCard: {
      marginTop: Spacing.lg,
    },
    summaryRow: {
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

    /* Bottom buttons */
    bottomButtons: {
      position: 'absolute',
      bottom: 32,
      left: Spacing.xl,
      right: Spacing.xl,
      gap: Spacing.sm,
    },
  });
