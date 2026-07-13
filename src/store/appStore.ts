import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Prompt } from "../schema/catalog";

export type ThemeMode = "auto" | "light" | "dark";
export type AiTarget = "chatgpt" | "claude";

export interface PromptSettings {
  modifiers: string[];
  optionalValues: Record<string, string>;
}

export interface UsageEntry extends PromptSettings {
  promptId: string;
  copiedAt: string;
}

export interface PersonalSnapshot {
  schemaVersion: 1;
  usage: Record<string, { copyCount: number; lastCopiedAt: string }>;
  favorites: string[];
  history: UsageEntry[];
  lastSettings: Record<string, PromptSettings>;
  recentQueries: string[];
  localPrompts: Prompt[];
  prefs: {
    theme: ThemeMode;
    lastAi: AiTarget;
  };
}

interface AppStore extends PersonalSnapshot {
  toggleFavorite: (id: string) => void;
  recordCopy: (promptId: string, settings: PromptSettings) => void;
  saveSettings: (promptId: string, settings: PromptSettings) => void;
  addRecentQuery: (query: string) => void;
  upsertLocalPrompt: (prompt: Prompt) => void;
  deleteLocalPrompt: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setLastAi: (target: AiTarget) => void;
  replacePersonalData: (snapshot: PersonalSnapshot) => void;
  clearPersonalData: () => void;
}

export const createDefaultSnapshot = (): PersonalSnapshot => ({
  schemaVersion: 1,
  usage: {},
  favorites: [],
  history: [],
  lastSettings: {},
  recentQueries: [],
  localPrompts: [],
  prefs: { theme: "auto", lastAi: "chatgpt" }
});

export function selectPersonalSnapshot(state: AppStore): PersonalSnapshot {
  return {
    schemaVersion: 1,
    usage: state.usage,
    favorites: state.favorites,
    history: state.history,
    lastSettings: state.lastSettings,
    recentQueries: state.recentQueries,
    localPrompts: state.localPrompts,
    prefs: state.prefs
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...createDefaultSnapshot(),
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favoriteId) => favoriteId !== id)
            : [id, ...state.favorites]
        })),
      recordCopy: (promptId, settings) => {
        const copiedAt = new Date().toISOString();
        set((state) => ({
          usage: {
            ...state.usage,
            [promptId]: {
              copyCount: (state.usage[promptId]?.copyCount ?? 0) + 1,
              lastCopiedAt: copiedAt
            }
          },
          history: [
            { promptId, copiedAt, ...settings },
            ...state.history
          ].slice(0, 50),
          lastSettings: { ...state.lastSettings, [promptId]: settings }
        }));
      },
      saveSettings: (promptId, settings) =>
        set((state) => ({
          lastSettings: { ...state.lastSettings, [promptId]: settings }
        })),
      addRecentQuery: (query) => {
        const normalized = query.trim();
        if (!normalized) return;
        set((state) => ({
          recentQueries: [
            normalized,
            ...state.recentQueries.filter((item) => item !== normalized)
          ].slice(0, 8)
        }));
      },
      upsertLocalPrompt: (prompt) =>
        set((state) => ({
          localPrompts: [prompt, ...state.localPrompts.filter((item) => item.id !== prompt.id)]
        })),
      deleteLocalPrompt: (id) =>
        set((state) => ({
          localPrompts: state.localPrompts.filter((prompt) => prompt.id !== id),
          favorites: state.favorites.filter((promptId) => promptId !== id),
          history: state.history.filter((entry) => entry.promptId !== id),
          lastSettings: Object.fromEntries(Object.entries(state.lastSettings).filter(([promptId]) => promptId !== id)),
          usage: Object.fromEntries(Object.entries(state.usage).filter(([promptId]) => promptId !== id))
        })),
      setTheme: (theme) => set((state) => ({ prefs: { ...state.prefs, theme } })),
      setLastAi: (lastAi) => set((state) => ({ prefs: { ...state.prefs, lastAi } })),
      replacePersonalData: (snapshot) => set(snapshot),
      clearPersonalData: () => set(createDefaultSnapshot())
    }),
    {
      name: "prompt-launcher-personal",
      version: 1,
      partialize: selectPersonalSnapshot
    }
  )
);
