-- Fix infinite recursion in group_members RLS policy
-- The original policy on group_members queries group_members itself, causing recursion.
-- Solution: a SECURITY DEFINER function that bypasses RLS for membership checks.

CREATE OR REPLACE FUNCTION public.get_user_group_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM group_members WHERE user_id = uid;
$$;

-- Drop all policies that reference group_members via subquery
DROP POLICY IF EXISTS "Members can read group members" ON group_members;
DROP POLICY IF EXISTS "Group members can read groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update" ON groups;
DROP POLICY IF EXISTS "Group members can read expenses" ON expenses;
DROP POLICY IF EXISTS "Group members can create expenses" ON expenses;
DROP POLICY IF EXISTS "Members can read splits" ON expense_splits;
DROP POLICY IF EXISTS "Members can create splits" ON expense_splits;
DROP POLICY IF EXISTS "Members can read items" ON expense_items;
DROP POLICY IF EXISTS "Members can create items" ON expense_items;
DROP POLICY IF EXISTS "Members can read assignments" ON item_assignments;
DROP POLICY IF EXISTS "Members can create assignments" ON item_assignments;
DROP POLICY IF EXISTS "Members can read settlements" ON settlements;
DROP POLICY IF EXISTS "Members can create settlements" ON settlements;

-- Recreate all policies using the SECURITY DEFINER function

-- group_members: no longer self-referential
CREATE POLICY "Members can read group members" ON group_members FOR SELECT
  USING (group_id IN (SELECT public.get_user_group_ids(auth.uid())));

-- groups (also allow creator to read their own group before they're added as member)
CREATE POLICY "Group members can read groups" ON groups FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.get_user_group_ids(auth.uid()))
  );

CREATE POLICY "Group admins can update" ON groups FOR UPDATE
  USING (id IN (
    SELECT group_id FROM group_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- expenses
CREATE POLICY "Group members can read expenses" ON expenses FOR SELECT
  USING (group_id IN (SELECT public.get_user_group_ids(auth.uid())));

CREATE POLICY "Group members can create expenses" ON expenses FOR INSERT
  WITH CHECK (group_id IN (SELECT public.get_user_group_ids(auth.uid())));

-- expense_splits
CREATE POLICY "Members can read splits" ON expense_splits FOR SELECT
  USING (expense_id IN (
    SELECT id FROM expenses
    WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
  ));

CREATE POLICY "Members can create splits" ON expense_splits FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT id FROM expenses
    WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
  ));

-- expense_items
CREATE POLICY "Members can read items" ON expense_items FOR SELECT
  USING (expense_id IN (
    SELECT id FROM expenses
    WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
  ));

CREATE POLICY "Members can create items" ON expense_items FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT id FROM expenses
    WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
  ));

-- item_assignments
CREATE POLICY "Members can read assignments" ON item_assignments FOR SELECT
  USING (item_id IN (
    SELECT id FROM expense_items
    WHERE expense_id IN (
      SELECT id FROM expenses
      WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
    )
  ));

CREATE POLICY "Members can create assignments" ON item_assignments FOR INSERT
  WITH CHECK (item_id IN (
    SELECT id FROM expense_items
    WHERE expense_id IN (
      SELECT id FROM expenses
      WHERE group_id IN (SELECT public.get_user_group_ids(auth.uid()))
    )
  ));

-- settlements
CREATE POLICY "Members can read settlements" ON settlements FOR SELECT
  USING (group_id IN (SELECT public.get_user_group_ids(auth.uid())));

CREATE POLICY "Members can create settlements" ON settlements FOR INSERT
  WITH CHECK (group_id IN (SELECT public.get_user_group_ids(auth.uid())));
