import { useMemo, useRef, useState } from "react";
import type { Catalog, Prompt } from "../schema/catalog";
import { buildLocalPrompt, githubNewFileUrl, type LocalPromptDraft } from "../local/createLocalPrompt";

interface LocalPromptWizardProps {
  catalog: Catalog;
  initialQuery?: string;
  onCancel: () => void;
  onSave: (prompt: Prompt) => void;
}

const inputChoices = [
  ["text", "文章"],
  ["memo", "メモ"],
  ["meeting-log", "会議ログ"],
  ["url", "URL"],
  ["image", "画像"],
  ["data", "データ"],
  ["code", "コード"],
  ["none", "材料なし"]
] as const;

export function LocalPromptWizard({ catalog, initialQuery = "", onCancel, onSave }: LocalPromptWizardProps) {
  const stableId = useRef(`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<LocalPromptDraft>({
    title: initialQuery.slice(0, 60),
    emoji: "🧰",
    summary: initialQuery,
    instruction: "",
    category: catalog.dictionaries.categories[0]?.slug ?? "writing",
    intent: catalog.dictionaries.intents[0]?.slug ?? "create",
    inputType: "text",
    inputLabel: "対象の内容",
    searchWords: initialQuery
  });

  const prompt = useMemo(
    () => buildLocalPrompt(draft, catalog.modifiers.map((modifier) => modifier.id), stableId.current),
    [catalog.modifiers, draft]
  );

  function update<K extends keyof LocalPromptDraft>(key: K, value: LocalPromptDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function canContinue(): boolean {
    if (step === 1) return draft.title.trim().length >= 2 && draft.summary.trim().length >= 2;
    if (step === 2) return draft.instruction.trim().length >= 10;
    return true;
  }

  function next() {
    if (!canContinue()) {
      setMessage(step === 1 ? "名前と用途を入力してください" : "AIへの指示をもう少し具体的にしてください");
      return;
    }
    setMessage("");
    setStep((current) => Math.min(3, current + 1));
  }

  async function copyJson() {
    const text = `${JSON.stringify(prompt, null, 2)}\n`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("正式登録用JSONをコピーしました");
    } catch {
      setMessage("JSONをコピーできませんでした");
    }
  }

  function saveAndUse() {
    onSave(prompt);
  }

  function saveAndOpenGitHub() {
    onSave(prompt);
    window.open(githubNewFileUrl(prompt), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-zinc-950 text-zinc-50">
      <header className="safe-top sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 backdrop-blur">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-2 text-sm font-bold text-zinc-300">← 閉じる</button>
          <span className="text-xs font-black text-zinc-500">{step} / 3</span>
        </div>
        <h1 className="text-xl font-black">自分用プロンプトを追加</h1>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="入力ステップ">
          {[1, 2, 3].map((item) => <span key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-reds-500" : "bg-zinc-800"}`} />)}
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-5">
        {step === 1 && (
          <section className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-reds-500">Step 1</p>
              <h2 className="mt-1 text-lg font-black">どんな道具にする？</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">あとで検索したとき、一目で用途が分かる名前にします。</p>
            </div>
            <label className="block text-sm font-bold text-zinc-300">名前
              <input autoFocus value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="例：企画の弱点を洗い出す" maxLength={60} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-white placeholder:text-zinc-600" />
            </label>
            <label className="block text-sm font-bold text-zinc-300">何に使う？
              <textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="例：企画メモから、実現性・集客力・リスクを確認する" rows={4} maxLength={160} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-base leading-7 text-white placeholder:text-zinc-600" />
            </label>
            <label className="block text-sm font-bold text-zinc-300">絵文字
              <input value={draft.emoji} onChange={(event) => update("emoji", event.target.value)} maxLength={8} className="mt-2 min-h-12 w-24 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-center text-xl text-white" />
            </label>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-reds-500">Step 2</p>
              <h2 className="mt-1 text-lg font-black">AIに何をしてほしい？</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">役割や形式を全部書かなくても大丈夫。仕事の核心を文章にします。</p>
            </div>
            <label className="block text-sm font-bold text-zinc-300">AIへの指示
              <textarea autoFocus value={draft.instruction} onChange={(event) => update("instruction", event.target.value)} placeholder="例：企画の前提を疑い、弱点と根拠を率直に指摘したうえで、実行可能な改善案を出してください。" rows={7} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-base leading-7 text-white placeholder:text-zinc-600" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-bold text-zinc-300">カテゴリ
                <select value={draft.category} onChange={(event) => update("category", event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white">
                  {catalog.dictionaries.categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-zinc-300">主な目的
                <select value={draft.intent} onChange={(event) => update("intent", event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white">
                  {[...catalog.dictionaries.intents].sort((a, b) => a.order - b.order).map((intent) => <option key={intent.slug} value={intent.slug}>{intent.label}</option>)}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-bold text-zinc-300">手元にある材料</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {inputChoices.map(([id, label]) => <button key={id} type="button" onClick={() => update("inputType", id)} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${draft.inputType === id ? "border-yellow-400 bg-yellow-400 text-zinc-950" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>{label}</button>)}
              </div>
            </fieldset>
            {draft.inputType !== "none" && <label className="block text-sm font-bold text-zinc-300">入力欄の名前
              <input value={draft.inputLabel} onChange={(event) => update("inputLabel", event.target.value)} placeholder="対象の内容" maxLength={40} className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-base text-white placeholder:text-zinc-600" />
            </label>}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-reds-500">Step 3</p>
              <h2 className="mt-1 text-lg font-black">検索しやすくして保存</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">まず端末内だけに保存されます。使い込んでからGitHubへ正式登録できます。</p>
            </div>
            <label className="block text-sm font-bold text-zinc-300">検索しそうな言葉
              <textarea value={draft.searchWords} onChange={(event) => update("searchWords", event.target.value)} placeholder="企画を厳しく見る、弱点、リスク" rows={3} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-base leading-7 text-white placeholder:text-zinc-600" />
              <span className="mt-1 block text-xs leading-5 text-zinc-500">読点・カンマ・改行で区切れます。不足分は名前と用途から自動生成します。</span>
            </label>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-2xl">{prompt.emoji}</span>
                <div className="min-w-0"><h3 className="font-black">{prompt.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-400">{prompt.summary}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-zinc-400"><span className="rounded-full bg-zinc-800 px-3 py-1">端末内</span><span className="rounded-full bg-zinc-800 px-3 py-1">検索語 {prompt.searchPhrases.length}件</span></div>
            </div>
            <button type="button" onClick={() => void copyJson()} className="min-h-12 w-full rounded-2xl border border-zinc-700 px-4 text-left text-sm font-bold text-zinc-300">📋 正式登録用JSONをコピー</button>
            <button type="button" onClick={saveAndOpenGitHub} className="min-h-12 w-full rounded-2xl border border-zinc-700 px-4 text-left text-sm font-bold text-zinc-300">↗ 端末に保存してGitHubで登録</button>
          </section>
        )}

        {message && <p role="status" className="mt-5 rounded-2xl bg-amber-500/10 p-3 text-sm font-bold text-amber-300">{message}</p>}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => step === 1 ? onCancel() : setStep((current) => current - 1)} className="min-h-14 rounded-2xl border border-zinc-700 text-sm font-black text-zinc-300">{step === 1 ? "キャンセル" : "戻る"}</button>
          {step < 3 ? <button type="button" onClick={next} className="min-h-14 rounded-2xl bg-reds-500 text-sm font-black text-white">次へ</button> : <button type="button" onClick={saveAndUse} className="min-h-14 rounded-2xl bg-reds-500 text-sm font-black text-white">保存して使う</button>}
        </div>
      </div>
    </div>
  );
}
