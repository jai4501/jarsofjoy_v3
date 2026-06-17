-- Migration: Secure Backend Operations and Database Access
-- Enforces backend-only calculations, secures OTPs, and protects roles.

-- 1. Secure temp_otps: Enable RLS and define no public policies (restricting access to service_role)
ALTER TABLE public.temp_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin all temp_otps" ON public.temp_otps;
CREATE POLICY "Allow admin all temp_otps" 
  ON public.temp_otps FOR ALL 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- 2. Restrict orders: Remove direct public create policy to force orders through backend calculation
DROP POLICY IF EXISTS "Allow public create orders" ON public.orders;

-- 3. Restrict order_items: Remove broad authenticated access and secure with custom select/admin policies
DROP POLICY IF EXISTS "Allow authenticated access order_items" ON public.order_items;

CREATE POLICY "Users can view their own order_items" 
  ON public.order_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE public.orders.id = public.order_items.order_id
        AND (public.orders.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Admin can manage order_items" 
  ON public.order_items FOR ALL 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- 4. Protect Roles: Add trigger function to prevent non-admins from changing their profile roles
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being updated, verify if the updater is an admin or if it's a system update
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify profile roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
