import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddDaftarEntry'>;
type Direction = 'i_owe' | 'they_owe';

export default function AddDaftarEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [contactName, setContactName] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('they_owe');
  const [note, setNote] = useState('');
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

  const isValid = contactName.trim().length > 0 && parseFloat(amount) > 0;

  const handleSave = async () => {
    if (!isValid || !profile) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('common.error'), t('daftar.invalidAmount'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Failed to save daftar entry:', err);
      Alert.alert(t('common.error'), t('daftar.saveFailed'));
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
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}>
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('daftar.newEntry')}</Text>
              <Text style={styles.headerTitle}>{t('daftar.addEntry')}</Text>
            </View>

            <View style={styles.formCard}>
              {isDark && (
                <LinearGradient colors={colors.cardGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              )}
              <View style={styles.cardAccent} />

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('daftar.contactName')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder={t('daftar.contactNamePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                    autoFocus
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('daftar.amount')}</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="cash-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputWithIcon}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('daftar.direction')}</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleButton, direction === 'they_owe' && styles.toggleButtonActiveGreen]}
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setDirection('they_owe'); }}
                  >
                    {direction === 'they_owe' && (
                      <LinearGradient colors={colors.successGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.toggleGradientBorder} />
                    )}
                    <View style={[styles.toggleInner, direction === 'they_owe' && styles.toggleInnerActiveGreen]}>
                      <Ionicons
                        name="arrow-down-circle"
                        size={18}
                        color={direction === 'they_owe' ? colors.success : colors.textTertiary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.toggleText, direction === 'they_owe' && styles.toggleTextActiveGreen]}>
                        {t('daftar.theyOweMe')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, direction === 'i_owe' && styles.toggleButtonActiveRed]}
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); setDirection('i_owe'); }}
                  >
                    {direction === 'i_owe' && (
                      <LinearGradient colors={colors.dangerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.toggleGradientBorder} />
                    )}
                    <View style={[styles.toggleInner, direction === 'i_owe' && styles.toggleInnerActiveRed]}>
                      <Ionicons
                        name="arrow-up-circle"
                        size={18}
                        color={direction === 'i_owe' ? colors.danger : colors.textTertiary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.toggleText, direction === 'i_owe' && styles.toggleTextActiveRed]}>
                        {t('daftar.iOweThem')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('daftar.note')}</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('daftar.notePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => { animateBtnPress(); handleSave(); }}
                disabled={!isValid || saving}
              >
                <LinearGradient
                  colors={isValid ? colors.primaryGradient : [colors.primaryDark, colors.primaryDark]}
                  style={styles.saveBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.5 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.saveButtonText}>{t('common.save')}</Text>
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
    scrollContent: { padding: Spacing.xl, paddingBottom: 60 },

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
      gap: Spacing.xxl,
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
    fieldGroup: { gap: Spacing.sm },
    label: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: isDark ? c.kicker : c.textSecondary,
      textTransform: 'uppercase',
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
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
    },
    inputIcon: { marginRight: Spacing.sm },
    inputWithIcon: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: FontFamily.body,
      color: c.text,
    },
    noteInput: { minHeight: 88, paddingTop: 14 },

    toggleRow: { flexDirection: 'row', gap: Spacing.md },
    toggleButton: {
      flex: 1,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
    },
    toggleGradientBorder: { ...StyleSheet.absoluteFillObject },
    toggleInner: {
      margin: 2,
      paddingVertical: 14,
      borderRadius: Radius.lg - 2,
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    toggleButtonActiveGreen: { borderColor: 'transparent' },
    toggleButtonActiveRed: { borderColor: 'transparent' },
    toggleInnerActiveGreen: {
      backgroundColor: isDark ? 'rgba(20,184,166,0.12)' : '#ECFDF5',
    },
    toggleInnerActiveRed: {
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FFF7ED',
    },
    toggleText: {
      fontSize: 14,
      fontFamily: FontFamily.bodySemibold,
      color: c.textSecondary,
    },
    toggleTextActiveGreen: { color: c.success },
    toggleTextActiveRed: { color: c.danger },

    saveButton: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.xxl,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveBtnGradient: {
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
    saveButtonText: {
      color: '#FFFFFF',
      fontFamily: FontFamily.bodyBold,
      fontSize: 17,
      letterSpacing: 0.3,
    },
  });
