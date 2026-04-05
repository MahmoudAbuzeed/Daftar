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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import { useAuth } from '../../lib/auth-context';
import { useAlert } from '../../hooks/useAlert';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneEntry'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  const { sendOTP } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]); // Default Egypt
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Logo bounce on mount ──
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // ── Orb drift animations ──
  const orbTealX = useRef(new Animated.Value(0)).current;
  const orbTealY = useRef(new Animated.Value(0)).current;
  const orbBrassX = useRef(new Animated.Value(0)).current;
  const orbBrassY = useRef(new Animated.Value(0)).current;

  // ── Title entrance ──
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(24)).current;

  // ── Card entrance ──
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Logo: spring in with a satisfying bounce
    Animated.spring(logoScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 8,
      stiffness: 140,
      mass: 0.9,
      delay: 200,
    }).start();

    // Logo: subtle continuous wobble
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: -1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Title entrance
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 600,
        delay: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(titleSlide, {
        toValue: 0,
        delay: 500,
        damping: 16,
        stiffness: 160,
        useNativeDriver: true,
      }),
    ]).start();

    // Card entrance
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        delay: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardSlide, {
        toValue: 0,
        delay: 700,
        damping: 16,
        stiffness: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating orb drift
    const driftOrb = (
      animX: Animated.Value,
      animY: Animated.Value,
      rangeX: number,
      rangeY: number,
      durationX: number,
      durationY: number,
    ) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animX, {
            toValue: rangeX,
            duration: durationX,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animX, {
            toValue: -rangeX,
            duration: durationX,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(animY, {
            toValue: rangeY,
            duration: durationY,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animY, {
            toValue: -rangeY,
            duration: durationY,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    driftOrb(orbTealX, orbTealY, 18, 12, 6000, 8000);
    driftOrb(orbBrassX, orbBrassY, 14, 20, 7000, 5500);
  }, []);

  const logoAnimStyle = {
    transform: [
      {
        scale: logoScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        }),
      },
      {
        rotate: logoRotate.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-3deg', '0deg', '3deg'],
        }),
      },
    ],
  };

  const handleContinue = async () => {
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

  const handlePhoneChange = (raw: string) => {
    setPhone(raw.replace(/\D/g, '').slice(0, country.maxLen));
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.headerGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Floating orbs with drift */}
      <Animated.View
        style={[
          styles.orbTeal,
          { transform: [{ translateX: orbTealX }, { translateY: orbTealY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orbBrass,
          { transform: [{ translateX: orbBrassX }, { translateY: orbBrassY }] },
        ]}
      />
      <View style={styles.orbDeep} />

      {/* Diagonal brass line accent */}
      <View style={styles.diagonalLine} />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle={colors.statusBarStyle}
          backgroundColor={colors.bg}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLine} />
            <Text style={styles.topBarLabel}>{t('auth.est')}</Text>
            <View style={styles.topBarLine} />
          </View>

          <View style={styles.content}>
            {/* Hero zone */}
            <View style={styles.heroZone}>
              {/* Bouncy Logo */}
              <Animated.View style={[styles.logoWrap, logoAnimStyle]}>
                <LinearGradient
                  colors={colors.accentGradient}
                  style={styles.logoBorder}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.logoCore}>
                    <Text style={styles.logoEmoji}>{'\uD83D\uDCD2'}</Text>
                  </View>
                </LinearGradient>

                <View style={styles.logoCornerTL} />
                <View style={styles.logoCornerBR} />
              </Animated.View>

              {/* Title stack with entrance */}
              <Animated.View
                style={[
                  styles.titleBlock,
                  {
                    opacity: titleOpacity,
                    transform: [{ translateY: titleSlide }],
                  },
                ]}
              >
                <Text style={styles.titleMain}>Daftar</Text>
                <View style={styles.titleDivider}>
                  <View style={styles.titleDividerLine} />
                  <View style={styles.titleDividerDiamond} />
                  <View style={styles.titleDividerLine} />
                </View>
                <Text style={styles.titleArabic}>{'\u062F\u0641\u062A\u0631'}</Text>
              </Animated.View>

              <Animated.View
                style={[styles.taglineRow, { opacity: titleOpacity }]}
              >
                <Text style={styles.tagline}>
                  {t('auth.welcomeTagline')}
                </Text>
              </Animated.View>
            </View>

            {/* Phone input card */}
            <Animated.View
              style={[
                styles.cardWrap,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardSlide }],
                },
              ]}
            >
              <ThemedCard accent padded style={styles.phoneCard}>
                <Text style={styles.phoneLabel}>{t('auth.phoneLabel')}</Text>

                <View style={styles.phoneRow}>
                  {/* Country code — tappable */}
                  <TouchableOpacity
                    style={styles.countryCode}
                    onPress={() => { Haptics.selectionAsync(); setCountryPickerOpen(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.flag}>{country.flag}</Text>
                    <Text style={styles.countryText}>{country.dial}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.phoneDivider} />

                  {/* Phone input */}
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

                {/* Country Picker Modal */}
                <Modal visible={countryPickerOpen} transparent animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
                  <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setCountryPickerOpen(false)}>
                    <View style={[styles.pickerContent, { backgroundColor: colors.bgCard }]}>
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
              </ThemedCard>

              {/* Continue button */}
              <View style={styles.ctaZone}>
                <FunButton
                  title={t('auth.continue')}
                  onPress={handleContinue}
                  loading={sending}
                  disabled={sending || phone.replace(/\D/g, '').length < 10}
                  variant="primary"
                  icon={
                    !sending ? (
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                    ) : undefined
                  }
                />
              </View>

              {/* Terms note */}
              <Text style={styles.termsNote}>{t('auth.termsNote')}</Text>
            </Animated.View>
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
    safeArea: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },

    // Atmospheric orbs
    orbTeal: {
      position: 'absolute',
      width: SCREEN_W * 0.8,
      height: SCREEN_W * 0.8,
      borderRadius: SCREEN_W * 0.4,
      backgroundColor: isDark
        ? 'rgba(27, 122, 108, 0.12)'
        : 'rgba(13, 148, 136, 0.08)',
      top: SCREEN_H * 0.08,
      left: -SCREEN_W * 0.25,
    },
    orbBrass: {
      position: 'absolute',
      width: SCREEN_W * 0.5,
      height: SCREEN_W * 0.5,
      borderRadius: SCREEN_W * 0.25,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.06)'
        : 'rgba(166, 124, 0, 0.05)',
      top: SCREEN_H * 0.55,
      right: -SCREEN_W * 0.15,
    },
    orbDeep: {
      position: 'absolute',
      width: SCREEN_W * 0.6,
      height: SCREEN_W * 0.6,
      borderRadius: SCREEN_W * 0.3,
      backgroundColor: isDark
        ? 'rgba(20, 184, 166, 0.05)'
        : 'rgba(13, 148, 136, 0.04)',
      bottom: -SCREEN_W * 0.1,
      left: SCREEN_W * 0.2,
    },

    diagonalLine: {
      position: 'absolute',
      width: 1,
      height: SCREEN_H * 0.35,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.15)'
        : 'rgba(166, 124, 0, 0.1)',
      top: SCREEN_H * 0.1,
      right: 40,
      transform: [{ rotate: '25deg' }],
    },

    // Top bar
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    topBarLine: {
      height: 1,
      width: 36,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.4)'
        : 'rgba(166, 124, 0, 0.25)',
    },
    topBarLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 9,
      letterSpacing: 5,
      color: isDark ? 'rgba(212, 175, 55, 0.65)' : colors.accent,
    },

    content: {
      flex: 1,
      justifyContent: 'space-between',
      paddingBottom: 36,
    },

    // Hero
    heroZone: {
      alignItems: 'center',
      paddingTop: Spacing.lg,
    },
    logoWrap: {
      marginBottom: 20,
    },
    logoBorder: {
      width: 100,
      height: 100,
      borderRadius: 30,
      padding: 3,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    logoCore: {
      flex: 1,
      borderRadius: 27,
      backgroundColor: isDark ? '#0A1614' : colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoEmoji: {
      fontSize: 42,
    },
    logoCornerTL: {
      position: 'absolute',
      top: -6,
      left: -6,
      width: 20,
      height: 20,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderColor: isDark
        ? 'rgba(201, 162, 39, 0.5)'
        : 'rgba(166, 124, 0, 0.3)',
    },
    logoCornerBR: {
      position: 'absolute',
      bottom: -6,
      right: -6,
      width: 20,
      height: 20,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderColor: isDark
        ? 'rgba(201, 162, 39, 0.5)'
        : 'rgba(166, 124, 0, 0.3)',
    },

    titleBlock: {
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    titleMain: {
      fontFamily: FontFamily.display,
      fontSize: 48,
      letterSpacing: -3,
      color: colors.text,
      includeFontPadding: false,
    },
    titleDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 6,
    },
    titleDividerLine: {
      width: 28,
      height: 1,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.55)'
        : 'rgba(166, 124, 0, 0.3)',
    },
    titleDividerDiamond: {
      width: 6,
      height: 6,
      backgroundColor: colors.accent,
      transform: [{ rotate: '45deg' }],
    },
    titleArabic: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: colors.accentLight,
      letterSpacing: 1,
    },
    taglineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 48,
      marginTop: Spacing.xs,
    },
    tagline: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },

    // Phone card
    cardWrap: {
      paddingHorizontal: Spacing.xxl,
    },
    phoneCard: {
      marginBottom: Spacing.lg,
    },
    phoneLabel: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: isDark ? colors.kicker : colors.textSecondary,
      marginBottom: Spacing.md,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,252,247,0.05)' : '#F8F7F5',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
    },
    countryCode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    flag: {
      fontSize: 22,
    },
    countryText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 17,
      color: colors.text,
      letterSpacing: 0.5,
    },
    phoneDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
      marginHorizontal: Spacing.md,
    },
    phoneInput: {
      flex: 1,
      fontFamily: FontFamily.bodyMedium,
      fontSize: 18,
      color: colors.text,
      letterSpacing: 1.5,
      paddingVertical: 14,
    },

    // Country picker
    pickerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    pickerContent: {
      borderTopLeftRadius: Radius.xxl,
      borderTopRightRadius: Radius.xxl,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: 40,
    },
    pickerHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    pickerTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 18,
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

    // CTA
    ctaZone: {
      marginBottom: Spacing.md,
    },
    termsNote: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
