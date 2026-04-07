import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'fifti_offline_queue';

export type QueueActionType =
  | 'insert_expense'
  | 'insert_settlement'
  | 'insert_ledger'
  | 'insert_expense_split'
  | 'insert_expense_item'
  | 'insert_item_assignment';

interface QueuedAction {
  id: string;
  type: QueueActionType;
  table: string;
  data: any;
  retries: number;
  created_at: string;
  error?: string;
}

const MAX_RETRIES = 5;

export async function getQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToQueue(action: Omit<QueuedAction, 'id' | 'created_at' | 'retries' | 'error'>): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push({
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      retries: 0,
      created_at: new Date().toISOString(),
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to add to offline queue:', error);
  }
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        const { error } = await supabase.from(action.table).insert(action.data);
        if (error) {
          // Retry logic
          if (action.retries < MAX_RETRIES) {
            remaining.push({ ...action, retries: action.retries + 1 });
            failed++;
          } else {
            // Max retries exceeded, log error
            console.error(`Queue action ${action.id} failed after ${MAX_RETRIES} retries:`, error);
            remaining.push({ ...action, error: error.message });
            failed++;
          }
        } else {
          synced++;
        }
      } catch (err: any) {
        // Network error or other exception
        if (action.retries < MAX_RETRIES) {
          remaining.push({ ...action, retries: action.retries + 1 });
          failed++;
        } else {
          console.error(`Queue action ${action.id} failed after ${MAX_RETRIES} retries:`, err.message);
          remaining.push({ ...action, error: err.message });
          failed++;
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return { synced, failed };
  } catch (error) {
    console.error('Sync queue error:', error);
    return { synced: 0, failed: 0 };
  }
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear offline queue:', error);
  }
}

export async function removeFromQueue(actionId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(a => a.id !== actionId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from offline queue:', error);
  }
}
