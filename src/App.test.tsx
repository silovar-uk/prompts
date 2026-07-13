import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { buildLocalPrompt } from "./local/createLocalPrompt";
import { useAppStore } from "./store/appStore";

const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-07-13T00:00:00.000Z",
  prompts: [
    {
      id: "writing-001",
      type: "base",
      version: 1,
      title: "内容を変えずに文章を短くする",
      shortTitle: "意味を保って短く",
      emoji: "✂️",
      problem: "文章が長い",
      summary: "意味を保ちながら短くします。",
      category: "writing",
      intents: ["arrange", "shorten"],
      inputTypes: ["text"],
      outputTypes: ["body"],
      audiences: ["general"],
      stages: ["draft"],
      tags: ["短く"],
      searchPhrases: ["文章を短くしたい", "意味を変えずに削りたい", "重複をなくしたい", "長文を縮めたい", "簡潔にしたい"],
      requiredInputs: [{ id: "targetText", label: "対象の文章", type: "textarea", placeholder: "ここに文章を貼り付け" }],
      optionalInputs: [{ id: "targetLength", label: "希望する長さ", type: "select", options: ["半分くらい"] }],
      promptTemplate: "文章を短くしてください。\n\n{{targetText}}\n{{#targetLength}}長さ: {{targetLength}}{{/targetLength}}",
      compatibleModifiers: ["mod-critical"],
      relatedIds: [],
      mobilePriority: 5,
      updatedAt: "2026-07-13"
    }
  ],
  modifiers: [
    {
      id: "mod-critical",
      title: "厳しく批評する",
      emoji: "🔥",
      summary: "問題点を率直に指摘します",
      slot: "stance",
      text: "## 追加条件\n率直に指摘してください。",
      conflictsWith: [],
      searchPhrases: ["厳しく", "辛口で"]
    }
  ],
  dictionaries: {
    synonyms: { "短くする": ["短く", "縮める"] },
    intents: [
      { slug: "arrange", label: "整える", order: 1 },
      { slug: "create", label: "作る", order: 2 },
      { slug: "inspect", label: "点検する", order: 3 }
    ],
    categories: [
      { slug: "writing", label: "文章", color: "#E6002D" },
      { slug: "planning", label: "企画", color: "#2E9B55" }
    ]
  }
};

function makeLocalPrompt() {
  return buildLocalPrompt({
    title: "企画の弱点を洗い出す",
    emoji: "🔥",
    summary: "企画メモから問題点を探す",
    instruction: "前提を疑い、問題点と根拠と改善案を出してください。",
    category: "planning",
    intent: "inspect",
    inputType: "memo",
    inputLabel: "企画メモ",
    searchWords: "企画の弱点、リスク、厳しく見る"
  }, ["mod-critical"], "local-edit-test", "2026-07-14");
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearPersonalData();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  it("スマホ用の検索画面と下部ナビを表示する", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "何をしたい？" })).toBeInTheDocument();
    expect(await screen.findByText("内容を変えずに文章を短くする")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
  });

  it("検索から入力、コピー後のAI導線まで完走する", async () => {
    render(<App />);
    const search = screen.getByLabelText("プロンプトを検索");
    fireEvent.change(search, { target: { value: "文章を短くしたい" } });

    const useButton = await screen.findByRole("button", { name: "使う" });
    fireEvent.click(useButton);
    fireEvent.change(screen.getByLabelText("対象の文章"), { target: { value: "同じ説明が重複している長い文章です。" } });
    fireEvent.click(screen.getByRole("button", { name: "📋 プロンプトをコピー" }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "コピー完了。どこで使う？" })).toBeVisible();
    expect(screen.getByRole("button", { name: "🟢 ChatGPTで開く" })).toBeVisible();
    expect(screen.getByRole("button", { name: "🟠 Claudeで開く" })).toBeVisible();
  });

  it("ウィザードから端末内プロンプトを追加してそのまま使える", async () => {
    render(<App />);
    await screen.findByText("内容を変えずに文章を短くする");
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("button", { name: "＋ 自分用プロンプトを追加" }));

    fireEvent.change(screen.getByLabelText("名前"), { target: { value: "企画の弱点を洗い出す" } });
    fireEvent.change(screen.getByLabelText("何に使う？"), { target: { value: "企画メモから問題点を探す" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));

    fireEvent.change(screen.getByLabelText("AIへの指示"), { target: { value: "前提を疑い、問題点と根拠と改善案を出してください。" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "保存して使う" }));

    expect(await screen.findByRole("heading", { name: "企画の弱点を洗い出す" })).toBeVisible();
    expect(useAppStore.getState().localPrompts).toHaveLength(1);
  });

  it("自作プロンプトを同じIDのまま編集できる", async () => {
    const original = makeLocalPrompt();
    useAppStore.getState().upsertLocalPrompt(original);
    render(<App />);
    await screen.findByText("内容を変えずに文章を短くする");
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("button", { name: "編集" }));

    expect(screen.getByRole("heading", { name: "自分用プロンプトを編集" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("名前"), { target: { value: "企画の弱点と優先順位を整理する" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "更新して使う" }));

    const saved = useAppStore.getState().localPrompts;
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(original.id);
    expect(saved[0].title).toBe("企画の弱点と優先順位を整理する");
  });

  it("自作プロンプトを別IDで複製できる", async () => {
    const original = makeLocalPrompt();
    useAppStore.getState().upsertLocalPrompt(original);
    render(<App />);
    await screen.findByText("内容を変えずに文章を短くする");
    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(screen.getByRole("button", { name: "複製" }));

    expect(screen.getByRole("heading", { name: "プロンプトを複製" })).toBeVisible();
    expect(screen.getByLabelText("名前")).toHaveValue("企画の弱点を洗い出す（コピー）");
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "複製して使う" }));

    const saved = useAppStore.getState().localPrompts;
    expect(saved).toHaveLength(2);
    expect(new Set(saved.map((prompt) => prompt.id)).size).toBe(2);
  });
});
