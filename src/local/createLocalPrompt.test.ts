import { describe, expect, it } from "vitest";
import { promptSchema } from "../schema/catalog";
import { buildLocalPrompt, githubNewFileUrl, promptToLocalDraft } from "./createLocalPrompt";

const draft = {
  title: "企画の弱点を洗い出す",
  emoji: "🔥",
  summary: "企画メモから実現性とリスクを点検する",
  instruction: "前提を疑い、問題点の根拠と実行可能な改善案を示してください。",
  category: "planning",
  intent: "inspect",
  inputType: "memo",
  inputLabel: "企画メモ",
  searchWords: "企画を厳しく見る、弱点、リスク"
};

describe("buildLocalPrompt", () => {
  it("ウィザードの入力からスキーマ適合するプロンプトを作る", () => {
    const prompt = buildLocalPrompt(draft, ["mod-critical"], "local-test-0001", "2026-07-14");

    expect(promptSchema.parse(prompt)).toEqual(prompt);
    expect(prompt.requiredInputs[0]?.label).toBe("企画メモ");
    expect(prompt.searchPhrases.length).toBeGreaterThanOrEqual(5);
    expect(prompt.promptTemplate).toContain("{{targetText}}");
  });

  it("材料なしなら入力欄を作らない", () => {
    const prompt = buildLocalPrompt({
      title: "アイデアを10個出す",
      emoji: "💡",
      summary: "テーマなしで発想を広げる",
      instruction: "異なる観点からアイデアを10個出してください。",
      category: "planning",
      intent: "create",
      inputType: "none",
      inputLabel: "",
      searchWords: "アイデア,発想"
    }, [], "local-test-0002", "2026-07-14");

    expect(prompt.requiredInputs).toHaveLength(0);
    expect(prompt.promptTemplate).not.toContain("{{targetText}}");
  });

  it("保存済みプロンプトを編集用入力へ戻せる", () => {
    const prompt = buildLocalPrompt(draft, ["mod-critical"], "local-test-0004", "2026-07-14");
    const restored = promptToLocalDraft(prompt);

    expect(restored.title).toBe(draft.title);
    expect(restored.instruction).toBe(draft.instruction);
    expect(restored.inputLabel).toBe(draft.inputLabel);
    expect(restored.category).toBe(draft.category);
    expect(restored.searchWords).toContain("企画を厳しく見る");
  });

  it("GitHubの新規ファイル作成URLにIDとJSONを含める", () => {
    const prompt = buildLocalPrompt({
      title: "文章を整える",
      emoji: "✍️",
      summary: "文章を読みやすくする",
      instruction: "文章を自然に整えてください。",
      category: "writing",
      intent: "arrange",
      inputType: "text",
      inputLabel: "文章",
      searchWords: "文章,整える"
    }, [], "local-test-0003", "2026-07-14");

    const url = githubNewFileUrl(prompt);
    expect(url).toContain("silovar-uk/prompts/new/main/data/prompts");
    expect(decodeURIComponent(url)).toContain("local-test-0003.json");
  });
});
