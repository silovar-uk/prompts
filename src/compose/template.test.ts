import { describe, expect, it } from "vitest";
import { composePrompt, renderTemplate } from "./template";
import type { Modifier, Prompt } from "../schema/catalog";

describe("renderTemplate", () => {
  it("未入力の任意ブロックを削除する", () => {
    const template = "対象: {{target}}\n{{#note}}補足: {{note}}{{/note}}";
    expect(renderTemplate(template, { target: "本文" })).toBe("対象: 本文");
  });
});

describe("composePrompt", () => {
  it("slot順にモディファイアーを合成する", () => {
    const prompt = { promptTemplate: "本文 {{target}}" } as Prompt;
    const modifiers = [
      { slot: "process", text: "PROCESS" },
      { slot: "stance", text: "STANCE" }
    ] as Modifier[];
    expect(composePrompt(prompt, { target: "A" }, modifiers)).toBe("本文 A\n\nSTANCE\n\nPROCESS");
  });
});
