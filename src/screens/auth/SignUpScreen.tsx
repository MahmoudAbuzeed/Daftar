import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../lib/theme-context';
import { Spacing, FontFamily } from '../../theme';
import ThemedInput from '../../components/ThemedInput';
import ThemedCard from '../../components/ThemedCard';
import FunButton from '../../components/FunButton';
import BouncyPressable from '../../components/BouncyPressable';
import AnimatedListItem from '../../components/AnimatedListItem';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const FIELD_ICONS: Record<string, string> = {
  displayName: 'person-outline',
  email: 'mail-outline',
  password: 'lock-closed-outline',
  confirmPassword: 'shield-checkmark-outline',
};

export default function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance(100);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Party popper bounce on mount ──
  const partyScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(partyScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 6,
      stiffness: 180,
      mass: 0.8,
      delay: 300,
    }).start();
  }, []);

  const partyStyle = {
    transform: [
      {
        scale: partyScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const handleSignUp = async () => {
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      alert.error(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    if (password.length < 6) {
      alert.error(t('auth.error'), t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      alert.error(t('auth.error'), t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await signUp(trimmedEmail, password, trimmedName);
    } catch (error: any) {
      alert.error(t('auth.error'), error.message ?? t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      key: 'displayName',
      label: t('auth.displayName'),
      placeholder: t('auth.displayNamePlaceholder'),
      value: displayName,
      onChange: setDisplayName,
      caps: 'words' as const,
      kb: 'default' as const,
      secure: false,
    },
    {
      key: 'email',
      label: t('auth.email'),
      placeholder: t('auth.emailPlaceholder'),
      value: email,
      onChange: setEmail,
      caps: 'none' as const,
      kb: 'email-address' as const,
      secure: false,
    },
    {
      key: 'password',
      label: t('auth.password'),
      placeholder: t('auth.passwordPlaceholder'),
      value: password,
      onChange: setPassword,
      caps: 'none' as const,
      kb: 'default' as const,
      secure: true,
    },
    {
      key: 'confirmPassword',
      label: t('auth.confirmPassword'),
      placeholder: t('auth.confirmPasswordPlaceholder'),
      value: confirmPassword,
      onChange: setConfirmPassword,
      caps: 'none' as const,
      kb: 'default' as const,
      secure: true,
    },
  ];

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
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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

            {/* Header with bouncy party emoji */}
            <Animated.View style={[styles.headerBlock, entrance.style]}>
              <View style={styles.headerRow}>
                <Text style={styles.headerKicker}>
                  {t('auth.joinDaftar')}
                </Text>
                <Animated.Text style={[styles.partyEmoji, partyStyle]}>
                  {'\uD83C\uDF89'}
                </Animated.Text>
              </View>
              <Text style={styles.headerTitle}>{t('auth.signUp')}</Text>
              <Text style={styles.headerSub}>
                {t('auth.signUpSubtitle')}
              </Text>
            </Animated.View>

            {/* Form card with staggered fields */}
            <Animated.View style={entrance.style}>
              <ThemedCard
                accent
                padded
                style={styles.formCard}
              >
                <View style={styles.formInner}>
                  {fields.map((f, i) => (
                    <AnimatedListItem key={f.key} index={i} delay={80}>
                      <ThemedInput
                        label={f.label}
                        icon={FIELD_ICONS[f.key]}
                        placeholder={f.placeholder}
                        value={f.value}
                        onChangeText={f.onChange}
                        keyboardType={f.kb}
                        autoCapitalize={f.caps}
                        autoCorrect={false}
                        secureTextEntry={f.secure}
                        editable={!loading}
                      />
                    </AnimatedListItem>
                  ))}

                  <AnimatedListItem index={fields.length} delay={80}>
                    <FunButton
                      title={t('auth.signUp')}
                      onPress={handleSignUp}
                      loading={loading}
                      disabled={loading}
                      variant="primary"
                      icon={
                        !loading ? (
                          <Ionicons
                            name="rocket-outline"
                            size={20}
                            color="#FFFFFF"
                          />
                        ) : undefined
                      }
                      style={styles.submitSpacing}
                    />
                  </AnimatedListItem>
                </View>
              </ThemedCard>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, entrance.style]}>
              <Text style={styles.footerText}>{t('auth.hasAccount')}</Text>
              <BouncyPressable
                onPress={() => navigation.replace('SignIn')}
                disabled={loading}
              >
                <Text style={styles.footerLink}>{t('auth.signIn')}</Text>
              </BouncyPressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingBottom: 40 },

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

    headerBlock: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: 28,
      paddingBottom: 24,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: Spacing.sm,
    },
    headerKicker: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 10,
      letterSpacing: 4,
      color: colors.kicker,
      textTransform: 'uppercase',
    },
    partyEmoji: {
      fontSize: 22,
    },
    headerTitle: {
      fontFamily: FontFamily.display,
      fontSize: 44,
      letterSpacing: -2,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    headerSub: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },

    formCard: {
      marginHorizontal: Spacing.xxl,
    },
    formInner: {
      gap: 18,
    },
    submitSpacing: {
      marginTop: Spacing.xs,
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 28,
      gap: 6,
    },
    footerText: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: colors.textSecondary,
    },
    footerLink: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 15,
      color: colors.primaryLight,
    },
  });
}
