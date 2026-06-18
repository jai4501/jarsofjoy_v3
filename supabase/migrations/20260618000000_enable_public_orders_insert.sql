-- Migration: Secure Serverless Client-Side Ordering Policies
-- Restores the correct RLS policies for client-side ordering as defined in the master schema,
-- dropping any broad public insert bypasses.

-- Drop any broad public bypass policies if they were created
DROP POLICY IF EXISTS "Allow public create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public create order_items" ON public.order_items;

-- 1. Orders table: Enable insert policy checking that the logged-in user's ID matches the order's user_id.
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. Order items table: Enable authenticated role access to order items.
DROP POLICY IF EXISTS "Allow authenticated access order_items" ON public.order_items;
CREATE POLICY "Allow authenticated access order_items"
  ON public.order_items FOR ALL
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');
