-- RPC function to ensure a user profile exists in public.users.
-- Runs as SECURITY DEFINER to bypass RLS, solving the timing issue
-- where auth.uid() may not yet be set after signUp (email confirmation pending).

CREATE OR REPLACE FUNCTION public.ensure_user_profile(
  user_id UUID,
  user_display_name TEXT,
  user_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, email)
  VALUES (user_id, user_display_name, user_email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), users.display_name),
    email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email);
END;
$$;
