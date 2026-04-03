export interface User {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_lang: 'en' | 'ar';
  preferred_currency: 'EGP' | 'USD';
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  currency: 'EGP' | 'USD';
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
  joined_at: string;
  user?: User;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by: string;
  description: string;
  total_amount: number;
  currency: 'EGP' | 'USD';
  category: string | null;
  split_type: 'equal' | 'exact' | 'percentage' | 'by_item';
  receipt_image: string | null;
  ai_parsed: boolean;
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
  currency: 'EGP' | 'USD';
  method: 'cash' | 'vodafone_cash' | 'instapay' | 'bank';
  note: string | null;
  created_at: string;
  paid_by_user?: User;
  paid_to_user?: User;
}

export interface DaftarEntry {
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
  currency: 'EGP' | 'USD';
  merchant_name: string | null;
}

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
