import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, Modifier, Prompt } from "./schema/catalog";
import { catalogSchema } from "./schema/catalog";
import { scorePrompt } from "./search/core";
import {
  createDefaultSnapshot,
  selectPersonalSnapshot,
  useAppStore,
  type AiTarget,
  type PersonalSnapshot,
  type PromptSettings,
  type ThemeMode,
  type UsageEntry
} from "./store/appStore";

interface LoadState {
  catalog: Catalog | null;
  error: string | null;
}

type Tab = "search" | "favorites" | "history" | "settings";

const navItems: Array<{ id: Tab; emoji: string; label: string }> = [
  { id: "search", emoji: "🔍", label: "探す" },
  { id: "favorites", emoji: "⭐", label: "よく使う" },
  { id: "history", emoji: "🕘", label: "履歴" },
  { id: "settings", emoji: "⚙️", label: "設定" }
];

const intentChips = [
  ["arrange", "整える"],
  ["think", "考える"],
  ["research", "調べる"],
  ["create", "作る"],
  ["compare", "比べる"],
  ["inspect", "点検する"],
  ["improve", "改善する"],
  ["convert", "変換する"]
] as const;

const inputChips = [
  ["text", "文章"],
  ["memo", "メモ"],
  ["meeting-log", "会議ログ"],
  ["url", "URL"],
  ["image", "画像"],
  ["data", "データ"],
  ["code", "コード"],
  ["none", "何もない"]
] as const;

const rotatingPlaceholders = [
  "長い文章、短くする？",
  "会議メモ、どうにかする？",
  "企画の弱点を洗い出す？",
  "雑な依頼から探してOK"
];

const aiTargets: Record<AiTarget, { label: string; url: string; emoji: string }> = {
  chatgpt: { label: "ChatGPTで開く", url: "https://chatgpt.com/", emoji: "🟢" },
  claude: { label: "Claudeで開く", url: "https://claude.ai/new", emoji: "🟠" }
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

function buildSettings(prompt: Prompt, values: Record<string, string>, modifiers: string[], includeFreeText = false): PromptSettings {
  const optionalValues = Object.fromEntries(
    prompt.optionalInputs
      .filter((field) => includeFreeText || field.type === "select")
      .map((field) => [field.id, values[field.id]?.trim() ?? ""])
      .filter(([, value]) => value)
  );
  return { modifiers, optionalValues };
}

function renderTemplate(prompt: Prompt, values: Record<string, string>): string {
  let output = prompt.promptTemplate;
  for (const field of prompt.optionalInputs) {
    const value = values[field.id]?.trim();
    const pattern = new RegExp(`{{#${field.id}}}([\\s\\S]*?){{\\/${field.id}}}`, "g");
    output = output.replace(pattern, value ? (_match, body: string) => body.replaceAll(`{{${field.id}}}`, value) : "");
  }
  for (const field of prompt.requiredInputs) {
    output = output.replaceAll(`{{${field.id}}}`, values[field.id]?.trim() ?? "");
  }
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeSnapshot(input: unknown): PersonalSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const source = raw.state && typeof raw.state === "object" ? raw.state as Record<string, unknown> : raw;
  const defaults = createDefaultSnapshot();
  const preferences = source.prefs && typeof source.prefs === "object" ? source.prefs as Record<string, unknown> : {};
  const theme: ThemeMode = preferences.theme === "light" || preferences.theme === "dark" ? preferences.theme : "auto";
  const lastAi: AiTarget = preferences.lastAi === "claude" ? "claude" : "chatgpt";

  const favorites = Array.isArray(source.favorites)
    ? source.favorites.filter((item): item is string => typeof item === "string")
    : [];
  const recentQueries = Array.isArray(source.recentQueries)
    ? source.recentQueries.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  const usage = source.usage && typeof source.usage === "object"
    ? source.usage as PersonalSnapshot["usage"]
    : {};
  const lastSettings = source.lastSettings && typeof source.lastSettings === "object"
    ? source.lastSettings as PersonalSnapshot["lastSettings"]
    : {};
  const history = Array.isArray(source.history)
    ? source.history.filter((entry): entry is UsageEntry => {
        if (!entry || typeof entry !== "object") return false;
        const item = entry as Record<string, unknown>;
        return typeof item.promptId === "string" && typeof item.copiedAt === "string";
      }).map((entry) => ({
        promptId: entry.promptId,
        copiedAt: entry.copiedAt,
        modifiers: Array.isArray(entry.modifiers) ? entry.modifiers.filter((item): item is string => typeof item === "string") : [],
        optionalValues: entry.optionalValues && typeof entry.optionalValues === "object" ? entry.optionalValues : {}
      })).slice(0, 50)
    : [];

  return {
    ...defaults,
    usage,
    favorites,
    history,
    lastSettings,
    recentQueries,
    prefs: { theme, lastAi }
  };
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const succeeded = document.execCommand("copy");
  textarea.remove();
  return succeeded;
}

export default function App() {
  const [{ catalog, error }, setLoadState] = useState<LoadState>({ catalog: null, error: null });
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
  const [inputType, setInputType] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState("");
  const [copySheetOpen, setCopySheetOpen] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const usage = useAppStore((state) => state.usage);
  const favorites = useAppStore((state) => state.favorites);
  const history = useAppStore((state) => state.history);
  const lastSettings = useAppStore((state) => state.lastSettings);
  const recentQueries = useAppStore((state) => state.recentQueries);
  const prefs = useAppStore((state) => state.prefs);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const recordCopy = useAppStore((state) => state.recordCopy);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const addRecentQuery = useAppStore((state) => state.addRecentQuery);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLastAi = useAppStore((state) => state.setLastAi);
  const replacePersonalData = useAppStore((state) => state.replacePersonalData);
  const clearPersonalData = useAppStore((state) => state.clearPersonalData);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}catalog.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`catalog.json: HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => setLoadState({ catalog: catalogSchema.parse(payload), error: null }))
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setLoadState({ catalog: null, error: loadError instanceof Error ? loadError.message : String(loadError) });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setPlaceholderIndex((current) => (current + 1) % rotatingPlaceholders.length), 4200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateOffset = () => {
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    };
    updateOffset();
    viewport.addEventListener("resize", updateOffset);
    viewport.addEventListener("scroll", updateOffset);
    return () => {
      viewport.removeEventListener("resize", updateOffset);
      viewport.removeEventListener("scroll", updateOffset);
    };
  }, []);

  useEffect(() => {
    const currentHasData = favorites.length > 0 || Object.keys(usage).length > 0;
    if (currentHasData) return;
    const legacy = localStorage.getItem("prompt-launcher:v1");
    if (!legacy) return;
    try {
      const snapshot = sanitizeSnapshot(JSON.parse(legacy));
      if (snapshot) replacePersonalData(snapshot);
      localStorage.removeItem("prompt-launcher:v1");
    } catch {
      // 壊れた旧データは残し、ユーザーが手動で確認できるようにする。
    }
  }, [favorites.length, replacePersonalData, usage]);

  const resolvedTheme = prefs.theme === "auto" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const categoryMap = useMemo(
    () => new Map(catalog?.dictionaries.categories.map((item) => [item.slug, item]) ?? []),
    [catalog]
  );
  const modifierMap = useMemo(
    () => new Map(catalog?.modifiers.map((item) => [item.id, item]) ?? []),
    [catalog]
  );

  const rankedPrompts = useMemo(() => {
    if (!catalog) return [];
    return catalog.prompts
      .map((prompt) => {
        const usageEntry = usage[prompt.id];
        const chipScore = (intent && prompt.intents.includes(intent) ? 0.08 : 0)
          + (inputType && prompt.inputTypes.includes(inputType) ? 0.07 : 0);
        const usageScore = usageEntry ? Math.min(0.15, Math.log2(usageEntry.copyCount + 1) * 0.035) : 0;
        const favoriteScore = favorites.includes(prompt.id) ? 0.1 : 0;
        return {
          prompt,
          score: scorePrompt(query, prompt, catalog.dictionaries.synonyms) + chipScore + usageScore + favoriteScore
        };
      })
      .sort((a, b) => b.score - a.score || b.prompt.mobilePriority - a.prompt.mobilePriority);
  }, [catalog, favorites, inputType, intent, query, usage]);

  const hasSearchCondition = Boolean(query.trim() || intent || inputType);
  const weakMatch = hasSearchCondition && (rankedPrompts[0]?.score ?? 0) < 0.13;

  const finalPrompt = useMemo(() => {
    if (!selectedPrompt) return "";
    const base = renderTemplate(selectedPrompt, values);
    const slotOrder: Modifier["slot"][] = ["stance", "scope", "audience", "output", "process"];
    const additions = selectedModifiers
      .map((id) => modifierMap.get(id))
      .filter((modifier): modifier is Modifier => Boolean(modifier))
      .sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot))
      .map((modifier) => modifier.text.trim());
    return [base, ...additions].filter(Boolean).join("\n\n");
  }, [modifierMap, selectedModifiers, selectedPrompt, values]);

  const favoritePrompts = catalog?.prompts
    .filter((prompt) => favorites.includes(prompt.id))
    .sort((a, b) => favorites.indexOf(a.id) - favorites.indexOf(b.id)) ?? [];

  const historyPrompts = history
    .map((entry) => ({ entry, prompt: catalog?.prompts.find((prompt) => prompt.id === entry.promptId) }))
    .filter((item): item is { entry: UsageEntry; prompt: Prompt } => Boolean(item.prompt));

  const totalCopyCount = Object.values(usage).reduce((sum, item) => sum + item.copyCount, 0);
  const topPrompts = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(usage)
      .sort(([, a], [, b]) => b.copyCount - a.copyCount)
      .slice(0, 3)
      .map(([id, data]) => ({ prompt: catalog.prompts.find((item) => item.id === id), count: data.copyCount }))
      .filter((item): item is { prompt: Prompt; count: number } => Boolean(item.prompt));
  }, [catalog, usage]);

  function flash(message: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2400);
  }

  function openPrompt(prompt: Prompt, override?: PromptSettings) {
    const saved = override ?? lastSettings[prompt.id];
    const availableModifiers = new Set(catalog?.modifiers.map((modifier) => modifier.id) ?? []);
    setSelectedPrompt(prompt);
    setValues(saved?.optionalValues ?? {});
    setSelectedModifiers(saved?.modifiers.filter((id) => availableModifiers.has(id)) ?? []);
    setShowPreview(false);
    setCopySheetOpen(false);
    if (query.trim()) addRecentQuery(query);
  }

  function toggleModifier(modifier: Modifier) {
    setSelectedModifiers((current) => {
      if (current.includes(modifier.id)) return current.filter((id) => id !== modifier.id);
      const withoutConflicts = current.filter((id) =>
        !modifier.conflictsWith.includes(id) && !modifierMap.get(id)?.conflictsWith.includes(modifier.id)
      );
      if (withoutConflicts.length !== current.length) flash("競合する条件を外しました");
      return [...withoutConflicts, modifier.id];
    });
  }

  function handleCopySuccess() {
    if (!selectedPrompt) return;
    const safeSettings = buildSettings(selectedPrompt, values, selectedModifiers);
    recordCopy(selectedPrompt.id, safeSettings);
    if ("vibrate" in navigator) navigator.vibrate(10);
    setCopySheetOpen(true);
    flash("コピーしました 🎉");
  }

  function copyPrompt() {
    if (!selectedPrompt) return;
    const missing = selectedPrompt.requiredInputs.find((field) => !values[field.id]?.trim());
    if (missing) {
      flash(`「${missing.label}」を入力してください`);
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(finalPrompt).then(handleCopySuccess).catch(() => {
        setShowPreview(true);
        flash("コピーできませんでした。全文を選択してください");
      });
      return;
    }

    if (fallbackCopy(finalPrompt)) handleCopySuccess();
    else {
      setShowPreview(true);
      flash("コピーできませんでした。全文を選択してください");
    }
  }

  function saveCurrentSettings() {
    if (!selectedPrompt) return;
    saveSettings(selectedPrompt.id, buildSettings(selectedPrompt, values, selectedModifiers, true));
    flash("今回の条件を保存しました");
  }

  function openAi(target: AiTarget) {
    setLastAi(target);
    window.open(aiTargets[target].url, "_blank", "noopener,noreferrer");
    setCopySheetOpen(false);
  }

  function exportData() {
    const snapshot = selectPersonalSnapshot(useAppStore.getState());
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prompt-launcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const snapshot = sanitizeSnapshot(JSON.parse(await file.text()));
      if (!snapshot) throw new Error("形式が違います");
      replacePersonalData(snapshot);
      flash("バックアップを読み込みました");
    } catch {
      flash("読み込めないファイルです");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function PromptCard({ prompt }: { prompt: Prompt }) {
    const category = categoryMap.get(prompt.category);
    const favorite = favorites.includes(prompt.id);
    const copyCount = usage[prompt.id]?.copyCount ?? 0;
    return (
      <article className="tool-card relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/10">
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: category?.color ?? "#E6002D" }} />
        <div className="flex items-start gap-3 pl-1">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-2xl" aria-hidden="true">
            {prompt.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black leading-6 text-white">{prompt.title}</h3>
              <button
                type="button"
                aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
                onClick={() => toggleFavorite(prompt.id)}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl"
              >
                {favorite ? "⭐" : "☆"}
              </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{prompt.summary}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-zinc-400">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1">{category?.label ?? prompt.category}</span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1">必要: {prompt.requiredInputs[0]?.label ?? "なし"}</span>
                {copyCount > 0 && <span className="rounded-full bg-zinc-800 px-2.5 py-1">{copyCount}回使用</span>}
              </div>
              <button
                type="button"
                onClick={() => openPrompt(prompt)}
                className="min-h-11 shrink-0 rounded-xl bg-reds-500 px-4 text-sm font-black text-white active:scale-95"
              >
                使う
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (selectedPrompt) {
    const compatible = selectedPrompt.compatibleModifiers
      .map((id) => modifierMap.get(id))
      .filter((item): item is Modifier => Boolean(item));
    const orderedTargets: AiTarget[] = prefs.lastAi === "claude" ? ["claude", "chatgpt"] : ["chatgpt", "claude"];

    return (
      <div className={`app-shell mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950 text-zinc-50 ${resolvedTheme === "light" ? "theme-light" : ""}`}>
        <header className="safe-top sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 backdrop-blur">
          <button type="button" onClick={() => setSelectedPrompt(null)} className="min-h-11 rounded-xl px-2 text-sm font-bold text-zinc-300">← 戻る</button>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-900 text-2xl">{selectedPrompt.emoji}</div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black leading-7">{selectedPrompt.title}</h1>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{selectedPrompt.summary}</p>
            </div>
            <button type="button" onClick={() => toggleFavorite(selectedPrompt.id)} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl">
              {favorites.includes(selectedPrompt.id) ? "⭐" : "☆"}
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-4 pb-36 pt-5">
          <section>
            <h2 className="text-sm font-black text-zinc-200">必須入力</h2>
            <div className="mt-3 space-y-4">
              {selectedPrompt.requiredInputs.map((field) => (
                <label key={field.id} className="block text-sm font-bold text-zinc-300">
                  {field.label}
                  {field.type === "textarea" ? (
                    <>
                      <textarea
                        value={values[field.id] ?? ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder}
                        rows={7}
                        className="mt-2 w-full resize-y rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-base leading-7 text-white placeholder:text-zinc-600"
                      />
                      {(values[field.id]?.length ?? 0) > 0 && <span className="mt-1 block text-right text-xs font-medium text-zinc-500">{values[field.id].length.toLocaleString()}文字</span>}
                    </>
                  ) : (
                    <input
                      type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"}
                      value={values[field.id] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                      placeholder={field.placeholder}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-white placeholder:text-zinc-600"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          {compatible.length > 0 && (
            <section>
              <h2 className="text-sm font-black text-zinc-200">条件を追加</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {compatible.map((modifier) => {
                  const active = selectedModifiers.includes(modifier.id);
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      onClick={() => toggleModifier(modifier)}
                      className={`min-h-11 rounded-full border px-4 text-sm font-bold transition active:scale-95 ${active ? "border-reds-500 bg-reds-500 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}
                    >
                      {modifier.emoji} {modifier.title}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {selectedPrompt.optionalInputs.length > 0 && (
            <details className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <summary className="cursor-pointer font-black text-zinc-200">詳細設定</summary>
              <div className="mt-4 space-y-4">
                {selectedPrompt.optionalInputs.map((field) => (
                  <label key={field.id} className="block text-sm font-bold text-zinc-300">
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        value={values[field.id] ?? ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-white"
                      >
                        <option value="">指定なし</option>
                        {field.options?.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={values[field.id] ?? ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder}
                        rows={4}
                        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                      />
                    ) : (
                      <input
                        type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"}
                        value={values[field.id] ?? ""}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder}
                        className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-white"
                      />
                    )}
                  </label>
                ))}
              </div>
            </details>
          )}

          <section>
            <button type="button" onClick={() => setShowPreview((current) => !current)} className="min-h-11 text-sm font-bold text-zinc-300">
              {showPreview ? "▼" : "▶"} 生成されるプロンプトを確認
            </button>
            {showPreview && (
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">
                {finalPrompt}
              </pre>
            )}
          </section>
        </main>

        <div className="keyboard-aware-bottom safe-bottom fixed inset-x-0 z-30 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
          <button type="button" onClick={copyPrompt} className="min-h-14 w-full rounded-2xl bg-reds-500 text-base font-black text-white shadow-lg shadow-red-950/40 active:scale-[0.98]">
            📋 プロンプトをコピー
          </button>
        </div>

        {copySheetOpen && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" role="presentation" onClick={() => setCopySheetOpen(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="copy-actions-title" onClick={(event) => event.stopPropagation()} className="safe-bottom w-full max-w-[430px] rounded-t-3xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700" />
              <h2 id="copy-actions-title" className="text-lg font-black">コピー完了。どこで使う？</h2>
              <div className="mt-4 grid gap-2">
                {orderedTargets.map((target) => (
                  <button key={target} type="button" onClick={() => openAi(target)} className="min-h-12 rounded-2xl bg-zinc-800 px-4 text-left text-sm font-black text-white">
                    {aiTargets[target].emoji} {aiTargets[target].label}
                  </button>
                ))}
                <button type="button" onClick={saveCurrentSettings} className="min-h-12 rounded-2xl border border-zinc-700 px-4 text-left text-sm font-bold text-zinc-300">
                  💾 今回の条件を保存
                </button>
              </div>
            </section>
          </div>
        )}

        {toast && <div role="status" className="toast-position fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 shadow-xl">{toast}</div>}
      </div>
    );
  }

  return (
    <div className={`app-shell mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950/90 text-zinc-50 ${resolvedTheme === "light" ? "theme-light" : ""}`}>
      <div className="h-1 w-full bg-reds-500" />
      <main className="safe-top flex-1 px-4 pb-28">
        {tab === "search" && (
          <>
            <header className="pt-2">
              <p className="text-sm font-semibold text-zinc-400">{greeting()} 👋</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">何をしたい？</h1>
            </header>

            <section className="mt-4">
              <label className="relative block">
                <span className="sr-only">プロンプトを検索</span>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && query.trim()) addRecentQuery(query);
                  }}
                  placeholder={rotatingPlaceholders[placeholderIndex]}
                  className="min-h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-900 pl-12 pr-11 text-base text-white shadow-inner placeholder:text-zinc-600"
                />
                {query && <button type="button" aria-label="検索語を消す" onClick={() => setQuery("")} className="absolute right-1 top-1 grid min-h-12 min-w-11 place-items-center text-zinc-400">✕</button>}
              </label>

              {!query && recentQueries.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="最近の検索">
                  {recentQueries.slice(0, 4).map((item) => (
                    <button key={item} type="button" onClick={() => setQuery(item)} className="min-h-10 rounded-full bg-zinc-900 px-3 text-xs font-bold text-zinc-400">🕘 {item}</button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {intentChips.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setIntent(intent === id ? "" : id)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${intent === id ? "bg-reds-500 text-white" : "bg-zinc-900 text-zinc-300"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {inputChips.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setInputType(inputType === id ? "" : id)} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${inputType === id ? "border-yellow-400 bg-yellow-400 text-zinc-950" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}>{label}</button>
                ))}
              </div>
            </section>

            {error && <p role="alert" className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-300">カタログを読み込めませんでした：{error}</p>}

            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-reds-500">Suggestions</p>
                  <h2 className="mt-1 text-lg font-black">{hasSearchCondition ? (weakMatch ? "近い候補" : "おすすめ候補") : "おすすめ"}</h2>
                </div>
                <span className="text-xs text-zinc-500">上位{Math.min(5, rankedPrompts.length)}件</span>
              </div>
              {weakMatch && <p className="mb-3 rounded-2xl border border-dashed border-zinc-700 p-4 text-sm leading-6 text-zinc-400">ぴったりは無かったけど、近い道具を3つ先に出しています。チップを一つ足すと絞りやすくなります。</p>}
              <div className="space-y-3">{rankedPrompts.slice(0, weakMatch ? 3 : 5).map(({ prompt }) => <PromptCard key={prompt.id} prompt={prompt} />)}</div>
            </section>
          </>
        )}

        {tab === "favorites" && (
          <section className="pt-3">
            <h1 className="text-2xl font-black">よく使う ⭐</h1>
            <p className="mt-1 text-sm text-zinc-400">前回の条件を引き継いで、すぐ再開できます。</p>
            <div className="mt-5 space-y-3">
              {favoritePrompts.length ? favoritePrompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />) : <p className="rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">まだお気に入りがありません。カードの☆を押すと追加できます。</p>}
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="pt-3">
            <h1 className="text-2xl font-black">履歴 🕘</h1>
            <p className="mt-1 text-sm leading-6 text-zinc-400">貼り付けた本文は保存していません。使った道具と安全な選択条件だけを記録します。</p>
            <div className="mt-5 space-y-3">
              {historyPrompts.length ? historyPrompts.map(({ entry, prompt }, index) => (
                <button key={`${entry.copiedAt}-${index}`} type="button" onClick={() => openPrompt(prompt, entry)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left">
                  <span className="text-2xl">{prompt.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-white">{prompt.title}</strong>
                    <span className="mt-1 block text-xs text-zinc-500">{new Date(entry.copiedAt).toLocaleString("ja-JP")}</span>
                  </span>
                  <span className="text-xs font-bold text-zinc-400">同じ条件で →</span>
                </button>
              )) : <p className="rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">まだ利用履歴がありません。</p>}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="pt-3">
            <h1 className="text-2xl font-black">設定 ⚙️</h1>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">コピー回数</p><p className="mt-1 text-2xl font-black">{totalCopyCount}</p></div>
              <div className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">お気に入り</p><p className="mt-1 text-2xl font-black">{favorites.length}</p></div>
            </div>

            {topPrompts.length > 0 && (
              <div className="mt-5 rounded-2xl bg-zinc-900 p-4">
                <h2 className="text-sm font-black">今月の相棒プロンプト</h2>
                <div className="mt-3 space-y-2">{topPrompts.map(({ prompt, count }, index) => <div key={prompt.id} className="flex items-center gap-3 text-sm"><span>{index + 1}位</span><span className="text-xl">{prompt.emoji}</span><span className="min-w-0 flex-1 truncate font-bold">{prompt.shortTitle}</span><span className="text-zinc-500">{count}回</span></div>)}</div>
              </div>
            )}

            <div className="mt-5 rounded-2xl bg-zinc-900 p-4">
              <h2 className="text-sm font-black">表示テーマ</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["auto", "dark", "light"] as ThemeMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setTheme(mode)} className={`min-h-11 rounded-xl text-sm font-bold ${prefs.theme === mode ? "bg-reds-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                    {mode === "auto" ? "自動" : mode === "dark" ? "黒" : "白"}
                  </button>
                ))}
              </div>
            </div>

            <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); }} />
            <button type="button" onClick={exportData} className="mt-5 min-h-12 w-full rounded-2xl bg-zinc-900 px-4 text-left text-sm font-bold">データをエクスポート</button>
            <button type="button" onClick={() => importInputRef.current?.click()} className="mt-3 min-h-12 w-full rounded-2xl bg-zinc-900 px-4 text-left text-sm font-bold">バックアップをインポート</button>
            <button type="button" onClick={() => { if (window.confirm("お気に入りと履歴を削除しますか？")) clearPersonalData(); }} className="mt-3 min-h-12 w-full rounded-2xl border border-zinc-800 px-4 text-left text-sm font-bold text-zinc-400">個人データを削除</button>
          </section>
        )}
      </main>

      <nav aria-label="メインナビゲーション" className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 px-2 pt-2 backdrop-blur">
        <div className="grid grid-cols-4">
          {navItems.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`min-h-14 rounded-xl px-1 py-1 text-xs font-semibold ${tab === item.id ? "bg-reds-500 text-white" : "text-zinc-500"}`}>
              <span className="block text-lg" aria-hidden="true">{item.emoji}</span><span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      {toast && <div role="status" className="toast-position fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 shadow-xl">{toast}</div>}
    </div>
  );
}
