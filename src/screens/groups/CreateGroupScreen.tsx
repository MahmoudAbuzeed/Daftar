import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors, Gradients, Spacing, Radius, Typography, Shadows, CommonStyles } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

const CURRENCIES: Array<'EGP' | 'USD'> = ['EGP', 'USD'];

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateGroupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [saving, setSaving] = useState(false);

  const isValid = name.trim().length > 0;

  const handleCreate = async () => {
    if (!user || !isValid) return;

    setSaving(true);

    try {
      const inviteCode = generateInviteCode();

      // Insert group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          currency,
          invite_code: inviteCode,
          created_by: user.id,
          is_archived: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      navigation.goBack();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.sectionTitle}>{t('groups.create')}</Text>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Group Name */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('groups.name')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('groups.name')}
                placeholderTextColor={Colors.textTertiary}
                maxLength={50}
                autoFocus
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('groups.description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('groups.description')}
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                maxLength={200}
                textAlignVertical="top"
              />
            </View>

            {/* Currency Picker */}
            <View style={styles.fieldLast}>
              <Text style={styles.label}>{t('groups.currency')}</Text>
              <View style={styles.currencyRow}>
                {CURRENCIES.map((cur) => {
                  const isActive = currency === cur;
                  return (
                    <TouchableOpacity
                      key={cur}
                      style={styles.currencyOption}
                      activeOpacity={0.7}
                      onPress={() => setCurrency(cur)}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={Gradients.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.currencyOptionInner}
                        >
                          <Text style={styles.currencyTextActive}>
                            {cur === 'EGP' ? `${t('common.egp')} (E\u00A3)` : `${t('common.usd')} ($)`}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.currencyOptionInnerInactive}>
                          <Text style={styles.currencyText}>
                            {cur === 'EGP' ? `${t('common.egp')} (E\u00A3)` : `${t('common.usd')} ($)`}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, !isValid && styles.createButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleCreate}
            disabled={!isValid || saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} size="small" />
            ) : (
              <Text style={styles.createButtonText}>{t('groups.create')}</Text>
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
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    ...Typography.screenTitle,
    marginBottom: Spacing.xxl,
  },
  // Form card
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
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
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  // Currency picker
  currencyRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  currencyOption: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  currencyOptionInner: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  currencyOptionInnerInactive: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radius.lg,
    backgroundColor: '#F8F7F5',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  currencyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  currencyTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  // Create button
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.glow,
  },
  createButtonDisabled: {
    backgroundColor: Colors.primaryLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    color: Colors.textOnPrimary,
    ...Typography.button,
  },
});
