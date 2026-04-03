import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Spacing, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

const SECTION_KEYS = [
  'infoCollect', 'howWeUse', 'thirdParty', 'dataStorage',
  'dataDeletion', 'childrenPrivacy', 'contact',
];

export default function PrivacyPolicyScreen(_props: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>{t('privacy.heading')}</Text>
      <Text style={styles.updated}>{t('privacy.updated')}</Text>

      {SECTION_KEYS.map((key, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{t(`privacy.${key}.title`)}</Text>
          <Text style={styles.sectionBody}>{t(`privacy.${key}.body`)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors, _isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      padding: Spacing.xl,
      paddingBottom: 60,
    },
    heading: {
      fontFamily: FontFamily.display,
      fontSize: 24,
      letterSpacing: -0.5,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    updated: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      marginBottom: Spacing.xxl,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontFamily: FontFamily.bodyBold,
      fontSize: 16,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    sectionBody: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 22,
    },
  });
