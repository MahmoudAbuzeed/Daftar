import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import { useAuth } from '../../lib/auth-context';
import { useAlert } from '../../hooks/useAlert';
import BouncyPressable from '../../components/BouncyPressable';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTPVerify'>;

const OTP_LENGTH = 6;

export default function OTPVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { verifyOTP, sendOTP } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRef = useRef<TextInput>(null);

  // ── Digit box bounce-in animations ──
  const digitAnims = useRef(
    Array.from({ length: OTP_LENGTH }, () => new Animated.Value(0)),
  ).current;

  // ── Header entrance ──
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  // ── Resend button pulse ──
  const resendScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Header entrance
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        delay: 100,
        damping: 16,
        stiffness: 160,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered digit box bounce-in
    digitAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 180,
        mass: 0.8,
        delay: 300 + i * 80,
      }).start();
    });
  }, []);

  // Timer countdown
  useEffect(() => {
    if (resendTimer <= 0) {
      // Pulse the resend button when it becomes active
      Animated.sequence([
        Animated.spring(resendScale, {
          toValue: 1.1,
          useNativeDriver: true,
          damping: 8,
          stiffness: 200,
        }),
        Animated.spring(resendScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 200,
        }),
      ]).start();
      return;
    }
    const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === OTP_LENGTH) {
      handleVerify();
    }
  }, [code]);

  const handleVerify = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      await verifyOTP(phone, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigation happens automatically via auth state change
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert.error(t('auth.error'), error.message ?? t('auth.invalidOTP'));
      setCode('');
    } finally {
      setVerifying(false);
    }
  }, [code, phone, verifying]);

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await sendOTP(phone);
      setResendTimer(60);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Silently fail
    }
  };

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(cleaned);
  };

  // Mask phone: +20XXXXXXX89
  const maskedPhone = useMemo(() => {
    if (phone.length <= 6) return phone;
    const start = phone.slice(0, 4);
    const end = phone.slice(-2);
    const middle = phone.slice(4, -2).replace(/./g, '\u2022');
    return `${start}${middle}${end}`;
  }, [phone]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.headerGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safe}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.bg}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Back button */}
          <BouncyPressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <View style={styles.backBtnInner}>
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.accentLight}
              />
            </View>
          </BouncyPressable>

          {/* Header */}
          <Animated.View
            style={[
              styles.headerBlock,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerSlide }],
              },
            ]}
          >
            <View style={styles.lockIconWrap}>
              <LinearGradient
                colors={colors.primaryGradient}
                style={styles.lockIconBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.headerTitle}>{t('auth.enterCode')}</Text>
            <Text style={styles.headerSub}>
              {t('auth.codeSentTo', { phone: maskedPhone })}
            </Text>
          </Animated.View>

          {/* OTP digit boxes */}
          <Pressable
            style={styles.digitContainer}
            onPress={() => inputRef.current?.focus()}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const isActive = code.length === i;
              const isFilled = code.length > i;

              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.digitBox,
                    isActive && styles.digitBoxActive,
                    isFilled && styles.digitBoxFilled,
                    {
                      transform: [
                        {
                          scale: digitAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                        },
                      ],
                      opacity: digitAnims[i],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.digitText,
                      isFilled && styles.digitTextFilled,
                    ]}
                  >
                    {code[i] || ''}
                  </Text>
                  {isActive && <View style={styles.cursor} />}
                </Animated.View>
              );
            })}

            {/* Hidden input */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              style={styles.hiddenInput}
              autoFocus
              editable={!verifying}
            />
          </Pressable>

          {/* Verifying state */}
          {verifying && (
            <View style={styles.verifyingRow}>
              <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendZone}>
            {resendTimer > 0 ? (
              <Text style={styles.resendTimer}>
                {t('auth.resendIn', { seconds: resendTimer })}
              </Text>
            ) : (
              <Animated.View style={{ transform: [{ scale: resendScale }] }}>
                <BouncyPressable onPress={handleResend}>
                  <Text style={styles.resendActive}>
                    {t('auth.resendCode')}
                  </Text>
                </BouncyPressable>
              </Animated.View>
            )}
          </View>
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
    safe: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },

    // Back button
    backBtn: {
      marginLeft: Spacing.xxl,
      marginTop: Spacing.lg,
      alignSelf: 'flex-start',
    },
    backBtnInner: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Header
    headerBlock: {
      alignItems: 'center',
      paddingTop: 36,
      paddingBottom: 32,
      paddingHorizontal: Spacing.xxl,
    },
    lockIconWrap: {
      marginBottom: Spacing.lg,
    },
    lockIconBg: {
      width: 60,
      height: 60,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1.5,
      color: colors.text,
      marginBottom: Spacing.sm,
      textAlign: 'center',
    },
    headerSub: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // OTP digit boxes
    digitContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: Spacing.xxl,
      marginBottom: Spacing.xxl,
    },
    digitBox: {
      width: 50,
      height: 60,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,252,247,0.04)' : '#F8F7F5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    digitBoxActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(27, 122, 108, 0.1)'
        : colors.primarySurface,
    },
    digitBoxFilled: {
      borderColor: isDark ? colors.accentLight : colors.accent,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.08)'
        : 'rgba(166, 124, 0, 0.06)',
    },
    digitText: {
      fontFamily: FontFamily.display,
      fontSize: 24,
      color: colors.textTertiary,
    },
    digitTextFilled: {
      color: colors.text,
    },
    cursor: {
      position: 'absolute',
      bottom: 12,
      width: 20,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.primary,
    },
    hiddenInput: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },

    // Verifying state
    verifyingRow: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    verifyingText: {
      fontFamily: FontFamily.bodyMedium,
      fontSize: 14,
      color: colors.primary,
      letterSpacing: 0.5,
    },

    // Resend
    resendZone: {
      alignItems: 'center',
      paddingTop: Spacing.md,
    },
    resendTimer: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: colors.textTertiary,
    },
    resendActive: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: colors.primaryLight,
    },
  });
}
