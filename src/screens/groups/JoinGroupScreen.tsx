import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Spacing, Radius, FontFamily } from '../../theme';
import FunButton from '../../components/FunButton';
import ThemedInput from '../../components/ThemedInput';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { useAlert } from '../../hooks/useAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const alert = useAlert();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrance = useScreenEntrance();

  const isValid = code.trim().length === 6;

  const handleJoin = async () => {
    if (!user || !isValid) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    setError(null);

    try {
      const inviteCode = code.trim().toUpperCase();

      // Look up the group by invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .eq('is_archived', false)
        .single();

      if (groupError || !group) {
        setError(t('groups.invalid_code'));
        return;
      }

      // Check if user is already a member
      const { data: existing, error: existError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existError) throw existError;

      if (existing) {
        setError(t('groups.already_member'));
        return;
      }

      // Add user to group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) throw joinError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert.show('success', t('groups.join'), `${t('groups.joined_successfully')} "${group.name}"`, [
        { text: t('common.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message || t('common.error'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      {isDark && (
        <LinearGradient
          colors={colors.headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
        />
      )}

      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <Animated.View style={[styles.content, entrance.style]}>
            {/* Gradient icon circle */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="link-outline" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>{t('groups.join')}</Text>
            <Text style={styles.subtitle}>
              {t('groups.enter_invite_code')}
            </Text>

            {/* Large code input using ThemedInput */}
            <ThemedInput
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError(null);
              }}
              placeholder={t('groups.codePlaceholder')}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              style={styles.codeInputStyle}
              containerStyle={styles.inputContainer}
              error={error || undefined}
            />

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={colors.danger}
                  style={{ marginRight: Spacing.sm }}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <FunButton
              title={t('groups.join')}
              onPress={handleJoin}
              loading={joining}
              disabled={!isValid}
              icon={<Ionicons name="enter-outline" size={20} color="#FFFFFF" />}
              style={styles.buttonWrapper}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    flex: {
      flex: 1,
    },
    content: {
      flex: 1,
      padding: Spacing.xxl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: Spacing.xxl,
    },
    iconGradient: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 10,
    },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      letterSpacing: -0.6,
      color: c.text,
      marginBottom: Spacing.sm,
    },
    subtitle: {
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xxxl,
      paddingHorizontal: Spacing.lg,
    },
    inputContainer: {
      width: '100%',
      marginBottom: Spacing.lg,
    },
    codeInputStyle: {
      fontSize: 28,
      fontFamily: FontFamily.bodyBold,
      letterSpacing: 8,
      textAlign: 'center',
      paddingVertical: 18,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(234,88,12,0.12)' : '#FFF7ED',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
      borderRadius: Radius.md,
      marginBottom: Spacing.lg,
      width: '100%',
    },
    errorText: {
      fontFamily: FontFamily.bodySemibold,
      color: c.danger,
      fontSize: 14,
      flex: 1,
    },
    buttonWrapper: {
      width: '100%',
    },
  });
