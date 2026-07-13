import { describe, expect, it } from "vitest";
import type { Prompt } from "../schema/catalog";
import { comparePrompts, findDuplicatePairs, findPotentialDuplicates } from "./duplicates";

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "local-a",
    type: "base",
    version: 1,
    title: "企画の弱点を洗い出す",
    shortTitle: "企画の弱点",
    emoji: "🔍",
    problem: "企画メモから問題点とリスクを確認する",
    summary: "企画メモから問題点とリスクを確認する",
    category: "planning",
    intents: ["inspect"],
    inputTypes: ["memo"],
    outputTypes: ["body"],
    audiences: [],
    stages: ["draft"],
    tags: ["ローカル", "自作"],
    searchPhrases: [
      "企画の弱点を探す",
      "施策のリスクを確認",
      "企画を厳しく見る",
      "問題点を洗い出す",
      "企画レビュー"
    ],
    requiredInputs: [{ id: "targetText", label: "企画メモ", type: "textarea" }],
    optionalInputs: [],
    promptTemplate: "企画の前提を疑い、問題点と根拠と改善案を出してください。\n\n## 企画メモ\n{{targetText}}",
    compatibleModifiers: [],
    relatedIds: [],
    mobilePriority: 4,
    updatedAt: "2026-07-14",
    ...overrides
  };
}

describe("prompt duplicate detection", () => {
  it("ほぼ同じプロンプトを強い重複候補として返す", () => {
    const candidate = makePrompt();
    const duplicate = makePrompt({ id: "local-b", title: "企画の弱点とリスクを洗い出す" });
    const comparison = comparePrompts(candidate, duplicate);

    expect(comparison.score).toBeGreaterThan(0.75);
    expect(comparison.reasons).toContain("用途が近い");
    expect(findPotentialDuplicates(candidate, [duplicate])).toHaveLength(1);
  });

  it("カテゴリだけ同じで用途が違うものは重複扱いしない", () => {
    const candidate = makePrompt();
    const different = makePrompt({
      id: "local-c",
      title: "イベントの告知文を作る",
      shortTitle: "告知文を作る",
      problem: "イベント情報から参加を促す案内文を作る",
      summary: "イベント情報から参加を促す案内文を作る",
      intents: ["create"],
      searchPhrases: ["イベント告知", "案内文を作る", "参加募集", "告知コピー", "イベント情報"],
      promptTemplate: "イベント情報を整理し、参加したくなる案内文を作ってください。\n\n{{targetText}}"
    });

    expect(comparePrompts(candidate, different).score).toBeLessThan(0.5);
    expect(findPotentialDuplicates(candidate, [different])).toHaveLength(0);
  });

  it("自作プロンプトを含む組み合わせだけ一覧化できる", () => {
    const local = makePrompt();
    const close = makePrompt({ id: "planning-001" });
    const unrelated = makePrompt({
      id: "writing-001",
      title: "文章を短くする",
      shortTitle: "文章を短く",
      problem: "長い文章から重複表現を削る",
      summary: "長い文章から重複表現を削る",
      category: "writing",
      intents: ["arrange"],
      inputTypes: ["text"],
      searchPhrases: ["文章を短くする", "重複を削る", "長文を縮める", "簡潔にする", "文章を整える"],
      requiredInputs: [{ id: "targetText", label: "文章", type: "textarea" }],
      promptTemplate: "意味を変えずに、文章の重複と冗長表現を削ってください。\n\n## 文章\n{{targetText}}"
    });
    const pairs = findDuplicatePairs([local, close, unrelated], {
      requireIds: new Set([local.id]),
      threshold: 0.6
    });

    expect(pairs).toHaveLength(1);
    expect(pairs[0].first.id).toBe(local.id);
    expect(pairs[0].second.id).toBe(close.id);
  });
});
