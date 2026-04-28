import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Radius, tabularNums } from '../theme';
import { formatCurrency, formatCurrencyAr } from '../utils/balance';

interface Props {
  /** Net amount. Positive = owed *to* the user. Negative = user owes. */
  amount: number;
  currency?: string;
  /** Optional override for "settled" copy when amount is ~0 */
  settledLabel?: string;
  /** Compact size for inline list rows */
  compact?: boolean;
}

/**
 * The canonical balance pill — green/red/grey by sign, with semantic tone
 * colors instead of overloaded success/danger. Used in groups list, friends,
 * ledger contact rows.
 */
export default function BalancePill({ amount, currency = 'EGP', settledLabel, compact }: Props) {
  const { colors, isDark } = useAppTheme();
  const { t, i18n } = useTranslation();
  const formatter = i18n.language === 'ar' ? formatCurrencyAr : formatCurrency;

  // Settled
  if (Math.abs(amount) < 0.01) {
    return (
      <View
        style={[
          styles.pill,
          compact && styles.pillCompact,
          { backgroundColor: 'transparent', borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="checkmark-circle"
          size={compact ? 12 : 14}
          color={colors.settled}
          style={styles.iconSpacing}
        />
        <Text style={[styles.text, compact && styles.textCompact, { color: colors.settled }]}>
          {settledLabel || t('groups.settled_up')}
        </Text>
      </View>
    );
  }

  const isPositive = amount > 0;
  const tone = isPositive ? colors.owed : colors.owe;
  const bg = isPositive
    ? isDark
      ? 'rgba(91,224,142,0.12)'
      : '#ECFDF5'
    : isDark
    ? 'rgba(252,129,129,0.12)'
    : '#FEF2F2';
  const border = isPositive
    ? isDark
      ? 'rgba(91,224,142,0.32)'
      : '#A7F3D0'
    : isDark
    ? 'rgba(252,129,129,0.32)'
    : '#FECACA';

  return (
    <View
      style={[
        styles.pill,
        compact && styles.pillCompact,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      <Text
        style={[styles.text, compact && styles.textCompact, tabularNums, { color: tone }]}
        allowFontScaling={false}
      >
        {isPositive ? '+' : '−'}
        {formatter(Math.abs(amount), currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  textCompact: {
    fontSize: 12,
  },
  iconSpacing: {
    marginEnd: 4,
  },
});
