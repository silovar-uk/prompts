import { useEffect, useMemo, useState } from "react";
import type { Catalog, Modifier, Prompt } from "./schema/catalog";
import { catalogSchema } from "./schema/catalog";

interface LoadState {
  catalog: Catalog | null;
  error: string | null;
}

type Tab = "search" | "favorites" | "history" | "settings";

type UsageEntry = {
  promptId: string;
  copiedAt: string;
  modifiers: string[];
};

type PersonalData = {
  favorites: string[];
  history: UsageEntry[];
  usage: Record<string, { copyCount: number; lastCopiedAt: string }>;
  prefs: { theme: "dark" | "light" | "auto" };
};

const STORAGE_KEY = "prompt-launcher:v1";
const defaultPersonalData: PersonalData = {
  favorites: [],
  history: [],
  usage: {},
  prefs: { theme: "dark" }
};

const navItems: Array<{ id: Tab; emoji: string; label: string }> = [
  { id: "search", emoji: "🔍", label: "探す" },
  { id: "favorites", emoji: "⭐", label: "よく使う" },
  { id: "history", emoji: "🕘", label: "履歴" },
  { id: "settings", emoji: "⚙️", label: "設定" }
];

const intentChips = [
  ["arrange", "整える"], ["think", "考える"], ["research", "調べる"], ["create", "作る"],
  ["compare", "比べる"], ["review", "点検する"], ["improve", "改善する"], ["convert", "変換する"]
] as const;

const inputChips = [
  ["text", "文章"], ["memo", "メモ"], ["meeting-log", "会議ログ"], ["url", "URL"],
  ["image", "画像"], ["data", "データ"], ["code", "コード"], ["none", "何もない"]
] as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function bigrams(value: string): string[] {
  if (value.length <= 1) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function overlap(query: string, target: string): number {
  const queryGrams = bigrams(normalize(query));
  const targetSet = new Set(bigrams(normalize(target)));
  if (!queryGrams.length) return 0;
  return queryGrams.filter((gram) => targetSet.has(gram)).length / queryGrams.length;
}

function promptScore(prompt: Prompt, query: string, intent: string, inputType: string, personal: PersonalData): number {
  const normalizedQuery = normalize(query);
  const fields = [
    ...prompt.searchPhrases.map((value) => [value, 3] as const),
    [prompt.title, 2.5] as const,
    [prompt.shortTitle, 2.5] as const,
    [prompt.problem, 1.5] as const,
    [prompt.summary, 1.5] as const,
    ...prompt.tags.map((value) => [value, 1] as const)
  ];
  let textScore = 0;
  for (const [field, weight] of fields) textScore = Math.max(textScore, overlap(query, field) * weight);
  const exactBonus = normalizedQuery && fields.some(([field]) => normalize(field).includes(normalizedQuery)) ? 0.15 : 0;
  const chipScore = (intent && prompt.intents.includes(intent) ? 0.08 : 0) + (inputType && prompt.inputTypes.includes(inputType) ? 0.07 : 0);
  const usage = personal.usage[prompt.id];
  const usageScore = usage ? Math.min(0.15, Math.log2(usage.copyCount + 1) * 0.035) : 0;
  const favoriteScore = personal.favorites.includes(prompt.id) ? 0.1 : 0;
  return textScore * 0.4 + exactBonus + chipScore + usageScore + favoriteScore + prompt.mobilePriority * 0.01;
}

function renderTemplate(prompt: Prompt, values: Record<string, string>): string {
  let output = prompt.promptTemplate;
  for (const field of prompt.optionalInputs) {
    const value = values[field.id]?.trim();
    const pattern = new RegExp(`{{#${field.id}}}([\\s\\S]*?){{\\/${field.id}}}`, "g");
    output = output.replace(pattern, value ? (_match, body: string) => body.replaceAll(`{{${field.id}}}`, value) : "");
  }
  for (const field of prompt.requiredInputs) output = output.replaceAll(`{{${field.id}}}`, values[field.id]?.trim() ?? "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function loadPersonalData(): PersonalData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultPersonalData, ...JSON.parse(raw) } : defaultPersonalData;
  } catch {
    return defaultPersonalData;
  }
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
  const [personal, setPersonal] = useState<PersonalData>(() => loadPersonalData());

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

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(personal)), [personal]);

  const categoryMap = useMemo(() => new Map(catalog?.dictionaries.categories.map((item) => [item.slug, item]) ?? []), [catalog]);
  const modifierMap = useMemo(() => new Map(catalog?.modifiers.map((item) => [item.id, item]) ?? []), [catalog]);

  const rankedPrompts = useMemo(() => {
    if (!catalog) return [];
    return [...catalog.prompts]
      .map((prompt) => ({ prompt, score: promptScore(prompt, query, intent, inputType, personal) }))
      .sort((a, b) => b.score - a.score)
      .filter((item) => query || intent || inputType ? item.score > 0.01 : true);
  }, [catalog, query, intent, inputType, personal]);

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
  }, [selectedPrompt, values, selectedModifiers, modifierMap]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function toggleFavorite(id: string) {
    setPersonal((current) => ({
      ...current,
      favorites: current.favorites.includes(id) ? current.favorites.filter((item) => item !== id) : [id, ...current.favorites]
    }));
  }

  function openPrompt(prompt: Prompt) {
    setSelectedPrompt(prompt);
    setValues({});
    setSelectedModifiers([]);
    setShowPreview(false);
  }

  function toggleModifier(modifier: Modifier) {
    setSelectedModifiers((current) => {
      if (current.includes(modifier.id)) return current.filter((id) => id !== modifier.id);
      const withoutConflicts = current.filter((id) => !modifier.conflictsWith.includes(id) && !modifierMap.get(id)?.conflictsWith.includes(modifier.id));
      if (withoutConflicts.length !== current.length) flash("競合する条件を外しました");
      return [...withoutConflicts, modifier.id];
    });
  }

  async function copyPrompt() {
    if (!selectedPrompt) return;
    const missing = selectedPrompt.requiredInputs.find((field) => !values[field.id]?.trim());
    if (missing) {
      flash(`「${missing.label}」を入力してください`);
      return;
    }
    try {
      await navigator.clipboard.writeText(finalPrompt);
      const now = new Date().toISOString();
      setPersonal((current) => ({
        ...current,
        history: [{ promptId: selectedPrompt.id, copiedAt: now, modifiers: selectedModifiers }, ...current.history].slice(0, 50),
        usage: {
          ...current.usage,
          [selectedPrompt.id]: {
            copyCount: (current.usage[selectedPrompt.id]?.copyCount ?? 0) + 1,
            lastCopiedAt: now
          }
        }
      }));
      if ("vibrate" in navigator) navigator.vibrate(10);
      flash("コピーしました 🎉");
    } catch {
      setShowPreview(true);
      flash("コピーできませんでした。全文を選択してください");
    }
  }

  function PromptCard({ prompt }: { prompt: Prompt }) {
    const category = categoryMap.get(prompt.category);
    const favorite = personal.favorites.includes(prompt.id);
    return (
      <article className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/10">
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: category?.color ?? "#E6002D" }} />
        <div className="flex items-start gap-3 pl-1">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-2xl" aria-hidden="true">{prompt.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black leading-6 text-white">{prompt.title}</h3>
              <button type="button" aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"} onClick={() => toggleFavorite(prompt.id)} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl">{favorite ? "⭐" : "☆"}</button>
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{prompt.summary}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-zinc-400">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1">{category?.label ?? prompt.category}</span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1">必要: {prompt.requiredInputs[0]?.label ?? "なし"}</span>
              </div>
              <button type="button" onClick={() => openPrompt(prompt)} className="min-h-11 shrink-0 rounded-xl bg-reds-500 px-4 text-sm font-black text-white active:scale-95">使う</button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (selectedPrompt) {
    const compatible = selectedPrompt.compatibleModifiers.map((id) => modifierMap.get(id)).filter((item): item is Modifier => Boolean(item));
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950 text-zinc-50">
        <header className="safe-top sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 backdrop-blur">
          <button type="button" onClick={() => setSelectedPrompt(null)} className="min-h-11 rounded-xl px-2 text-sm font-bold text-zinc-300">← 戻る</button>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-900 text-2xl">{selectedPrompt.emoji}</div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black leading-7">{selectedPrompt.title}</h1>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{selectedPrompt.summary}</p>
            </div>
            <button type="button" onClick={() => toggleFavorite(selectedPrompt.id)} className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl">{personal.favorites.includes(selectedPrompt.id) ? "⭐" : "☆"}</button>
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
                    <textarea value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} placeholder={field.placeholder} rows={7} className="mt-2 w-full resize-y rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-base leading-7 text-white placeholder:text-zinc-600" />
                  ) : (
                    <input value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} placeholder={field.placeholder} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-white placeholder:text-zinc-600" />
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
                  return <button key={modifier.id} type="button" onClick={() => toggleModifier(modifier)} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition active:scale-95 ${active ? "border-reds-500 bg-reds-500 text-white" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>{modifier.emoji} {modifier.title}</button>;
                })}
              </div>
            </section>
          )}

          {selectedPrompt.optionalInputs.length > 0 && (
            <details className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <summary className="cursor-pointer font-black text-zinc-200">詳細設定</summary>
              <div className="mt-4 space-y-4">
                {selectedPrompt.optionalInputs.map((field) => (
                  <label key={field.id} className="block text-sm font-bold text-zinc-300">{field.label}
                    {field.type === "select" ? (
                      <select value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="">指定なし</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
                    ) : (
                      <input value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} placeholder={field.placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-white" />
                    )}
                  </label>
                ))}
              </div>
            </details>
          )}

          <section>
            <button type="button" onClick={() => setShowPreview(!showPreview)} className="min-h-11 text-sm font-bold text-zinc-300">{showPreview ? "▼" : "▶"} 生成されるプロンプトを確認</button>
            {showPreview && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">{finalPrompt}</pre>}
          </section>
        </main>

        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
          <button type="button" onClick={copyPrompt} className="min-h-14 w-full rounded-2xl bg-reds-500 text-base font-black text-white shadow-lg shadow-red-950/40 active:scale-[0.98]">📋 プロンプトをコピー</button>
        </div>
        {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 shadow-xl">{toast}</div>}
      </div>
    );
  }

  const favorites = catalog?.prompts.filter((prompt) => personal.favorites.includes(prompt.id)) ?? [];
  const historyPrompts = personal.history.map((entry) => ({ entry, prompt: catalog?.prompts.find((prompt) => prompt.id === entry.promptId) })).filter((item): item is { entry: UsageEntry; prompt: Prompt } => Boolean(item.prompt));

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950/90 text-zinc-50">
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
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：長い文章を短くしたい" className="min-h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-900 pl-12 pr-11 text-base text-white shadow-inner placeholder:text-zinc-600" />
                {query && <button type="button" aria-label="検索語を消す" onClick={() => setQuery("")} className="absolute right-1 top-1 grid min-h-12 min-w-11 place-items-center text-zinc-400">✕</button>}
              </label>

              <div className="mt-4 flex flex-wrap gap-2">{intentChips.map(([id, label]) => <button key={id} type="button" onClick={() => setIntent(intent === id ? "" : id)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${intent === id ? "bg-reds-500 text-white" : "bg-zinc-900 text-zinc-300"}`}>{label}</button>)}</div>
              <div className="mt-2 flex flex-wrap gap-2">{inputChips.map(([id, label]) => <button key={id} type="button" onClick={() => setInputType(inputType === id ? "" : id)} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${inputType === id ? "border-yellow-400 bg-yellow-400 text-zinc-950" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}>{label}</button>)}</div>
            </section>

            {error && <p role="alert" className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-300">カタログを読み込めませんでした：{error}</p>}

            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-reds-500">Suggestions</p><h2 className="mt-1 text-lg font-black">{query || intent || inputType ? "近い候補" : "おすすめ"}</h2></div><span className="text-xs text-zinc-500">{rankedPrompts.length}件</span></div>
              <div className="space-y-3">{rankedPrompts.slice(0, 5).map(({ prompt }) => <PromptCard key={prompt.id} prompt={prompt} />)}</div>
              {catalog && rankedPrompts.length === 0 && <div className="rounded-3xl border border-dashed border-zinc-700 p-5 text-sm leading-6 text-zinc-400">ぴったりは無かったけど、別の言葉やチップで探せます。検索語はそのまま残してあるので、条件を一つ外してみてください。</div>}
            </section>
          </>
        )}

        {tab === "favorites" && <section className="pt-3"><h1 className="text-2xl font-black">よく使う ⭐</h1><p className="mt-1 text-sm text-zinc-400">お気に入りの道具をすぐ呼び出せます。</p><div className="mt-5 space-y-3">{favorites.length ? favorites.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />) : <p className="rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">まだお気に入りがありません。カードの☆を押すと追加できます。</p>}</div></section>}

        {tab === "history" && <section className="pt-3"><h1 className="text-2xl font-black">履歴 🕘</h1><p className="mt-1 text-sm leading-6 text-zinc-400">貼り付けた本文は保存していません。使った道具と条件だけを記録します。</p><div className="mt-5 space-y-3">{historyPrompts.length ? historyPrompts.map(({ entry, prompt }, index) => <button key={`${entry.copiedAt}-${index}`} type="button" onClick={() => openPrompt(prompt)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-left"><span className="text-2xl">{prompt.emoji}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{prompt.title}</strong><span className="mt-1 block text-xs text-zinc-500">{new Date(entry.copiedAt).toLocaleString("ja-JP")}</span></span><span className="text-zinc-500">→</span></button>) : <p className="rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">まだ利用履歴がありません。</p>}</div></section>}

        {tab === "settings" && <section className="pt-3"><h1 className="text-2xl font-black">設定 ⚙️</h1><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">コピー回数</p><p className="mt-1 text-2xl font-black">{Object.values(personal.usage).reduce((sum, item) => sum + item.copyCount, 0)}</p></div><div className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">お気に入り</p><p className="mt-1 text-2xl font-black">{personal.favorites.length}</p></div></div><button type="button" onClick={() => { const blob = new Blob([JSON.stringify(personal, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "prompt-launcher-backup.json"; anchor.click(); URL.revokeObjectURL(url); }} className="mt-5 min-h-12 w-full rounded-2xl bg-zinc-900 px-4 text-left text-sm font-bold">データをエクスポート</button><button type="button" onClick={() => { if (window.confirm("お気に入りと履歴を削除しますか？")) setPersonal(defaultPersonalData); }} className="mt-3 min-h-12 w-full rounded-2xl border border-zinc-800 px-4 text-left text-sm font-bold text-zinc-400">個人データを削除</button></section>}
      </main>

      <nav aria-label="メインナビゲーション" className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 px-2 pt-2 backdrop-blur">
        <div className="grid grid-cols-4">{navItems.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`min-h-14 rounded-xl px-1 py-1 text-xs font-semibold ${tab === item.id ? "bg-reds-500 text-white" : "text-zinc-500"}`}><span className="block text-lg" aria-hidden="true">{item.emoji}</span><span>{item.label}</span></button>)}</div>
      </nav>
      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 shadow-xl">{toast}</div>}
    </div>
  );
}
