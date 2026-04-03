import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = code.trim().length === 6;

  const handleJoin = async () => {
    if (!user || !isValid) return;

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
        setError(t('groups.invalid_code') || 'Invalid invite code. Please check and try again.');
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
        setError(t('groups.already_member') || 'You are already a member of this group.');
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

      Alert.alert(
        t('groups.join'),
        `${t('groups.joined_successfully') || 'Successfully joined'} "${group.name}"!`,
        [
          {
            text: t('common.done'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🔗</Text>
          </View>

          <Text style={styles.title}>{t('groups.join')}</Text>
          <Text style={styles.subtitle}>
            {t('groups.enter_invite_code') || 'Enter the 6-character invite code to join a group.'}
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError(null);
              }}
              placeholder="ABC123"
              placeholderTextColor="#D1D5DB"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              textAlign="center"
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.joinButton, !isValid && styles.joinButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleJoin}
            disabled={!isValid || joining}
          >
            {joining ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.joinButtonText}>{t('groups.join')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  codeInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 8,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  joinButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
