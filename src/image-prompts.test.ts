import { describe, expect, it } from "vitest";
import { imagePrompts } from "../scripts/image-prompts";
import { promptSchema } from "./schema/catalog";

describe("image prompt catalog", () => {
  it("画像生成プロンプトを18件持つ", () => {
    expect(imagePrompts).toHaveLength(18);
  });

  it("すべてスキーマに適合しIDが重複しない", () => {
    const ids = imagePrompts.map((prompt) => prompt.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const prompt of imagePrompts) {
      expect(() => promptSchema.parse(prompt)).not.toThrow();
      expect(prompt.category).toBe("image");
      expect(prompt.searchPhrases.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("主要な画像用途を検索語として持つ", () => {
    const phrases = imagePrompts.flatMap((prompt) => prompt.searchPhrases).join(" ");
    for (const keyword of ["KV", "サムネイル", "アイコン", "カルーセル", "Jinja2", "JSON"]) {
      expect(phrases).toContain(keyword);
    }
  });
});
