-- Collaborative Bill Assignment: Shared Bills

CREATE TABLE IF NOT EXISTS shared_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  paid_by UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'finalized', 'cancelled')),
  receipt_image TEXT,
  tax DECIMAL(12,2) DEFAULT 0,
  service_charge DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EGP' CHECK (currency IN ('EGP', 'USD')),
  merchant_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id)
);

CREATE TABLE IF NOT EXISTS shared_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES shared_bills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shared_bill_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES shared_bill_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Indexes
CREATE INDEX idx_shared_bills_group ON shared_bills(group_id, status, created_at DESC);
CREATE INDEX idx_shared_bill_items_bill ON shared_bill_items(bill_id, sort_order);
CREATE INDEX idx_shared_bill_claims_item ON shared_bill_claims(item_id);
CREATE INDEX idx_shared_bill_claims_user ON shared_bill_claims(user_id);

-- RLS
ALTER TABLE shared_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_bill_claims ENABLE ROW LEVEL SECURITY;

-- Shared bills: group members can read, creator can write
CREATE POLICY "Group members can read shared bills" ON shared_bills FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Group members can create shared bills" ON shared_bills FOR INSERT
  WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "Creator can update shared bills" ON shared_bills FOR UPDATE
  USING (created_by = auth.uid());

-- Items: group members can read, creator can write
CREATE POLICY "Group members can read bill items" ON shared_bill_items FOR SELECT
  USING (bill_id IN (SELECT id FROM shared_bills WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())));
CREATE POLICY "Creator can insert bill items" ON shared_bill_items FOR INSERT
  WITH CHECK (bill_id IN (SELECT id FROM shared_bills WHERE created_by = auth.uid()));
CREATE POLICY "Creator can update bill items" ON shared_bill_items FOR UPDATE
  USING (bill_id IN (SELECT id FROM shared_bills WHERE created_by = auth.uid()));

-- Claims: group members can read/write their own claims
CREATE POLICY "Group members can read claims" ON shared_bill_claims FOR SELECT
  USING (item_id IN (SELECT id FROM shared_bill_items WHERE bill_id IN (SELECT id FROM shared_bills WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()))));
CREATE POLICY "Users can claim items" ON shared_bill_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unclaim items" ON shared_bill_claims FOR DELETE
  USING (auth.uid() = user_id);

-- Finalize shared bill: atomic transaction
CREATE OR REPLACE FUNCTION public.finalize_shared_bill(p_bill_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill shared_bills%ROWTYPE;
  v_expense_id UUID;
  v_subtotal DECIMAL(12,2);
  v_total DECIMAL(12,2);
  v_item RECORD;
  v_db_item_id UUID;
  v_claim RECORD;
  v_claim_count INTEGER;
  v_splits JSONB := '{}';
  v_user_id TEXT;
  v_user_amount DECIMAL;
BEGIN
  -- Lock and validate
  SELECT * INTO v_bill FROM shared_bills WHERE id = p_bill_id FOR UPDATE;
  IF v_bill IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_bill.status != 'pending' THEN RAISE EXCEPTION 'Bill already finalized'; END IF;

  -- Calculate subtotal
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal FROM shared_bill_items WHERE bill_id = p_bill_id;
  v_total := v_subtotal + v_bill.tax + v_bill.service_charge;

  -- Create expense
  INSERT INTO expenses (group_id, paid_by, description, total_amount, currency, split_type, ai_parsed, created_by, category, is_deleted)
  VALUES (v_bill.group_id, v_bill.paid_by, COALESCE(v_bill.merchant_name, 'Shared Bill'), v_total, v_bill.currency, 'by_item', true, v_bill.created_by, 'Food & Dining', false)
  RETURNING id INTO v_expense_id;

  -- Create expense items + assignments from claims
  FOR v_item IN SELECT * FROM shared_bill_items WHERE bill_id = p_bill_id ORDER BY sort_order LOOP
    INSERT INTO expense_items (expense_id, name, quantity, unit_price, total_price, sort_order)
    VALUES (v_expense_id, v_item.name, v_item.quantity, v_item.unit_price, v_item.total_price, v_item.sort_order)
    RETURNING id INTO v_db_item_id;

    SELECT COUNT(*) INTO v_claim_count FROM shared_bill_claims WHERE item_id = v_item.id;
    IF v_claim_count = 0 THEN v_claim_count := 1; END IF;

    FOR v_claim IN SELECT * FROM shared_bill_claims WHERE item_id = v_item.id LOOP
      INSERT INTO item_assignments (item_id, user_id, share_amount)
      VALUES (v_db_item_id, v_claim.user_id, ROUND(v_item.total_price / v_claim_count, 2));

      -- Accumulate per-user totals
      v_splits := jsonb_set(
        v_splits,
        ARRAY[v_claim.user_id::text],
        to_jsonb(COALESCE((v_splits->>v_claim.user_id::text)::decimal, 0) + ROUND(v_item.total_price / v_claim_count, 2))
      );
    END LOOP;
  END LOOP;

  -- Distribute tax + service charge proportionally and create expense_splits
  FOR v_user_id, v_user_amount IN SELECT key, value::decimal FROM jsonb_each_text(v_splits) LOOP
    DECLARE
      v_extras DECIMAL(12,2);
    BEGIN
      v_extras := CASE WHEN v_subtotal > 0 THEN ROUND((v_bill.tax + v_bill.service_charge) * (v_user_amount / v_subtotal), 2) ELSE 0 END;
      INSERT INTO expense_splits (expense_id, user_id, amount, is_settled)
      VALUES (v_expense_id, v_user_id::uuid, v_user_amount + v_extras, false);
    END;
  END LOOP;

  -- Finalize the bill
  UPDATE shared_bills SET status = 'finalized', finalized_at = now(), expense_id = v_expense_id, updated_at = now() WHERE id = p_bill_id;

  RETURN v_expense_id;
END;
$$;

-- Enable realtime for claims table
ALTER PUBLICATION supabase_realtime ADD TABLE shared_bill_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_bills;
