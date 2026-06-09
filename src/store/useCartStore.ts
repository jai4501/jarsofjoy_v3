import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
}

interface CartState {
  items: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  addItem: (product: any) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  loadCart: (userId: string) => Promise<void>;
  total: number;
}

const getInitialItems = (): CartItem[] => {
  try {
    const saved = localStorage.getItem('joj_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const syncCartWithDB = async (items: CartItem[]) => {
  localStorage.setItem('joj_cart', JSON.stringify(items));
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      // Gracefully attempt to sync. If cart column doesn't exist yet, it won't crash the UI.
      await (supabase.from('profiles') as any)
        .update({ cart: items })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Failed to sync cart with DB:', err);
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  items: getInitialItems(),
  isCartOpen: false,
  setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),
  addItem: (product) => {
    const currentItems = get().items;
    const existingItem = currentItems.find((item) => item.id === product.id);
    let newItems: CartItem[] = [];

    if (existingItem) {
      newItems = currentItems.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newItems = [...currentItems, { ...product, quantity: 1 }];
    }
    set({ items: newItems });
    syncCartWithDB(newItems);
  },
  removeItem: (id) => {
    const newItems = get().items.filter((item) => item.id !== id);
    set({ items: newItems });
    syncCartWithDB(newItems);
  },
  updateQuantity: (id, quantity) => {
    const newItems = get().items.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
    );
    set({ items: newItems });
    syncCartWithDB(newItems);
  },
  clearCart: () => {
    set({ items: [] });
    syncCartWithDB([]);
  },
  loadCart: async (userId) => {
    try {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('cart')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        const dbCart = ((data as any).cart || []) as CartItem[];
        const localCart = getInitialItems();
        
        // Merge local guest items with DB items
        const mergedCart = [...dbCart];
        localCart.forEach((localItem) => {
          const existing = mergedCart.find((item) => item.id === localItem.id);
          if (existing) {
            existing.quantity = Math.max(existing.quantity, localItem.quantity);
          } else {
            mergedCart.push(localItem);
          }
        });
        
        set({ items: mergedCart });
        localStorage.setItem('joj_cart', JSON.stringify(mergedCart));
        
        // Sync merged cart back to DB
        await (supabase.from('profiles') as any)
          .update({ cart: mergedCart })
          .eq('id', userId);
      }
    } catch (err) {
      console.error('Failed to load cart from DB:', err);
    }
  },
  get total() {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
