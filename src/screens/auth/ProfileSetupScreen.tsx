import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, FontFamily } from '../../theme';
import { useAuth } from '../../lib/auth-context';
import { useAlert } from '../../hooks/useAlert';
import FunButton from '../../components/FunButton';
import ThemedCard from '../../components/ThemedCard';
import ThemedInput from '../../components/ThemedInput';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen(_props: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { setupProfile } = useAuth();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Greeting bounce animation ──
  const greetingScale = useRef(new Animated.Value(0)).current;
  const greetingRotate = useRef(new Animated.Value(0)).current;

  // ── Header entrance ──
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(24)).current;

  // ── Card entrance ──
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  // ── Confetti-like dots ──
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Greeting emoji: spring bounce in
    Animated.spring(greetingScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 6,
      stiffness: 120,
      mass: 0.8,
      delay: 200,
    }).start();

    // Greeting emoji: playful wobble
    Animated.loop(
      Animated.sequence([
        Animated.timing(greetingRotate, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(greetingRotate, {
          toValue: -1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(greetingRotate, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Header entrance
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        delay: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0,
        delay: 400,
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
        delay: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardSlide, {
        toValue: 0,
        delay: 600,
        damping: 16,
        stiffness: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Decorative dots float up
    const floatDot = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    floatDot(dot1, 0);
    floatDot(dot2, 300);
    floatDot(dot3, 600);
  }, []);

  const greetingAnimStyle = {
    transform: [
      {
        scale: greetingScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0.2, 1],
        }),
      },
      {
        rotate: greetingRotate.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-8deg', '0deg', '8deg'],
        }),
      },
    ],
  };

  const handleSetup = async () => {
    if (!name.trim()) {
      alert.error(t('auth.error'), t('auth.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await setupProfile(name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auth context will set needsProfile = false, causing navigator to show main app
    } catch (error: any) {
      alert.error(t('auth.error'), error.message);
    } finally {
      setSaving(false);
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

      {/* Decorative floating dots */}
      <Animated.View
        style={[
          styles.floatDot,
          styles.floatDot1,
          {
            transform: [
              {
                translateY: dot1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -12],
                }),
              },
            ],
            opacity: dot1.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.7, 0.3],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.floatDot,
          styles.floatDot2,
          {
            transform: [
              {
                translateY: dot2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -16],
                }),
              },
            ],
            opacity: dot2.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.2, 0.6, 0.2],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.floatDot,
          styles.floatDot3,
          {
            transform: [
              {
                translateY: dot3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              },
            ],
            opacity: dot3.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.25, 0.5, 0.25],
            }),
          },
        ]}
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
            {/* Bouncy greeting */}
            <View style={styles.greetingZone}>
              <Animated.View
                style={[styles.greetingEmoji, greetingAnimStyle]}
              >
                <LinearGradient
                  colors={colors.accentGradient}
                  style={styles.greetingBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.greetingIcon}>{'\uD83C\uDF89'}</Text>
                </LinearGradient>
              </Animated.View>

              <Animated.View
                style={[
                  styles.headerContent,
                  {
                    opacity: headerOpacity,
                    transform: [{ translateY: headerSlide }],
                  },
                ]}
              >
                <Text style={styles.welcomeTitle}>
                  {t('auth.welcomeToDaftar')}
                </Text>
                <Text style={styles.welcomeSub}>
                  {t('auth.whatName')}
                </Text>
              </Animated.View>
            </View>

            {/* Name input card */}
            <Animated.View
              style={[
                styles.cardWrap,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardSlide }],
                },
              ]}
            >
              <ThemedCard accent padded style={styles.nameCard}>
                <ThemedInput
                  label={t('auth.displayName')}
                  icon="person-outline"
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!saving}
                  returnKeyType="done"
                  onSubmitEditing={handleSetup}
                />
              </ThemedCard>

              <View style={styles.ctaZone}>
                <FunButton
                  title={t('auth.getStarted')}
                  onPress={handleSetup}
                  loading={saving}
                  disabled={saving || !name.trim()}
                  variant="primary"
                  icon={
                    !saving ? (
                      <Ionicons
                        name="rocket-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    ) : undefined
                  }
                />
              </View>
            </Animated.View>
          </ScrollView>
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
    scroll: {
      flexGrow: 1,
      paddingBottom: 40,
    },

    // Decorative floating dots
    floatDot: {
      position: 'absolute',
      borderRadius: 999,
    },
    floatDot1: {
      width: 8,
      height: 8,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.4)'
        : 'rgba(166, 124, 0, 0.2)',
      top: '20%',
      left: '15%',
    },
    floatDot2: {
      width: 6,
      height: 6,
      backgroundColor: isDark
        ? 'rgba(20, 184, 166, 0.35)'
        : 'rgba(13, 148, 136, 0.2)',
      top: '25%',
      right: '12%',
    },
    floatDot3: {
      width: 10,
      height: 10,
      backgroundColor: isDark
        ? 'rgba(201, 162, 39, 0.25)'
        : 'rgba(166, 124, 0, 0.12)',
      top: '35%',
      left: '70%',
    },

    // Greeting
    greetingZone: {
      alignItems: 'center',
      paddingTop: 80,
      paddingBottom: 36,
    },
    greetingEmoji: {
      marginBottom: 24,
    },
    greetingBg: {
      width: 88,
      height: 88,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 8,
    },
    greetingIcon: {
      fontSize: 40,
    },
    headerContent: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xxl,
    },
    welcomeTitle: {
      fontFamily: FontFamily.display,
      fontSize: 32,
      letterSpacing: -1.5,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    welcomeSub: {
      fontFamily: FontFamily.body,
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },

    // Name card
    cardWrap: {
      paddingHorizontal: Spacing.xxl,
    },
    nameCard: {
      marginBottom: Spacing.xl,
    },

    // CTA
    ctaZone: {
      // no extra margin needed; FunButton handles its own padding
    },
  });
}
