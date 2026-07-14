import { useEffect, useMemo, useState } from "react";
import type { Catalog, Prompt } from "../schema/catalog";
import { catalogSchema } from "../schema/catalog";
import { scorePrompt } from "../search/core";
import { comparePrompts } from "../local/duplicates";
import { useAppStore } from "../store/appStore";
import {
  selectLifecycleSnapshot,
  useLocalLifecycleStore,
  type ArchivedPromptRecord,
  type LocalPromptMigration
} from "../store/localLifecycleStore";

interface LocalPromptLifecycleManagerProps {
  onClose: () => void;
}

type Section = "active" | "archived" | "migrated";
type SortMode = "usage" | "title" | "updated";

interface CatalogState {
  catalog: Catalog | null;
  error: string | null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LocalPromptLifecycleManager({ onClose }: LocalPromptLifecycleManagerProps) {
  const [{ catalog, error }, setCatalogState] = useState<CatalogState>({ catalog: null, error: null });
  const [section, setSection] = useState<Section>("active");
  const [message, setMessage] = useState("");
  const [migrationSource, setMigrationSource] = useState<Prompt | null>(null);
  const [migrationQuery, setMigrationQuery] = useState("");

  const localPrompts = useAppStore((state) => state.localPrompts);
  const usage = useAppStore((state) => state.usage);
  const moveLocalPrompt = useAppStore((state) => state.moveLocalPrompt);
  const setLocalPromptOrder = useAppStore((state) => state.setLocalPromptOrder);
  const removeLocalPrompt = useAppStore((state) => state.removeLocalPrompt);
  const restoreLocalPrompt = useAppStore((state) => state.restoreLocalPrompt);
  const transferLocalPromptToOfficial = useAppStore((state) => state.transferLocalPromptToOfficial);
  const deleteLocalPrompt = useAppStore((state) => state.deleteLocalPrompt);

  const archivedPrompts = useLocalLifecycleStore((state) => state.archivedPrompts);
  const migrations = useLocalLifecycleStore((state) => state.migrations);
  const archivePrompt = useLocalLifecycleStore((state) => state.archivePrompt);
  const removeArchivedPrompt = useLocalLifecycleStore((state) => state.removeArchivedPrompt);
  const recordMigration = useLocalLifecycleStore((state) => state.recordMigration);
  const removeMigration = useLocalLifecycleStore((state) => state.removeMigration);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}catalog.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`catalog.json: HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => setCatalogState({ catalog: catalogSchema.parse(payload), error: null }))
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setCatalogState({ catalog: null, error: loadError instanceof Error ? loadError.message : String(loadError) });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const migrationCandidates = useMemo(() => {
    if (!migrationSource || !catalog) return [];
    const normalizedQuery = migrationQuery.trim();
    return catalog.prompts
      .map((prompt) => {
        const similarity = comparePrompts(migrationSource, prompt, catalog.dictionaries.synonyms);
        const search = normalizedQuery
          ? scorePrompt(normalizedQuery, prompt, catalog.dictionaries.synonyms)
          : 0;
        const exactId = prompt.id === migrationSource.id;
        const score = exactId ? 2 : similarity.score * 0.75 + search * 0.25;
        return { prompt, score, reasons: exactId ? ["IDが一致"] : similarity.reasons };
      })
      .filter((candidate) => normalizedQuery ? candidate.score > 0.02 : candidate.score >= 0.12)
      .sort((left, right) => right.score - left.score || right.prompt.mobilePriority - left.prompt.mobilePriority)
      .slice(0, 8);
  }, [catalog, migrationQuery, migrationSource]);

  function flash(text: string) {
    setMessage(text);
  }

  function applySort(mode: SortMode) {
    const index = new Map(localPrompts.map((prompt, position) => [prompt.id, position]));
    const ordered = [...localPrompts].sort((left, right) => {
      if (mode === "usage") {
        return (usage[right.id]?.copyCount ?? 0) - (usage[left.id]?.copyCount ?? 0)
          || (index.get(left.id) ?? 0) - (index.get(right.id) ?? 0);
      }
      if (mode === "title") return left.title.localeCompare(right.title, "ja");
      return right.updatedAt.localeCompare(left.updatedAt)
        || (index.get(left.id) ?? 0) - (index.get(right.id) ?? 0);
    });
    setLocalPromptOrder(ordered.map((prompt) => prompt.id));
    flash(mode === "usage" ? "よく使う順に並べました" : mode === "title" ? "名前順に並べました" : "更新日順に並べました");
  }

  function handleArchive(prompt: Prompt) {
    archivePrompt(prompt);
    removeLocalPrompt(prompt.id);
    flash("アーカイブしました");
  }

  function handleRestore(record: ArchivedPromptRecord) {
    restoreLocalPrompt(record.prompt);
    removeArchivedPrompt(record.prompt.id);
    setSection("active");
    flash("利用中へ戻しました");
  }

  function handleDeleteArchived(record: ArchivedPromptRecord) {
    if (!window.confirm(`「${record.prompt.title}」を完全に削除しますか？`)) return;
    removeArchivedPrompt(record.prompt.id);
    deleteLocalPrompt(record.prompt.id);
    flash("完全に削除しました");
  }

  function beginMigration(prompt: Prompt) {
    setMigrationSource(prompt);
    setMigrationQuery("");
  }

  function completeMigration(officialPrompt: Prompt) {
    if (!migrationSource) return;
    const migration: LocalPromptMigration = {
      localPrompt: migrationSource,
      officialPromptId: officialPrompt.id,
      officialTitle: officialPrompt.title,
      migratedAt: new Date().toISOString()
    };
    transferLocalPromptToOfficial(migrationSource.id, officialPrompt.id);
    recordMigration(migration);
    setMigrationSource(null);
    setMigrationQuery("");
    setSection("migrated");
    flash("正式版へ移行しました");
  }

  function restoreMigrated(record: LocalPromptMigration) {
    restoreLocalPrompt(record.localPrompt);
    removeMigration(record.localPrompt.id);
    setSection("active");
    flash("端末内版を復元しました。正式版へ移した履歴はそのまま残ります");
  }

  function deleteMigrationRecord(record: LocalPromptMigration) {
    if (!window.confirm(`「${record.localPrompt.title}」の移行記録を削除しますか？`)) return;
    removeMigration(record.localPrompt.id);
    flash("移行記録を削除しました");
  }

  function exportLifecycleData() {
    downloadJson(
      `prompt-launcher-lifecycle-${new Date().toISOString().slice(0, 10)}.json`,
      selectLifecycleSnapshot(useLocalLifecycleStore.getState())
    );
  }

  const light = document.documentElement.dataset.theme === "light";
  const sectionItems: Array<{ id: Section; label: string; count: number }> = [
    { id: "active", label: "利用中", count: localPrompts.length },
    { id: "archived", label: "アーカイブ", count: archivedPrompts.length },
    { id: "migrated", label: "移行済み", count: migrations.length }
  ];

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto bg-zinc-950 text-zinc-50 ${light ? "theme-light" : ""}`}>
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-zinc-950/95">
        <header className="safe-top sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 backdrop-blur">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-2 text-sm font-bold text-zinc-300">← 閉じる</button>
            <button type="button" onClick={exportLifecycleData} className="min-h-10 rounded-xl bg-zinc-900 px-3 text-xs font-bold text-zinc-400">管理データを書き出す</button>
          </div>
          <h1 className="text-xl font-black">自作プロンプト管理</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-400">順番を整え、使わないものを退避し、正式登録済みの道具へ履歴ごと移します。</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {sectionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={section === item.id ? "page" : undefined}
                className={`min-h-12 rounded-2xl px-2 text-xs font-black ${section === item.id ? "bg-reds-500 text-white" : "bg-zinc-900 text-zinc-400"}`}
              >
                {item.label}<span className="ml-1">{item.count}</span>
              </button>
            ))}
          </div>
        </header>

        <main className="space-y-4 px-4 pb-32 pt-5">
          {section === "active" && (
            <>
              <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-sm font-black">一括で並べ替え</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => applySort("usage")} className="min-h-11 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300">使用回数順</button>
                  <button type="button" onClick={() => applySort("updated")} className="min-h-11 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300">更新日順</button>
                  <button type="button" onClick={() => applySort("title")} className="min-h-11 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300">名前順</button>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">個別の上下ボタンでも微調整できます。並び順は端末に保存されます。</p>
              </section>

              {localPrompts.length ? localPrompts.map((prompt, index) => (
                <article key={prompt.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-800 text-2xl">{prompt.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black leading-6">{prompt.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">{usage[prompt.id]?.copyCount ?? 0}回使用 ・ 更新 {prompt.updatedAt}</p>
                    </div>
                    <span className="text-xs font-black text-zinc-600">{index + 1}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" aria-label={`${prompt.title}を上へ`} disabled={index === 0} onClick={() => moveLocalPrompt(prompt.id, -1)} className="min-h-11 rounded-xl bg-zinc-800 text-sm font-black text-zinc-300 disabled:opacity-30">↑ 上へ</button>
                    <button type="button" aria-label={`${prompt.title}を下へ`} disabled={index === localPrompts.length - 1} onClick={() => moveLocalPrompt(prompt.id, 1)} className="min-h-11 rounded-xl bg-zinc-800 text-sm font-black text-zinc-300 disabled:opacity-30">↓ 下へ</button>
                    <button type="button" onClick={() => handleArchive(prompt)} className="min-h-11 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400">アーカイブ</button>
                    <button type="button" onClick={() => beginMigration(prompt)} className="min-h-11 rounded-xl bg-blue-600 text-xs font-black text-white">正式版へ移行</button>
                  </div>
                </article>
              )) : (
                <p className="rounded-3xl border border-dashed border-zinc-700 p-6 text-sm leading-6 text-zinc-400">利用中の自作プロンプトはありません。アーカイブや移行済みから戻せます。</p>
              )}
            </>
          )}

          {section === "archived" && (
            archivedPrompts.length ? archivedPrompts.map((record) => (
              <article key={record.prompt.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{record.prompt.emoji}</span>
                  <div className="min-w-0 flex-1"><h2 className="font-black">{record.prompt.title}</h2><p className="mt-1 text-xs text-zinc-500">{formatDate(record.archivedAt)}にアーカイブ</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleRestore(record)} className="min-h-11 rounded-xl bg-reds-500 text-xs font-black text-white">利用中へ戻す</button>
                  <button type="button" onClick={() => handleDeleteArchived(record)} className="min-h-11 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-500">完全に削除</button>
                </div>
              </article>
            )) : <p className="rounded-3xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">アーカイブは空です。</p>
          )}

          {section === "migrated" && (
            <>
              <p className="rounded-2xl bg-blue-500/10 p-4 text-xs leading-5 text-blue-200">移行時に、お気に入り・使用回数・履歴・前回設定を正式版へ引き継ぎます。端末内版を復元しても、正式版へ移した履歴は消しません。</p>
              {migrations.length ? migrations.map((record) => (
                <article key={record.localPrompt.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{record.localPrompt.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-black">{record.localPrompt.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">→ {record.officialTitle}</p>
                      <code className="mt-1 block break-all text-[11px] text-zinc-600">{record.officialPromptId}</code>
                      <p className="mt-1 text-xs text-zinc-600">{formatDate(record.migratedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => restoreMigrated(record)} className="min-h-11 rounded-xl bg-zinc-800 text-xs font-black text-zinc-300">端末内版を復元</button>
                    <button type="button" onClick={() => deleteMigrationRecord(record)} className="min-h-11 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-500">記録を削除</button>
                  </div>
                </article>
              )) : <p className="rounded-3xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">正式版へ移行した記録はありません。</p>}
            </>
          )}

          {error && <p role="alert" className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-300">正式カタログを読み込めませんでした：{error}</p>}
        </main>

        {migrationSource && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70" role="presentation" onClick={() => setMigrationSource(null)}>
            <section role="dialog" aria-modal="true" aria-labelledby="migration-title" onClick={(event) => event.stopPropagation()} className="safe-bottom max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
              <h2 id="migration-title" className="text-lg font-black">正式版への移行先を選ぶ</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">「{migrationSource.title}」の利用記録を、選んだ正式プロンプトへまとめます。</p>
              <label className="mt-4 block text-sm font-bold text-zinc-300">正式プロンプトを検索
                <input value={migrationQuery} onChange={(event) => setMigrationQuery(event.target.value)} placeholder="名前・用途・IDで検索" className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-white placeholder:text-zinc-600" />
              </label>
              <div className="mt-4 space-y-2">
                {migrationCandidates.map((candidate) => (
                  <button key={candidate.prompt.id} type="button" onClick={() => completeMigration(candidate.prompt)} className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left active:scale-[0.99]">
                    <div className="flex items-start gap-3"><span className="text-2xl">{candidate.prompt.emoji}</span><span className="min-w-0 flex-1"><strong className="block text-sm text-white">{candidate.prompt.title}</strong><span className="mt-1 block text-xs leading-5 text-zinc-500">{candidate.prompt.summary}</span><code className="mt-1 block text-[11px] text-zinc-600">{candidate.prompt.id}</code></span><span className="shrink-0 text-xs font-black text-blue-300">{candidate.score >= 1.5 ? "ID一致" : `${Math.round(Math.min(1, candidate.score) * 100)}%`}</span></div>
                    {candidate.reasons.length > 0 && <span className="mt-2 block text-[11px] text-zinc-600">{candidate.reasons.join("・")}</span>}
                  </button>
                ))}
                {catalog && migrationCandidates.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">候補がありません。別の検索語を試してください。</p>}
              </div>
              <button type="button" onClick={() => setMigrationSource(null)} className="mt-4 min-h-12 w-full rounded-2xl border border-zinc-700 text-sm font-bold text-zinc-400">キャンセル</button>
            </section>
          </div>
        )}

        {message && <div role="status" className="safe-bottom fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-black text-zinc-950 shadow-xl">{message}</div>}
      </div>
    </div>
  );
}
