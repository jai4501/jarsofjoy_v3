-- =========================================================
-- ADVANCED ADDRESS SYSTEM: Multi-Address & Detailed Fields
-- =========================================================

-- 1. Create a table for multiple addresses per user
CREATE TABLE IF NOT EXISTS public.addresses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label        TEXT        DEFAULT 'Home', -- e.g., 'Home', 'Work'
  door_no      TEXT        NOT NULL,
  street       TEXT        NOT NULL,
  area         TEXT        NOT NULL,
  landmark     TEXT,
  pincode      TEXT        NOT NULL,
  district     TEXT,
  state        TEXT        DEFAULT 'Tamil Nadu',
  is_default   BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure only 5 addresses per user (Trigger)
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

-- 3. Handle is_default logic: only one default per user
CREATE OR REPLACE FUNCTION public.handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
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
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_default_address();

-- 4. Update orders to store detailed address snapshot
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS door_no TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS area TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- 5. Enable RLS for addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = profile_id OR public.is_admin())
  WITH CHECK (auth.uid() = profile_id OR public.is_admin());

-- 6. Add trigger for updated_at
DROP TRIGGER IF EXISTS addresses_updated_at ON public.addresses;
CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Indexing for performance
CREATE INDEX IF NOT EXISTS idx_addresses_profile_id ON public.addresses(profile_id);
CREATE INDEX IF NOT EXISTS idx_addresses_pincode ON public.addresses(pincode);
