import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import { useAuth } from '../../lib/auth-context';
import { useAlert } from '../../hooks/useAlert';
import FunButton from '../../components/FunButton';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneEntry'>;

const { height: SCREEN_H } = Dimensions.get('window');

type AuthMode = 'phone' | 'email';

interface Country { code: string; dial: string; flag: string; name: string; maxLen: number }

const COUNTRIES: Country[] = [
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Egypt', maxLen: 11 },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi Arabia', maxLen: 10 },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE', maxLen: 9 },
  { code: 'KW', dial: '+965', flag: '🇰🇼', name: 'Kuwait', maxLen: 8 },
  { code: 'QA', dial: '+974', flag: '🇶🇦', name: 'Qatar', maxLen: 8 },
  { code: 'BH', dial: '+973', flag: '🇧🇭', name: 'Bahrain', maxLen: 8 },
  { code: 'OM', dial: '+968', flag: '🇴🇲', name: 'Oman', maxLen: 8 },
  { code: 'JO', dial: '+962', flag: '🇯🇴', name: 'Jordan', maxLen: 10 },
  { code: 'LB', dial: '+961', flag: '🇱🇧', name: 'Lebanon', maxLen: 8 },
  { code: 'IQ', dial: '+964', flag: '🇮🇶', name: 'Iraq', maxLen: 10 },
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Morocco', maxLen: 10 },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisia', maxLen: 8 },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algeria', maxLen: 10 },
  { code: 'LY', dial: '+218', flag: '🇱🇾', name: 'Libya', maxLen: 10 },
  { code: 'SD', dial: '+249', flag: '🇸🇩', name: 'Sudan', maxLen: 9 },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States', maxLen: 10 },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom', maxLen: 11 },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany', maxLen: 12 },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France', maxLen: 10 },
  { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Turkey', maxLen: 10 },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India', maxLen: 10 },
  { code: 'PK', dial: '+92', flag: '🇵🇰', name: 'Pakistan', maxLen: 11 },
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigeria', maxLen: 11 },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa', maxLen: 10 },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brazil', maxLen: 11 },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada', maxLen: 10 },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia', maxLen: 10 },
];

export default function PhoneEntryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { sendOTP, signInWithEmail, signUpWithEmail } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [mode, setMode] = useState<AuthMode>('email');
  const [isSignUp, setIsSignUp] = useState(false);

  // Phone state
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [sending, setSending] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        damping: 20,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePhoneContinue = async () => {
    const trimmed = phone.trim().replace(/\s/g, '');
    if (trimmed.length < 6) {
      alert.error(t('auth.error'), t('auth.invalidPhone'));
      return;
    }

    setSending(true);
    try {
      const digits = trimmed.startsWith('0') ? trimmed.slice(1) : trimmed;
      const fullPhone = `${country.dial}${digits}`;
      await sendOTP(fullPhone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('OTPVerify', { phone: fullPhone });
    } catch (error: any) {
      alert.error(t('auth.error'), error.message ?? t('auth.otpFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleEmailContinue = async () => {
    if (!email.trim() || !password) {
      alert.error(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    if (password.length < 6) {
      alert.error(t('auth.error'), t('auth.passwordTooShort'));
      return;
    }

    setSending(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      alert.error(
        t('auth.error'),
        error.message ?? (isSignUp ? t('auth.signUpFailed') : t('auth.signInFailed')),
      );
    } finally {
      setSending(false);
    }
  };

  const handleContinue = mode === 'phone' ? handlePhoneContinue : handleEmailContinue;

  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/\D/g, '').slice(0, country.maxLen));
  };

  const isDisabled = mode === 'phone'
    ? sending || phone.replace(/\D/g, '').length < 6
    : sending || !email.trim() || password.length < 6;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.bg}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeIn,
                transform: [{ translateY: slideUp }],
              },
            ]}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.logoArea}>
                <Svg width={100} height={100} style={styles.logoRing}>
                  <Circle
                    cx={50}
                    cy={50}
                    r={46}
                    stroke={isDark ? 'rgba(29,185,84,0.25)' : 'rgba(29,185,84,0.15)'}
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray="8 6"
                  />
                  <Circle
                    cx={50}
                    cy={50}
                    r={36}
                    stroke={isDark ? 'rgba(255,149,0,0.2)' : 'rgba(255,149,0,0.12)'}
                    strokeWidth={1}
                    fill="none"
                  />
                </Svg>
                <View style={styles.logoWrap}>
                  <Text style={styles.logoEmoji}>{'\u2696\uFE0F'}</Text>
                </View>
              </View>

              <MaskedView
                maskElement={<Text style={styles.title}>Fifti</Text>}
              >
                <LinearGradient
                  colors={isDark ? ['#4AD97B', '#1DB954'] : ['#1DB954', '#17A347']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={[styles.title, { opacity: 0 }]}>Fifti</Text>
                </LinearGradient>
              </MaskedView>

              <View style={styles.dotAccent} />

              <Text style={styles.subtitle}>
                {t('auth.welcomeTagline')}
              </Text>
            </View>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
                onPress={() => setMode('email')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={mode === 'email' ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.modeBtnText, mode === 'email' && styles.modeBtnTextActive]}>
                  {t('auth.email')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
                onPress={() => setMode('phone')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={mode === 'phone' ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.modeBtnText, mode === 'phone' && styles.modeBtnTextActive]}>
                  {t('auth.phoneLabel')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {mode === 'phone' ? (
                <>
                  <View style={styles.inputRow}>
                    <TouchableOpacity
                      style={styles.countryBtn}
                      onPress={() => { Haptics.selectionAsync(); setCountryPickerOpen(true); }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.flag}>{country.flag}</Text>
                      <Text style={styles.dialCode}>{country.dial}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>

                    <View style={styles.inputDivider} />

                    <TextInput
                      value={phone}
                      onChangeText={handlePhoneChange}
                      keyboardType="number-pad"
                      maxLength={country.maxLen}
                      placeholder={t('auth.phonePlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      style={styles.phoneInput}
                      editable={!sending}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.emailInputWrap}>
                    <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      style={styles.emailInput}
                      editable={!sending}
                    />
                  </View>

                  <View style={styles.emailInputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                      style={styles.emailInput}
                      editable={!sending}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.btnWrap}>
                <FunButton
                  title={mode === 'email'
                    ? (isSignUp ? t('auth.signUp') : t('auth.signIn'))
                    : t('auth.continue')
                  }
                  onPress={handleContinue}
                  loading={sending}
                  disabled={isDisabled}
                  variant="primary"
                  icon={
                    !sending ? (
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    ) : undefined
                  }
                />
              </View>

              {mode === 'email' && (
                <TouchableOpacity
                  onPress={() => setIsSignUp(!isSignUp)}
                  style={styles.switchAuth}
                  activeOpacity={0.6}
                >
                  <Text style={styles.switchAuthText}>
                    {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
                    <Text style={styles.switchAuthLink}>
                      {isSignUp ? t('auth.signIn') : t('auth.signUp')}
                    </Text>
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.terms}>{t('auth.termsNote')}</Text>
            </View>
          </Animated.View>

          {/* Country Picker Modal */}
          <Modal visible={countryPickerOpen} transparent animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setCountryPickerOpen(false)}>
              <View style={[styles.pickerSheet, { backgroundColor: colors.bgCard }]}>
                <View style={styles.pickerHandle} />
                <Text style={styles.pickerTitle}>{t('auth.selectCountry') || 'Select Country'}</Text>
                <FlatList
                  data={COUNTRIES}
                  keyExtractor={item => item.code}
                  style={{ maxHeight: SCREEN_H * 0.5 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerRow, item.code === country.code && styles.pickerRowActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCountry(item);
                        setPhone('');
                        setCountryPickerOpen(false);
                      }}
                    >
                      <Text style={styles.pickerFlag}>{item.flag}</Text>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerDial}>{item.dial}</Text>
                      {item.code === country.code && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    safeArea: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.xxxl,
    },

    // Hero
    hero: {
      alignItems: 'center',
      marginBottom: 32,
    },
    logoArea: {
      width: 100,
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    logoRing: {
      position: 'absolute',
    },
    logoWrap: {
      width: 60,
      height: 60,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.primarySurface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoEmoji: {
      fontSize: 28,
    },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 42,
      letterSpacing: -2,
      color: colors.text,
    },
    dotAccent: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
      marginVertical: 10,
    },
    subtitle: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: Spacing.xl,
    },

    // Mode toggle
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F4F6',
      borderRadius: Radius.md,
      padding: 3,
      marginBottom: Spacing.xxl,
    },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: Radius.sm,
    },
    modeBtnActive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    modeBtnText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 13,
      color: colors.textTertiary,
    },
    modeBtnTextActive: {
      color: colors.primary,
    },

    // Form
    form: {
      gap: 0,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
    },
    flag: {
      fontSize: 20,
    },
    dialCode: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: colors.text,
    },
    inputDivider: {
      width: 1,
      height: 22,
      backgroundColor: colors.border,
      marginHorizontal: Spacing.md,
    },
    phoneInput: {
      flex: 1,
      fontFamily: FontFamily.bodyMedium,
      fontSize: 17,
      color: colors.text,
      letterSpacing: 1,
      paddingVertical: 14,
    },

    // Email inputs
    emailInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8F8FA',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
    },
    inputIcon: {
      marginRight: Spacing.sm,
    },
    emailInput: {
      flex: 1,
      fontFamily: FontFamily.bodyMedium,
      fontSize: 16,
      color: colors.text,
      paddingVertical: 14,
    },

    btnWrap: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    switchAuth: {
      alignSelf: 'center',
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
    },
    switchAuthText: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchAuthLink: {
      fontFamily: FontFamily.bodySemibold,
      color: colors.primary,
    },
    terms: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },

    // Country picker
    pickerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: 40,
    },
    pickerHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    pickerTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17,
      color: colors.text,
      marginBottom: Spacing.lg,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: Spacing.md,
    },
    pickerRowActive: {
      backgroundColor: colors.primarySurface,
      borderRadius: Radius.md,
    },
    pickerFlag: { fontSize: 22 },
    pickerName: {
      flex: 1,
      fontFamily: FontFamily.bodyMedium,
      fontSize: 15,
      color: colors.text,
    },
    pickerDial: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 14,
      color: colors.textSecondary,
    },

  });
}
