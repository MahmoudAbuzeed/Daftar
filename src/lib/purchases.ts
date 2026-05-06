// Payments are temporarily disabled. All functions are no-op stubs so the rest
// of the app (PaywallScreen, subscription context, etc.) keeps working without
// triggering RevenueCat, the App Store, or Google Play.
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

export async function initPurchases(_userId?: string): Promise<void> {}

export async function identifyUser(_userId: string): Promise<void> {}

export async function getPackages(): Promise<PurchasesPackage[]> {
  return [];
}

export async function purchasePackage(
  _pkg: PurchasesPackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo }> {
  return { success: false };
}

export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
}> {
  return { success: false };
}

export async function checkProStatus(): Promise<boolean> {
  return false;
}

export async function logoutPurchases(): Promise<void> {}
