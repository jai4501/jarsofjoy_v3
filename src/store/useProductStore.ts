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

export const useProductStore = create<ProductState>((set, get) => {
  const cached = getCachedCatalog();
  const hasCache = cached.products.length > 0 && cached.categories.length > 0;

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
      } catch (err) {
        console.error('Error fetching catalog:', err);
        set({ loading: false });
      }
    }
  };
});
