import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth-context';
import { identifyUser, checkProStatus } from './purchases';
import { Subscription, TierLimits, FeatureKey } from '../types/database';

const SUB_CACHE_KEY = '@fifti/subscription';

export const FREE_LIMITS: TierLimits = {
  maxGroups: 5,
  maxReceiptScans: Infinity,
  maxLedgerContacts: 20,
  maxWhatsAppReminders: 10,
  hasDataExport: false,
  hasAnalytics: false,
  hasRecurringExpenses: false,
  hasProBadge: false,
};

export const PRO_LIMITS: TierLimits = {
  maxGroups: Infinity,
  maxReceiptScans: Infinity,
  maxLedgerContacts: Infinity,
  maxWhatsAppReminders: Infinity,
  hasDataExport: true,
  hasAnalytics: true,
  hasRecurringExpenses: true,
  hasProBadge: true,
};

export interface UsageResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
}

interface SubscriptionContextValue {
  isPro: boolean;
  tier: 'free' | 'pro';
  limits: TierLimits;
  subscription: Subscription | null;
  loading: boolean;
  canPerform: (feature: FeatureKey) => Promise<UsageResult>;
  incrementUsage: (feature: FeatureKey) => Promise<number>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPro: false,
  tier: 'free',
  limits: FREE_LIMITS,
  subscription: null,
  loading: true,
  canPerform: async () => ({ allowed: true, currentUsage: 0, limit: 3 }),
  incrementUsage: async () => 1,
  refreshSubscription: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isPro = useMemo(() => {
    if (!subscription) return false;
    if (!subscription.is_active) return false;
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) return false;
    return subscription.tier === 'pro';
  }, [subscription]);

  const tier: 'free' | 'pro' = isPro ? 'pro' : 'free';
  const limits = isPro ? PRO_LIMITS : FREE_LIMITS;

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      // Try cache first for instant UI
      const cached = await AsyncStorage.getItem(SUB_CACHE_KEY);
      if (cached) {
        setSubscription(JSON.parse(cached));
      }

      // Fetch from server
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSubscription(data as Subscription);
        await AsyncStorage.setItem(SUB_CACHE_KEY, JSON.stringify(data));
      } else {
        setSubscription(null);
        await AsyncStorage.removeItem(SUB_CACHE_KEY);
      }

      // Also sync with RevenueCat
      try {
        await identifyUser(user.id);
        const rcPro = await checkProStatus();
        // If RevenueCat says Pro but Supabase doesn't, sync
        if (rcPro && (!data || data.tier !== 'pro')) {
          // Will be synced on next purchase webhook
        }
      } catch {}
    } catch {
      // Use cached value if available
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const canPerform = useCallback(
    async (feature: FeatureKey): Promise<UsageResult> => {
      if (isPro) return { allowed: true, currentUsage: 0, limit: Infinity };
      if (!user) return { allowed: false, currentUsage: 0, limit: 0 };

      const limitMap: Record<FeatureKey, number> = {
        receipt_scan: FREE_LIMITS.maxReceiptScans,
        group_create: FREE_LIMITS.maxGroups,
        whatsapp_reminder: FREE_LIMITS.maxWhatsAppReminders,
        data_export: 0, // Not available for free
      };

      const limit = limitMap[feature];

      try {
        // For group_create, count actual groups instead of usage_tracking
        if (feature === 'group_create') {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          const currentUsage = count || 0;
          return { allowed: currentUsage < limit, currentUsage, limit };
        }

        // For other features, check usage_tracking
        const { data } = await supabase.rpc('get_usage', {
          p_user_id: user.id,
          p_feature: feature,
        });

        const currentUsage = (data as number) || 0;
        return { allowed: currentUsage < limit, currentUsage, limit };
      } catch {
        // Fail open — allow the action if we can't check
        return { allowed: true, currentUsage: 0, limit };
      }
    },
    [isPro, user],
  );

  const incrementUsage = useCallback(
    async (feature: FeatureKey): Promise<number> => {
      if (!user) return 0;

      try {
        const { data } = await supabase.rpc('increment_usage', {
          p_user_id: user.id,
          p_feature: feature,
        });
        return (data as number) || 0;
      } catch {
        return 0;
      }
    },
    [user],
  );

  const value = useMemo(
    () => ({
      isPro,
      tier,
      limits,
      subscription,
      loading,
      canPerform,
      incrementUsage,
      refreshSubscription: fetchSubscription,
    }),
    [isPro, tier, limits, subscription, loading, canPerform, incrementUsage, fetchSubscription],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
