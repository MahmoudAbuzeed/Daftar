import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StyleProp, ViewStyle, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Spacing } from '../theme';
import { displayFor } from '../theme/fonts';

interface Props {
  /** Ionicons name shown inside the gradient circle */
  icon: keyof typeof Ionicons.glyphMap;
  /** Editorial title rendered in the display font */
  title: string;
  /** Supporting body text */
  body?: string;
  /** Optional CTA — pass any pressable */
  action?: React.ReactNode;
  /** Animate the icon with a gentle bounce loop. Default: true */
  bouncy?: boolean;
  /** Use the brass/accent gradient instead of the brand gradient */
  variant?: 'brand' | 'accent';
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard empty state — bouncy icon in gradient circle, editorial title,
 * supporting body, optional CTA. Replaces ad-hoc empty states across screens.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  bouncy = true,
  variant = 'brand',
  style,
}: Props) {
  const { colors } = useAppTheme();
  const { i18n } = useTranslation();
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bouncy) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -10,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bouncy]);

  const gradient = variant === 'accent' ? colors.accentGradient : colors.primaryGradient;
  const titleFont = displayFor(i18n.language, 'bold');

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.iconWrap, { transform: [{ translateY: bounce }] }]}>
        <View style={[styles.iconShadow, { shadowColor: gradient[0] }]}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name={icon} size={36} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </Animated.View>
      <Text
        style={[
          styles.title,
          { color: colors.text, fontFamily: titleFont, writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={[
            styles.body,
            { color: colors.textSecondary, writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {body}
        </Text>
      ) : null}
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  iconWrap: {
    marginBottom: Spacing.xl,
  },
  iconShadow: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    borderRadius: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  actionWrap: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
