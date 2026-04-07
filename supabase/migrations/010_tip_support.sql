-- Add tip support to shared_bills and expenses
ALTER TABLE shared_bills ADD COLUMN tip DECIMAL(12,2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN tip_amount DECIMAL(12,2) DEFAULT 0;

-- Replace finalize_shared_bill to include tip in distribution
CREATE OR REPLACE FUNCTION public.finalize_shared_bill(p_bill_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_total := v_subtotal + v_bill.tax + v_bill.service_charge + COALESCE(v_bill.tip, 0);

  -- Create expense
  INSERT INTO expenses (group_id, paid_by, description, total_amount, currency, split_type, ai_parsed, created_by, category, is_deleted, tip_amount)
  VALUES (v_bill.group_id, v_bill.paid_by, COALESCE(v_bill.merchant_name, 'Shared Bill'), v_total, v_bill.currency, 'by_item', true, v_bill.created_by, 'Food & Dining', false, COALESCE(v_bill.tip, 0))
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

  -- Distribute tax + service charge + tip proportionally and create expense_splits
  FOR v_user_id, v_user_amount IN SELECT key, value::decimal FROM jsonb_each_text(v_splits) LOOP
    DECLARE
      v_extras DECIMAL(12,2);
    BEGIN
      v_extras := CASE WHEN v_subtotal > 0 THEN ROUND((v_bill.tax + v_bill.service_charge + COALESCE(v_bill.tip, 0)) * (v_user_amount / v_subtotal), 2) ELSE 0 END;
      INSERT INTO expense_splits (expense_id, user_id, amount, is_settled)
      VALUES (v_expense_id, v_user_id::uuid, v_user_amount + v_extras, false);
    END;
  END LOOP;

  -- Finalize the bill
  UPDATE shared_bills SET status = 'finalized', finalized_at = now(), expense_id = v_expense_id, updated_at = now() WHERE id = p_bill_id;

  RETURN v_expense_id;
END;
$$;
