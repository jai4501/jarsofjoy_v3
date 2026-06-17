import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { useCartStore } from './useCartStore';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => Promise<void>;
  setIsAdmin: (isAdmin: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  fetchProfile: (userId: string) => Promise<Profile | null | undefined>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  isAdmin: false,
  loading: false,
  isInitialized: false,
  setUser: async (user) => {
    console.log('setUser called with:', user?.email || 'null');
    const isAdminEmail = user?.email === 'jarsofjoy.bakes@gmail.com' || user?.email?.endsWith('@admin.com');
    set({ user, isAdmin: isAdminEmail, loading: !!user });
    
    if (user) {
      await get().fetchProfile(user.id);
      await useCartStore.getState().loadCart(user.id);
    } else {
      set({ profile: null, isAdmin: false, loading: false });
      useCartStore.setState({ items: [] });
      localStorage.removeItem('joj_cart');
    }
  },
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('API Error (Profile):', error.message);
      }

      if (!data && get().user) {
        const currentUser = get().user!;
        const rawMobile = currentUser.user_metadata?.mobile;
        const mobileVal = rawMobile && rawMobile.trim() !== '' ? rawMobile : null;
        const defaultProfile = {
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Sweet Customer',
          email: currentUser.email || '',
          mobile: mobileVal,
          role: 'customer',
          is_active: true
        };
        const { error: upsertError } = await (supabase.from('profiles') as any).upsert(defaultProfile);
        if (upsertError) {
          console.error('Error auto-creating profile:', upsertError.message);
        } else {
          set({ profile: defaultProfile as any, loading: false });
          return defaultProfile as any;
        }
      }

      const profileData = data || null;
      set({ profile: profileData, loading: false });
      
      // Save avatar image dynamically in user local storage cache
      const avatarUrl = (profileData as any)?.avatar_url;
      if (avatarUrl) {
        fetch(avatarUrl, { mode: 'cors' }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Network Error fetching profile:', err.message);
      set({ loading: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false });
    useCartStore.setState({ items: [] });
    localStorage.removeItem('joj_cart');
  },
}));
