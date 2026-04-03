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

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

const sections = [
  {
    title: '1. Information We Collect',
    body:
      '- Phone number (for authentication)\n' +
      '- Display name (your chosen name)\n' +
      '- Expense and payment data you enter\n' +
      '- Receipt images you scan\n' +
      '- Contacts (only when you choose to invite friends)',
  },
  {
    title: '2. How We Use Your Information',
    body:
      '- To provide bill splitting and debt tracking services\n' +
      '- To authenticate your account via SMS verification\n' +
      '- To process receipt images using AI for item extraction\n' +
      '- To send notifications about shared expenses',
  },
  {
    title: '3. Third-Party Services',
    body:
      '- Supabase: Authentication, database, and file storage\n' +
      '- OpenAI: Receipt image processing (images are processed and not stored by OpenAI)',
  },
  {
    title: '4. Data Storage and Security',
    body:
      '- Your data is stored securely on Supabase servers\n' +
      '- We use row-level security to ensure you can only access your own data\n' +
      '- Receipt images are stored in private buckets',
  },
  {
    title: '5. Data Deletion',
    body:
      '- You can delete your account and all associated data by contacting us\n' +
      '- Deleting the app does not delete your server-side data',
  },
  {
    title: '6. Children\'s Privacy',
    body: '- Daftar is not intended for children under 13',
  },
  {
    title: '7. Contact',
    body: '- Email: support@daftar.app',
  },
];

export default function PrivacyPolicyScreen(_props: Props) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Privacy Policy for Daftar</Text>
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
