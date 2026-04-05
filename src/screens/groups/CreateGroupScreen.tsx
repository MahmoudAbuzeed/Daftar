import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

import { CurrencyCode } from '../../types/database';

const CURRENCIES: CurrencyCode[] = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'INR', 'PKR', 'TRY', 'CAD', 'AUD', 'BRL'];

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
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [saving, setSaving] = useState(false);

  const entrance = useScreenEntrance();

  const isValid = name.trim().length > 0;

  const handleCreate = async () => {
    if (!user || !isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const inviteCode = generateInviteCode();
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

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'admin' });

      if (memberError) throw memberError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient colors={colors.headerGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={entrance.style}>
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('groups.newCircle')}</Text>
              <Text style={styles.headerTitle}>{t('groups.create')}</Text>
            </View>

            <ThemedCard accent style={styles.formCard}>
              <ThemedInput
                label={t('groups.name')}
                value={name}
                onChangeText={setName}
                placeholder={t('groups.name')}
                maxLength={50}
                autoFocus
                containerStyle={styles.field}
              />

              <ThemedInput
                label={t('groups.description')}
                value={description}
                onChangeText={setDescription}
                placeholder={t('groups.description')}
                multiline
                numberOfLines={3}
                maxLength={200}
                style={styles.textArea}
                containerStyle={styles.field}
              />

              <View style={styles.fieldLast}>
                <Text style={styles.label}>{t('groups.currency')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
                  {CURRENCIES.map((cur) => {
                    const isActive = currency === cur;
                    return (
                      <BouncyPressable
                        key={cur}
                        onPress={() => {
                          setCurrency(cur);
                        }}
                        scaleDown={0.94}
                        style={styles.currencyOption}
                      >
                        {isActive ? (
                          <LinearGradient
                            colors={colors.primaryGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.currencyOptionInner}
                          >
                            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.currencyTextActive}>
                              {cur}
                            </Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.currencyOptionInnerInactive}>
                            <Text style={styles.currencyText}>
                              {cur}
                            </Text>
                          </View>
                        )}
                      </BouncyPressable>
                    );
                  })}
                </ScrollView>
              </View>
            </ThemedCard>

            <FunButton
              title={t('groups.create')}
              onPress={handleCreate}
              loading={saving}
              disabled={!isValid}
              icon={<Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />}
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
    content: { padding: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 60 },

    headerBlock: { marginBottom: Spacing.xxl },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: c.kicker,
      marginBottom: Spacing.xs,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1,
      color: c.text,
    },

    formCard: {
      marginBottom: Spacing.xl,
    },
    field: { marginBottom: Spacing.xl },
    fieldLast: { marginBottom: 0 },
    label: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },

    currencyRow: { flexDirection: 'row', gap: Spacing.md },
    currencyOption: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
    currencyOptionInner: {
      flexDirection: 'row',
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
    },
    currencyOptionInnerInactive: {
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: Radius.lg,
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5,
      borderColor: c.border,
    },
    currencyText: {
      fontSize: 15,
      fontFamily: FontFamily.bodySemibold,
      color: c.textSecondary,
    },
    currencyTextActive: {
      fontSize: 15,
      fontFamily: FontFamily.bodyBold,
      color: '#FFFFFF',
    },
  });
