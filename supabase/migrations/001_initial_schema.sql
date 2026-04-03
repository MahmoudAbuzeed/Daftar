-- Daftar Database Schema
-- Egyptian bill splitting & expense tracking app

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  preferred_lang TEXT DEFAULT 'en' CHECK (preferred_lang IN ('en', 'ar')),
  preferred_currency TEXT DEFAULT 'EGP' CHECK (preferred_currency IN ('EGP', 'USD')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  currency TEXT DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_archived BOOLEAN DEFAULT false
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id),
  description TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  category TEXT,
  split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'by_item')),
  receipt_image TEXT,
  ai_parsed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Expense splits (what each user owes for an expense)
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  percentage DECIMAL(5,2),
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(expense_id, user_id)
);

-- Expense items (from AI receipt scanner)
CREATE TABLE IF NOT EXISTS expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  sort_order INTEGER
);

-- Item assignments (who shares which item)
CREATE TABLE IF NOT EXISTS item_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES expense_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  share_amount DECIMAL(12,2) NOT NULL
);

-- Settlements
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by UUID REFERENCES users(id),
  paid_to UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  method TEXT DEFAULT 'cash' CHECK (method IN ('cash', 'vodafone_cash', 'instapay', 'bank')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Personal debt ledger (Daftar)
CREATE TABLE IF NOT EXISTS daftar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_user_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('i_owe', 'they_owe')),
  note TEXT,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_expenses_group ON expenses(group_id, created_at DESC);
CREATE INDEX idx_splits_user ON expense_splits(user_id);
CREATE INDEX idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_settlements_group ON settlements(group_id);
CREATE INDEX idx_daftar_user ON daftar_entries(user_id, is_settled);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_groups_invite ON groups(invite_code);

-- Balance calculation function
CREATE OR REPLACE FUNCTION get_group_balances(p_group_id UUID)
RETURNS TABLE(from_user UUID, to_user UUID, net_amount DECIMAL) AS $$
  WITH debts AS (
    SELECT
      es.user_id AS debtor,
      e.paid_by AS creditor,
      SUM(es.amount) AS total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = p_group_id
      AND e.is_deleted = false
      AND es.user_id != e.paid_by
    GROUP BY es.user_id, e.paid_by
  ),
  settled AS (
    SELECT paid_by, paid_to, SUM(amount) AS total
    FROM settlements
    WHERE group_id = p_group_id
    GROUP BY paid_by, paid_to
  ),
  net AS (
    SELECT
      d.debtor AS from_user,
      d.creditor AS to_user,
      COALESCE(d.total, 0) - COALESCE(s.total, 0) AS net_amount
    FROM debts d
    LEFT JOIN settled s ON s.paid_by = d.debtor AND s.paid_to = d.creditor
  )
  SELECT * FROM net WHERE net_amount > 0.01;
$$ LANGUAGE sql STABLE;

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE daftar_entries ENABLE ROW LEVEL SECURITY;

-- Users: can read any user, update own
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups: members can read
CREATE POLICY "Group members can read groups" ON groups FOR SELECT
  USING (id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group admins can update" ON groups FOR UPDATE
  USING (id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Group members: members can read their groups' members
CREATE POLICY "Members can read group members" ON group_members FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can join groups" ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE
  USING (auth.uid() = user_id);

-- Expenses: group members can CRUD
CREATE POLICY "Group members can read expenses" ON expenses FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Group members can create expenses" ON expenses FOR INSERT
  WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Expense creator can update" ON expenses FOR UPDATE
  USING (created_by = auth.uid());

-- Expense splits: same as expenses
CREATE POLICY "Members can read splits" ON expense_splits FOR SELECT
  USING (expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));
CREATE POLICY "Members can create splits" ON expense_splits FOR INSERT
  WITH CHECK (expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));

-- Expense items
CREATE POLICY "Members can read items" ON expense_items FOR SELECT
  USING (expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));
CREATE POLICY "Members can create items" ON expense_items FOR INSERT
  WITH CHECK (expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));

-- Item assignments
CREATE POLICY "Members can read assignments" ON item_assignments FOR SELECT
  USING (item_id IN (SELECT id FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()))));
CREATE POLICY "Members can create assignments" ON item_assignments FOR INSERT
  WITH CHECK (item_id IN (SELECT id FROM expense_items WHERE expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()))));

-- Settlements
CREATE POLICY "Members can read settlements" ON settlements FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can create settlements" ON settlements FOR INSERT
  WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

-- Daftar entries: only own
CREATE POLICY "Users can read own daftar" ON daftar_entries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own daftar" ON daftar_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daftar" ON daftar_entries FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daftar" ON daftar_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');
CREATE POLICY "Users can read own receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');
