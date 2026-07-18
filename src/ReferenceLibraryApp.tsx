import { useEffect, useMemo, useState } from "react";
import type { Catalog, Prompt } from "./schema/catalog";
import { catalogSchema } from "./schema/catalog";
import { scorePrompt } from "./search/core";
import { useAppStore, type ThemeMode } from "./store/appStore";

type Filter = "all" | "favorites" | string;

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
  "press-release": "プレスリリース",
  newsletter: "メルマガ原稿",
  "social-posts": "SNS投稿案",
  "risk-review": "点検結果",
  tsv: "TSV",
  requirements: "要件定義",
  "code-review": "コードレビュー",
  "slide-outline": "スライド構成",
  "image-prompt": "画像生成プロンプト",
  json: "JSON",
  lesson: "教材"
};

function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function referenceHref(prompt: Prompt): string {
  return `${import.meta.env.BASE_URL}p/${prompt.id}/`;
}

export default function ReferenceLibraryApp() {
  const [{ catalog, error }, setCatalogState] = useState<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const prefs = useAppStore((state) => state.prefs);
  const setTheme = useAppStore((state) => state.setTheme);

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
    const applyTheme = () => {
      const resolved = resolveTheme(prefs.theme);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    applyTheme();
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media || prefs.theme !== "auto") return;
    media.addEventListener?.("change", applyTheme);
    return () => media.removeEventListener?.("change", applyTheme);
  }, [prefs.theme]);

  const categoryMap = useMemo(
    () => new Map(catalog?.dictionaries.categories.map((category) => [category.slug, category]) ?? []),
    [catalog]
  );

  const results = useMemo(() => {
    if (!catalog) return [];
    const byFilter = catalog.prompts.filter((prompt) => {
      if (filter === "favorites") return favorites.includes(prompt.id);
      if (filter === "all") return true;
      return prompt.category === filter;
    });

    if (query.trim()) {
      return byFilter
        .map((prompt) => ({ prompt, score: scorePrompt(query, prompt, catalog.dictionaries.synonyms) }))
        .filter(({ score }) => score > 0.015)
        .sort((left, right) => right.score - left.score || right.prompt.mobilePriority - left.prompt.mobilePriority)
        .map(({ prompt }) => prompt);
    }

    return [...byFilter].sort((left, right) =>
      Number(favorites.includes(right.id)) - Number(favorites.includes(left.id))
      || right.mobilePriority - left.mobilePriority
      || right.updatedAt.localeCompare(left.updatedAt)
      || left.title.localeCompare(right.title, "ja")
    );
  }, [catalog, favorites, filter, query]);

  const imageCategory = catalog?.dictionaries.categories.find((category) => category.slug === "image");
  const remainingCategories = catalog?.dictionaries.categories.filter((category) => category.slug !== "image") ?? [];

  return (
    <div className="rl-app">
      <header className="rl-header">
        <a className="rl-brand" href={import.meta.env.BASE_URL}>
          <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" />
          <span><strong>Prompts</strong><small>{catalog?.prompts.length ?? "—"}件</small></span>
        </a>
        <nav aria-label="資料">
          <a href={`${import.meta.env.BASE_URL}prompts.md`}>Markdown一覧</a>
          <a href={`${import.meta.env.BASE_URL}llms.txt`}>AI向け案内</a>
        </nav>
      </header>

      <main className="rl-main">
        <section className="rl-intro">
          <p className="rl-kicker">SHARED PROMPT REFERENCE</p>
          <h1>人が読んで選び、<br />AIにURLで渡す。</h1>
          <p>用途と必要な材料を確認して個別ページを開き、そのページをAIに読ませて使うプロンプト集です。</p>
          <ol>
            <li><b>1</b><span>検索して選ぶ</span></li>
            <li><b>2</b><span>説明を読む</span></li>
            <li><b>3</b><span>URLをAIへ渡す</span></li>
          </ol>
        </section>

        <section className="rl-search-area" aria-label="プロンプト検索">
          <label className="rl-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例：画像生成、会議の決定、文章を短く"
              aria-label="プロンプトを検索"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="検索語を消す">×</button>}
          </label>

          <div className="rl-filters" aria-label="カテゴリで絞り込む">
            <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>すべて</button>
            {imageCategory && <button type="button" className={filter === imageCategory.slug ? "active image" : "image"} onClick={() => setFilter(imageCategory.slug)}>🖼️ {imageCategory.label}</button>}
            <button type="button" className={filter === "favorites" ? "active" : ""} onClick={() => setFilter("favorites")}>★ お気に入り</button>
            {remainingCategories.map((category) => (
              <button key={category.slug} type="button" className={filter === category.slug ? "active" : ""} onClick={() => setFilter(category.slug)}>{category.label}</button>
            ))}
          </div>
        </section>

        {error && (
          <section className="rl-error">
            <strong>プロンプトを読み込めませんでした</strong>
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
          </section>
        )}

        <section className="rl-results" aria-live="polite">
          <div className="rl-results-head">
            <div>
              <h2>{query ? "検索結果" : filter === "favorites" ? "お気に入り" : filter === "all" ? "すべてのプロンプト" : categoryMap.get(filter)?.label ?? "プロンプト"}</h2>
              <p>タイトルを押すと、人向けの説明とAI向け実行仕様を開きます。</p>
            </div>
            <b>{results.length}件</b>
          </div>

          <div className="rl-list">
            {results.map((prompt) => {
              const isFavorite = favorites.includes(prompt.id);
              const category = categoryMap.get(prompt.category);
              const output = outputLabels[prompt.outputTypes[0] ?? ""] ?? prompt.outputTypes[0] ?? "成果物";
              return (
                <article className="rl-row" key={prompt.id}>
                  <a href={referenceHref(prompt)} className="rl-row-main">
                    <span className="rl-row-icon" aria-hidden="true">{prompt.emoji}</span>
                    <span className="rl-row-copy">
                      <strong>{prompt.title}</strong>
                      <span className="rl-row-summary">{prompt.summary}</span>
                      <span className="rl-row-meta">
                        <code>{prompt.id}@{prompt.version}</code>
                        <span>{category?.label ?? prompt.category}</span>
                        <span>返るもの：{output}</span>
                      </span>
                    </span>
                    <span className="rl-row-arrow" aria-hidden="true">›</span>
                  </a>
                  <button
                    type="button"
                    className={`rl-favorite ${isFavorite ? "active" : ""}`}
                    aria-label={isFavorite ? `${prompt.title}をお気に入りから外す` : `${prompt.title}をお気に入りに追加`}
                    onClick={() => toggleFavorite(prompt.id)}
                  >{isFavorite ? "★" : "☆"}</button>
                </article>
              );
            })}
          </div>

          {!error && catalog && results.length === 0 && (
            <div className="rl-empty">
              <p>該当するプロンプトはありません。</p>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>絞り込みを解除</button>
            </div>
          )}
        </section>

        <section className="rl-about">
          <div>
            <h2>AIへの渡し方</h2>
            <p>個別ページ上部の「AIへの指示をコピー」を押し、ChatGPTやClaudeなどへ貼ります。その後に対象資料を送ります。</p>
          </div>
          <pre>次のURLを読み、ページに記載された<br />AI向け実行仕様に従ってください。</pre>
        </section>

        <section className="rl-footer-tools">
          <span>表示</span>
          {(["auto", "light", "dark"] as ThemeMode[]).map((mode) => (
            <button key={mode} type="button" className={prefs.theme === mode ? "active" : ""} onClick={() => setTheme(mode)}>
              {mode === "auto" ? "自動" : mode === "light" ? "明るい" : "暗い"}
            </button>
          ))}
        </section>
      </main>

      <footer className="rl-footer">
        <a href={`${import.meta.env.BASE_URL}reference-catalog.json`}>JSON</a>
        <a href={`${import.meta.env.BASE_URL}sitemap.xml`}>Sitemap</a>
        <span>人が読んで選び、AIが読んで実行する。</span>
      </footer>
    </div>
  );
}
