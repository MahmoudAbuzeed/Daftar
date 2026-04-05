import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import AnimatedListItem from '../../components/AnimatedListItem';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { useSubscription } from '../../lib/subscription-context';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/balance';
import { RecurringExpense, GroupMember, User } from '../../types/database';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'RecurringExpenses'>;
type Frequency = 'weekly' | 'biweekly' | 'monthly';

const FREQ_COLORS: Record<Frequency, [string, string]> = {
  weekly: ['#0D9488', '#14B8A6'],
  biweekly: ['#D97706', '#FBBF24'],
  monthly: ['#7C3AED', '#A78BFA'],
};

export default function RecurringExpensesScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { isPro } = useSubscription();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>('EGP');

  // Form state
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: group } = await supabase.from('groups').select('currency').eq('id', groupId).single();
      if (group) setCurrency(group.currency);

      const { data: membersData } = await supabase
        .from('group_members').select('*, user:users(*)').eq('group_id', groupId);
      setMembers(membersData || []);

      const { data } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('next_due', { ascending: true });
      setItems((data || []) as RecurringExpense[]);
    } catch {} finally { setLoading(false); }
  }, [user, groupId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const openAddModal = () => {
    if (!isPro) {
      navigation.navigate('Paywall', { trigger: 'recurring' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDescription('');
    setAmount('');
    setFrequency('monthly');
    setSelectedMembers(members.map(m => m.user_id));
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!description.trim() || !amount.trim()) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setSaving(true);
    try {
      const nextDue = new Date();
      if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
      else if (frequency === 'biweekly') nextDue.setDate(nextDue.getDate() + 14);
      else nextDue.setMonth(nextDue.getMonth() + 1);

      const { data: rec, error: recErr } = await supabase
        .from('recurring_expenses')
        .insert({
          group_id: groupId,
          created_by: user!.id,
          description: description.trim(),
          amount: parsedAmount,
          currency,
          split_type: 'equal',
          frequency,
          next_due: nextDue.toISOString().split('T')[0],
          is_active: true,
        })
        .select()
        .single();
      if (recErr) throw recErr;

      const memberInserts = selectedMembers.map(uid => ({
        recurring_id: rec.id,
        user_id: uid,
        share_amount: Math.round((parsedAmount / selectedMembers.length) * 100) / 100,
      }));
      await supabase.from('recurring_expense_members').insert(memberInserts);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      alert.error(t('common.error'), err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    alert.confirm(t('recurring.delete'), t('recurring.deleteConfirm'), async () => {
      await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    }, t('recurring.delete'), t('common.cancel'), true);
  };

  const toggleMember = (uid: string) => {
    Haptics.selectionAsync();
    setSelectedMembers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const renderItem = ({ item, index }: { item: RecurringExpense; index: number }) => (
    <AnimatedListItem index={index}>
      <ThemedCard>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemDesc}>{item.description}</Text>
            <View style={styles.itemMeta}>
              <LinearGradient colors={FREQ_COLORS[item.frequency]} style={styles.freqBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.freqText}>{t(`recurring.${item.frequency}`)}</Text>
              </LinearGradient>
              <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
              <Text style={styles.dueText}>{t('recurring.nextDue')}: {item.next_due}</Text>
            </View>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemAmount}>{formatCurrency(item.amount, item.currency)}</Text>
            {item.created_by === user?.id && (
              <BouncyPressable onPress={() => handleDelete(item.id)}>
                <View style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </View>
              </BouncyPressable>
            )}
          </View>
        </View>
      </ThemedCard>
    </AnimatedListItem>
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={colors.statusBarStyle} />
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />}

      <SafeAreaView style={styles.safe}>
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="repeat-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('recurring.noRecurring')}</Text>
              <Text style={styles.emptySub}>{t('recurring.noRecurringSubtitle')}</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {/* FAB */}
        <BouncyPressable onPress={openAddModal} style={styles.fab}>
          <LinearGradient colors={colors.primaryGradient} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Ionicons name="add" size={26} color="#FFF" />
          </LinearGradient>
        </BouncyPressable>
      </SafeAreaView>

      {/* Add Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.bgCard }]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('recurring.addNew')}</Text>

            <ThemedInput label={t('recurring.description')} icon="pencil-outline" value={description} onChangeText={setDescription} placeholder={t('recurring.description')} containerStyle={{ marginBottom: Spacing.lg }} />
            <ThemedInput label={t('recurring.amount')} icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" containerStyle={{ marginBottom: Spacing.lg }} />

            <Text style={styles.fieldLabel}>{t('recurring.frequency')}</Text>
            <View style={styles.freqRow}>
              {(['weekly', 'biweekly', 'monthly'] as Frequency[]).map(f => (
                <BouncyPressable key={f} onPress={() => { Haptics.selectionAsync(); setFrequency(f); }} scaleDown={0.95}>
                  <View style={[styles.freqPill, frequency === f && styles.freqPillActive]}>
                    <Text style={[styles.freqPillText, frequency === f && styles.freqPillTextActive]}>{t(`recurring.${f}`)}</Text>
                  </View>
                </BouncyPressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('recurring.members')}</Text>
            <ScrollView style={styles.memberList}>
              {members.map(m => {
                const u = m.user as unknown as User | null;
                const selected = selectedMembers.includes(m.user_id);
                return (
                  <BouncyPressable key={m.user_id} onPress={() => toggleMember(m.user_id)}>
                    <View style={styles.memberRow}>
                      <Text style={styles.memberName}>{u?.display_name || t('common.unknown')}</Text>
                      <Switch value={selected} onValueChange={() => toggleMember(m.user_id)}
                        trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB', true: `${colors.primary}66` }}
                        thumbColor={selected ? colors.primaryLight : isDark ? '#4A5F59' : '#9CA3AF'}
                      />
                    </View>
                  </BouncyPressable>
                );
              })}
            </ScrollView>

            <FunButton title={t('recurring.create')} onPress={handleCreate} loading={saving} disabled={!description.trim() || !amount.trim()} icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />} style={{ marginTop: Spacing.lg }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: Spacing.xl, gap: Spacing.md },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyWrap: { alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxxl },
    emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: 18, color: c.text },
    emptySub: { fontFamily: FontFamily.body, fontSize: 14, color: c.textTertiary, textAlign: 'center', lineHeight: 22 },

    itemRow: { flexDirection: 'row', alignItems: 'center' },
    itemInfo: { flex: 1, marginRight: Spacing.md },
    itemDesc: { fontFamily: FontFamily.bodySemibold, fontSize: 16, color: c.text },
    itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    freqBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
    freqText: { fontFamily: FontFamily.bodySemibold, fontSize: 11, color: '#FFF', letterSpacing: 0.3 },
    dueText: { fontFamily: FontFamily.body, fontSize: 12, color: c.textTertiary },
    itemRight: { alignItems: 'flex-end', gap: 8 },
    itemAmount: { fontFamily: FontFamily.bodyBold, fontSize: 18, color: c.text, letterSpacing: -0.3 },
    deleteBtn: { padding: 6, borderRadius: 8, backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FEF2F2' },

    fab: { position: 'absolute', bottom: 24, end: 20, shadowColor: c.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
    fabGradient: { width: 60, height: 60, borderRadius: Radius.xl, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xxl, paddingBottom: 40, borderWidth: 1, borderColor: c.border },
    modalHandle: { width: 40, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xl },
    modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: 20, color: c.text, marginBottom: Spacing.xl },
    fieldLabel: { fontFamily: FontFamily.bodySemibold, fontSize: 11, letterSpacing: 1.5, color: isDark ? c.kicker : c.textSecondary, textTransform: 'uppercase', marginBottom: Spacing.sm },
    freqRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
    freqPill: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.borderLight },
    freqPillActive: { backgroundColor: c.primary },
    freqPillText: { fontFamily: FontFamily.bodySemibold, fontSize: 13, color: c.textTertiary },
    freqPillTextActive: { color: '#FFF' },
    memberList: { maxHeight: 200, marginBottom: Spacing.sm },
    memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    memberName: { fontFamily: FontFamily.bodyMedium, fontSize: 15, color: c.text },
  });
