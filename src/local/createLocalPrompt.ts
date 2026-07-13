import type { Prompt } from "../schema/catalog";

export interface LocalPromptDraft {
  title: string;
  emoji: string;
  summary: string;
  instruction: string;
  category: string;
  intent: string;
  inputType: string;
  inputLabel: string;
  searchWords: string;
}

function compact(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

function uniquePhrases(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length >= 2))].slice(0, 10);
}

export function createLocalPromptId(now = Date.now(), random = Math.random()): string {
  return `local-${now.toString(36)}-${Math.floor(random * 1679616).toString(36).padStart(4, "0")}`;
}

export function buildLocalPrompt(
  draft: LocalPromptDraft,
  compatibleModifiers: string[],
  id = createLocalPromptId(),
  updatedAt = new Date().toISOString().slice(0, 10)
): Prompt {
  const title = compact(draft.title, "自分用プロンプト").slice(0, 60);
  const summary = compact(draft.summary, `${title}を実行する自分用プロンプトです。`).slice(0, 160);
  const instruction = compact(draft.instruction, `${title}を実行してください。`);
  const inputType = draft.inputType || "text";
  const needsInput = inputType !== "none";
  const inputLabel = compact(draft.inputLabel, "対象の内容").slice(0, 40);
  const rawSearchWords = draft.searchWords.split(/[、,\n]/).map((value) => value.trim());
  const searchPhrases = uniquePhrases([
    ...rawSearchWords,
    title,
    `${title}をしたい`,
    summary,
    `${summary}に使う`,
    `自分用の${title}`
  ]);
  while (searchPhrases.length < 5) searchPhrases.push(`${title}${searchPhrases.length + 1}`);

  const inputBlock = needsInput ? `\n\n## ${inputLabel}\n{{targetText}}` : "";

  return {
    id,
    type: "base",
    version: 1,
    title,
    shortTitle: title.slice(0, 15),
    emoji: compact(draft.emoji, "🧰").slice(0, 8),
    problem: summary,
    summary,
    category: draft.category || "writing",
    intents: [draft.intent || "create"],
    inputTypes: [inputType],
    outputTypes: ["body"],
    audiences: [],
    stages: ["draft"],
    tags: ["ローカル", "自作"],
    searchPhrases,
    requiredInputs: needsInput
      ? [{ id: "targetText", label: inputLabel, type: "textarea", placeholder: `${inputLabel}を貼り付け` }]
      : [],
    optionalInputs: [],
    promptTemplate: `${instruction}${inputBlock}\n\n## 出力\n- 依頼された成果物から始め、不要な前置きは入れないでください。`,
    compatibleModifiers,
    relatedIds: [],
    mobilePriority: 4,
    updatedAt
  };
}

export function githubNewFileUrl(prompt: Prompt): string {
  const query = new URLSearchParams({
    filename: `${prompt.id}.json`,
    value: `${JSON.stringify(prompt, null, 2)}\n`
  });
  return `https://github.com/silovar-uk/prompts/new/main/data/prompts?${query.toString()}`;
}
