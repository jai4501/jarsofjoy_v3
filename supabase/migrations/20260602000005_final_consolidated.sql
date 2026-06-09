-- ============================================================
-- CONSOLIDATED MIGRATION: PROFILES, ADDRESSES, SECURITY
-- ============================================================

-- 1. PROFILES: ADD ROLE COLUMN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'staff'));

-- 2. UTILITY: UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS public.addresses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label        TEXT        DEFAULT 'Home' CHECK (char_length(label) <= 50),
  door_no      TEXT        NOT NULL,
  street       TEXT        NOT NULL,
  area         TEXT        NOT NULL,
  landmark     TEXT,
  pincode      TEXT        NOT NULL CHECK (pincode ~ '^\d{6}$'),
  district     TEXT,
  state        TEXT        DEFAULT 'Tamil Nadu',
  is_default   BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for addresses.updated_at
DROP TRIGGER IF EXISTS set_addresses_updated_at ON public.addresses;
CREATE TRIGGER set_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ADDRESS LIMIT: MAX 5 PER USER
CREATE OR REPLACE FUNCTION public.check_address_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.addresses WHERE profile_id = NEW.profile_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 addresses allowed per user.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_address_limit ON public.addresses;
CREATE TRIGGER trigger_check_address_limit
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.check_address_limit();

-- 5. DEFAULT ADDRESS LOGIC (FIXED: NON-RECURSIVE)

-- Part A: BEFORE INSERT - Set first address as default
CREATE OR REPLACE FUNCTION public.handle_default_address_before()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.addresses WHERE profile_id = NEW.profile_id) = 0 THEN
    NEW.is_default := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_before ON public.addresses;
CREATE TRIGGER trigger_handle_default_before
  BEFORE INSERT ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_default_address_before();

-- Part B: AFTER INSERT/UPDATE - Clear other defaults
CREATE OR REPLACE FUNCTION public.handle_default_address_after()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.addresses
    SET is_default = FALSE
    WHERE profile_id = NEW.profile_id 
      AND id <> NEW.id 
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_after ON public.addresses;
CREATE TRIGGER trigger_handle_default_after
  AFTER INSERT OR UPDATE OF is_default ON public.addresses
  FOR EACH ROW 
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.handle_default_address_after();

-- 6. SECURITY: ADMIN CHECK FUNCTION
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR email = 'jarsofjoy.bakes@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS POLICIES
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

-- 8. SETUP: PROMOTE OWNER
UPDATE public.profiles SET role = 'admin' WHERE email = 'jarsofjoy.bakes@gmail.com';
