import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Prompt } from "../schema/catalog";

export interface ArchivedPromptRecord {
  prompt: Prompt;
  archivedAt: string;
}

export interface LocalPromptMigration {
  localPrompt: Prompt;
  officialPromptId: string;
  officialTitle: string;
  migratedAt: string;
}

export interface LocalLifecycleSnapshot {
  schemaVersion: 1;
  archivedPrompts: ArchivedPromptRecord[];
  migrations: LocalPromptMigration[];
}

interface LocalLifecycleStore extends LocalLifecycleSnapshot {
  archivePrompt: (prompt: Prompt) => void;
  removeArchivedPrompt: (id: string) => void;
  recordMigration: (migration: LocalPromptMigration) => void;
  removeMigration: (localPromptId: string) => void;
  clearLifecycleData: () => void;
}

export const createDefaultLifecycleSnapshot = (): LocalLifecycleSnapshot => ({
  schemaVersion: 1,
  archivedPrompts: [],
  migrations: []
});

export function selectLifecycleSnapshot(state: LocalLifecycleStore): LocalLifecycleSnapshot {
  return {
    schemaVersion: 1,
    archivedPrompts: state.archivedPrompts,
    migrations: state.migrations
  };
}

export const useLocalLifecycleStore = create<LocalLifecycleStore>()(
  persist(
    (set) => ({
      ...createDefaultLifecycleSnapshot(),
      archivePrompt: (prompt) =>
        set((state) => ({
          archivedPrompts: [
            { prompt, archivedAt: new Date().toISOString() },
            ...state.archivedPrompts.filter((record) => record.prompt.id !== prompt.id)
          ]
        })),
      removeArchivedPrompt: (id) =>
        set((state) => ({
          archivedPrompts: state.archivedPrompts.filter((record) => record.prompt.id !== id)
        })),
      recordMigration: (migration) =>
        set((state) => ({
          migrations: [migration, ...state.migrations.filter((record) => record.localPrompt.id !== migration.localPrompt.id)]
        })),
      removeMigration: (localPromptId) =>
        set((state) => ({
          migrations: state.migrations.filter((record) => record.localPrompt.id !== localPromptId)
        })),
      clearLifecycleData: () => set(createDefaultLifecycleSnapshot())
    }),
    {
      name: "prompt-launcher-local-lifecycle",
      version: 1,
      partialize: selectLifecycleSnapshot
    }
  )
);
