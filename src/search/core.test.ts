import { describe, expect, it } from "vitest";
import { bigrams, katakanaToHiragana, normalizeText, searchPrompts } from "./core";
import type { Prompt } from "../schema/catalog";

const prompts = [
  { id: "writing-001", title: "文章を短くする", searchPhrases: ["長い文章を短くしたい"], problem: "文章が長い", summary: "簡潔にする", tags: ["文章"], mobilePriority: 5 },
  { id: "meeting-001", title: "会議を整理する", searchPhrases: ["決定事項を出す"], problem: "会議メモ", summary: "議事録", tags: ["会議"], mobilePriority: 5 }
] as Prompt[];

describe("search core", () => {
  it("カタカナをひらがなへ統一する", () => {
    expect(katakanaToHiragana("ミーティング")).toBe("みーてぃんぐ");
  });

  it("類義語を正規形へ寄せる", () => {
    expect(normalizeText("文面を圧縮", { "短くする": ["圧縮"], 文章: ["文面"] })).toBe("文章を短くする");
  });

  it("bigramを作る", () => {
    expect([...bigrams("文章短縮")]).toEqual(["文章", "章短", "短縮"]);
  });

  it("自然文から該当プロンプトを上位にする", () => {
    expect(searchPrompts("文章を短く", prompts)[0].id).toBe("writing-001");
  });
});
