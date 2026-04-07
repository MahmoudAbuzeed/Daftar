export type CurrencyCode = 'EGP' | 'USD' | 'EUR' | 'GBP' | 'SAR' | 'AED' | 'KWD' | 'QAR' | 'BHD' | 'OMR' | 'JOD' | 'LBP' | 'IQD' | 'MAD' | 'TND' | 'DZD' | 'LYD' | 'SDG' | 'INR' | 'PKR' | 'TRY' | 'NGN' | 'ZAR' | 'BRL' | 'CAD' | 'AUD';

export type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'bank' | 'paypal' | 'venmo' | 'zelle' | 'wise' | 'revolut' | 'apple_pay' | 'google_pay' | 'stc_pay' | 'mada' | 'upi' | 'other';

export interface User {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_lang: 'en' | 'ar';
  preferred_currency: CurrencyCode;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  currency: CurrencyCode;
  invite_code: string;
  created_by: string;
  created_at: string;
  is_archived: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  is_favorite: boolean;
  joined_at: string;
  user?: User;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  description: string;
  total_amount: number;
  currency: CurrencyCode;
  category: string | null;
  split_type: 'equal' | 'exact' | 'percentage' | 'by_item';
  receipt_image: string | null;
  notes: string | null;
  ai_parsed: boolean;
  tip_amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  splits?: ExpenseSplit[];
  items?: ExpenseItem[];
  paid_by_user?: User;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage: number | null;
  is_settled: boolean;
  created_at: string;
  user?: User;
}

export interface ExpenseItem {
  id: string;
  expense_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  assignments?: ItemAssignment[];
}

export interface ItemAssignment {
  id: string;
  item_id: string;
  user_id: string;
  share_amount: number;
}

export interface Settlement {
  id: string;
  group_id: string;
  paid_by: string;
  paid_to: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  note: string | null;
  created_at: string;
  paid_by_user?: User;
  paid_to_user?: User;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  contact_name: string;
  contact_user_id: string | null;
  amount: number;
  direction: 'i_owe' | 'they_owe';
  note: string | null;
  is_settled: boolean;
  created_at: string;
  settled_at: string | null;
}

export interface Balance {
  from_user: string;
  to_user: string;
  net_amount: number;
  from_user_data?: User;
  to_user_data?: User;
}

export interface ParsedReceipt {
  items: ParsedReceiptItem[];
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  currency: CurrencyCode;
  merchant_name: string | null;
}

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Subscription & Monetization

export interface Subscription {
  id: string;
  user_id: string;
  tier: 'free' | 'pro';
  billing_period: 'monthly' | 'yearly' | null;
  platform: 'ios' | 'android' | 'web' | null;
  store_transaction_id: string | null;
  store_product_id: string | null;
  started_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  feature: 'receipt_scan' | 'group_create' | 'whatsapp_reminder' | 'data_export';
  period_start: string;
  usage_count: number;
  updated_at: string;
}

export type FeatureKey = 'receipt_scan' | 'group_create' | 'whatsapp_reminder' | 'data_export';

export interface TierLimits {
  maxGroups: number;
  maxReceiptScans: number;
  maxLedgerContacts: number;
  maxWhatsAppReminders: number;
  hasDataExport: boolean;
  hasAnalytics: boolean;
  hasRecurringExpenses: boolean;
  hasProBadge: boolean;
}

// Collaborative Bill Assignment

export interface SharedBill {
  id: string;
  group_id: string;
  created_by: string;
  paid_by: string;
  status: 'pending' | 'finalized' | 'cancelled';
  receipt_image: string | null;
  tax: number;
  service_charge: number;
  tip: number;
  currency: CurrencyCode;
  merchant_name: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  expense_id: string | null;
  items?: SharedBillItem[];
  created_by_user?: User;
  paid_by_user?: User;
}

export interface SharedBillItem {
  id: string;
  bill_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  claims?: SharedBillClaim[];
}

export interface SharedBillClaim {
  id: string;
  item_id: string;
  user_id: string;
  claimed_at: string;
  user?: User;
}

// Recurring Expenses

export interface RecurringExpense {
  id: string;
  group_id: string;
  created_by: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  category: string | null;
  split_type: 'equal' | 'exact' | 'percentage';
  frequency: 'weekly' | 'biweekly' | 'monthly';
  next_due: string;
  is_active: boolean;
  last_created_at: string | null;
  created_at: string;
  members?: RecurringExpenseMember[];
  group?: Group;
}

export interface RecurringExpenseMember {
  id: string;
  recurring_id: string;
  user_id: string;
  share_amount: number | null;
  share_percentage: number | null;
}

// Quick Split (standalone, no group needed)

export interface QuickSplit {
  id: string;
  user_id: string;
  description: string;
  total_amount: number;
  currency: CurrencyCode;
  created_at: string;
}

export interface QuickSplitParticipant {
  id: string;
  quick_split_id: string;
  name: string;
  phone: string | null;
  amount: number;
  is_settled: boolean;
  created_at: string;
}

// Currency Conversion

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

// Push Notifications

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
  updated_at: string;
}

export type NotificationType = 'expense' | 'settlement' | 'group_settled';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  created_at: string;
}
