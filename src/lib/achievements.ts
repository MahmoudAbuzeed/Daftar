import { supabase } from './supabase';
import { get_group_balances } from './supabase';

export type AchievementType =
  | 'first_expense'
  | 'debt_free'
  | 'speed_settler'
  | 'group_creator'
  | 'social_butterfly'
  | 'receipt_scanner';

/**
 * Award an achievement to a user (idempotent via UNIQUE constraint)
 */
export async function awardAchievement(
  userId: string,
  type: AchievementType,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        type,
        metadata: metadata || {},
      });

    if (error) {
      // UNIQUE violation (23505) means badge already earned - this is fine
      if (error.code === '23505') {
        console.log(`Achievement ${type} already earned by user ${userId}`);
        return false;
      }
      console.error(`Error awarding achievement ${type}:`, error);
      return false;
    }

    console.log(`Awarded achievement ${type} to user ${userId}`);
    return true;
  } catch (err) {
    console.error(`Exception awarding achievement ${type}:`, err);
    return false;
  }
}

/**
 * Check if user has settled all debts in a group (debt_free achievement)
 */
export async function checkDebtFree(userId: string, groupId: string): Promise<void> {
  try {
    // Call the RPC function to get simplified balances for the group
    const { data, error } = await supabase.rpc('get_group_balances', {
      group_id: groupId,
    });

    if (error) {
      console.error('Error checking debt-free status:', error);
      return;
    }

    // If no balances exist, all debts are settled
    if (!data || data.length === 0) {
      await awardAchievement(userId, 'debt_free', { groupId });
    }
  } catch (err) {
    console.error('Exception checking debt-free:', err);
  }
}

/**
 * Check if user settled a debt within 24 hours (speed_settler achievement)
 */
export async function checkSpeedSettler(
  userId: string,
  settlementCreatedAt: string,
  originalExpenseCreatedAt: string
): Promise<void> {
  try {
    const settlementTime = new Date(settlementCreatedAt).getTime();
    const expenseTime = new Date(originalExpenseCreatedAt).getTime();
    const hoursPassed = (settlementTime - expenseTime) / (1000 * 60 * 60);

    if (hoursPassed < 24) {
      await awardAchievement(userId, 'speed_settler', {
        settledWithinHours: Math.floor(hoursPassed),
      });
    }
  } catch (err) {
    console.error('Exception checking speed settler:', err);
  }
}

/**
 * Check if user is in 5+ groups (social_butterfly achievement)
 */
export async function checkSocialButterfly(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('Error checking social butterfly:', error);
      return;
    }

    const groupCount = data?.length || 0;
    if (groupCount >= 5) {
      await awardAchievement(userId, 'social_butterfly', { groupCount });
    }
  } catch (err) {
    console.error('Exception checking social butterfly:', err);
  }
}

/**
 * Check if this is user's first expense
 */
export async function checkFirstExpense(userId: string): Promise<void> {
  try {
    const { data, error, count } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId);

    if (error) {
      console.error('Error checking first expense:', error);
      return;
    }

    // If this is the first expense (count = 1), award the badge
    if (count === 1) {
      await awardAchievement(userId, 'first_expense');
    }
  } catch (err) {
    console.error('Exception checking first expense:', err);
  }
}
