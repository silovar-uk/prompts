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
type LibraryMode = "all" | "favorites" | "image" | "local";
type WizardState = { mode: LocalPromptWizardMode; source?: Prompt; query: string };

type DetectedInput = {
  type: string;
  label: string;
  terms: string[];
};

const navItems: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home", label: "検索", icon: "⌕" },
  { id: "library", label: "一覧", icon: "☷" },
  { id: "history", label: "履歴", icon: "↺" },
  { id: "settings", label: "設定", icon: "⚙" }
];

const intentChoices = [
  ["arrange", "整える"],
  ["think", "考える"],
  ["research", "調べる"],
  ["create", "作る"],
  ["compare", "比べる"],
  ["inspect", "点検"],
  ["improve", "改善"],
  ["convert", "変換"]
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
  json: "JSON",
  text: "テンプレート",
  lesson: "教材"
};

const aiTargets: Record<AiTarget, { label: string; url: string }> = {
  chatgpt: { label: "ChatGPTで使う", url: "https://chatgpt.com/" },
  claude: { label: "Claudeで使う", url: "https://claude.ai/new" }
};

function detectInput(value: string): DetectedInput {
  const text = value.trim();
  if (!text) return { type: "", label: "", terms: [] };
  const urlCount = (text.match(/https?:\/\/\S+/g) ?? []).length;
  const meetingHits = (text.match(/会議|打ち合わせ|ミーティング|議題|決定事項|担当|期限|参加者|発言/g) ?? []).length;
  const codeHits = (text.match(/\b(function|const|let|class|import|export|return)\b|=>|<\/?[a-z][^>]*>|[{;}]/g) ?? []).length;
  const tableHits = (text.match(/\t|,.*,|\d+(?:\.\d+)?%|\d{1,3}(?:,\d{3})+/g) ?? []).length;
  const bulletHits = (text.match(/^[・●\-*]\s?/gm) ?? []).length;
  if (codeHits >= 4) return { type: "code", label: "コード", terms: ["コード", "レビュー", "実装"] };
  if (meetingHits >= 2) return { type: "meeting-log", label: "会議メモ", terms: ["会議", "決定事項", "担当", "期限"] };
  if (tableHits >= 3) return { type: "data", label: "数値・表", terms: ["表", "データ", "分析", "TSV"] };
  if (urlCount > 0 && text.length < 400) return { type: "url", label: "URL", terms: ["URL", "調査", "要約"] };
  if (bulletHits >= 3) return { type: "memo", label: "箇条書き", terms: ["メモ", "整理", "構成"] };
  if (text.length >= 500) return { type: "text", label: "長文", terms: ["文章", "要約", "構成", "短くする"] };
  return { type: "text", label: "文章", terms: ["文章", "整える"] };
}

function renderTemplate(prompt: Prompt, values: Record<string, string>): string {
  let output = prompt.promptTemplate;
  for (const field of prompt.optionalInputs) {
    const value = values[field.id]?.trim() ?? "";
    const pattern = new RegExp(`{{#${field.id}}}([\\s\\S]*?){{\\/${field.id}}}`, "g");
    output = output.replace(pattern, (_match, body: string) => value ? body.replaceAll(`{{${field.id}}}`, value) : "");
  }
  for (const field of prompt.requiredInputs) {
    output = output.replaceAll(`{{${field.id}}}`, values[field.id]?.trim() ?? "");
  }
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function buildSettings(prompt: Prompt, values: Record<string, string>, modifiers: string[]): PromptSettings {
  return {
    modifiers,
    optionalValues: Object.fromEntries(
      prompt.optionalInputs
        .filter((field) => field.type === "select")
        .map((field) => [field.id, values[field.id]?.trim() ?? ""])
        .filter(([, value]) => Boolean(value))
    )
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
    <label className="lf-field">
      <span>{field.label}{required && <b>必須</b>}</span>
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

export default function LibraryFirstApp() {
  const [{ catalog, error }, setCatalogState] = useState<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("");
  const [imageOnly, setImageOnly] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteRequested, setPasteRequested] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("all");
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
  const imageCount = useMemo(() => allPrompts.filter((prompt) => prompt.category === "image").length, [allPrompts]);
  const categoryMap = useMemo(() => new Map(catalog?.dictionaries.categories.map((category) => [category.slug, category]) ?? []), [catalog]);
  const modifierMap = useMemo(() => new Map(catalog?.modifiers.map((modifier) => [modifier.id, modifier]) ?? []), [catalog]);
  const detected = useMemo(() => detectInput(pasteText), [pasteText]);

  const homeResults = useMemo(() => {
    if (!catalog) return [];
    const combinedQuery = [query.trim(), pasteRequested ? detected.terms.join(" ") : ""].filter(Boolean).join(" ");
    const source = imageOnly ? allPrompts.filter((prompt) => prompt.category === "image") : allPrompts;
    return source
      .map((prompt) => {
        const base = combinedQuery ? scorePrompt(combinedQuery, prompt, catalog.dictionaries.synonyms) : 0;
        const typeBoost = pasteRequested && detected.type && prompt.inputTypes.includes(detected.type) ? 0.25 : 0;
        const intentBoost = intent && prompt.intents.includes(intent) ? 0.18 : 0;
        const favoriteBoost = favorites.includes(prompt.id) ? 0.12 : 0;
        const usageBoost = Math.min(0.16, Math.log2((usage[prompt.id]?.copyCount ?? 0) + 1) * 0.04);
        return { prompt, score: base + typeBoost + intentBoost + favoriteBoost + usageBoost };
      })
      .filter(({ score }) => !combinedQuery || score > 0.015)
      .sort((left, right) => right.score - left.score
        || Number(favorites.includes(right.prompt.id)) - Number(favorites.includes(left.prompt.id))
        || (usage[right.prompt.id]?.copyCount ?? 0) - (usage[left.prompt.id]?.copyCount ?? 0)
        || right.prompt.mobilePriority - left.prompt.mobilePriority)
      .slice(0, pasteRequested ? 3 : query || intent || imageOnly ? 12 : 8);
  }, [allPrompts, catalog, detected, favorites, imageOnly, intent, pasteRequested, query, usage]);

  const libraryResults = useMemo(() => {
    if (!catalog) return [];
    const source = libraryMode === "favorites"
      ? allPrompts.filter((prompt) => favorites.includes(prompt.id))
      : libraryMode === "image"
        ? allPrompts.filter((prompt) => prompt.category === "image")
        : libraryMode === "local"
          ? localPrompts
          : allPrompts;
    if (libraryQuery.trim()) {
      return source
        .map((prompt) => ({ prompt, score: scorePrompt(libraryQuery, prompt, catalog.dictionaries.synonyms) }))
        .filter(({ score }) => score > 0.015)
        .sort((left, right) => right.score - left.score || left.prompt.title.localeCompare(right.prompt.title, "ja"))
        .map(({ prompt }) => prompt);
    }
    return [...source].sort((left, right) =>
      Number(favorites.includes(right.id)) - Number(favorites.includes(left.id))
      || (usage[right.id]?.copyCount ?? 0) - (usage[left.id]?.copyCount ?? 0)
      || right.mobilePriority - left.mobilePriority
      || left.title.localeCompare(right.title, "ja")
    );
  }, [allPrompts, catalog, favorites, libraryMode, libraryQuery, localPrompts, usage]);

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
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  function handleFavorite(prompt: Prompt) {
    const adding = !favorites.includes(prompt.id);
    toggleFavorite(prompt.id);
    flash(adding ? "お気に入りに追加しました" : "お気に入りから外しました");
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
    setLibraryMode("local");
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

  function PromptRow({ prompt, showSummary = false, allowEdit = false }: { prompt: Prompt; showSummary?: boolean; allowEdit?: boolean }) {
    const category = categoryMap.get(prompt.category);
    const copyCount = usage[prompt.id]?.copyCount ?? 0;
    const outputLabel = outputLabels[prompt.outputTypes[0] ?? ""] ?? "成果物";
    const isFavorite = favorites.includes(prompt.id);
    return (
      <div className="lf-row-wrap">
        <article className={`lf-prompt-row ${prompt.category === "image" ? "is-image" : ""}`}>
          <button type="button" className="lf-row-main" onClick={() => openPrompt(prompt)}>
            <span className="lf-row-icon" aria-hidden="true">{prompt.emoji}</span>
            <span className="lf-row-copy">
              <span className="lf-row-title">{prompt.title}</span>
              {showSummary && <span className="lf-row-summary">{prompt.summary}</span>}
              <span className="lf-row-meta">
                <span>{category?.label ?? prompt.category}</span>
                <span>{outputLabel}</span>
                {localIds.has(prompt.id) && <span>自作</span>}
                {copyCount > 0 && <span>{copyCount}回</span>}
              </span>
            </span>
            <span className="lf-row-arrow" aria-hidden="true">›</span>
          </button>
          <button type="button" className={`lf-favorite ${isFavorite ? "active" : ""}`} aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに追加"} onClick={() => handleFavorite(prompt)}>{isFavorite ? "★" : "☆"}</button>
        </article>
        {allowEdit && localIds.has(prompt.id) && (
          <div className="lf-row-tools">
            <button type="button" onClick={() => openWizard("edit", prompt)}>編集</button>
            <button type="button" onClick={() => openWizard("duplicate", prompt)}>複製</button>
          </div>
        )}
      </div>
    );
  }

  if (managerOpen) return <LocalPromptLifecycleManager onClose={() => setManagerOpen(false)} />;
  if (wizardState && catalog) return <LocalPromptWizard catalog={catalog} existingPrompts={allPrompts} initialQuery={wizardState.query} initialPrompt={wizardState.source} mode={wizardState.mode} onCancel={() => setWizardState(null)} onSave={saveLocalPrompt} />;

  if (selectedPrompt) {
    const compatible = selectedPrompt.compatibleModifiers.map((id) => modifierMap.get(id)).filter((modifier): modifier is Modifier => Boolean(modifier));
    const targetOrder: AiTarget[] = prefs.lastAi === "claude" ? ["claude", "chatgpt"] : ["chatgpt", "claude"];
    return (
      <div className="lf-app">
        <header className="lf-detail-header">
          <button type="button" className="lf-back" onClick={() => setSelectedPrompt(null)}>← 戻る</button>
          <button type="button" className={`lf-favorite ${favorites.includes(selectedPrompt.id) ? "active" : ""}`} aria-label={favorites.includes(selectedPrompt.id) ? "お気に入りから外す" : "お気に入りに追加"} onClick={() => handleFavorite(selectedPrompt)}>{favorites.includes(selectedPrompt.id) ? "★" : "☆"}</button>
        </header>
        <main className="lf-detail">
          <div className="lf-detail-title"><span>{selectedPrompt.emoji}</span><div><small>{categoryMap.get(selectedPrompt.category)?.label}</small><h1>{selectedPrompt.title}</h1></div></div>
          <p className="lf-detail-lead">{selectedPrompt.summary}</p>
          {selectedPrompt.requiredInputs.map((field) => <Field key={field.id} field={field} value={values[field.id] ?? ""} required onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}
          {compatible.length > 0 && <section className="lf-detail-section"><h2>仕上がりを調整</h2><div className="lf-chip-row">{compatible.map((modifier) => <button key={modifier.id} type="button" className={selectedModifiers.includes(modifier.id) ? "active" : ""} onClick={() => toggleModifier(modifier)}>{modifier.emoji} {modifier.title}</button>)}</div></section>}
          {selectedPrompt.optionalInputs.length > 0 && <details className="lf-details"><summary>詳細設定</summary>{selectedPrompt.optionalInputs.map((field) => <Field key={field.id} field={field} value={values[field.id] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}</details>}
          <button type="button" className="lf-preview-toggle" onClick={() => setPreviewOpen((current) => !current)}>{previewOpen ? "プレビューを閉じる" : "生成内容を確認"}</button>
          {previewOpen && <pre className="lf-preview">{finalPrompt}</pre>}
        </main>
        <div className="lf-copy-dock"><button type="button" onClick={copyPrompt}>プロンプトをコピー</button></div>
        {copySheetOpen && <div className="lf-sheet-backdrop" onClick={() => setCopySheetOpen(false)}><section className="lf-sheet" role="dialog" aria-modal="true" aria-labelledby="lf-copy-title" onClick={(event) => event.stopPropagation()}><div className="lf-sheet-handle" /><h2 id="lf-copy-title">コピー完了</h2>{targetOrder.map((target) => <button key={target} type="button" onClick={() => openAi(target)}>{aiTargets[target].label}<span>↗</span></button>)}<button type="button" className="lf-sheet-close" onClick={() => setCopySheetOpen(false)}>閉じる</button></section></div>}
        {toast && <div className="lf-toast" role="status">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="lf-app">
      <header className="lf-header">
        <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" />
        <div><strong>Prompts</strong><span>{allPrompts.length || "—"}件</span></div>
        <button type="button" onClick={() => { setTab("library"); setLibraryMode("all"); }}>一覧を見る</button>
      </header>

      <main className="lf-main">
        {tab === "home" && <>
          <section className="lf-home-search">
            <h1>何をしたい？</h1>
            <label className="lf-search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：画像を作る、文章を短く、会議を整理" aria-label="プロンプトを検索" />{query && <button type="button" aria-label="検索語を消す" onClick={() => setQuery("")}>×</button>}</label>
            <div className="lf-intent-strip">
              <button type="button" className={`lf-image-filter ${imageOnly ? "active" : ""}`} onClick={() => { setImageOnly((current) => !current); setIntent(""); }}>🖼️ 画像生成</button>
              {intentChoices.map(([id, label]) => <button key={id} type="button" className={intent === id ? "active" : ""} onClick={() => { setIntent(intent === id ? "" : id); setImageOnly(false); }}>{label}</button>)}
            </div>
          </section>

          {recentQueries.length > 0 && !query && !intent && !imageOnly && <div className="lf-recent-strip"><span>最近</span>{recentQueries.slice(0, 4).map((recent) => <button key={recent} type="button" onClick={() => setQuery(recent)}>{recent}</button>)}</div>}

          {error && <section className="lf-error"><strong>カタログを読み込めませんでした</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>再読み込み</button></section>}

          <section className="lf-list-section">
            <div className="lf-section-head"><h2>{pasteRequested ? "この材料に合う候補" : imageOnly ? "画像生成プロンプト" : query || intent ? "検索結果" : "すぐ使う"}</h2><span>{homeResults.length}件</span></div>
            <div className="lf-prompt-list">{homeResults.map(({ prompt }) => <PromptRow key={prompt.id} prompt={prompt} showSummary={Boolean(query || pasteRequested)} />)}</div>
            {query && homeResults.length === 0 && <button type="button" className="lf-empty-action" onClick={() => openWizard("create", undefined, query)}>この用途で自作する</button>}
          </section>

          <details className="lf-paste-helper">
            <summary>文章・メモを貼って候補を出す</summary>
            <textarea value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPasteRequested(false); }} placeholder="文章、会議メモ、URL、コードを貼り付け" rows={5} />
            <div><span>{detected.label || "未判定"}</span><button type="button" disabled={!pasteText.trim()} onClick={() => setPasteRequested(true)}>候補を出す</button></div>
          </details>
        </>}

        {tab === "library" && <>
          <section className="lf-library-head">
            <div><h1>ライブラリ</h1><p>検索して、一覧からすぐ開く。</p></div>
            <button type="button" onClick={() => openWizard("create")}>＋ 自作</button>
          </section>
          <label className="lf-search-box lf-library-search"><span aria-hidden="true">⌕</span><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="タイトル・用途・検索語で絞り込む" aria-label="ライブラリを検索" />{libraryQuery && <button type="button" aria-label="ライブラリ検索を消す" onClick={() => setLibraryQuery("")}>×</button>}</label>
          <div className="lf-library-tabs">
            <button type="button" className={libraryMode === "all" ? "active" : ""} onClick={() => setLibraryMode("all")}>すべて <b>{allPrompts.length}</b></button>
            <button type="button" className={libraryMode === "image" ? "active" : ""} onClick={() => setLibraryMode("image")}>画像生成 <b>{imageCount}</b></button>
            <button type="button" className={libraryMode === "favorites" ? "active" : ""} onClick={() => setLibraryMode("favorites")}>お気に入り <b>{favorites.length}</b></button>
            <button type="button" className={libraryMode === "local" ? "active" : ""} onClick={() => setLibraryMode("local")}>自作 <b>{localPrompts.length}</b></button>
          </div>
          <div className="lf-library-meta"><span>{libraryResults.length}件を表示</span><button type="button" onClick={() => setManagerOpen(true)}>整理・アーカイブ・移行</button></div>
          <div className="lf-prompt-list lf-library-list">{libraryResults.map((prompt) => <PromptRow key={prompt.id} prompt={prompt} allowEdit={libraryMode === "local"} />)}</div>
          {!libraryResults.length && <p className="lf-empty">該当するプロンプトはありません。</p>}
          <p className="lf-lifecycle-note">アーカイブ {archivedCount}件・移行済み {migratedCount}件</p>
        </>}

        {tab === "history" && <>
          <section className="lf-page-head"><h1>履歴</h1><p>使った道具と条件だけを保存します。</p></section>
          <div className="lf-history-list">{historyItems.length ? historyItems.map(({ entry, prompt }, index) => <button key={`${entry.copiedAt}-${index}`} type="button" onClick={() => openPrompt(prompt, entry)}><span>{prompt.emoji}</span><div><strong>{prompt.title}</strong><small>{new Date(entry.copiedAt).toLocaleString("ja-JP")}</small></div><b>›</b></button>) : <p className="lf-empty">まだ履歴はありません。</p>}</div>
        </>}

        {tab === "settings" && <>
          <section className="lf-page-head"><h1>設定</h1><p>表示と端末内データ。</p></section>
          <section className="lf-stat-line"><span>コピー <b>{Object.values(usage).reduce((sum, item) => sum + item.copyCount, 0)}</b></span><span>お気に入り <b>{favorites.length}</b></span><span>自作 <b>{localPrompts.length}</b></span></section>
          <section className="lf-settings-card"><h2>表示テーマ</h2><div className="lf-theme-tabs">{(["auto", "light", "dark"] as ThemeMode[]).map((mode) => <button key={mode} type="button" className={prefs.theme === mode ? "active" : ""} onClick={() => setTheme(mode)}>{mode === "auto" ? "自動" : mode === "light" ? "明るい" : "暗い"}</button>)}</div></section>
          <section className="lf-settings-card"><h2>データ</h2><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importData(file); }} /><button type="button" onClick={exportData}>バックアップを書き出す</button><button type="button" onClick={() => importRef.current?.click()}>バックアップを読み込む</button><button type="button" className="danger" onClick={() => { if (window.confirm("端末内の個人データを削除しますか？")) clearPersonalData(); }}>個人データを削除</button></section>
          <section className="lf-settings-card"><h2>表示がおかしいとき</h2><button type="button" onClick={async () => { const registrations = await navigator.serviceWorker?.getRegistrations(); await Promise.all((registrations ?? []).map((registration) => registration.update())); window.location.reload(); }}>最新版を再読み込み</button></section>
        </>}
      </main>

      <nav className="lf-bottom-nav" aria-label="メインナビゲーション">{navItems.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      {toast && <div className="lf-toast" role="status">{toast}</div>}
    </div>
  );
}
