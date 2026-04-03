import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth-context';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { Colors, Gradients, Spacing, Radius, Shadows, FontFamily } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
const { width: SW } = Dimensions.get('window');

export default function SignInScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
    } catch (error: any) {
      Alert.alert(t('auth.error'), error.message ?? t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#040D0B', '#0B1F1A', '#0A1916']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.orbTeal} />
      <View style={styles.orbBrass} />

      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#040D0B" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backArrow}>{'\u2190'}</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.headerTitle}>{t('auth.signIn')}</Text>
              <Text style={styles.headerSub}>{t('auth.signInSubtitle')}</Text>
            </View>

            {/* Form */}
            <View style={styles.formCard}>
              <LinearGradient
                colors={['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.formAccentBar} />

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.email')}</Text>
                <TextInput
                  style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  placeholderTextColor="rgba(244,240,232,0.25)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.password')}</Text>
                <TextInput
                  style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor="rgba(244,240,232,0.25)"
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSignIn}
                disabled={loading}
              >
                <LinearGradient
                  colors={loading ? ['#0F5249', '#0F5249'] : ['#1B7A6C', '#14B8A6']}
                  style={[styles.submitBtn, Shadows.glow]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.5 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitText}>{t('auth.signIn')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
              <TouchableOpacity onPress={() => navigation.replace('SignUp')} disabled={loading}>
                <Text style={styles.footerLink}>{t('auth.signUp')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040D0B' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  orbTeal: {
    position: 'absolute',
    width: SW * 0.7,
    height: SW * 0.7,
    borderRadius: SW * 0.35,
    backgroundColor: 'rgba(27,122,108,0.1)',
    top: '15%',
    right: -SW * 0.2,
  },
  orbBrass: {
    position: 'absolute',
    width: SW * 0.5,
    height: SW * 0.5,
    borderRadius: SW * 0.25,
    backgroundColor: 'rgba(201,162,39,0.05)',
    bottom: '10%',
    left: -SW * 0.15,
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  backArrow: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 20,
    color: Colors.accentLight,
  },

  headerBlock: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 36,
    paddingBottom: 28,
  },
  headerKicker: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 10,
    letterSpacing: 4,
    color: 'rgba(212,175,55,0.6)',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    letterSpacing: -2,
    color: '#F4F0E8',
    marginBottom: Spacing.sm,
  },
  headerSub: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: 'rgba(244,240,232,0.5)',
    lineHeight: 22,
  },

  formCard: {
    marginHorizontal: Spacing.xxl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.2)',
    padding: Spacing.xxl,
    gap: 22,
    overflow: 'hidden',
  },
  formAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.accent,
    opacity: 0.7,
  },

  inputGroup: { gap: Spacing.sm },
  label: {
    fontFamily: FontFamily.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(212,175,55,0.65)',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,252,247,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 15,
    fontSize: 16,
    fontFamily: FontFamily.body,
    color: '#F4F0E8',
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(27,122,108,0.1)',
  },

  submitBtn: {
    borderRadius: Radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  submitText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 6,
  },
  footerText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: 'rgba(244,240,232,0.45)',
  },
  footerLink: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.primaryLight,
  },
});
