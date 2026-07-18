import { useEffect, useMemo, useState } from "react";
import type { Catalog, Prompt } from "./schema/catalog";
import { catalogSchema } from "./schema/catalog";
import { scorePrompt } from "./search/core";
import { useAppStore, type ThemeMode } from "./store/appStore";

type View = "home" | "library" | "shelf";
type Filter = "all" | string;

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
  text: "文章",
  lesson: "教材"
};

function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function referenceHref(prompt: Prompt, use = false, resume = false): string {
  const params = new URLSearchParams();
  if (use) params.set("use", "1");
  if (resume) params.set("resume", "1");
  const suffix = params.size ? `?${params.toString()}` : "";
  return `${import.meta.env.BASE_URL}p/${prompt.id}/${suffix}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric" }).format(new Date(value));
}

function uniquePrompts(prompts: Array<Prompt | undefined>): Prompt[] {
  const seen = new Set<string>();
  return prompts.flatMap((prompt) => {
    if (!prompt || seen.has(prompt.id)) return [];
    seen.add(prompt.id);
    return [prompt];
  });
}

export default function ReferenceLibraryApp() {
  const [{ catalog, error }, setCatalogState] = useState<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const usage = useAppStore((state) => state.usage);
  const history = useAppStore((state) => state.history);
  const lastSettings = useAppStore((state) => state.lastSettings);
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

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("rl-motion", !reduced);
  }, []);

  const categoryMap = useMemo(
    () => new Map(catalog?.dictionaries.categories.map((category) => [category.slug, category]) ?? []),
    [catalog]
  );

  const promptMap = useMemo(
    () => new Map(catalog?.prompts.map((prompt) => [prompt.id, prompt]) ?? []),
    [catalog]
  );

  const categories = useMemo(() => {
    if (!catalog) return [];
    const image = catalog.dictionaries.categories.find((category) => category.slug === "image");
    const others = catalog.dictionaries.categories.filter((category) => category.slug !== "image");
    return image ? [...others, image] : others;
  }, [catalog]);

  const searchResults = useMemo(() => {
    if (!catalog || !query.trim()) return [];
    return catalog.prompts
      .filter((prompt) => filter === "all" || prompt.category === filter)
      .map((prompt) => ({ prompt, score: scorePrompt(query, prompt, catalog.dictionaries.synonyms) }))
      .filter(({ score }) => score > 0.015)
      .sort((left, right) => right.score - left.score || right.prompt.mobilePriority - left.prompt.mobilePriority)
      .map(({ prompt }) => prompt);
  }, [catalog, filter, query]);

  const libraryResults = useMemo(() => {
    if (!catalog) return [];
    return catalog.prompts
      .filter((prompt) => filter === "all" || prompt.category === filter)
      .sort((left, right) =>
        right.mobilePriority - left.mobilePriority
        || right.updatedAt.localeCompare(left.updatedAt)
        || left.title.localeCompare(right.title, "ja")
      );
  }, [catalog, filter]);

  const favoritePrompts = useMemo(
    () => favorites.flatMap((id) => promptMap.get(id) ?? []),
    [favorites, promptMap]
  );

  const recentPrompts = useMemo(
    () => uniquePrompts(history.map((entry) => promptMap.get(entry.promptId))).slice(0, 6),
    [history, promptMap]
  );

  const topPrompts = useMemo(
    () => Object.entries(usage)
      .sort(([, left], [, right]) => right.copyCount - left.copyCount)
      .map(([id]) => promptMap.get(id))
      .filter((prompt): prompt is Prompt => Boolean(prompt))
      .slice(0, 6),
    [promptMap, usage]
  );

  const quickPrompts = useMemo(
    () => uniquePrompts([...favoritePrompts, ...recentPrompts, ...topPrompts]).slice(0, 5),
    [favoritePrompts, recentPrompts, topPrompts]
  );

  const updatedPrompts = useMemo(
    () => [...(catalog?.prompts ?? [])]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 4),
    [catalog]
  );

  const hasPersonalShelf = favoritePrompts.length > 0 || recentPrompts.length > 0;
  const isSearching = Boolean(query.trim());

  function changeView(next: View) {
    setView(next);
    setQuery("");
    if (next === "home") setFilter("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function quickReason(prompt: Prompt): string {
    if (favorites.includes(prompt.id)) return "マイ棚";
    if (recentPrompts.some((item) => item.id === prompt.id)) return "最近使った";
    return `よく使う・${usage[prompt.id]?.copyCount ?? 0}回`;
  }

  function renderRow(prompt: Prompt, index = 0) {
    const isFavorite = favorites.includes(prompt.id);
    const category = categoryMap.get(prompt.category);
    const output = outputLabels[prompt.outputTypes[0] ?? ""] ?? prompt.outputTypes[0] ?? "成果物";
    return (
      <article
        className="rl-row rl-search-result"
        key={prompt.id}
        style={{ animationDelay: `${Math.min(index, 7) * 42}ms` }}
      >
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
          aria-label={isFavorite ? `${prompt.title}をマイ棚から外す` : `${prompt.title}をマイ棚へ追加`}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(prompt.id)}
        >{isFavorite ? "★" : "☆"}</button>
      </article>
    );
  }

  function renderQuickCard(prompt: Prompt) {
    const resume = Boolean(lastSettings[prompt.id]);
    return (
      <a className="rl-quick-card" href={referenceHref(prompt, true, resume)} key={prompt.id}>
        <span className="rl-quick-card__reason">{quickReason(prompt)}</span>
        <span className="rl-quick-card__icon" aria-hidden="true">{prompt.emoji}</span>
        <strong>{prompt.shortTitle}</strong>
        <small>{resume ? "前回条件で開く" : "すぐ使う"} →</small>
      </a>
    );
  }

  return (
    <div className="rl-app">
      <header className="rl-header">
        <button type="button" className="rl-brand" onClick={() => changeView("home")}>
          <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" />
          <span><strong>Prompts</strong><small>{catalog?.prompts.length ?? "—"}件</small></span>
        </button>
        <nav aria-label="メインナビゲーション">
          <button type="button" className={view === "library" ? "active" : ""} onClick={() => changeView("library")}>ライブラリ</button>
          <button type="button" className={`rl-shelf-button ${view === "shelf" ? "active" : ""}`} onClick={() => changeView("shelf")}>
            <span>★ マイ棚</span><b>{favorites.length}</b>
          </button>
        </nav>
      </header>

      <main className="rl-main">
        {view !== "shelf" && (
          <section className={`rl-task ${view === "library" ? "rl-task--compact" : ""}`}>
            {view === "home" && (
              <div className="rl-task__intro">
                <p className="rl-kicker">PROMPT LAUNCHER + LIBRARY</p>
                <h1>今日は、<br />何をしますか？</h1>
                <p>雑な依頼のままで大丈夫。近い道具を探し、内容を確かめ、そのまま使えます。</p>
                <div className="rl-flow" aria-label="利用の流れ">
                  <span>探す</span><i aria-hidden="true"></i><span>選ぶ</span><i aria-hidden="true"></i><span>使う</span>
                </div>
              </div>
            )}

            <div className="rl-search-area" aria-label="プロンプト検索">
              {view === "library" && <div className="rl-section-label"><small>LIBRARY</small><h1>プロンプトを一覧から探す</h1></div>}
              <label className="rl-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例：会議の決定事項を整理したい"
                  aria-label="やりたいことからプロンプトを検索"
                />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="検索語を消す">×</button>}
              </label>

              {(view === "library" || isSearching) && (
                <div className="rl-filters" aria-label="カテゴリで絞り込む">
                  <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>すべて</button>
                  {categories.map((category) => (
                    <button key={category.slug} type="button" className={filter === category.slug ? "active" : ""} onClick={() => setFilter(category.slug)}>
                      {category.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {error && (
          <section className="rl-error">
            <strong>プロンプトを読み込めませんでした</strong>
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
          </section>
        )}

        {view !== "shelf" && isSearching && (
          <section className="rl-results rl-view" aria-live="polite">
            <div className="rl-results-head">
              <div>
                <small>SEARCH RESULTS</small>
                <h2>「{query}」に近いプロンプト</h2>
                <p>合う理由は要約と、返ってくる成果物で判断できます。</p>
              </div>
              <b>{searchResults.length}件</b>
            </div>
            <div className="rl-list">{searchResults.map((prompt, index) => renderRow(prompt, index))}</div>
            {!error && catalog && searchResults.length === 0 && (
              <div className="rl-empty">
                <p>近いプロンプトが見つかりませんでした。</p>
                <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>検索をやり直す</button>
              </div>
            )}
          </section>
        )}

        {view === "home" && !isSearching && (
          <div className="rl-view">
            <section className="rl-quick-section">
              <div className="rl-results-head">
                <div>
                  <small>QUICK START</small>
                  <h2>すぐ使う</h2>
                  <p>固定、最近、利用回数から、戻りやすい道具をまとめます。</p>
                </div>
                {hasPersonalShelf && <button type="button" className="rl-text-button" onClick={() => changeView("shelf")}>マイ棚を見る →</button>}
              </div>
              {quickPrompts.length > 0 ? (
                <div className="rl-quick-grid">{quickPrompts.map(renderQuickCard)}</div>
              ) : (
                <div className="rl-onboarding">
                  <span aria-hidden="true">☆</span>
                  <div><strong>よく使う道具は、ここへ戻せます。</strong><p>一覧の☆を押すとマイ棚へ固定。使ったプロンプトも次回ここに現れます。</p></div>
                </div>
              )}
            </section>

            <div className="rl-home-grid">
              <section className="rl-category-section">
                <div className="rl-results-head">
                  <div><small>BROWSE BY PURPOSE</small><h2>目的から探す</h2></div>
                  <button type="button" className="rl-text-button" onClick={() => changeView("library")}>全件を見る →</button>
                </div>
                <div className="rl-category-grid">
                  {categories.map((category, index) => (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => { setFilter(category.slug); setView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <span>{category.label}</span>
                      <small>{catalog?.prompts.filter((prompt) => prompt.category === category.slug).length ?? 0}件</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rl-updated-section">
                <div className="rl-results-head"><div><small>RECENTLY UPDATED</small><h2>最近追加・更新</h2></div></div>
                <div className="rl-updated-list">
                  {updatedPrompts.map((prompt) => (
                    <a href={referenceHref(prompt)} key={prompt.id}>
                      <span>{prompt.emoji}</span>
                      <strong>{prompt.shortTitle}</strong>
                      <small>{formatDate(prompt.updatedAt)}</small>
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <section className="rl-howto">
              <div>
                <small>HANDOFF</small>
                <h2>選んだら、そのままAIへ渡す。</h2>
                <p>個別ページで入力を加え、実行用テキストをコピー。ChatGPTやClaudeを開くところまでつなぎます。</p>
              </div>
              <div className="rl-handoff-demo" aria-hidden="true">
                <span>プロンプト</span><i></i><span>入力</span><i></i><strong>AIへ</strong>
              </div>
            </section>
          </div>
        )}

        {view === "library" && !isSearching && (
          <section className="rl-results rl-view" aria-live="polite">
            <div className="rl-results-head">
              <div><small>ALL PROMPTS</small><h2>{filter === "all" ? "すべてのプロンプト" : categoryMap.get(filter)?.label ?? "プロンプト"}</h2><p>タイトルを押すと、説明と使用画面を開きます。</p></div>
              <b>{libraryResults.length}件</b>
            </div>
            <div className="rl-list">{libraryResults.map((prompt, index) => renderRow(prompt, index))}</div>
          </section>
        )}

        {view === "shelf" && (
          <section className="rl-shelf rl-view">
            <div className="rl-shelf-hero">
              <div><small>MY SHELF</small><h1>戻ってきた道具</h1><p>固定したもの、最近使ったもの、利用回数の多いものを分けて置いています。</p></div>
              <button type="button" onClick={() => changeView("home")}>新しく探す →</button>
            </div>

            <section className="rl-shelf-group">
              <div className="rl-results-head"><div><small>PINNED</small><h2>固定したプロンプト</h2></div><b>{favoritePrompts.length}件</b></div>
              {favoritePrompts.length > 0 ? <div className="rl-quick-grid">{favoritePrompts.map(renderQuickCard)}</div> : <div className="rl-empty"><p>まだ固定したプロンプトはありません。ライブラリの☆から追加できます。</p></div>}
            </section>

            <section className="rl-shelf-group">
              <div className="rl-results-head"><div><small>RECENT</small><h2>最近使った</h2><p>前回保存した条件があれば、その状態で開きます。</p></div></div>
              {recentPrompts.length > 0 ? <div className="rl-list">{recentPrompts.map((prompt, index) => renderRow(prompt, index))}</div> : <div className="rl-empty"><p>利用履歴はまだありません。</p></div>}
            </section>

            {topPrompts.length > 0 && (
              <section className="rl-shelf-group">
                <div className="rl-results-head"><div><small>MOST USED</small><h2>よく使う</h2></div></div>
                <div className="rl-ranking">
                  {topPrompts.map((prompt, index) => (
                    <a href={referenceHref(prompt, true, Boolean(lastSettings[prompt.id]))} key={prompt.id}>
                      <b>{index + 1}</b><span>{prompt.emoji}</span><strong>{prompt.title}</strong><small>{usage[prompt.id]?.copyCount ?? 0}回</small>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

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
        <a href={`${import.meta.env.BASE_URL}prompts.md`}>Markdown</a>
        <a href={`${import.meta.env.BASE_URL}reference-catalog.json`}>JSON</a>
        <a href={`${import.meta.env.BASE_URL}sitemap.xml`}>Sitemap</a>
        <span>探し、確かめ、使い、また戻る。</span>
      </footer>
    </div>
  );
}
