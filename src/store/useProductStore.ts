import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type Product = Database['public']['Tables']['products']['Row'] & { variations?: { name: string; price: number }[] };
type Category = Database['public']['Tables']['product_categories']['Row'];

interface ProductState {
  products: Product[];
  categories: Category[];
  isLoaded: boolean;
  loading: boolean;
  fetchCatalog: (force?: boolean) => Promise<void>;
}

const getCachedCatalog = () => {
  try {
    const products = localStorage.getItem('site_products');
    const categories = localStorage.getItem('site_categories');
    return {
      products: products ? JSON.parse(products) : [],
      categories: categories ? JSON.parse(categories) : []
    };
  } catch (e) {
    return { products: [], categories: [] };
  }
};

import { useUserStore } from './useUserStore';

const preloadAllCatalogImages = (products: Product[], categories: Category[]) => {
  if (typeof window === 'undefined') return;
  const triggerPreload = () => {
    // 1. Preload all category images
    categories.forEach((cat) => {
      const url = (cat as any).image_url;
      if (url) {
        fetch(url, { mode: 'cors' }).catch(() => {});
      }
    });

    // 2. Preload all product images (all images in the array)
    products.forEach((p) => {
      if (p.images && p.images.length > 0) {
        p.images.forEach((url) => {
          if (url) {
            fetch(url, { mode: 'cors' }).catch(() => {});
          }
        });
      }
    });

    // 3. Preload business logo (from cached settings)
    try {
      const savedSettings = localStorage.getItem('site_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const businessLogo = settings['business_logo'];
        if (businessLogo) {
          fetch(businessLogo, { mode: 'cors' }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to parse settings for logo preloading:', e);
    }

    // 4. Preload user avatar if profile exists
    try {
      const profile = useUserStore.getState().profile;
      const avatarUrl = (profile as any)?.avatar_url;
      if (avatarUrl) {
        fetch(avatarUrl, { mode: 'cors' }).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to fetch profile avatar for preloading:', e);
    }

    // 5. Preload all static theme webp images to guarantee local storage / offline usage
    const staticThemeImages = [
      '/bakery_hero.webp',
      '/bakery_packaging.webp',
      '/business_logo_new.webp',
      '/category_brownie.webp',
      '/category_celebration_cake.webp',
      '/category_cookie.webp',
      '/category_swiss_roll.webp',
      '/category_tea_cake.webp',
      '/icon-192.webp',
      '/icon-512.webp'
    ];
    staticThemeImages.forEach((imgUrl) => {
      fetch(imgUrl, { mode: 'cors' }).catch(() => {});
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(triggerPreload);
  } else {
    setTimeout(triggerPreload, 1000);
  }
};

export const useProductStore = create<ProductState>((set, get) => {
  const cached = getCachedCatalog();
  const hasCache = cached.products.length > 0 && cached.categories.length > 0;

  if (hasCache) {
    preloadAllCatalogImages(cached.products, cached.categories);
  }

  return {
    products: cached.products,
    categories: cached.categories,
    isLoaded: hasCache,
    loading: false,
    fetchCatalog: async (force = false) => {
      const { isLoaded, loading } = get();

      // If already loading, do nothing to avoid duplicate concurrent fetches
      if (loading) return;

      // SWR Pattern: if already loaded and not forced, return immediately.
      // However, we can fetch silently in the background to update the cache.
      if (isLoaded && !force) {
        // Trigger background sync without setting loading to true
        (async () => {
          try {
            const [prodRes, catRes] = await Promise.all([
              supabase
                .from('products')
                .select('*')
                .eq('active', true)
                .order('name'),
              supabase
                .from('product_categories')
                .select('*')
                .order('sort_order', { ascending: true })
            ]);
            if (prodRes.data && catRes.data) {
              localStorage.setItem('site_products', JSON.stringify(prodRes.data));
              localStorage.setItem('site_categories', JSON.stringify(catRes.data));
              set({ 
                products: prodRes.data as Product[], 
                categories: catRes.data as Category[] 
              });
              preloadAllCatalogImages(prodRes.data as Product[], catRes.data as Category[]);
            }
          } catch (err) {
            console.error('Silent catalog background update failed:', err);
          }
        })();
        return;
      }

      set({ loading: true });
      try {
        const [prodRes, catRes] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .eq('active', true)
            .order('name'),
          supabase
            .from('product_categories')
            .select('*')
            .order('sort_order', { ascending: true })
        ]);

        if (prodRes.error) throw prodRes.error;
        if (catRes.error) throw catRes.error;

        localStorage.setItem('site_products', JSON.stringify(prodRes.data || []));
        localStorage.setItem('site_categories', JSON.stringify(catRes.data || []));

        set({
          products: (prodRes.data || []) as Product[],
          categories: (catRes.data || []) as Category[],
          isLoaded: true,
          loading: false
        });
        preloadAllCatalogImages((prodRes.data || []) as Product[], (catRes.data || []) as Category[]);
      } catch (err) {
        console.error('Error fetching catalog:', err);
        set({ loading: false });
      }
    }
  };
});
