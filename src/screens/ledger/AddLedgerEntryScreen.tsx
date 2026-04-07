import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';
import ThemedInput from '../../components/ThemedInput';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'AddLedgerEntry'>;
type Direction = 'i_owe' | 'they_owe';

export default function AddLedgerEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();
  const alert = useAlert();

  const [contactName, setContactName] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('they_owe');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = contactName.trim().length > 0 && parseFloat(amount) > 0;

  const handleSave = async () => {
    if (!isValid || !profile) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert.error(t('common.error'), t('ledger.invalidAmount'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const { error } = await supabase.from('ledger_entries').insert({
        user_id: profile.id,
        contact_name: contactName.trim(),
        amount: parsedAmount,
        direction,
        note: note.trim() || null,
        is_settled: false,
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Failed to save ledger entry:', err);
      alert.error(t('common.error'), t('ledger.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient
          colors={colors.headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
        />
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={entrance.style}>
            {/* Header */}
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('ledger.newEntry')}</Text>
              <Text style={styles.headerTitle}>{t('ledger.addEntry')}</Text>
            </View>

            {/* Form Card */}
            <ThemedCard accent style={styles.formCard}>
              <View style={styles.fieldGroup}>
                <ThemedInput
                  label={t('ledger.contactName')}
                  icon="person-outline"
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder={t('ledger.contactNamePlaceholder')}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedInput
                  label={t('ledger.amount')}
                  icon="cash-outline"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Direction Toggle */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('ledger.direction')}</Text>
                <View style={styles.toggleRow}>
                  <BouncyPressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDirection('they_owe');
                    }}
                    style={styles.togglePillWrap}
                    scaleDown={0.94}
                  >
                    <View
                      style={[
                        styles.togglePill,
                        direction === 'they_owe'
                          ? styles.togglePillActiveGreen
                          : styles.togglePillInactive,
                      ]}
                    >
                      {direction === 'they_owe' && (
                        <LinearGradient
                          colors={colors.successGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.toggleGradientBg}
                        />
                      )}
                      <View style={styles.toggleContent}>
                        <Ionicons
                          name="arrow-down-circle"
                          size={20}
                          color={
                            direction === 'they_owe'
                              ? '#FFFFFF'
                              : colors.textTertiary
                          }
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            direction === 'they_owe' && styles.toggleTextActive,
                          ]}
                        >
                          {t('ledger.theyOweMe')}
                        </Text>
                      </View>
                    </View>
                  </BouncyPressable>

                  <BouncyPressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDirection('i_owe');
                    }}
                    style={styles.togglePillWrap}
                    scaleDown={0.94}
                  >
                    <View
                      style={[
                        styles.togglePill,
                        direction === 'i_owe'
                          ? styles.togglePillActiveRed
                          : styles.togglePillInactive,
                      ]}
                    >
                      {direction === 'i_owe' && (
                        <LinearGradient
                          colors={colors.dangerGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.toggleGradientBg}
                        />
                      )}
                      <View style={styles.toggleContent}>
                        <Ionicons
                          name="arrow-up-circle"
                          size={20}
                          color={
                            direction === 'i_owe'
                              ? '#FFFFFF'
                              : colors.textTertiary
                          }
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            direction === 'i_owe' && styles.toggleTextActive,
                          ]}
                        >
                          {t('ledger.iOweThem')}
                        </Text>
                      </View>
                    </View>
                  </BouncyPressable>
                </View>
              </View>

              {/* Note */}
              <View style={styles.fieldGroup}>
                <ThemedInput
                  label={t('ledger.note')}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('ledger.notePlaceholder')}
                  multiline
                  numberOfLines={3}
                  style={styles.noteInput}
                />
              </View>
            </ThemedCard>

            {/* Save Button */}
            <FunButton
              title={t('common.save')}
              onPress={handleSave}
              loading={saving}
              disabled={!isValid}
              icon={
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFFFFF"
                />
              }
              style={styles.saveButton}
            />
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
    scrollContent: { padding: Spacing.xl, paddingBottom: 60 },

    headerBlock: { marginBottom: Spacing.xxl },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: c.kicker,
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1,
      color: c.text,
    },

    formCard: { gap: Spacing.xxl },
    fieldGroup: { gap: Spacing.sm },

    label: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
    },

    toggleRow: { flexDirection: 'row', gap: Spacing.md },
    togglePillWrap: { flex: 1 },
    togglePill: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: c.border,
    },
    togglePillInactive: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
    },
    togglePillActiveGreen: {
      borderColor: 'transparent',
    },
    togglePillActiveRed: {
      borderColor: 'transparent',
    },
    toggleGradientBg: {
      ...StyleSheet.absoluteFillObject,
    },
    toggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 6,
    },
    toggleText: {
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
      color: c.textSecondary,
    },
    toggleTextActive: {
      color: '#FFFFFF',
    },

    noteInput: { minHeight: 88, textAlignVertical: 'top' },

    saveButton: { marginTop: Spacing.xxl },
  });
