import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Spacing } from '../theme';
import { displayFor } from '../theme/fonts';

interface Props {
  /** Display title — when `editorial`, rendered in the serif display font */
  title?: string;
  /** Optional small uppercase tracked label above the title */
  kicker?: string;
  /** Render `title` in the editorial serif font instead of the compact UI font */
  editorial?: boolean;
  /** Show a back button */
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Transparent background — use over hero gradients */
  transparent?: boolean;
}

/**
 * Universal stack-screen header. Two visual modes:
 *   - default: compact 17pt centered title (used by detail screens)
 *   - editorial: 24pt serif left-aligned title with optional kicker
 *     (use for screens that previously inlined a kicker+title pattern)
 */
export default function ScreenHeader({
  title,
  kicker,
  editorial,
  onBack,
  rightAction,
  transparent,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(I18nManager.isRTL ? 12 : -12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
    ]).start();
  }, []);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack?.();
  };

  const bg = transparent ? 'transparent' : colors.bg;
  const borderColor = transparent ? 'transparent' : isDark ? colors.borderLight : colors.border;
  const direction = I18nManager.isRTL ? 'rtl' : 'ltr';
  const titleFont = editorial ? displayFor(i18n.language, 'bold') : FontFamily.bodySemibold;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 4,
          backgroundColor: bg,
          borderBottomColor: borderColor,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.row}>
        {/* Back button */}
        {onBack ? (
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.6}
            style={[
              styles.backBtn,
              {
                backgroundColor: colors.iconButtonBg,
                borderColor: colors.iconButtonBorder,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={isDark ? colors.accentLight : colors.text}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {/* Title block */}
        <Animated.View
          style={[
            editorial ? styles.editorialTitleBlock : styles.compactTitleBlock,
            {
              opacity: fadeIn,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {editorial && kicker ? (
            <Text
              style={[styles.kicker, { color: colors.kicker, writingDirection: direction }]}
              numberOfLines={1}
            >
              {kicker}
            </Text>
          ) : null}
          <Text
            style={[
              editorial ? styles.editorialTitle : styles.compactTitle,
              { color: colors.text, fontFamily: titleFont, writingDirection: direction },
            ]}
            numberOfLines={1}
          >
            {title || ''}
          </Text>
        </Animated.View>

        {/* Right action */}
        {rightAction ? (
          <View style={styles.rightSlot}>{rightAction}</View>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backPlaceholder: {
    width: 36,
  },
  compactTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  editorialTitleBlock: {
    flex: 1,
    marginStart: Spacing.md,
  },
  compactTitle: {
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  editorialTitle: {
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  kicker: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 9,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rightSlot: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
});
