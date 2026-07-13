import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "./schema/catalog";
import { catalogSchema } from "./schema/catalog";
import { PromptCard } from "./components/PromptCard";

interface LoadState {
  catalog: Catalog | null;
  error: string | null;
}

const navItems = [
  { emoji: "🔍", label: "探す" },
  { emoji: "⭐", label: "よく使う" },
  { emoji: "🕘", label: "履歴" },
  { emoji: "⚙️", label: "設定" }
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

export default function App() {
  const [{ catalog, error }, setLoadState] = useState<LoadState>({ catalog: null, error: null });

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

  const categories = useMemo(
    () => new Map(catalog?.dictionaries.categories.map((item) => [item.slug, item]) ?? []),
    [catalog]
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950/80 text-zinc-50">
      <div className="h-1 w-full bg-reds-500" />
      <main className="safe-top flex-1 px-4 pb-28">
        <header className="pt-2">
          <p className="text-sm font-semibold text-zinc-400">{greeting()} 👋</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Prompt Launcher</h1>
              <p className="mt-1 text-sm leading-6 text-zinc-400">仕事を始める道具箱、基盤工事まで完了。</p>
            </div>
            <span className="rounded-full bg-reds-500 px-3 py-1.5 text-xs font-black text-white">
              Phase 0
            </span>
          </div>
        </header>

        <section aria-labelledby="status-title" className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-xl" aria-hidden="true">
              🧰
            </div>
            <div>
              <h2 id="status-title" className="font-bold text-white">基盤ステータス</h2>
              {error ? (
                <p role="alert" className="mt-1 text-sm leading-6 text-amber-300">
                  カタログを読み込めませんでした：{error}
                </p>
              ) : catalog ? (
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {catalog.prompts.length}件のシードと{catalog.modifiers.length}件の追加条件を検証済み。
                </p>
              ) : (
                <p className="mt-1 text-sm leading-6 text-zinc-400">カタログを検証しています…</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["PWA", "準備済み"],
              ["JSON", "CI検証"],
              ["Pages", "自動公開"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-zinc-950 px-2 py-3">
                <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
                <div className="mt-1 text-xs font-bold text-zinc-200">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="seed-title" className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-reds-500">Seed catalog</p>
              <h2 id="seed-title" className="mt-1 text-lg font-black text-white">最初の道具</h2>
            </div>
            <span className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400">検索はPhase A1</span>
          </div>
          <div className="space-y-3">
            {catalog?.prompts.map((prompt) => {
              const category = categories.get(prompt.category);
              return (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  categoryLabel={category?.label ?? prompt.category}
                  categoryColor={category?.color ?? "#E6002D"}
                />
              );
            })}
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-dashed border-zinc-700 p-5 text-sm leading-6 text-zinc-400">
          <strong className="text-zinc-200">次の契約点：</strong>
          スキーマv1に沿った上位30件が入ると、検索→フォーム→コピーのコア体験へ進みます。
        </section>
      </main>

      <nav
        aria-label="メインナビゲーション"
        className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 px-2 pt-2 backdrop-blur"
      >
        <div className="grid grid-cols-4">
          {navItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-current={index === 0 ? "page" : undefined}
              className={`min-h-14 rounded-xl px-1 py-1 text-xs font-semibold ${
                index === 0 ? "bg-reds-500 text-white" : "text-zinc-500"
              }`}
            >
              <span className="block text-lg" aria-hidden="true">{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
