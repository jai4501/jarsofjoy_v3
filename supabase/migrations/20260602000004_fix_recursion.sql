-- =========================================================
-- FIX: Infinite Recursion & Security refined
-- =========================================================

-- 1. Ensure role column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- 2. Drop existing triggers to start fresh
DROP TRIGGER IF EXISTS trigger_handle_default_address ON public.addresses;
DROP TRIGGER IF EXISTS trigger_check_address_limit ON public.addresses;

-- 3. Address Limit: Max 5 (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.check_address_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.addresses WHERE profile_id = NEW.profile_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 addresses allowed per user.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_address_limit
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.check_address_limit();

-- 4. Default Logic (BEFORE INSERT/UPDATE)
-- This version modifies the NEW row directly, avoiding recursive UPDATE statements.
CREATE OR REPLACE FUNCTION public.handle_default_address_before()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first address, it MUST be default
  IF (SELECT COUNT(*) FROM public.addresses WHERE profile_id = NEW.profile_id) = 0 THEN
    NEW.is_default := TRUE;
  END IF;

  -- If the new row is being set as default, we must unset other defaults.
  -- We do this in a separate step or AFTER trigger to avoid recursion on the same row.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_default_before
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_default_address_before();

-- 5. Clear other defaults (AFTER INSERT/UPDATE)
-- Only runs if the row was set to default, and unsets others.
CREATE OR REPLACE FUNCTION public.handle_default_address_after()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.addresses
    SET is_default = FALSE
    WHERE profile_id = NEW.profile_id 
      AND id <> NEW.id 
      AND is_default = TRUE; -- Only update rows that are currently default
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_default_after
  AFTER INSERT OR UPDATE OF is_default ON public.addresses
  FOR EACH ROW 
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.handle_default_address_after();

-- 6. Updated Admin Check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR email = 'jarsofjoy.bakes@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Ensure RLS is active
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

-- 8. Final Setup
UPDATE public.profiles SET role = 'admin' WHERE email = 'jarsofjoy.bakes@gmail.com';
