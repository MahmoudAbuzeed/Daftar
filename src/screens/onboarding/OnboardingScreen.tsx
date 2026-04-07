import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDED_KEY = '@fifti/onboarded';

interface Props {
  onComplete: () => void;
}

interface SlideData {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
}

const SLIDES: SlideData[] = [
  {
    id: 'scan',
    title: 'Scan & Split',
    subtitle:
      'Take a photo of your receipt and split items with friends instantly.',
    icon: 'scan-outline',
    gradient: ['#1DB954', '#4AD97B'],
  },
  {
    id: 'track',
    title: 'Track Balances',
    subtitle:
      'See who owes what at a glance. No more awkward conversations.',
    icon: 'swap-horizontal-outline',
    gradient: ['#E08600', '#FFBB54'],
  },
  {
    id: 'settle',
    title: 'Settle via WhatsApp',
    subtitle:
      'Send reminders and settle up with one tap through WhatsApp.',
    icon: 'logo-whatsapp',
    gradient: ['#1DB954', '#4AD97B'],
  },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);

  // Animated values for dot indicators
  const dotWidths = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? 24 : 8)),
  ).current;
  const dotOpacities = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.3)),
  ).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const newIndex = viewableItems[0].index;
        setActiveIndex(newIndex);
        animateDots(newIndex);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const animateDots = useCallback(
    (toIndex: number) => {
      SLIDES.forEach((_, i) => {
        Animated.spring(dotWidths[i], {
          toValue: i === toIndex ? 24 : 8,
          useNativeDriver: false,
          damping: 15,
          stiffness: 200,
        }).start();
        Animated.spring(dotOpacities[i], {
          toValue: i === toIndex ? 1 : 0.3,
          useNativeDriver: false,
          damping: 15,
          stiffness: 200,
        }).start();
      });
    },
    [dotWidths, dotOpacities],
  );

  const goToNext = useCallback(() => {
    if (activeIndex < SLIDES.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    }
  }, [activeIndex]);

  const handleComplete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    } catch {
      // Storage write failed — proceed anyway
    }
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    } catch {
      // Storage write failed — proceed anyway
    }
    onComplete();
  }, [onComplete]);

  const renderSlide = useCallback(
    ({ item }: { item: SlideData }) => (
      <View style={styles.slide}>
        <View style={styles.slideContent}>
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name={item.icon} size={36} color="#FFFFFF" />
          </LinearGradient>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    ),
    [styles],
  );

  const keyExtractor = useCallback((item: SlideData) => item.id, []);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom area */}
      <View style={styles.bottomContainer}>
        {/* Dots + Skip row */}
        <View style={styles.dotsRow}>
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidths[i],
                    opacity: dotOpacities[i],
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            ))}
          </View>

          {!isLastSlide ? (
            <Text style={styles.skipText} onPress={handleSkip}>
              {t('common.skip', 'Skip')}
            </Text>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        {/* Action button */}
        <FunButton
          title={isLastSlide ? t('onboarding.getStarted', 'Get Started') : t('onboarding.next', 'Next')}
          onPress={isLastSlide ? handleComplete : goToNext}
          variant="primary"
        />
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    slide: {
      width: SCREEN_WIDTH,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xxxl,
    },
    slideContent: {
      alignItems: 'center',
      paddingBottom: Spacing.huge,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      letterSpacing: -0.6,
      color: c.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    subtitle: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      lineHeight: 24,
      color: c.textSecondary,
      textAlign: 'center',
      paddingHorizontal: Spacing.lg,
    },
    bottomContainer: {
      paddingHorizontal: Spacing.xxl,
      paddingBottom: Spacing.huge,
      paddingTop: Spacing.xl,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xxl,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    dot: {
      height: 8,
      borderRadius: Radius.full,
    },
    skipText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 15,
      color: c.textTertiary,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    skipPlaceholder: {
      width: 40,
    },
  });
