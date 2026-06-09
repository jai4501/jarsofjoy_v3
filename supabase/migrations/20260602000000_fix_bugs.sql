-- =========================================================
-- FIX: Security, Missing Tables, and RLS Consistency
-- =========================================================

-- 1. Create product_categories table (referenced in Admin panel)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        UNIQUE NOT NULL,
  emoji       TEXT        DEFAULT '🧁',
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Define is_admin() function for secure RLS
-- Replace 'jarsofjoy.bakes@gmail.com' with the actual admin email if different
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'email' = 'jarsofjoy.bakes@gmail.com' OR
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reset and Re-apply RLS Policies for Security

-- PRODUCTS: Secure Admin access
DROP POLICY IF EXISTS "Allow admin all" ON public.products;
CREATE POLICY "Allow admin all" ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PRODUCT_CATEGORIES: Public read, Admin write
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read categories" ON public.product_categories;
CREATE POLICY "Allow public read categories" ON public.product_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin all categories" ON public.product_categories;
CREATE POLICY "Allow admin all categories" ON public.product_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ORDERS: Users view their own, Admin view all, Public create
DROP POLICY IF EXISTS "Allow public create orders" ON public.orders;
CREATE POLICY "Allow public create orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin can update orders" ON public.orders;
CREATE POLICY "Admin can update orders" ON public.orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Admin can delete orders" ON public.orders FOR DELETE
  USING (public.is_admin());

-- PAYMENTS: Users view/create their own, Admin view/verify all
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = payments.order_id 
      AND (orders.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Allow authenticated payment creation" ON public.payments;
CREATE POLICY "Allow authenticated payment creation" ON public.payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can update payments" ON public.payments;
CREATE POLICY "Admin can update payments" ON public.payments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SITE_CONTENT: Public read, Admin all
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read site_content" ON public.site_content;
CREATE POLICY "Allow public read site_content" ON public.site_content FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin all site_content" ON public.site_content;
CREATE POLICY "Allow admin all site_content" ON public.site_content FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Seed initial categories
INSERT INTO public.product_categories (name, emoji, sort_order) VALUES
  ('Jar Cakes', '🎂', 1),
  ('Brownies', '🍫', 2),
  ('Tea Cakes', '🫖', 3),
  ('Cookies', '🍪', 4),
  ('Specials', '✨', 5)
ON CONFLICT (name) DO NOTHING;
