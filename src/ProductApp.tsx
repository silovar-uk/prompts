import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, InputField, Modifier, Prompt } from "./schema/catalog";
import { catalogSchema, promptSchema } from "./schema/catalog";
import { scorePrompt } from "./search/core";
import { LocalPromptWizard, type LocalPromptWizardMode } from "./components/LocalPromptWizard";
import { LocalPromptLifecycleManager } from "./components/LocalPromptLifecycleManager";
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
import { useLocalLifecycleStore } from "./store/localLifecycleStore";

type Tab = "home" | "library" | "history" | "settings";

type WizardState = {
  mode: LocalPromptWizardMode;
  source?: Prompt;
  query: string;
};

type DetectedInput = {
  type: string;
  label: string;
  terms: string[];
  confidence: string;
};

const navItems: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "library", label: "ライブラリ", icon: "▤" },
  { id: "history", label: "履歴", icon: "↺" },
  { id: "settings", label: "設定", icon: "⚙" }
];

const intentChoices = [
  ["arrange", "整える"],
  ["think", "考える"],
  ["research", "調べる"],
  ["create", "作る"],
  ["compare", "比べる"],
  ["inspect", "点検する"],
  ["improve", "改善する"],
  ["convert", "変換する"]
] as const;

const outputLabels: Record<string, string> = {
  body: "完成文",
  analysis: "分析",
  outline: "構成案",
  minutes: "議事録",
  agenda: "アジェンダ",
  email: "メール",
  ideas: "企画案",
  concept: "コンセプト",
  "action-plan": "実行計画",
  checklist: "チェックリスト",
  explanation: "解説",
  comparison: "比較表",
  "case-list": "事例一覧",
  "verification-plan": "確認計画",
  "press-release": "リリース",
  newsletter: "メルマガ",
  "social-posts": "SNS案",
  "risk-review": "点検結果",
  tsv: "TSV",
  requirements: "要件定義",
  "code-review": "コードレビュー",
  "slide-outline": "スライド構成",
  "image-prompt": "画像指示",
  lesson: "教材"
};

const aiTargets: Record<AiTarget, { label: string; url: string }> = {
  chatgpt: { label: "ChatGPTで使う", url: "https://chatgpt.com/" },
  claude: { label: "Claudeで使う", url: "https://claude.ai/new" }
};

function detectInput(value: string): DetectedInput {
  const text = value.trim();
  if (!text) return { type: "", label: "未判定", terms: [], confidence: "" };

  const urlCount = (text.match(/https?:\/\/\S+/g) ?? []).length;
  const meetingHits = (text.match(/会議|打ち合わせ|ミーティング|議題|決定事項|担当|期限|参加者|発言/g) ?? []).length;
  const codeHits = (text.match(/\b(function|const|let|class|import|export|return)\b|=>|<\/?[a-z][^>]*>|[{;}]/g) ?? []).length;
  const tableHits = (text.match(/\t|,.*,|\d+(?:\.\d+)?%|\d{1,3}(?:,\d{3})+/g) ?? []).length;
  const bulletHits = (text.match(/^[・●\-*]\s?/gm) ?? []).length;

  if (codeHits >= 4) return { type: "code", label: "コード", terms: ["コード", "レビュー", "実装"], confidence: "コード記号を検出" };
  if (meetingHits >= 2) return { type: "meeting-log", label: "会議メモ", terms: ["会議", "決定事項", "担当", "期限"], confidence: "会議表現を検出" };
  if (tableHits >= 3) return { type: "data", label: "数値・表", terms: ["表", "データ", "分析", "TSV"], confidence: "表・数値を検出" };
  if (urlCount > 0 && text.length < 400) return { type: "url", label: "URL", terms: ["URL", "調査", "要約"], confidence: "URLを検出" };
  if (bulletHits >= 3) return { type: "memo", label: "箇条書きメモ", terms: ["メモ", "整理", "構成"], confidence: "箇条書きを検出" };
  if (text.length >= 500) return { type: "text", label: "長文", terms: ["文章", "要約", "構成", "短くする"], confidence: "長文を検出" };
  return { type: "text", label: "文章", terms: ["文章", "整える"], confidence: "文章として判定" };
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

function buildSettings(prompt: Prompt, values: Record<string, string>, modifiers: string[]): PromptSettings {
  const optionalValues = Object.fromEntries(
    prompt.optionalInputs
      .filter((field) => field.type === "select")
      .map((field) => [field.id, values[field.id]?.trim() ?? ""])
      .filter(([, value]) => value)
  );
  return { modifiers, optionalValues };
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

function sanitizeBackup(input: unknown): PersonalSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const source = raw.state && typeof raw.state === "object" ? raw.state as Record<string, unknown> : raw;
  const defaults = createDefaultSnapshot();
  const localPrompts = Array.isArray(source.localPrompts)
    ? source.localPrompts.flatMap((item) => {
        const parsed = promptSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const history = Array.isArray(source.history)
    ? source.history.filter((item): item is UsageEntry => {
        if (!item || typeof item !== "object") return false;
        const entry = item as Record<string, unknown>;
        return typeof entry.promptId === "string" && typeof entry.copiedAt === "string";
      }).slice(0, 50)
    : [];
  const rawPrefs = source.prefs && typeof source.prefs === "object" ? source.prefs as Record<string, unknown> : {};

  return {
    ...defaults,
    usage: source.usage && typeof source.usage === "object" ? source.usage as PersonalSnapshot["usage"] : {},
    favorites: Array.isArray(source.favorites) ? source.favorites.filter((item): item is string => typeof item === "string") : [],
    history,
    lastSettings: source.lastSettings && typeof source.lastSettings === "object" ? source.lastSettings as PersonalSnapshot["lastSettings"] : {},
    recentQueries: Array.isArray(source.recentQueries) ? source.recentQueries.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    localPrompts,
    prefs: {
      theme: rawPrefs.theme === "dark" ? "dark" : rawPrefs.theme === "light" ? "light" : "auto",
      lastAi: rawPrefs.lastAi === "claude" ? "claude" : "chatgpt"
    }
  };
}

function Field({ field, value, onChange, required }: { field: InputField; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="pl-field">
      <span>{field.label}{required && <b> 必須</b>}</span>
      {field.type === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">指定なし</option>
          {field.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} rows={required ? 8 : 4} />
      ) : (
        <input type={field.type === "url" ? "url" : field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      )}
    </label>
  );
}

export default function ProductApp() {
  const [{ catalog, error }, setCatalogState] = useState<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [intent, setIntent] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copySheetOpen, setCopySheetOpen] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const usage = useAppStore((state) => state.usage);
  const favorites = useAppStore((state) => state.favorites);
  const history = useAppStore((state) => state.history);
  const lastSettings = useAppStore((state) => state.lastSettings);
  const recentQueries = useAppStore((state) => state.recentQueries);
  const localPrompts = useAppStore((state) => state.localPrompts);
  const prefs = useAppStore((state) => state.prefs);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const recordCopy = useAppStore((state) => state.recordCopy);
  const addRecentQuery = useAppStore((state) => state.addRecentQuery);
  const upsertLocalPrompt = useAppStore((state) => state.upsertLocalPrompt);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLastAi = useAppStore((state) => state.setLastAi);
  const replacePersonalData = useAppStore((state) => state.replacePersonalData);
  const clearPersonalData = useAppStore((state) => state.clearPersonalData);
  const archivedCount = useLocalLifecycleStore((state) => state.archivedPrompts.length);
  const migratedCount = useLocalLifecycleStore((state) => state.migrations.length);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}catalog.json`, { signal: controller.signal, cache: "no-store" })
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
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, []);

  const resolvedTheme = prefs.theme === "auto" ? (systemDark ? "dark" : "light") : prefs.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const allPrompts = useMemo(() => {
    const localIds = new Set(localPrompts.map((prompt) => prompt.id));
    return [...localPrompts, ...(catalog?.prompts.filter((prompt) => !localIds.has(prompt.id)) ?? [])];
  }, [catalog, localPrompts]);
  const localIds = useMemo(() => new Set(localPrompts.map((prompt) => prompt.id)), [localPrompts]);
  const categoryMap = useMemo(() => new Map(catalog?.dictionaries.categories.map((category) => [category.slug, category]) ?? []), [catalog]);
  const modifierMap = useMemo(() => new Map(catalog?.modifiers.map((modifier) => [modifier.id, modifier]) ?? []), [catalog]);
  const detected = useMemo(() => detectInput(pasteText), [pasteText]);

  const rankedPrompts = useMemo(() => {
    if (!catalog) return [];
    const combinedQuery = [query.trim(), analysisRequested ? detected.terms.join(" ") : ""].filter(Boolean).join(" ");
    return allPrompts
      .map((prompt) => {
        const baseScore = combinedQuery ? scorePrompt(combinedQuery, prompt, catalog.dictionaries.synonyms) : prompt.mobilePriority * 0.02;
        const typeBoost = detected.type && prompt.inputTypes.includes(detected.type) ? 0.22 : 0;
        const intentBoost = intent && prompt.intents.includes(intent) ? 0.16 : 0;
        const usageBoost = Math.min(0.16, Math.log2((usage[prompt.id]?.copyCount ?? 0) + 1) * 0.04);
        const favoriteBoost = favorites.includes(prompt.id) ? 0.12 : 0;
        return { prompt, score: baseScore + typeBoost + intentBoost + usageBoost + favoriteBoost };
      })
      .sort((left, right) => right.score - left.score || right.prompt.mobilePriority - left.prompt.mobilePriority);
  }, [allPrompts, analysisRequested, catalog, detected, favorites, intent, query, usage]);

  const quickPrompts = useMemo(() => [...allPrompts]
    .sort((left, right) => Number(favorites.includes(right.id)) - Number(favorites.includes(left.id))
      || (usage[right.id]?.copyCount ?? 0) - (usage[left.id]?.copyCount ?? 0)
      || right.mobilePriority - left.mobilePriority)
    .slice(0, 4), [allPrompts, favorites, usage]);

  const favoritePrompts = allPrompts.filter((prompt) => favorites.includes(prompt.id));
  const historyItems = history
    .map((entry) => ({ entry, prompt: allPrompts.find((prompt) => prompt.id === entry.promptId) }))
    .filter((item): item is { entry: UsageEntry; prompt: Prompt } => Boolean(item.prompt));

  const finalPrompt = useMemo(() => {
    if (!selectedPrompt) return "";
    const base = renderTemplate(selectedPrompt, values);
    const order: Modifier["slot"][] = ["stance", "scope", "audience", "output", "process"];
    const additions = selectedModifiers
      .map((id) => modifierMap.get(id))
      .filter((modifier): modifier is Modifier => Boolean(modifier))
      .sort((left, right) => order.indexOf(left.slot) - order.indexOf(right.slot))
      .map((modifier) => modifier.text.trim());
    return [base, ...additions].filter(Boolean).join("\n\n");
  }, [modifierMap, selectedModifiers, selectedPrompt, values]);

  function flash(message: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2500);
  }

  function openPrompt(prompt: Prompt, override?: PromptSettings) {
    const saved = override ?? lastSettings[prompt.id];
    const nextValues: Record<string, string> = { ...(saved?.optionalValues ?? {}) };
    if (pasteText.trim() && prompt.requiredInputs[0]) nextValues[prompt.requiredInputs[0].id] = pasteText.trim();
    setValues(nextValues);
    setSelectedModifiers(saved?.modifiers.filter((id) => modifierMap.has(id)) ?? []);
    setSelectedPrompt(prompt);
    setPreviewOpen(false);
    setCopySheetOpen(false);
    if (query.trim()) addRecentQuery(query);
  }

  function toggleModifier(modifier: Modifier) {
    setSelectedModifiers((current) => {
      if (current.includes(modifier.id)) return current.filter((id) => id !== modifier.id);
      const withoutConflicts = current.filter((id) => !modifier.conflictsWith.includes(id) && !modifierMap.get(id)?.conflictsWith.includes(modifier.id));
      return [...withoutConflicts, modifier.id];
    });
  }

  function copyPrompt() {
    if (!selectedPrompt) return;
    const missing = selectedPrompt.requiredInputs.find((field) => !values[field.id]?.trim());
    if (missing) {
      flash(`「${missing.label}」を入力してください`);
      return;
    }
    const onSuccess = () => {
      recordCopy(selectedPrompt.id, buildSettings(selectedPrompt, values, selectedModifiers));
      setCopySheetOpen(true);
      if ("vibrate" in navigator) navigator.vibrate(10);
      flash("コピーしました");
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(finalPrompt).then(onSuccess).catch(() => fallbackCopy(finalPrompt) ? onSuccess() : flash("コピーできませんでした"));
    } else if (fallbackCopy(finalPrompt)) onSuccess();
    else flash("コピーできませんでした");
  }

  function openAi(target: AiTarget) {
    setLastAi(target);
    window.open(aiTargets[target].url, "_blank", "noopener,noreferrer");
    setCopySheetOpen(false);
  }

  function openWizard(mode: LocalPromptWizardMode = "create", source?: Prompt, initialQuery = "") {
    setWizardState({ mode, source, query: initialQuery });
  }

  function saveLocalPrompt(prompt: Prompt) {
    upsertLocalPrompt(prompt);
    setWizardState(null);
    setTab("library");
    openPrompt(prompt);
    flash("自作プロンプトを保存しました");
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
      const snapshot = sanitizeBackup(JSON.parse(await file.text()));
      if (!snapshot) throw new Error("invalid");
      replacePersonalData(snapshot);
      flash("バックアップを読み込みました");
    } catch {
      flash("読み込めないファイルです");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  function PromptCard({ prompt, compact = false }: { prompt: Prompt; compact?: boolean }) {
    const category = categoryMap.get(prompt.category);
    const copyCount = usage[prompt.id]?.copyCount ?? 0;
    const inputLabel = prompt.requiredInputs[0]?.label ?? "入力なし";
    const outputLabel = outputLabels[prompt.outputTypes[0] ?? ""] ?? "成果物";
    return (
      <article className={`pl-tool-card ${compact ? "is-compact" : ""}`}>
        <div className="pl-tool-accent" style={{ background: category?.color ?? "#2563EB" }} />
        <div className="pl-tool-icon" aria-hidden="true">{prompt.emoji}</div>
        <div className="pl-tool-copy">
          <div className="pl-tool-heading">
            <div><p className="pl-kicker">{category?.label ?? prompt.category}{localIds.has(prompt.id) ? " ・ 端末内" : ""}</p><h3>{prompt.title}</h3></div>
            <button type="button" className="pl-icon-button" aria-label={favorites.includes(prompt.id) ? "お気に入りから外す" : "お気に入りに追加"} onClick={() => toggleFavorite(prompt.id)}>{favorites.includes(prompt.id) ? "★" : "☆"}</button>
          </div>
          {!compact && <p className="pl-tool-summary">{prompt.summary}</p>}
          <div className="pl-tool-meta"><span>渡す: {inputLabel}</span><span>返る: {outputLabel}</span>{copyCount > 0 && <span>{copyCount}回使用</span>}</div>
          <button type="button" className="pl-primary small" onClick={() => openPrompt(prompt)}>この道具を使う</button>
        </div>
      </article>
    );
  }

  if (managerOpen) return <LocalPromptLifecycleManager onClose={() => setManagerOpen(false)} />;
  if (wizardState && catalog) return <LocalPromptWizard catalog={catalog} existingPrompts={allPrompts} initialQuery={wizardState.query} initialPrompt={wizardState.source} mode={wizardState.mode} onCancel={() => setWizardState(null)} onSave={saveLocalPrompt} />;

  if (selectedPrompt) {
    const compatible = selectedPrompt.compatibleModifiers.map((id) => modifierMap.get(id)).filter((modifier): modifier is Modifier => Boolean(modifier));
    const targetOrder: AiTarget[] = prefs.lastAi === "claude" ? ["claude", "chatgpt"] : ["chatgpt", "claude"];
    return (
      <div className="pl-app">
        <header className="pl-detail-header">
          <button type="button" className="pl-back" onClick={() => setSelectedPrompt(null)}>← 戻る</button>
          <button type="button" className="pl-icon-button" aria-label={favorites.includes(selectedPrompt.id) ? "お気に入りから外す" : "お気に入りに追加"} onClick={() => toggleFavorite(selectedPrompt.id)}>{favorites.includes(selectedPrompt.id) ? "★" : "☆"}</button>
        </header>
        <main className="pl-detail">
          <div className="pl-detail-title"><span>{selectedPrompt.emoji}</span><div><p className="pl-kicker">{categoryMap.get(selectedPrompt.category)?.label}</p><h1>{selectedPrompt.title}</h1></div></div>
          <p className="pl-lead">{selectedPrompt.summary}</p>
          {selectedPrompt.requiredInputs.map((field) => <Field key={field.id} field={field} value={values[field.id] ?? ""} required onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}
          {compatible.length > 0 && <section className="pl-section"><div className="pl-section-heading"><h2>仕上がりを調整</h2><span>複数選択可</span></div><div className="pl-chip-row">{compatible.map((modifier) => <button key={modifier.id} type="button" className={`pl-chip ${selectedModifiers.includes(modifier.id) ? "active" : ""}`} onClick={() => toggleModifier(modifier)}>{modifier.emoji} {modifier.title}</button>)}</div></section>}
          {selectedPrompt.optionalInputs.length > 0 && <details className="pl-details"><summary>詳細設定</summary><div className="pl-details-body">{selectedPrompt.optionalInputs.map((field) => <Field key={field.id} field={field} value={values[field.id] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}</div></details>}
          <button type="button" className="pl-preview-toggle" onClick={() => setPreviewOpen((current) => !current)}>{previewOpen ? "プレビューを閉じる" : "生成されるプロンプトを確認"}</button>
          {previewOpen && <pre className="pl-preview">{finalPrompt}</pre>}
        </main>
        <div className="pl-copy-dock"><button type="button" className="pl-primary large" onClick={copyPrompt}>プロンプトをコピー</button></div>
        {copySheetOpen && <div className="pl-sheet-backdrop" onClick={() => setCopySheetOpen(false)}><section className="pl-sheet" role="dialog" aria-modal="true" aria-labelledby="copy-sheet-title" onClick={(event) => event.stopPropagation()}><div className="pl-sheet-handle" /><h2 id="copy-sheet-title">コピー完了。どこで使う？</h2>{targetOrder.map((target) => <button key={target} type="button" className="pl-sheet-button" onClick={() => openAi(target)}>{aiTargets[target].label} <span>↗</span></button>)}<button type="button" className="pl-sheet-close" onClick={() => setCopySheetOpen(false)}>閉じる</button></section></div>}
        {toast && <div className="pl-toast" role="status">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="pl-app">
      <header className="pl-brand-header"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" /><div><p>Prompt Launcher</p><strong>仕事を、すぐAIへ。</strong></div><span className="pl-catalog-count">{allPrompts.length || "—"} tools</span></header>
      <main className="pl-main">
        {tab === "home" && <>
          <section className="pl-hero"><p className="pl-eyebrow">PASTE FIRST</p><h1>何を任せる？</h1><p>文章、会議メモ、URL、コード。雑なまま貼れば、合う道具を3つに絞ります。</p><label className="pl-paste-box"><span className="sr-only">材料を貼り付け</span><textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setAnalysisRequested(false); }} placeholder="ここにそのまま貼り付け" rows={7} />{pasteText && <span className="pl-detection">{detected.label} ・ {detected.confidence}</span>}</label><div className="pl-hero-actions"><button type="button" className="pl-primary" disabled={!pasteText.trim()} onClick={() => setAnalysisRequested(true)}>おすすめを見る</button>{pasteText && <button type="button" className="pl-secondary" onClick={() => { setPasteText(""); setAnalysisRequested(false); }}>消す</button>}</div></section>
          <section className="pl-search-panel"><label className="pl-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：メルマガにしたい、厳しく見て" aria-label="プロンプトを検索" />{query && <button type="button" aria-label="検索語を消す" onClick={() => setQuery("")}>×</button>}</label><details className="pl-filter-details"><summary>目的で絞る</summary><div className="pl-chip-row">{intentChoices.map(([id, label]) => <button key={id} type="button" className={`pl-chip ${intent === id ? "active" : ""}`} onClick={() => setIntent(intent === id ? "" : id)}>{label}</button>)}</div></details></section>
          {error && <section className="pl-error"><strong>カタログを読み込めませんでした</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>再読み込み</button></section>}
          <section className="pl-section"><div className="pl-section-heading"><div><p className="pl-kicker">{analysisRequested || query || intent ? "MATCHED FOR YOU" : "START HERE"}</p><h2>{analysisRequested ? "この材料に合う3つ" : query || intent ? "検索結果" : "すぐ使う"}</h2></div><span>{rankedPrompts.length ? `上位${Math.min(analysisRequested ? 3 : 5, rankedPrompts.length)}件` : ""}</span></div><div className="pl-card-list">{(analysisRequested ? rankedPrompts.slice(0, 3) : query || intent ? rankedPrompts.slice(0, 5) : quickPrompts.map((prompt) => ({ prompt, score: 0 }))).map(({ prompt }) => <PromptCard key={prompt.id} prompt={prompt} />)}</div>{(analysisRequested || query) && rankedPrompts.length === 0 && <button type="button" className="pl-empty-action" onClick={() => openWizard("create", undefined, query || detected.terms.join(" "))}>この用途で自作プロンプトを作る</button>}</section>
          {!query && !analysisRequested && recentQueries.length > 0 && <section className="pl-section"><div className="pl-section-heading"><h2>最近の検索</h2></div><div className="pl-chip-row">{recentQueries.slice(0, 6).map((recent) => <button key={recent} type="button" className="pl-chip" onClick={() => setQuery(recent)}>{recent}</button>)}</div></section>}
        </>}

        {tab === "library" && <><section className="pl-page-title"><p className="pl-eyebrow">YOUR LIBRARY</p><h1>ライブラリ</h1><p>よく使う道具と、自分で育てている道具をまとめます。</p></section><section className="pl-library-actions"><button type="button" className="pl-primary" onClick={() => openWizard("create")}>＋ 自作プロンプト</button><button type="button" className="pl-secondary" onClick={() => setManagerOpen(true)}>整理・アーカイブ・移行</button><p>アーカイブ {archivedCount}件 ・ 移行済み {migratedCount}件</p></section><section className="pl-section"><div className="pl-section-heading"><h2>お気に入り</h2><span>{favoritePrompts.length}件</span></div><div className="pl-card-list">{favoritePrompts.length ? favoritePrompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} compact />) : <p className="pl-empty">カードの☆を押すと、ここへ集まります。</p>}</div></section><section className="pl-section"><div className="pl-section-heading"><h2>端末内の自作</h2><span>{localPrompts.length}件</span></div><div className="pl-card-list">{localPrompts.length ? localPrompts.map((prompt) => <div key={prompt.id}><PromptCard prompt={prompt} compact /><div className="pl-inline-actions"><button type="button" onClick={() => openWizard("edit", prompt)}>編集</button><button type="button" onClick={() => openWizard("duplicate", prompt)}>複製</button></div></div>) : <p className="pl-empty">まだ自作プロンプトはありません。</p>}</div></section></>}

        {tab === "history" && <><section className="pl-page-title"><p className="pl-eyebrow">RECENT WORK</p><h1>履歴</h1><p>貼り付けた本文は保存せず、使った道具と選択条件だけを残します。</p></section><div className="pl-history-list">{historyItems.length ? historyItems.map(({ entry, prompt }, index) => <button key={`${entry.copiedAt}-${index}`} type="button" className="pl-history-item" onClick={() => openPrompt(prompt, entry)}><span>{prompt.emoji}</span><div><strong>{prompt.title}</strong><small>{new Date(entry.copiedAt).toLocaleString("ja-JP")}</small></div><b>同じ条件で →</b></button>) : <p className="pl-empty">まだ履歴はありません。</p>}</div></>}

        {tab === "settings" && <><section className="pl-page-title"><p className="pl-eyebrow">SETTINGS</p><h1>設定</h1><p>表示と端末内データを管理します。</p></section><section className="pl-stat-grid"><div><span>コピー</span><strong>{Object.values(usage).reduce((sum, item) => sum + item.copyCount, 0)}</strong></div><div><span>お気に入り</span><strong>{favorites.length}</strong></div><div><span>自作</span><strong>{localPrompts.length}</strong></div></section><section className="pl-settings-card"><h2>表示テーマ</h2><div className="pl-segmented">{(["auto", "light", "dark"] as ThemeMode[]).map((mode) => <button key={mode} type="button" className={prefs.theme === mode ? "active" : ""} onClick={() => setTheme(mode)}>{mode === "auto" ? "自動" : mode === "light" ? "明るい" : "暗い"}</button>)}</div></section><section className="pl-settings-card"><h2>データ</h2><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); }} /><button type="button" className="pl-settings-button" onClick={exportData}>バックアップを書き出す</button><button type="button" className="pl-settings-button" onClick={() => importRef.current?.click()}>バックアップを読み込む</button><button type="button" className="pl-settings-button danger" onClick={() => { if (window.confirm("端末内の個人データを削除しますか？")) clearPersonalData(); }}>個人データを削除</button></section><section className="pl-settings-card"><h2>不具合時</h2><p>画面が古い、ボタンが反応しない場合は最新版を再取得します。</p><button type="button" className="pl-settings-button" onClick={async () => { const registrations = await navigator.serviceWorker?.getRegistrations(); await Promise.all((registrations ?? []).map((registration) => registration.update())); window.location.reload(); }}>最新版を再読み込み</button></section></>}
      </main>
      <nav className="pl-bottom-nav" aria-label="メインナビゲーション">{navItems.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      {toast && <div className="pl-toast" role="status">{toast}</div>}
    </div>
  );
}
