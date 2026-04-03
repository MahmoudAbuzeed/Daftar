import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddDaftarEntry'>;

type Direction = 'i_owe' | 'they_owe';

export default function AddDaftarEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();

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
      Alert.alert(t('common.error'), t('daftar.invalidAmount'));
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('daftar_entries').insert({
        user_id: profile.id,
        contact_name: contactName.trim(),
        amount: parsedAmount,
        direction,
        note: note.trim() || null,
        is_settled: false,
      });

      if (error) throw error;

      navigation.goBack();
    } catch (err) {
      console.error('Failed to save daftar entry:', err);
      Alert.alert(t('common.error'), t('daftar.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('daftar.addEntry')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Gradient accent line under header */}
      <LinearGradient
        colors={[...Gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerAccentLine}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Floating Form Card */}
          <View style={styles.formCard}>
            {/* Contact Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('daftar.contactName')}</Text>
              <TextInput
                style={styles.input}
                value={contactName}
                onChangeText={setContactName}
                placeholder={t('daftar.contactNamePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('daftar.amount')}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Direction Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('daftar.direction')}</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    direction === 'they_owe' && styles.toggleButtonActiveGreen,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setDirection('they_owe')}
                >
                  {direction === 'they_owe' && (
                    <LinearGradient
                      colors={[...Gradients.success]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.toggleGradientBorder}
                    />
                  )}
                  <View style={[
                    styles.toggleInner,
                    direction === 'they_owe' && styles.toggleInnerActiveGreen,
                  ]}>
                    <Text
                      style={[
                        styles.toggleText,
                        direction === 'they_owe' && styles.toggleTextActiveGreen,
                      ]}
                    >
                      {t('daftar.theyOweMe')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    direction === 'i_owe' && styles.toggleButtonActiveRed,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setDirection('i_owe')}
                >
                  {direction === 'i_owe' && (
                    <LinearGradient
                      colors={[...Gradients.danger]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.toggleGradientBorder}
                    />
                  )}
                  <View style={[
                    styles.toggleInner,
                    direction === 'i_owe' && styles.toggleInnerActiveRed,
                  ]}>
                    <Text
                      style={[
                        styles.toggleText,
                        direction === 'i_owe' && styles.toggleTextActiveRed,
                      ]}
                    >
                      {t('daftar.iOweThem')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Note */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('daftar.note')}</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder={t('daftar.notePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
  },
  headerAccentLine: {
    height: 3,
    borderRadius: 2,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  headerTitle: {
    ...Typography.sectionTitle,
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.xxl,
    ...Shadows.md,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.label,
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
  noteInput: {
    minHeight: 88,
    paddingTop: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  toggleButton: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: '#F8F7F5',
  },
  toggleGradientBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  toggleInner: {
    margin: 2,
    paddingVertical: 14,
    borderRadius: Radius.lg - 2,
    backgroundColor: '#F8F7F5',
    alignItems: 'center',
  },
  toggleButtonActiveGreen: {
    borderColor: 'transparent',
  },
  toggleButtonActiveRed: {
    borderColor: 'transparent',
  },
  toggleInnerActiveGreen: {
    backgroundColor: Colors.successSurface,
  },
  toggleInnerActiveRed: {
    backgroundColor: Colors.dangerSurface,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleTextActiveGreen: {
    color: Colors.success,
  },
  toggleTextActiveRed: {
    color: Colors.danger,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xxl,
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
