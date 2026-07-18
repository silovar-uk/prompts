import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { referencePromptSchema, type ReferencePrompt } from "../src/schema/reference.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function replaceUseWhen(content: string, before: string[], after: string[], format: "html" | "markdown"): string {
  let next = content;
  for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
    const oldValue = before[index];
    const newValue = after[index];
    if (format === "html") {
      next = next.replaceAll(`<li>${escapeHtml(oldValue)}</li>`, `<li>${escapeHtml(newValue)}</li>`);
    } else {
      next = next.replaceAll(`- ${oldValue}`, `- ${newValue}`);
    }
  }
  return next;
}

function fixComposerRuntime(html: string): string {
  const broken = "const block=new RegExp('{{#'+key+'}}([\\s\\S]*?){{\\/'+key+'}}','g');text=text.replace(block,(_,body)=>value?body.replaceAll('{{'+key+'}}',value):'');";
  const fixed = "const open='{{#'+key+'}}',close='{{/'+key+'}}';let start;while((start=text.indexOf(open))>=0){const end=text.indexOf(close,start+open.length);if(end<0)break;const body=text.slice(start+open.length,end);text=text.slice(0,start)+(value?body.replaceAll('{{'+key+'}}',value):'')+text.slice(end+close.length)}";
  return html.replace(broken, fixed);
}

const useFlowCss = `
:root{--motion-fast:160ms;--motion-productive:240ms;--motion-expressive:560ms;--motion-ease:cubic-bezier(.2,0,0,1);--gold:#eab33e}
.actions{align-items:center}.actions .use-primary{order:-3;min-height:48px;padding-inline:20px}.actions [data-favorite]{order:-2;color:#795000;border-color:color-mix(in srgb,var(--gold) 55%,var(--line));background:color-mix(in srgb,var(--gold) 16%,var(--paper))}.actions [data-favorite][aria-pressed="true"]{color:#5d3d00;background:color-mix(in srgb,var(--gold) 34%,var(--paper))}
.composer{scroll-margin-top:84px;border-color:color-mix(in srgb,var(--blue) 40%,var(--line));box-shadow:0 16px 38px rgba(24,38,74,.08)}.composer[open]{background:color-mix(in srgb,var(--soft) 26%,var(--paper))}.composer summary{display:flex;align-items:center;justify-content:space-between;gap:16px;list-style:none}.composer summary::-webkit-details-marker{display:none}.composer summary::after{content:"＋";color:var(--blue);font-size:22px}.composer[open] summary::after{content:"−"}.composer .composer-lead{margin:0 0 16px;color:var(--muted);font-size:12px}.composer-body>.primary{min-height:48px}.handoff{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;padding:14px;border-radius:12px;background:#101b35}.handoff strong{grid-column:1/-1;color:#fff;font-size:12px}.handoff a{display:grid;min-height:42px;place-items:center;border-radius:9px;color:#fff;background:#24375f;font-size:12px;font-weight:850;text-decoration:none}.handoff a:hover{background:#315087}
.spec-details{border:1px solid #24375f;border-radius:18px;background:#101b35;color:#edf2ff}.spec-details>summary{display:flex;justify-content:space-between;gap:16px;padding:20px 24px;cursor:pointer;font-weight:900;list-style:none}.spec-details>summary::-webkit-details-marker{display:none}.spec-details>summary span{color:#9cb8ec;font:11px ui-monospace,monospace}.spec-details .spec{border:0;border-top:1px solid #24375f;border-radius:0;background:transparent}.page-toast{position:fixed;z-index:50;right:18px;bottom:18px;max-width:min(360px,calc(100vw - 36px));padding:11px 14px;border:1px solid var(--line);border-radius:11px;color:var(--ink);background:var(--paper);box-shadow:0 12px 30px rgba(0,0,0,.16);font-size:12px;font-weight:850;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity var(--motion-productive),transform var(--motion-productive)}.page-toast.is-visible{opacity:1;transform:translateY(0)}
@media(max-width:640px){.actions .use-primary{width:100%}.handoff{grid-template-columns:1fr}.handoff strong{grid-column:auto}.spec-details>summary{padding:18px}.page-toast{right:12px;bottom:12px}}
@media(prefers-reduced-motion:no-preference){.hero{animation:page-rise var(--motion-expressive) var(--motion-ease) both}.composer.is-opening{animation:composer-enter var(--motion-expressive) var(--motion-ease) both}@keyframes page-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes composer-enter{0%{transform:translateY(14px);box-shadow:0 0 0 rgba(24,38,74,0)}100%{transform:translateY(0);box-shadow:0 16px 38px rgba(24,38,74,.08)}}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
`;

const useFlowScript = `
(()=> {
  const readJson = (id) => {
    const node = document.getElementById(id);
    return node ? JSON.parse(node.textContent || "{}") : {};
  };
  const meta = readJson("prompt-page-meta");
  const storageKey = "prompt-launcher-personal";
  const composer = document.querySelector(".composer");
  const favoriteButton = document.querySelector("[data-favorite]");
  const toast = document.querySelector("[data-page-toast]");
  let toastTimer = 0;

  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  };

  const readPersisted = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const wrapped = parsed && typeof parsed.state === "object";
      const state = wrapped ? parsed.state : parsed;
      return { parsed, state: state && typeof state === "object" ? state : {}, wrapped };
    } catch {
      return { parsed: {}, state: {}, wrapped: false };
    }
  };

  const writeState = (nextState) => {
    try {
      const current = readPersisted();
      const payload = current.wrapped
        ? { ...current.parsed, state: nextState, version: current.parsed.version ?? 1 }
        : { state: nextState, version: 1 };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  };

  const currentValues = () => {
    const values = {};
    document.querySelectorAll("[data-field]").forEach((element) => {
      values[element.dataset.field] = (element.value || "").trim();
    });
    return values;
  };

  const restoreSettings = () => {
    const { state } = readPersisted();
    const values = state.lastSettings?.[meta.id]?.optionalValues || {};
    document.querySelectorAll("[data-field]").forEach((element) => {
      const value = values[element.dataset.field];
      if (typeof value === "string" && value) element.value = value;
    });
  };

  const updateFavoriteButton = () => {
    if (!favoriteButton) return;
    const { state } = readPersisted();
    const active = Array.isArray(state.favorites) && state.favorites.includes(meta.id);
    favoriteButton.setAttribute("aria-pressed", String(active));
    favoriteButton.textContent = active ? "★ マイ棚に保存済み" : "☆ マイ棚へ";
  };

  const toggleFavorite = () => {
    const { state } = readPersisted();
    const favorites = Array.isArray(state.favorites) ? state.favorites.filter((id) => typeof id === "string") : [];
    const active = favorites.includes(meta.id);
    const next = active ? favorites.filter((id) => id !== meta.id) : [meta.id, ...favorites];
    if (writeState({ ...state, schemaVersion: state.schemaVersion ?? 1, favorites: next })) {
      updateFavoriteButton();
      notify(active ? "マイ棚から外しました" : "マイ棚へ追加しました");
    }
  };

  const recordUse = () => {
    const now = new Date().toISOString();
    const { state } = readPersisted();
    const usage = state.usage && typeof state.usage === "object" ? state.usage : {};
    const history = Array.isArray(state.history) ? state.history : [];
    const lastSettings = state.lastSettings && typeof state.lastSettings === "object" ? state.lastSettings : {};
    const settings = { modifiers: [], optionalValues: currentValues() };
    writeState({
      ...state,
      schemaVersion: state.schemaVersion ?? 1,
      usage: {
        ...usage,
        [meta.id]: {
          copyCount: (usage[meta.id]?.copyCount || 0) + 1,
          lastCopiedAt: now
        }
      },
      history: [{ promptId: meta.id, copiedAt: now, ...settings }, ...history].slice(0, 50),
      lastSettings: { ...lastSettings, [meta.id]: settings }
    });
  };

  const openComposer = (focus = true) => {
    if (!composer) return;
    composer.open = true;
    composer.classList.remove("is-opening");
    void composer.offsetWidth;
    composer.classList.add("is-opening");
    restoreSettings();
    composer.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (focus) window.setTimeout(() => composer.querySelector("[data-field]")?.focus(), 420);
  };

  document.querySelector("[data-open-composer]")?.addEventListener("click", () => openComposer());
  favoriteButton?.addEventListener("click", toggleFavorite);

  document.querySelectorAll('[data-copy="reference"],[data-copy="prompt"]').forEach((button) => {
    button.addEventListener("click", () => {
      recordUse();
      notify("コピーしました。AIへ渡せます");
    });
  });

  const copyComposed = document.querySelector("[data-copy-composed]");
  copyComposed?.addEventListener("click", () => {
    recordUse();
    const handoff = document.querySelector("[data-handoff]");
    if (handoff) handoff.hidden = false;
    notify("実行用テキストをコピーしました");
  });

  const params = new URLSearchParams(location.search);
  if (params.get("resume") === "1") restoreSettings();
  if (params.get("use") === "1") requestAnimationFrame(() => openComposer(false));
  updateFavoriteButton();
})();
`;

function enhanceUseFlow(html: string, reference: ReferencePrompt): string {
  let next = html;

  const composerMatch = next.match(/<details class="composer">[\s\S]*?<\/details>/);
  const composer = composerMatch?.[0]
    .replace("このページ内で実行用テキストを作る", "入力して実行用テキストを作る")
    .replace(
      '<div class="composer-body">',
      '<div class="composer-body"><p class="composer-lead">必要な材料や条件を入力し、AIへ渡す実行用テキストを作ります。前回の条件が保存されている場合は復元します。</p>'
    )
    .replace(
      '<button data-copy-composed hidden>作ったテキストをコピー</button>',
      '<button data-copy-composed hidden>作ったテキストをコピー</button><div class="handoff" data-handoff hidden><strong>コピーしました。どこで使う？</strong><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPTで開く</a><a href="https://claude.ai/new" target="_blank" rel="noreferrer">Claudeで開く</a></div>'
    );

  if (composerMatch && composer) {
    next = next.replace(composerMatch[0], "");
    next = next.replace(
      "</div><section><h2>このプロンプトでできること</h2>",
      `</div>${composer}<section><h2>このプロンプトでできること</h2>`
    );
  }

  next = next.replace(
    '<div class="actions"><button class="primary" data-copy="reference">AIへの指示をコピー</button><button data-copy="prompt">プロンプト全文をコピー</button></div>',
    '<div class="actions"><button class="primary use-primary" data-open-composer>このプロンプトを使う</button><button data-favorite aria-pressed="false">☆ マイ棚へ</button><button data-copy="reference">AIへの指示をコピー</button><button data-copy="prompt">全文をコピー</button></div>'
  );

  next = next.replace(
    /<section class="spec">([\s\S]*?)<\/section>/,
    `<details class="spec-details"><summary>AI向け実行仕様を読む <span>${escapeHtml(reference.id)}@${reference.version}</span></summary><section class="spec">$1</section></details>`
  );

  next = next.replace("</style>", `${useFlowCss}</style>`);
  next = next.replace(
    "</body>",
    `<div class="page-toast" data-page-toast role="status" aria-live="polite"></div><script id="prompt-page-meta" type="application/json">${safeJson({ id: reference.id, version: reference.version })}</script><script>${useFlowScript}</script></body>`
  );

  return next;
}

async function polishPageSet(reference: ReferencePrompt, version: number): Promise<ReferencePrompt> {
  const directories = [
    path.join(publicDir, "p", reference.id),
    path.join(publicDir, "p", reference.id, "v", String(version))
  ];
  const cleanUseWhen = reference.searchPhrases.slice(0, 5).map((value) => value.trim()).filter(Boolean);
  const nextReference = referencePromptSchema.parse({
    ...reference,
    humanGuide: { ...reference.humanGuide, useWhen: cleanUseWhen }
  });

  for (const directory of directories) {
    const htmlPath = path.join(directory, "index.html");
    const markdownPath = path.join(directory, "prompt.md");
    const jsonPath = path.join(directory, "prompt.json");
    const [html, markdown] = await Promise.all([
      fs.readFile(htmlPath, "utf8"),
      fs.readFile(markdownPath, "utf8")
    ]);
    const cleanedHtml = replaceUseWhen(html, reference.humanGuide.useWhen, cleanUseWhen, "html");
    const enhancedHtml = enhanceUseFlow(fixComposerRuntime(cleanedHtml), nextReference);

    await Promise.all([
      fs.writeFile(htmlPath, enhancedHtml, "utf8"),
      fs.writeFile(markdownPath, replaceUseWhen(markdown, reference.humanGuide.useWhen, cleanUseWhen, "markdown"), "utf8"),
      fs.writeFile(jsonPath, `${JSON.stringify(nextReference, null, 2)}\n`, "utf8")
    ]);
  }

  return nextReference;
}

async function main() {
  const referenceCatalogPath = path.join(publicDir, "reference-catalog.json");
  const rawCatalog = JSON.parse(await fs.readFile(referenceCatalogPath, "utf8")) as {
    schemaVersion: number;
    generatedAt: string;
    prompts: unknown[];
  };
  const references = rawCatalog.prompts.map((prompt) => referencePromptSchema.parse(prompt));
  const polished = await Promise.all(references.map((reference) => polishPageSet(reference, reference.version)));
  await fs.writeFile(referenceCatalogPath, `${JSON.stringify({ ...rawCatalog, prompts: polished }, null, 2)}\n`, "utf8");
  console.log(`✓ reference pages polished: ${polished.length} prompts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
