import React, { useMemo } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Terms'>;

const sections = [
  {
    title: '1. Service Description',
    body: 'Daftar is a bill splitting and personal debt tracking application.',
  },
  {
    title: '2. Account',
    body:
      '- You must provide a valid phone number to create an account\n' +
      '- You are responsible for all activity on your account',
  },
  {
    title: '3. Acceptable Use',
    body:
      '- You agree to use Daftar only for lawful purposes\n' +
      '- You will not attempt to manipulate expense records fraudulently',
  },
  {
    title: '4. Subscriptions',
    body:
      '- Daftar Pro is available as a monthly or yearly subscription\n' +
      '- Subscriptions are managed through Apple App Store or Google Play Store\n' +
      '- You can cancel anytime through your store account settings',
  },
  {
    title: '5. Limitation of Liability',
    body:
      '- Daftar is provided "as is" without warranties\n' +
      '- We are not responsible for disputes between users about expenses\n' +
      '- We are not a financial institution or payment processor',
  },
  {
    title: '6. Governing Law',
    body: '- These terms are governed by the laws of Egypt',
  },
  {
    title: '7. Changes',
    body:
      '- We may update these terms from time to time\n' +
      '- Continued use constitutes acceptance of updated terms',
  },
  {
    title: '8. Contact',
    body: '- Email: support@daftar.app',
  },
];

export default function TermsScreen(_props: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Terms of Service for Daftar</Text>
      <Text style={styles.updated}>Last updated: April 2026</Text>

      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
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
