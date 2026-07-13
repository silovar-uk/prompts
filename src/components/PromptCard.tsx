import type { Prompt } from "../schema/catalog";

interface PromptCardProps {
  prompt: Prompt;
  categoryLabel: string;
  categoryColor: string;
  favorite: boolean;
  copyCount: number;
  isLocal: boolean;
  onToggleFavorite: () => void;
  onUse: () => void;
}

export function PromptCard({
  prompt,
  categoryLabel,
  categoryColor,
  favorite,
  copyCount,
  isLocal,
  onToggleFavorite,
  onUse
}: PromptCardProps) {
  return (
    <article className="tool-card relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/10">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: categoryColor }} />
      <div className="flex items-start gap-3 pl-1">
        <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-2xl">
          {prompt.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-black leading-6 text-white">{prompt.title}</h3>
            <button
              type="button"
              aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加"}
              onClick={onToggleFavorite}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl"
            >
              {favorite ? "⭐" : "☆"}
            </button>
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{prompt.summary}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-zinc-400">
              <span className="rounded-full bg-zinc-800 px-2.5 py-1">{categoryLabel}</span>
              {isLocal && <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-zinc-950">端末内</span>}
              <span className="rounded-full bg-zinc-800 px-2.5 py-1">必要: {prompt.requiredInputs[0]?.label ?? "なし"}</span>
              {copyCount > 0 && <span className="rounded-full bg-zinc-800 px-2.5 py-1">{copyCount}回使用</span>}
            </div>
            <button type="button" onClick={onUse} className="min-h-11 shrink-0 rounded-xl bg-reds-500 px-4 text-sm font-black text-white active:scale-95">
              使う
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
