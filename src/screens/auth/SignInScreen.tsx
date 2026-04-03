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
import { Spacing, Radius, FontFamily } from '../../theme';
import ThemedInput from '../../components/ThemedInput';
import ThemedCard from '../../components/ThemedCard';
import FunButton from '../../components/FunButton';
import BouncyPressable from '../../components/BouncyPressable';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance(100);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Waving hand animation ──
  const waveRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wave the hand emoji on mount
    const waveSequence = Animated.sequence([
      Animated.timing(waveRotate, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotate, {
        toValue: -1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotate, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotate, {
        toValue: -1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(waveRotate, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
    ]);

    // Start wave after a short delay
    const timer = setTimeout(() => waveSequence.start(), 400);
    return () => clearTimeout(timer);
  }, []);

  const waveStyle = {
    transform: [
      {
        rotate: waveRotate.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-25deg', '0deg', '25deg'],
        }),
      },
    ],
  };

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      alert.error(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
    } catch (error: any) {
      alert.error(t('auth.error'), error.message ?? t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

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

            {/* Header with waving emoji */}
            <Animated.View style={[styles.headerBlock, entrance.style]}>
              <View style={styles.headerRow}>
                <Text style={styles.headerKicker}>
                  {t('auth.welcomeBack')}
                </Text>
                <Animated.Text style={[styles.waveEmoji, waveStyle]}>
                  {'\uD83D\uDC4B'}
                </Animated.Text>
              </View>
              <Text style={styles.headerTitle}>{t('auth.signIn')}</Text>
              <Text style={styles.headerSub}>
                {t('auth.signInSubtitle')}
              </Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View style={entrance.style}>
              <ThemedCard
                accent
                padded
                style={styles.formCard}
              >
                <View style={styles.formInner}>
                  <ThemedInput
                    label={t('auth.email')}
                    icon="mail-outline"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    containerStyle={styles.inputSpacing}
                  />

                  <ThemedInput
                    label={t('auth.password')}
                    icon="lock-closed-outline"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                    containerStyle={styles.inputSpacing}
                  />

                  <FunButton
                    title={t('auth.signIn')}
                    onPress={handleSignIn}
                    loading={loading}
                    disabled={loading}
                    variant="primary"
                    icon={
                      !loading ? (
                        <Ionicons
                          name="log-in-outline"
                          size={20}
                          color="#FFFFFF"
                        />
                      ) : undefined
                    }
                    style={styles.submitSpacing}
                  />
                </View>
              </ThemedCard>
            </Animated.View>

            {/* Footer */}
            <Animated.View style={[styles.footer, entrance.style]}>
              <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
              <BouncyPressable
                onPress={() => navigation.replace('SignUp')}
                disabled={loading}
              >
                <Text style={styles.footerLink}>{t('auth.signUp')}</Text>
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
      paddingTop: 36,
      paddingBottom: 28,
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
    waveEmoji: {
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
      gap: 22,
    },
    inputSpacing: {
      // Spacing is handled by the gap on formInner
    },
    submitSpacing: {
      marginTop: Spacing.xs,
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 32,
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
