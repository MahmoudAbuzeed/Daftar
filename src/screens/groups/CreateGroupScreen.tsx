import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Animated,
  Easing,
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
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [saving, setSaving] = useState(false);

  const entrance = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, []);

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
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const animateBtnPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }),
    ]).start();
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
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('groups.newCircle')}</Text>
              <Text style={styles.headerTitle}>{t('groups.create')}</Text>
            </View>

            <View style={styles.formCard}>
              {isDark && (
                <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              )}
              <View style={styles.cardAccent} />

              <View style={styles.field}>
                <Text style={styles.label}>{t('groups.name')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('groups.name')}
                  placeholderTextColor={colors.textTertiary}
                  maxLength={50}
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('groups.description')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('groups.description')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>

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
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCurrency(cur);
                        }}
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

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.createButton, !isValid && styles.createButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => { animateBtnPress(); handleCreate(); }}
                disabled={!isValid || saving}
              >
                <LinearGradient
                  colors={isValid ? colors.primaryGradient : [colors.primaryDark, colors.primaryDark]}
                  style={styles.createBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.5 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.createButtonText}>{t('groups.create')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
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
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: isDark ? undefined : c.bgCard,
      padding: Spacing.xl,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
      shadowColor: c.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 4,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: c.accent,
      opacity: isDark ? 0.5 : 0.35,
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
    input: {
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: FontFamily.body,
      color: c.text,
    },
    textArea: { minHeight: 80, paddingTop: 14 },

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

    createButton: { borderRadius: Radius.lg, overflow: 'hidden' },
    createButtonDisabled: { opacity: 0.5 },
    createBtnGradient: {
      flexDirection: 'row',
      paddingVertical: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
    },
    createButtonText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.bodyBold,
      fontSize: 17,
      letterSpacing: 0.3,
    },
  });
