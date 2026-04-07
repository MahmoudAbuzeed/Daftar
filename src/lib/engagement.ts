import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { saveInAppNotification, scheduleLocalNotification } from './notifications';
import { simplifyDebts } from '../utils/balance';
import { Balance } from '../types/database';

const NOTIFICATION_COOLDOWN_HOURS = 24;
const ACTIVITY_NUDGE_DAYS = 3;

/**
 * Get the key for storing last notification time in AsyncStorage
 */
const getLastNotifiedKey = (type: string): string => `last_notified_${type}`;

/**
 * Check if we should notify the user for a given type (cooldown check)
 */
const shouldNotifyToday = async (type: string): Promise<boolean> => {
  try {
    const key = getLastNotifiedKey(type);
    const lastNotified = await AsyncStorage.getItem(key);

    if (!lastNotified) return true;

    const lastTime = parseInt(lastNotified, 10);
    const hoursPassed = (Date.now() - lastTime) / (1000 * 60 * 60);

    if (type === 'activity_nudge') {
      // Activity nudge: only once every 3 days
      return hoursPassed >= 72;
    }

    // Default: once per day
    return hoursPassed >= NOTIFICATION_COOLDOWN_HOURS;
  } catch (error) {
    console.error('Error checking notification cooldown:', error);
    return true; // Allow notification on error
  }
};

/**
 * Mark that we've notified the user for this type
 */
const markNotified = async (type: string): Promise<void> => {
  try {
    const key = getLastNotifiedKey(type);
    await AsyncStorage.setItem(key, Date.now().toString());
  } catch (error) {
    console.error('Error marking notification:', error);
  }
};

/**
 * Get all unsettled debts for the current user across all groups
 */
const getUnseenDebtsForUser = async (userId: string) => {
  try {
    // Get all groups the user is in
    const { data: memberships, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    if (membershipError || !memberships || memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map((m) => m.group_id);
    const allBalances: Balance[] = [];

    // For each group, fetch expenses and settlements
    for (const groupId of groupIds) {
      const { data: expenses, error: expenseError } = await supabase
        .from('expenses')
        .select('id, paid_by, splits:expense_splits(user_id, amount)')
        .eq('group_id', groupId)
        .eq('is_deleted', false);

      if (expenseError || !expenses) continue;

      // Build raw balances from expenses
      for (const expense of expenses) {
        for (const split of expense.splits || []) {
          if (split.user_id !== expense.paid_by) {
            allBalances.push({
              from_user: split.user_id,
              to_user: expense.paid_by,
              net_amount: split.amount,
            });
          }
        }
      }

      // Fetch settlements for this group
      const { data: settlements } = await supabase
        .from('settlements')
        .select('paid_by, paid_to, amount')
        .eq('group_id', groupId);

      // Offset balances by settlements
      for (const settlement of settlements || []) {
        allBalances.push({
          from_user: settlement.paid_to,
          to_user: settlement.paid_by,
          net_amount: settlement.amount,
        });
      }
    }

    // Simplify and filter for debts owed by current user
    const simplified = simplifyDebts(allBalances);
    return simplified.filter((debt) => debt.from_user === userId);
  } catch (error) {
    console.error('Error getting unseen debts:', error);
    return [];
  }
};

/**
 * Get unpaid quick splits for the current user
 */
const getUnpaidQuickSplits = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('quick_split_participants')
      .select('quick_split_id, is_settled')
      .eq('user_id', userId)
      .eq('is_settled', false);

    if (error || !data) return 0;
    return data.length;
  } catch (error) {
    console.error('Error getting unpaid quick splits:', error);
    return 0;
  }
};

/**
 * Get days since user last logged an expense
 */
const getDaysSinceLastExpense = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('created_at')
      .eq('created_by', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 999; // No expenses found
    }

    const lastExpenseDate = new Date(data[0].created_at);
    const now = new Date();
    const daysPassed = Math.floor((now.getTime() - lastExpenseDate.getTime()) / (1000 * 60 * 60 * 24));

    return daysPassed;
  } catch (error) {
    console.error('Error getting days since last expense:', error);
    return 0;
  }
};

/**
 * Get user profile data
 */
const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    return data || null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

/**
 * Get debtor names for debt reminder notification
 */
const getDebtorNames = async (debtToUserId: string): Promise<string> => {
  try {
    const { data, error } = await supabase.from('users').select('display_name').eq('id', debtToUserId).single();
    return data?.display_name || 'Someone';
  } catch (error) {
    return 'Someone';
  }
};

/**
 * Main function: Check app state and send engagement notifications
 * Call this on every app open
 */
export async function checkOnAppOpen(userId: string): Promise<void> {
  try {
    // 1. Check for debt reminder
    const debts = await getUnseenDebtsForUser(userId);
    if (debts.length > 0 && (await shouldNotifyToday('debt_reminder'))) {
      const topDebt = debts[0];
      const creditorName = await getDebtorNames(topDebt.to_user);

      const title = 'Unsettled Debt';
      const body = `You still owe ${creditorName} ${topDebt.net_amount.toFixed(2)}`;

      // Save in-app notification
      await saveInAppNotification(userId, 'debt_reminder', title, body, {
        debtToUserId: topDebt.to_user,
        amount: topDebt.net_amount.toFixed(2),
      });

      // Schedule local notification
      await scheduleLocalNotification(title, body, {
        type: 'timeInterval',
        seconds: 5, // Show in 5 seconds as a demo
      });

      await markNotified('debt_reminder');
    }

    // 2. Check for activity nudge
    const daysSinceExpense = await getDaysSinceLastExpense(userId);
    if (daysSinceExpense >= ACTIVITY_NUDGE_DAYS && (await shouldNotifyToday('activity_nudge'))) {
      const title = 'Keep Track of Expenses';
      const body = `You haven't logged an expense in ${daysSinceExpense} days. Track your bills before they pile up!`;

      await saveInAppNotification(userId, 'activity_nudge', title, body);

      await scheduleLocalNotification(title, body, {
        type: 'timeInterval',
        seconds: 10, // Show in 10 seconds
      });

      await markNotified('activity_nudge');
    }

    // 3. Check for quick split reminders
    const unpaidSplits = await getUnpaidQuickSplits(userId);
    if (unpaidSplits > 0 && (await shouldNotifyToday('quicksplit_reminder'))) {
      const title = 'Unpaid QuickSplits';
      const body = `${unpaidSplits} person${unpaidSplits !== 1 ? 's' : ''} ${
        unpaidSplits === 1 ? 'has' : 'have'
      } not paid their share yet`;

      await saveInAppNotification(userId, 'quicksplit_reminder', title, body, {
        unpaidCount: unpaidSplits.toString(),
      });

      await scheduleLocalNotification(title, body, {
        type: 'timeInterval',
        seconds: 15, // Show in 15 seconds
      });

      await markNotified('quicksplit_reminder');
    }
  } catch (error) {
    console.error('Error in checkOnAppOpen:', error);
  }
}

/**
 * Schedule a weekly Sunday summary notification at 10am
 */
export async function scheduleWeeklySummary(userId: string): Promise<string | null> {
  try {
    const debts = await getUnseenDebtsForUser(userId);

    if (debts.length === 0) {
      return null; // No debts, no need to schedule
    }

    const totalOwed = debts.reduce((sum, d) => sum + d.net_amount, 0);
    const groupsCount = new Set(debts.map((d) => d.to_user)).size;

    const title = 'Weekly Summary';
    const body = `You owe ${groupsCount} person${groupsCount !== 1 ? 's' : ''} a total of ${totalOwed.toFixed(2)}`;

    // Schedule for every Sunday at 10am
    const notificationId = await scheduleLocalNotification(title, body, {
      type: 'weekly',
      weekday: 1, // Sunday (0 = Sunday, 1 = Monday, ... 6 = Saturday in Expo)
      hour: 10,
      minute: 0,
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling weekly summary:', error);
    return null;
  }
}

/**
 * Schedule a daily 9am reminder if user has debts
 */
export async function scheduleDailySettleNudge(userId: string): Promise<string | null> {
  try {
    const debts = await getUnseenDebtsForUser(userId);

    if (debts.length === 0) {
      return null; // No debts, no need to schedule
    }

    const debtCount = debts.length;
    const title = 'Settle Up Reminder';
    const body = `You have ${debtCount} unsettled debt${debtCount !== 1 ? 's' : ''}. Tap to settle up.`;

    // Schedule for daily at 9am
    const notificationId = await scheduleLocalNotification(title, body, {
      type: 'daily',
      hour: 9,
      minute: 0,
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling daily settle nudge:', error);
    return null;
  }
}

/**
 * Cancel all scheduled engagement notifications
 * Call on logout
 */
export async function cancelEngagementNotifications(): Promise<void> {
  try {
    // Get all scheduled notifications
    const notifications = await Notifications.getAllScheduledNotificationsAsync();

    // Cancel engagement-related ones (those with our data flags)
    const engagementNotifications = notifications.filter(
      (n) =>
        n.trigger &&
        'weekday' in n.trigger &&
        typeof n.request.content.data === 'object' &&
        n.request.content.data &&
        'isEngagement' in n.request.content.data
    );

    for (const notification of engagementNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    console.log(`Cancelled ${engagementNotifications.length} engagement notifications`);
  } catch (error) {
    console.error('Error cancelling engagement notifications:', error);
  }
}
