-- Migration: Checkout & Delivery System
-- Adds support for tracking, delivery partners, and smart fee logic

-- 1. Update Products to support long-distance delivery flag
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS can_deliver_far BOOLEAN DEFAULT TRUE;

-- 2. Update Orders to support tracking and delivery metadata
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_partner     TEXT CHECK (delivery_partner IN ('Delhivery', 'Rapido', 'Self')),
ADD COLUMN IF NOT EXISTS tracking_id          TEXT, -- AWB or Link
ADD COLUMN IF NOT EXISTS weight_grams         NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_weekend_order     BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_late_night        BOOLEAN DEFAULT FALSE;

-- 3. Seed initial WhatsApp config if missing (Already largely handled by seed, but ensuring keys exist)
INSERT INTO public.site_content (key, value, category) VALUES
  ('delhivery_api_link',  'https://www.delhivery.com/track/package/', 'delivery'),
  ('rapido_tracking_base', '',                                       'delivery')
ON CONFLICT (key) DO NOTHING;
