import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Preferences {
  theme: "auto" | "light" | "dark";
}

interface AppState {
  schemaVersion: 1;
  favorites: string[];
  recentQueries: string[];
  prefs: Preferences;
  toggleFavorite: (id: string) => void;
  setTheme: (theme: Preferences["theme"]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      schemaVersion: 1,
      favorites: [],
      recentQueries: [],
      prefs: { theme: "auto" },
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favoriteId) => favoriteId !== id)
            : [...state.favorites, id]
        })),
      setTheme: (theme) => set((state) => ({ prefs: { ...state.prefs, theme } }))
    }),
    {
      name: "prompt-launcher-v1",
      version: 1,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        favorites: state.favorites,
        recentQueries: state.recentQueries,
        prefs: state.prefs
      })
    }
  )
);
