import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Spacing } from '../theme';

interface Props {
  /** Uppercase tracked label between the two thin rules */
  label: string;
  /** Use the brass accent rule (default) or the subtler border color */
  variant?: 'accent' | 'subtle';
  /** Override horizontal margin if you don't want the default screen gutter */
  marginHorizontal?: number;
}

/**
 * Editorial section divider — small uppercase kicker flanked by thin rules.
 * The default brass-accent variant is the canonical "section break" used by
 * editorial layouts. The subtle variant matches list dividers.
 */
export default function SectionDivider({ label, variant = 'accent', marginHorizontal }: Props) {
  const { colors } = useAppTheme();
  const ruleColor = variant === 'accent' ? colors.kicker : colors.borderLight;
  const textColor = variant === 'accent' ? colors.kicker : colors.textTertiary;

  return (
    <View style={[styles.row, marginHorizontal !== undefined && { marginHorizontal }]}>
      <View style={[styles.rule, { backgroundColor: ruleColor, opacity: variant === 'accent' ? 0.5 : 1 }]} />
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      <View style={[styles.rule, { backgroundColor: ruleColor, opacity: variant === 'accent' ? 0.5 : 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
    marginVertical: Spacing.md,
    gap: Spacing.md,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 10,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
});
