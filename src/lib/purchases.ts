import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// RevenueCat API keys
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'test_icBvIOqImAaaNmNFCRNeVscTFlB';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'test_icBvIOqImAaaNmNFCRNeVscTFlB';

// Entitlement ID configured in RevenueCat dashboard
const PRO_ENTITLEMENT = 'Fifti Pro';

/**
 * Initialize RevenueCat SDK. Call once on app startup.
 */
export async function initPurchases(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('RevenueCat API key not configured');
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

  if (Platform.OS === 'ios') {
    await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId || undefined });
  } else if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY, appUserID: userId || undefined });
  }
}

/**
 * Set the RevenueCat user ID (call after auth)
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('RevenueCat identify failed:', e);
  }
}

/**
 * Get available subscription packages
 */
export async function getPackages(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages || [];
  } catch {
    return [];
  }
}

/**
 * Purchase a package (shows Apple/Google payment sheet)
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      await syncSubscriptionToSupabase(customerInfo);
    }

    return { success: isPro, customerInfo };
  } catch (e: any) {
    if (e.userCancelled) {
      return { success: false };
    }
    throw e;
  }
}

/**
 * Restore purchases (for users who reinstall or switch devices)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      await syncSubscriptionToSupabase(customerInfo);
    }

    return { success: isPro, customerInfo };
  } catch {
    return { success: false };
  }
}

/**
 * Check if user currently has Pro entitlement
 */
export async function checkProStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Sync RevenueCat subscription to Supabase database
 */
async function syncSubscriptionToSupabase(customerInfo: CustomerInfo): Promise<void> {
  const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
  if (!proEntitlement) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from('subscriptions').upsert({
      user_id: user.id,
      tier: 'pro',
      billing_period: proEntitlement.periodType === 'ANNUAL' ? 'yearly' : 'monthly',
      platform: Platform.OS as 'ios' | 'android',
      store_transaction_id: proEntitlement.originalPurchaseDateMillis?.toString() || null,
      store_product_id: proEntitlement.productIdentifier,
      started_at: proEntitlement.originalPurchaseDate,
      expires_at: proEntitlement.expirationDate,
      is_active: true,
      cancelled_at: proEntitlement.unsubscribeDetectedAt || null,
    }, { onConflict: 'user_id' });

    // Also update user's is_pro flag for fast reads
    await supabase.from('users').update({ is_pro: true }).eq('id', user.id);
  } catch (e) {
    console.warn('Failed to sync subscription:', e);
  }
}

/**
 * Log out from RevenueCat (call on sign out)
 */
export async function logoutPurchases(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch {}
}
