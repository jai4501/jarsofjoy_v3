-- =========================================================
-- SCHEMA EVOLUTION: Profiles Address & Category Images
-- =========================================================

-- 1. Add address to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Enhance product_categories with images and hierarchy
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- 3. Update products to support sub-categories (optional but helpful for the request)
-- If we want to link products directly to the category table instead of just a string
-- For now, we'll keep the string 'category' for compatibility but the Admin can use the hierarchy.

-- 4. RLS update for new columns (usually automatic, but ensuring Admin can write)
-- The existing "Allow admin all categories" policy on product_categories will cover new columns.
