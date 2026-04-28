import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../lib/theme-context';
import { FontFamily, Spacing } from '../theme';
import { displayFor } from '../theme/fonts';
import FunButton from './FunButton';
import EmptyState from './EmptyState';

type Variant = 'loading' | 'error' | 'empty';

interface Props {
  variant: Variant;
  title?: string;
  body?: string;
  /** For variant="error", a callback to retry the failed operation */
  onRetry?: () => void;
  /** For variant="empty", an icon to show */
  icon?: keyof typeof Ionicons.glyphMap;
  /** For variant="empty", a CTA element */
  action?: React.ReactNode;
}

/**
 * Full-screen state placeholder for the three universal "between content" states.
 * Use this so screens stop reinventing loading spinners and silent error catches.
 *
 *   if (loading) return <StateScreen variant="loading" />;
 *   if (error) return <StateScreen variant="error" onRetry={refetch} />;
 *   if (!data.length) return <StateScreen variant="empty" icon="people-outline" title="..." />;
 */
export default function StateScreen({ variant, title, body, onRetry, icon, action }: Props) {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const titleFont = displayFor(i18n.language, 'bold');
  const direction = I18nManager.isRTL ? 'rtl' : 'ltr';

  if (variant === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (variant === 'error') {
    const errorTitle = title || t('common.error');
    const errorBody = body || t('common.errorBody', 'Something went wrong. Please try again.');
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.errorIcon, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
        </View>
        <Text style={[styles.title, { color: colors.text, fontFamily: titleFont, writingDirection: direction }]}>
          {errorTitle}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary, writingDirection: direction }]}>{errorBody}</Text>
        {onRetry ? (
          <View style={styles.action}>
            <FunButton
              title={t('common.retry')}
              onPress={onRetry}
              icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
            />
          </View>
        ) : null}
      </View>
    );
  }

  // empty
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <EmptyState
        icon={icon || 'cube-outline'}
        title={title || t('common.empty', 'Nothing here yet')}
        body={body}
        action={action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  errorIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.xl,
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
  action: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
  },
});
