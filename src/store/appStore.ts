import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Prompt } from "../schema/catalog";
import { useLocalLifecycleStore } from "./localLifecycleStore";

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

export interface UsageStats {
  copyCount: number;
  lastCopiedAt: string;
}

export interface PersonalSnapshot {
  schemaVersion: 1;
  usage: Record<string, UsageStats>;
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
  moveLocalPrompt: (id: string, direction: -1 | 1) => void;
  setLocalPromptOrder: (ids: string[]) => void;
  removeLocalPrompt: (id: string) => void;
  restoreLocalPrompt: (prompt: Prompt) => void;
  transferLocalPromptToOfficial: (localId: string, officialId: string) => void;
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

function latestTimestamp(left?: string, right?: string): string {
  return [left, right].filter((value): value is string => Boolean(value)).sort().at(-1) ?? new Date().toISOString();
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
        set((state) => {
          const existingIndex = state.localPrompts.findIndex((item) => item.id === prompt.id);
          if (existingIndex < 0) return { localPrompts: [prompt, ...state.localPrompts] };
          const localPrompts = [...state.localPrompts];
          localPrompts[existingIndex] = prompt;
          return { localPrompts };
        }),
      moveLocalPrompt: (id, direction) =>
        set((state) => {
          const from = state.localPrompts.findIndex((prompt) => prompt.id === id);
          const to = from + direction;
          if (from < 0 || to < 0 || to >= state.localPrompts.length) return {};
          const localPrompts = [...state.localPrompts];
          [localPrompts[from], localPrompts[to]] = [localPrompts[to], localPrompts[from]];
          return { localPrompts };
        }),
      setLocalPromptOrder: (ids) =>
        set((state) => {
          const byId = new Map(state.localPrompts.map((prompt) => [prompt.id, prompt]));
          const ordered = ids.flatMap((id) => {
            const prompt = byId.get(id);
            if (!prompt) return [];
            byId.delete(id);
            return [prompt];
          });
          return { localPrompts: [...ordered, ...byId.values()] };
        }),
      removeLocalPrompt: (id) =>
        set((state) => ({
          localPrompts: state.localPrompts.filter((prompt) => prompt.id !== id)
        })),
      restoreLocalPrompt: (prompt) =>
        set((state) => ({
          localPrompts: [prompt, ...state.localPrompts.filter((item) => item.id !== prompt.id)]
        })),
      transferLocalPromptToOfficial: (localId, officialId) =>
        set((state) => {
          if (localId === officialId) {
            return { localPrompts: state.localPrompts.filter((prompt) => prompt.id !== localId) };
          }

          const localUsage = state.usage[localId];
          const officialUsage = state.usage[officialId];
          const usage = { ...state.usage };
          delete usage[localId];
          if (localUsage || officialUsage) {
            usage[officialId] = {
              copyCount: (localUsage?.copyCount ?? 0) + (officialUsage?.copyCount ?? 0),
              lastCopiedAt: latestTimestamp(localUsage?.lastCopiedAt, officialUsage?.lastCopiedAt)
            };
          }

          const lastSettings = { ...state.lastSettings };
          const localSettings = lastSettings[localId];
          delete lastSettings[localId];
          if (localSettings && !lastSettings[officialId]) lastSettings[officialId] = localSettings;

          return {
            localPrompts: state.localPrompts.filter((prompt) => prompt.id !== localId),
            favorites: [...new Set(state.favorites.map((id) => id === localId ? officialId : id))],
            history: state.history.map((entry) => entry.promptId === localId ? { ...entry, promptId: officialId } : entry),
            lastSettings,
            usage
          };
        }),
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
      clearPersonalData: () => {
        set(createDefaultSnapshot());
        useLocalLifecycleStore.getState().clearLifecycleData();
      }
    }),
    {
      name: "prompt-launcher-personal",
      version: 1,
      partialize: selectPersonalSnapshot
    }
  )
);
