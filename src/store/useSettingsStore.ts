import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface SiteSettings {
  [key: string]: string;
}

interface SettingsState {
  settings: SiteSettings;
  loading: boolean;
  isInitialized: boolean;
  fetchSettings: () => Promise<void>;
  getSetting: (key: string, fallback?: string) => string;
}

const getCachedSettings = (): SiteSettings => {
  try {
    const cached = localStorage.getItem('site_settings');
    return cached ? JSON.parse(cached) : {};
  } catch (e) {
    return {};
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const cached = getCachedSettings();
  const hasCache = Object.keys(cached).length > 0;

  return {
    settings: cached,
    loading: false,
    isInitialized: hasCache,
    fetchSettings: async () => {
      set({ loading: true });
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('key, value');
        
        if (error) throw error;

        const settingsMap = data.reduce((acc: any, curr: any) => {
          acc[curr.key] = curr.value;
          return acc;
        }, {});

        localStorage.setItem('site_settings', JSON.stringify(settingsMap));
        set({ settings: settingsMap, loading: false, isInitialized: true });
      } catch (err) {
        console.error('Error fetching settings:', err);
        set({ loading: false, isInitialized: true });
      }
    },
    getSetting: (key, fallback = '') => {
      return get().settings[key] || fallback;
    }
  };
});
