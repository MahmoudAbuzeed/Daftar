import React from 'react';
import { View, Text, StyleSheet, Animated, StyleProp, ViewStyle, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Spacing } from '../theme';
import { displayFor } from '../theme/fonts';
import useScreenEntrance from '../hooks/useScreenEntrance';

interface Props {
  /** Small uppercase tracked label above the title — usually a section/feature name */
  kicker?: string;
  /** The editorial display title (rendered in Cormorant / Tajawal) */
  title: string;
  /** Optional supporting line beneath the title */
  subtitle?: string;
  /** Optional element rendered to the trailing edge of the header (button, icon, etc.) */
  rightAction?: React.ReactNode;
  /** Disable the entrance animation (e.g. when nested in a scrollview that already animates) */
  noAnimate?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Force-collapse the kicker line so the title aligns flush */
  hideKicker?: boolean;
}

/**
 * Standard editorial header for any screen. Renders:
 *   KICKER LABEL (Poppins · uppercase · brass)
 *   Title in Cormorant (or Tajawal in Arabic)
 *   Subtitle in Poppins regular
 * with the canonical entrance animation from useScreenEntrance.
 *
 * Replaces the ad-hoc kicker+title pattern repeated across ~10 screens.
 */
export default function EditorialHeader({
  kicker,
  title,
  subtitle,
  rightAction,
  noAnimate,
  style,
  hideKicker,
}: Props) {
  const { colors } = useAppTheme();
  const { i18n } = useTranslation();
  const entrance = useScreenEntrance();

  const titleFont = displayFor(i18n.language, 'bold');
  const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

  const Wrap: any = noAnimate ? View : Animated.View;
  const animStyle = noAnimate ? undefined : entrance.style;

  return (
    <Wrap style={[styles.container, animStyle, style]}>
      <View style={styles.textBlock}>
        {kicker && !hideKicker ? (
          <Text style={[styles.kicker, { color: colors.kicker, writingDirection }]} numberOfLines={1}>
            {kicker}
          </Text>
        ) : null}
        <Text
          style={[
            styles.title,
            { color: colors.text, fontFamily: titleFont, writingDirection },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.textSecondary, writingDirection }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </Wrap>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  textBlock: {
    flex: 1,
    marginEnd: Spacing.md,
  },
  kicker: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs + 2,
  },
  title: {
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: Spacing.xs + 2,
  },
  right: {
    marginBottom: 4,
  },
});
