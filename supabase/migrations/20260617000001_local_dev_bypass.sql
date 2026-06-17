-- Optional Migration: Local Development Bypass
-- Restore public insert policy on the orders table for testing when SUPABASE_SERVICE_ROLE_KEY is not configured on the backend.
-- WARNING: This bypasses backend validation/calculations for direct frontend insertions, so it should only be used for local development/testing.

-- To enable the local development bypass:
-- CREATE POLICY "Allow public create orders" ON public.orders FOR INSERT WITH CHECK (true);

-- To disable the local development bypass and restore backend-only security:
-- DROP POLICY IF EXISTS "Allow public create orders" ON public.orders;
