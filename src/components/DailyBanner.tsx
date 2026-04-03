import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { getQuotes, getDailyIndex, DailyQuote } from '../data/daily-quotes';
import { Radius, Spacing } from '../theme';

export default function DailyBanner() {
  const { colors, isDark } = useAppTheme();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const quotes = getQuotes(i18n.language);
  const [index, setIndex] = useState(() => getDailyIndex(quotes));
  const quote: DailyQuote = quotes[index % quotes.length];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const emojiScale = useRef(new Animated.Value(0.3)).current;
  const emojiBounce = useRef(new Animated.Value(0)).current;

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.spring(emojiScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(emojiBounce, {
            toValue: -6,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(emojiBounce, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  const animateQuoteChange = useCallback(
    (direction: 1 | -1) => {
      const slideOut = direction * -30;
      const slideIn = direction * 30;

      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: slideOut,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIndex((prev) => {
          const next = prev + direction;
          if (next < 0) return quotes.length - 1;
          return next % quotes.length;
        });

        contentSlide.setValue(slideIn);
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(contentSlide, {
            toValue: 0,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [quotes.length, contentOpacity, contentSlide]
  );

  const goNext = useCallback(() => animateQuoteChange(1), [animateQuoteChange]);
  const goPrev = useCallback(() => animateQuoteChange(-1), [animateQuoteChange]);

  const gradientColors: [string, string, ...string[]] = isDark
    ? [colors.primaryDark + 'CC', colors.primary + '55']
    : [colors.accentLight + '22', colors.primarySurface];

  const arrowColor = isDark ? colors.accentLight : colors.accent;
  const labelText = isAr ? 'حكمة اليوم' : 'DAILY WISDOM';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={[styles.accentStripe, { backgroundColor: colors.accent }]} />

        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={isAr ? goNext : goPrev}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
            style={[styles.navBtn, { backgroundColor: arrowColor + '18' }]}
          >
            <Ionicons
              name={isAr ? 'chevron-forward' : 'chevron-back'}
              size={18}
              color={arrowColor}
            />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.quoteContent,
              {
                opacity: contentOpacity,
                transform: [{ translateX: contentSlide }],
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.emoji,
                {
                  transform: [
                    { scale: emojiScale },
                    { translateY: emojiBounce },
                  ],
                },
              ]}
            >
              {quote.emoji}
            </Animated.Text>

            <Text
              style={[
                styles.quoteText,
                {
                  color: isDark ? '#F5F0E6' : colors.text,
                  writingDirection: isAr ? 'rtl' : 'ltr',
                  textAlign: 'center',
                },
              ]}
            >
              {quote.text}
            </Text>
          </Animated.View>

          <TouchableOpacity
            onPress={isAr ? goPrev : goNext}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.6}
            style={[styles.navBtn, { backgroundColor: arrowColor + '18' }]}
          >
            <Ionicons
              name={isAr ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={arrowColor}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.decorRow}>
          <View style={[styles.decorDot, { backgroundColor: colors.accent + '55' }]} />
          <Text style={[styles.label, { color: isDark ? colors.accentLight : colors.accent }]}>
            {labelText}
          </Text>
          <View style={[styles.decorDot, { backgroundColor: colors.accent + '55' }]} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  gradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  accentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
    paddingHorizontal: 2,
  },
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  decorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
