-- Create user achievements table for gamification

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL CHECK (type IN (
              'first_expense',
              'debt_free',
              'speed_settler',
              'group_creator',
              'social_butterfly',
              'receipt_scanner')),
  earned_at TIMESTAMPTZ DEFAULT now(),
  metadata  JSONB DEFAULT '{}',
  UNIQUE(user_id, type)
);

-- Indexes
CREATE INDEX idx_achievements_user ON public.user_achievements(user_id, earned_at DESC);

-- Row Level Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);
