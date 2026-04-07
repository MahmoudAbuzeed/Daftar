-- Add quick splits feature for daily expense tracking
CREATE TABLE quick_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE quick_split_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_split_id UUID NOT NULL REFERENCES quick_splits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone VARCHAR(20),
  amount DECIMAL(12, 2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_quick_splits_user_id ON quick_splits(user_id);
CREATE INDEX idx_quick_splits_created_at ON quick_splits(created_at DESC);
CREATE INDEX idx_quick_split_participants_quick_split_id ON quick_split_participants(quick_split_id);

-- Enable RLS
ALTER TABLE quick_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_split_participants ENABLE ROW LEVEL SECURITY;

-- Quick split RLS policies
-- Users can only see their own quick splits
CREATE POLICY quick_splits_select ON quick_splits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own quick splits
CREATE POLICY quick_splits_insert ON quick_splits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own quick splits
CREATE POLICY quick_splits_update ON quick_splits
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own quick splits
CREATE POLICY quick_splits_delete ON quick_splits
  FOR DELETE USING (auth.uid() = user_id);

-- Quick split participants RLS policies
-- Participants can be viewed by the split owner
CREATE POLICY quick_split_participants_select ON quick_split_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quick_splits qs
      WHERE qs.id = quick_split_id AND qs.user_id = auth.uid()
    )
  );

-- Participants can be inserted by the split owner
CREATE POLICY quick_split_participants_insert ON quick_split_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quick_splits qs
      WHERE qs.id = quick_split_id AND qs.user_id = auth.uid()
    )
  );

-- Participants can be updated by the split owner
CREATE POLICY quick_split_participants_update ON quick_split_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quick_splits qs
      WHERE qs.id = quick_split_id AND qs.user_id = auth.uid()
    )
  );

-- Participants can be deleted by the split owner
CREATE POLICY quick_split_participants_delete ON quick_split_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quick_splits qs
      WHERE qs.id = quick_split_id AND qs.user_id = auth.uid()
    )
  );
