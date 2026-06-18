-- Migration: Add Admin Insert Policy on Orders Table
-- Allows authenticated administrators/staff to insert orders directly from the frontend (e.g., for Draft Orders in the Admin Chat Panel)

CREATE POLICY "Admin can insert orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (public.is_admin());
