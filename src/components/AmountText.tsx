import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, tabularNums } from '../theme';
import { displayFor } from '../theme/fonts';
import { formatCurrency, formatCurrencyAr } from '../utils/balance';

type Variant = 'hero' | 'display' | 'amount' | 'inline';
type Tone = 'owed' | 'owe' | 'neutral' | 'brand' | 'ink';

interface Props {
  amount: number;
  currency?: string;
  variant?: Variant;
  tone?: Tone;
  /** Optional explicit sign prefix override (`'+' | '-' | null`). Default: derive from amount sign + tone. */
  signMode?: 'auto' | 'always' | 'absolute' | 'none';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Renders a currency amount with consistent typography, tabular numerals, and
 * semantic color tone.
 *
 *   <AmountText amount={42.5} variant="hero" tone="brand" />
 *
 * - `hero` (56pt Cormorant) — the single hero amount on a screen
 * - `display` (36pt Cormorant) — secondary heroes, totals, balances
 * - `amount` (22pt Poppins bold) — list rows, settlement amounts
 * - `inline` (15pt Poppins bold) — body text references
 *
 * Tones map to the new semantic colors: `owed` (financial green), `owe`
 * (financial red), `neutral` (default text), `brand` (Spotify green), `ink`
 * (deep editorial ink).
 */
export default function AmountText({
  amount,
  currency = 'EGP',
  variant = 'amount',
  tone = 'neutral',
  signMode = 'absolute',
  style,
  numberOfLines,
}: Props) {
  const { colors } = useAppTheme();
  const { i18n } = useTranslation();

  const formatter = i18n.language === 'ar' ? formatCurrencyAr : formatCurrency;

  let displayValue: number;
  let prefix = '';
  switch (signMode) {
    case 'always':
      displayValue = Math.abs(amount);
      prefix = amount >= 0 ? '+' : '−';
      break;
    case 'absolute':
      displayValue = Math.abs(amount);
      prefix = '';
      break;
    case 'auto':
      displayValue = Math.abs(amount);
      if (amount < 0) prefix = '−';
      break;
    case 'none':
    default:
      displayValue = amount;
      prefix = '';
      break;
  }

  const formatted = formatter(displayValue, currency);

  const toneColor = ((): string => {
    switch (tone) {
      case 'owed':
        return colors.owed;
      case 'owe':
        return colors.owe;
      case 'brand':
        return colors.brand;
      case 'ink':
        return colors.ink;
      case 'neutral':
      default:
        return colors.text;
    }
  })();

  const variantStyle = variantStyleFor(variant, i18n.language);

  return (
    <Text
      style={[
        variantStyle,
        tabularNums,
        { color: toneColor, writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' },
        style,
      ]}
      numberOfLines={numberOfLines ?? 1}
      allowFontScaling={false}
    >
      {prefix}
      {formatted}
    </Text>
  );
}

function variantStyleFor(variant: Variant, lang: string | undefined): TextStyle {
  const serif = displayFor(lang, 'bold');
  switch (variant) {
    case 'hero':
      return { fontFamily: serif, fontSize: 56, letterSpacing: -1.8, lineHeight: 60 };
    case 'display':
      return { fontFamily: serif, fontSize: 36, letterSpacing: -1, lineHeight: 40 };
    case 'amount':
      return { fontFamily: FontFamily.bodyBold, fontSize: 22, letterSpacing: -0.4 };
    case 'inline':
    default:
      return { fontFamily: FontFamily.bodyBold, fontSize: 15, letterSpacing: -0.2 };
  }
}
