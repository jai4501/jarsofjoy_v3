-- Migration to add cart JSONB column to the profiles table
-- This allows persistent, server-side storage of items in the user's shopping cart.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cart JSONB DEFAULT '[]'::jsonb;
