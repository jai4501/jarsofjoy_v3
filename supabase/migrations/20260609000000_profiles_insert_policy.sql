-- Migration to allow authenticated users to insert their own profile
-- This is necessary to support client-side fallback upserts when profiles are missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;
