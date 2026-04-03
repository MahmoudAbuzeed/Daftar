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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
const { width: SW } = Dimensions.get('window');

export default function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSignUp = async () => {
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('auth.error'), t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('auth.error'), t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await signUp(trimmedEmail, password, trimmedName);
    } catch (error: any) {
      Alert.alert(t('auth.error'), error.message ?? t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'displayName', label: t('auth.displayName'), placeholder: t('auth.displayNamePlaceholder'), value: displayName, onChange: setDisplayName, caps: 'words' as const, kb: 'default' as const },
    { key: 'email', label: t('auth.email'), placeholder: t('auth.emailPlaceholder'), value: email, onChange: setEmail, caps: 'none' as const, kb: 'email-address' as const },
    { key: 'password', label: t('auth.password'), placeholder: t('auth.passwordPlaceholder'), value: password, onChange: setPassword, secure: true },
    { key: 'confirmPassword', label: t('auth.confirmPassword'), placeholder: t('auth.confirmPasswordPlaceholder'), value: confirmPassword, onChange: setConfirmPassword, secure: true },
  ];

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
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backArrow}>{'\u2190'}</Text>
            </TouchableOpacity>

            <View style={styles.headerBlock}>
              <Text style={styles.headerKicker}>{t('auth.joinDaftar')}</Text>
              <Text style={styles.headerTitle}>{t('auth.signUp')}</Text>
              <Text style={styles.headerSub}>{t('auth.signUpSubtitle')}</Text>
            </View>

            <View style={styles.formCard}>
              <LinearGradient
                colors={['rgba(255,252,247,0.06)', 'rgba(255,252,247,0.02)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.formAccentBar} />

              {fields.map((f) => (
                <View key={f.key} style={styles.inputGroup}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, focusedField === f.key && styles.inputFocused]}
                    value={f.value}
                    onChangeText={f.onChange}
                    placeholder={f.placeholder}
                    placeholderTextColor="rgba(244,240,232,0.25)"
                    keyboardType={f.kb || 'default'}
                    autoCapitalize={f.caps || 'none'}
                    autoCorrect={false}
                    secureTextEntry={f.secure}
                    editable={!loading}
                    onFocus={() => setFocusedField(f.key)}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              ))}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSignUp}
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
                    <Text style={styles.submitText}>{t('auth.signUp')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.hasAccount')}</Text>
              <TouchableOpacity onPress={() => navigation.replace('SignIn')} disabled={loading}>
                <Text style={styles.footerLink}>{t('auth.signIn')}</Text>
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
    backgroundColor: 'rgba(27,122,108,0.08)',
    top: '20%',
    left: -SW * 0.25,
  },
  orbBrass: {
    position: 'absolute',
    width: SW * 0.4,
    height: SW * 0.4,
    borderRadius: SW * 0.2,
    backgroundColor: 'rgba(201,162,39,0.05)',
    bottom: '15%',
    right: -SW * 0.1,
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
    paddingTop: 28,
    paddingBottom: 24,
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
    gap: 18,
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
    marginTop: 28,
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
