-- Add payment status tracking to settlements
-- Allows tracking pending vs completed payments for deep-link payment flows

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS initiated_at TIMESTAMPTZ;

-- Index for querying pending settlements by group
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(group_id, status)
  WHERE status = 'pending';
