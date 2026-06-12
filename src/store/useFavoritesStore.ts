import { create } from 'zustand';

interface FavoritesState {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => {
  // Gracefully load initial favorites from localStorage
  let initialFavorites: string[] = [];
  try {
    const saved = localStorage.getItem('joj_favorites');
    if (saved) {
      initialFavorites = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse favorites from localStorage:', e);
  }

  return {
    favorites: initialFavorites,
    toggleFavorite: (id: string) => {
      const current = get().favorites;
      const updated = current.includes(id)
        ? current.filter(favId => favId !== id)
        : [...current, id];
      
      localStorage.setItem('joj_favorites', JSON.stringify(updated));
      set({ favorites: updated });
    },
    isFavorite: (id: string) => {
      return get().favorites.includes(id);
    }
  };
});
