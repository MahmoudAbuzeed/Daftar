import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { Platform } from 'react-native';

// Configure how notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationType = 'expense' | 'settlement' | 'group_settled';

interface SendToUsersPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Register device for push notifications and save token to database
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    if (!token || !token.data) {
      console.log('Failed to get push token');
      return null;
    }

    const pushToken = token.data;
    const platform = Platform.OS as 'ios' | 'android' | 'web';

    // Save token to database (upsert)
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: pushToken,
          platform,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving push token to database:', error);
      return null;
    }

    console.log('Push token registered successfully:', pushToken);
    return pushToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send push notifications to specific users via Edge Function
 * This notifies OTHER users when something happens
 */
export async function sendNotificationsToUsers({
  userIds,
  title,
  body,
  data,
}: SendToUsersPayload): Promise<boolean> {
  try {
    if (!userIds || userIds.length === 0) {
      console.log('No user IDs provided for notifications');
      return false;
    }

    // Call the Edge Function
    const response = await supabase.functions.invoke('send-push-notification', {
      body: {
        userIds,
        title,
        body,
        data: data || {},
      },
    });

    if (response.error) {
      console.error('Error sending push notifications:', response.error);
      return false;
    }

    console.log('Push notifications sent:', response.data);
    return true;
  } catch (error) {
    console.error('Error invoking send-push-notification function:', error);
    return false;
  }
}

/**
 * Save an in-app notification to the database
 * This is what users see in the NotificationsScreen
 */
export async function saveInAppNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<string | null> {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data: data || {},
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving in-app notification:', error);
      return null;
    }

    return notification?.id || null;
  } catch (error) {
    console.error('Error saving in-app notification:', error);
    return null;
  }
}

/**
 * Fetch in-app notifications for a user
 */
export async function getNotifications(userId: string, limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

/**
 * Schedule a local notification using the OS scheduler
 * Trigger types: timeInterval (immediate), daily, weekly
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: any
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { isEngagement: true },
        sound: 'default',
        badge: 1,
      },
      trigger,
    });

    console.log('Local notification scheduled:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling local notification:', error);
    return null;
  }
}
