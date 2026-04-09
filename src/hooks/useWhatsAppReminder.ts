import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '../lib/subscription-context';
import { shareViaWhatsApp } from '../utils/whatsapp';
import { RootStackParamList } from '../navigation/AppNavigator';

/**
 * Send a WhatsApp reminder, gated by the free-tier monthly limit.
 *
 * Free users get a fixed number of reminders per month (FREE_LIMITS.maxWhatsAppReminders).
 * If they exceed the limit, the paywall opens. Pro users are unlimited.
 *
 * Usage is metered server-side via the `whatsapp_reminder` feature key.
 */
export function useWhatsAppReminder() {
  const { canPerform, incrementUsage } = useSubscription();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return useCallback(
    async (message: string, phone?: string): Promise<boolean> => {
      const usage = await canPerform('whatsapp_reminder');
      if (!usage.allowed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        navigation.navigate('Paywall', { trigger: 'whatsapp_limit' });
        return false;
      }

      try {
        await shareViaWhatsApp(message, phone);
        // Only meter on successful send
        incrementUsage('whatsapp_reminder').catch(() => {});
        return true;
      } catch (err) {
        console.error('WhatsApp reminder failed:', err);
        return false;
      }
    },
    [canPerform, incrementUsage, navigation],
  );
}
