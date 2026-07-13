import type { Prompt } from "../schema/catalog";

interface PromptCardProps {
  prompt: Prompt;
  categoryLabel: string;
  categoryColor: string;
}

export function PromptCard({ prompt, categoryLabel, categoryColor }: PromptCardProps) {
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 shadow-tool"
      style={{ borderLeftColor: categoryColor, borderLeftWidth: 4 }}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-800 text-2xl"
        >
          {prompt.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-bold leading-6 text-white">{prompt.shortTitle}</h3>
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-300">
              {categoryLabel}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{prompt.summary}</p>
        </div>
      </div>
    </article>
  );
}
