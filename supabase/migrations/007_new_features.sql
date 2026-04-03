-- New Features: Notes, Recurring Expenses, Currency Conversion

-- Add notes column to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;

-- Recurring expenses
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  category TEXT,
  split_type TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'exact', 'percentage')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  next_due DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Members included in recurring expense
CREATE TABLE IF NOT EXISTS recurring_expense_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id UUID REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  share_amount DECIMAL(12,2),
  share_percentage DECIMAL(5,2),
  UNIQUE(recurring_id, user_id)
);

-- Indexes
CREATE INDEX idx_recurring_group ON recurring_expenses(group_id, is_active);
CREATE INDEX idx_recurring_due ON recurring_expenses(next_due) WHERE is_active = true;
CREATE INDEX idx_recurring_members ON recurring_expense_members(recurring_id);

-- RLS
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expense_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read recurring" ON recurring_expenses FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Group members can create recurring" ON recurring_expenses FOR INSERT
  WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Creator can update recurring" ON recurring_expenses FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "Creator can delete recurring" ON recurring_expenses FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Members can read recurring members" ON recurring_expense_members FOR SELECT
  USING (recurring_id IN (SELECT id FROM recurring_expenses WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));
CREATE POLICY "Creator can manage recurring members" ON recurring_expense_members FOR INSERT
  WITH CHECK (recurring_id IN (SELECT id FROM recurring_expenses WHERE created_by = auth.uid()));

-- Currency exchange rates cache (updated periodically)
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(12,6) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

-- Seed with a default EGP/USD rate
INSERT INTO exchange_rates (from_currency, to_currency, rate)
VALUES ('EGP', 'USD', 0.02), ('USD', 'EGP', 50.0)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rates" ON exchange_rates FOR SELECT USING (true);
