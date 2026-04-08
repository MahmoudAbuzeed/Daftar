import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  StatusBar,
  I18nManager,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { useAppTheme, ThemeColors } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { Spacing, Radius, FontFamily } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { GroupMessage } from '../../types/database';
import { sendNotificationsToUsers } from '../../lib/notifications';
import BouncyPressable from '../../components/BouncyPressable';
import ThemedCard from '../../components/ThemedCard';
import useScreenEntrance from '../../hooks/useScreenEntrance';
import { AnimatedGradientButton } from '../../components/SendButton';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChat'>;

const { width: SW } = Dimensions.get('window');

export default function GroupChatScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const entrance = useScreenEntrance();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('group_messages')
        .select('*, user:users!group_messages_user_id_fkey(display_name)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (msgError) throw msgError;

      // Reverse to show oldest first
      setMessages((msgData || []).reverse());

      // Fetch group name
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      if (groupData) setGroupName(groupData.name);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId, profile?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Set up navigation title
  useEffect(() => {
    navigation.setOptions({ title: groupName });
  }, [navigation, groupName]);

  // Real-time subscription
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`chat:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as GroupMessage;
          setMessages(prev => [...prev, newMsg]);
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, profile?.id]);

  // Get other group members for notifications
  const getOtherMembers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .neq('user_id', profile?.id);

      return data?.map(m => m.user_id) || [];
    } catch (err) {
      console.error('Error fetching members:', err);
      return [];
    }
  }, [groupId, profile?.id]);

  const handleSendMessage = async () => {
    if (!profile?.id || !inputText.trim()) return;

    const messageContent = inputText.trim();
    setSending(true);

    try {
      // Insert message
      const { error: insertError } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          user_id: profile.id,
          content: messageContent,
          type: 'text',
        });

      if (insertError) throw insertError;

      setInputText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Send push notifications to other members
      const otherMemberIds = await getOtherMembers();
      if (otherMemberIds.length > 0) {
        const preview = messageContent.length > 50 ? messageContent.slice(0, 50) + '...' : messageContent;
        await sendNotificationsToUsers({
          userIds: otherMemberIds,
          title: groupName,
          body: `${profile.display_name}: ${preview}`,
          data: { type: 'chat', groupId },
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: GroupMessage; index: number }) => {
    const isOwnMessage = item.user_id === profile?.id;
    const isSystemMessage = item.type !== 'text';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageRow}>
          <View style={styles.systemMessagePill}>
            <Ionicons
              name={item.type === 'expense' ? 'receipt-outline' : 'swap-horizontal-outline'}
              size={12}
              color={colors.textTertiary}
            />
            <Text style={styles.systemMessageText} numberOfLines={2}>
              {item.content}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isOwnMessage && styles.messageRowOwn]}>
        {!isOwnMessage && (
          <View style={styles.avatarSmall}>
            <LinearGradient colors={colors.primaryGradient} style={styles.avatarGradient}>
              <Text style={styles.avatarText}>
                {(item.user?.display_name || '?')[0].toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
        )}

        <View style={[styles.messageBubble, isOwnMessage && styles.messageBubbleOwn]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.user?.display_name || 'Someone'}</Text>
          )}
          <Text style={[styles.messageContent, isOwnMessage && styles.messageContentOwn]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.messageTimeOwn]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="chatbubble-outline" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>{t('chat.noMessages')}</Text>
        <Text style={styles.emptySub}>{t('chat.noMessagesSubtitle')}</Text>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.safe}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.messagesList}
          ListEmptyComponent={renderEmpty}
          inverted={false}
          scrollIndicatorInsets={{ right: 1 }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colors.textTertiary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!sending}
              />
              <AnimatedGradientButton
                onPress={handleSendMessage}
                disabled={!inputText.trim()}
                loading={sending}
                colors={colors}
                isDark={isDark}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },

    messagesList: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    emptyList: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    messageRowOwn: {
      justifyContent: 'flex-end',
    },

    avatarSmall: {
      width: 32,
      height: 32,
      borderRadius: 8,
      overflow: 'hidden',
    },
    avatarGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 12,
      color: '#FFFFFF',
    },

    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : c.bgCard,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : c.border,
    },
    messageBubbleOwn: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },

    senderName: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 11,
      color: c.textSecondary,
      marginBottom: 2,
    },

    messageContent: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: c.text,
      lineHeight: 20,
    },
    messageContentOwn: {
      color: '#FFFFFF',
    },

    messageTime: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: c.textTertiary,
      marginTop: 4,
    },
    messageTimeOwn: {
      color: 'rgba(255,255,255,0.7)',
    },

    systemMessageRow: {
      alignItems: 'center',
      marginVertical: Spacing.md,
    },
    systemMessagePill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : c.bgCard,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : c.borderLight,
      gap: Spacing.xs,
    },
    systemMessageText: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: c.textSecondary,
    },

    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : c.border,
      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      paddingBottom: Platform.OS === 'android' ? Spacing.lg + 4 : Spacing.md,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: FontFamily.body,
      fontSize: 15,
      color: c.text,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : c.border,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      maxHeight: 100,
      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF',
    },

    emptyState: {
      alignItems: 'center',
      gap: Spacing.md,
    },
    emptyTitle: {
      fontFamily: FontFamily.bodySemibold,
      fontSize: 16,
      color: c.text,
    },
    emptySub: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: c.textTertiary,
      textAlign: 'center',
    },
  });
