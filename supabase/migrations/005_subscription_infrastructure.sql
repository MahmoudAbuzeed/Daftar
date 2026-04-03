-- Daftar Pro: Subscription & Usage Tracking Infrastructure

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly')),
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  store_transaction_id TEXT,
  store_product_id TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Usage tracking for metered features
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN (
    'receipt_scan', 'group_create', 'whatsapp_reminder', 'data_export'
  )),
  period_start DATE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature, period_start)
);

-- Add is_pro flag to users for fast reads
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(expires_at) WHERE is_active = true;
CREATE INDEX idx_usage_tracking_lookup ON usage_tracking(user_id, feature, period_start);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own usage"
  ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage"
  ON usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage"
  ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

-- Atomic usage increment function
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', now())::date;
  v_count INTEGER;
BEGIN
  INSERT INTO usage_tracking (user_id, feature, period_start, usage_count)
  VALUES (p_user_id, p_feature, v_period_start, 1)
  ON CONFLICT (user_id, feature, period_start)
  DO UPDATE SET usage_count = usage_tracking.usage_count + 1, updated_at = now()
  RETURNING usage_count INTO v_count;
  RETURN v_count;
END;
$$;

-- Get current month usage
CREATE OR REPLACE FUNCTION public.get_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT usage_count FROM usage_tracking
     WHERE user_id = p_user_id
       AND feature = p_feature
       AND period_start = date_trunc('month', now())::date),
    0
  );
$$;
