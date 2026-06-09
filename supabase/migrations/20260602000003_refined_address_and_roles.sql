-- =========================================================
-- REFINED SCHEMA: Roles, Address Constraints, and Logic
-- =========================================================

-- 1. Add role to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- 2. Refined Addresses Table with constraints
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

-- 3. Utility Updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_addresses_updated_at ON public.addresses;
CREATE TRIGGER set_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Address Limit: Max 5
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

-- 5. Refined Default Address Logic
-- Auto-sets is_default=TRUE if this is the user's first address
CREATE OR REPLACE FUNCTION public.handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-promote to default if this is the user's first address
  IF NOT NEW.is_default THEN
    IF (SELECT COUNT(*) FROM public.addresses WHERE profile_id = NEW.profile_id) = 1 THEN
      UPDATE public.addresses SET is_default = TRUE WHERE id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;
  
  -- If marked as default, unset all other defaults for this user
  IF NEW.is_default THEN
    UPDATE public.addresses
    SET is_default = FALSE
    WHERE profile_id = NEW.profile_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_default_address ON public.addresses;
CREATE TRIGGER trigger_handle_default_address
  AFTER INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_default_address();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_addresses_profile_id ON public.addresses(profile_id);
CREATE INDEX IF NOT EXISTS idx_addresses_pincode ON public.addresses(pincode);

-- 7. Secure Admin Check using role column
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Promote the main email to admin for setup
UPDATE public.profiles SET role = 'admin' WHERE email = 'jarsofjoy.bakes@gmail.com';
