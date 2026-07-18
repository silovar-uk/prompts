import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReferenceLibraryApp from "./ReferenceLibraryApp";
import { useAppStore } from "./store/appStore";

const meetingPrompt = {
  id: "meeting-001",
  type: "base",
  version: 1,
  title: "会議メモから決定事項と次の行動を抜き出す",
  shortTitle: "会議の決定を整理",
  emoji: "📝",
  problem: "会議メモが長い",
  summary: "決定事項・担当・期限を整理します。",
  category: "meeting",
  intents: ["arrange"],
  inputTypes: ["meeting-log", "memo"],
  outputTypes: ["minutes"],
  audiences: [],
  stages: ["draft"],
  tags: ["議事録"],
  searchPhrases: ["会議で決まったこと", "担当と期限", "会議メモを整理", "議事録を作る", "次の行動"],
  requiredInputs: [{ id: "meetingNotes", label: "会議メモ", type: "textarea", placeholder: "貼り付け" }],
  optionalInputs: [],
  promptTemplate: "会議メモから決定事項と次の行動を整理してください。\n\n{{meetingNotes}}",
  compatibleModifiers: [],
  relatedIds: [],
  mobilePriority: 5,
  updatedAt: "2026-07-14"
};

const imagePrompt = {
  id: "image-001",
  type: "base",
  version: 1,
  title: "イベント告知KVを作る",
  shortTitle: "イベント告知KV",
  emoji: "🖼️",
  problem: "告知画像を作りたい",
  summary: "イベント情報から画像生成指示を作ります。",
  category: "image",
  intents: ["create"],
  inputTypes: ["memo", "text"],
  outputTypes: ["image-prompt"],
  audiences: [],
  stages: ["draft"],
  tags: ["画像生成", "KV"],
  searchPhrases: ["イベント告知画像", "KVを作る", "告知ビジュアル", "画像を作る", "キービジュアル"],
  requiredInputs: [{ id: "eventInfo", label: "イベント情報", type: "textarea", placeholder: "貼り付け" }],
  optionalInputs: [],
  promptTemplate: "イベント情報から画像生成用の完成プロンプトを作ってください。\n\n{{eventInfo}}",
  compatibleModifiers: [],
  relatedIds: [],
  mobilePriority: 5,
  updatedAt: "2026-07-14"
};

const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-07-14T00:00:00.000Z",
  prompts: [meetingPrompt, imagePrompt],
  modifiers: [],
  dictionaries: {
    synonyms: {
      会議: ["ミーティング", "打ち合わせ"],
      画像生成: ["画像を作る", "画像AI"]
    },
    intents: [
      { slug: "arrange", label: "整える", order: 1 },
      { slug: "create", label: "作る", order: 2 }
    ],
    categories: [
      { slug: "meeting", label: "会議・議事録", color: "#D59B16" },
      { slug: "image", label: "画像生成", color: "#4B71D8" }
    ]
  }
};

describe("ReferenceLibraryApp", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearPersonalData();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    });
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
  });

  it("ライブラリから人向けの個別ページへ移動できる", async () => {
    render(<ReferenceLibraryApp />);
    fireEvent.click(await screen.findByRole("button", { name: "ライブラリ" }));
    await screen.findByRole("heading", { name: "プロンプトを一覧から探す" });

    const link = await screen.findByRole("link", { name: new RegExp(meetingPrompt.title) });
    expect(link).toHaveAttribute("href", "/prompts/p/meeting-001/");
    expect(within(link).getByText("meeting-001@1")).toBeVisible();
  });

  it("画像生成カテゴリだけを表示できる", async () => {
    render(<ReferenceLibraryApp />);
    fireEvent.click(await screen.findByRole("button", { name: "ライブラリ" }));
    await screen.findByRole("heading", { name: "プロンプトを一覧から探す" });

    fireEvent.click(screen.getByRole("button", { name: "画像生成" }));

    expect(await screen.findByRole("link", { name: new RegExp(imagePrompt.title) })).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(meetingPrompt.title) })).not.toBeInTheDocument();
  });

  it("検索したプロンプトをマイ棚へ固定できる", async () => {
    render(<ReferenceLibraryApp />);
    const search = await screen.findByLabelText("やりたいことからプロンプトを検索");

    fireEvent.change(search, { target: { value: "会議メモ" } });
    const resultLink = await screen.findByRole("link", { name: new RegExp(meetingPrompt.title) });
    expect(resultLink).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(imagePrompt.title) })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${meetingPrompt.title}をマイ棚へ追加` }));
    await waitFor(() => expect(useAppStore.getState().favorites).toContain(meetingPrompt.id));

    fireEvent.click(screen.getByRole("button", { name: /^★ マイ棚/ }));
    const shelfHeading = await screen.findByRole("heading", { name: "固定したプロンプト" });
    const shelfGroup = shelfHeading.closest("section");
    expect(shelfGroup).not.toBeNull();
    expect(within(shelfGroup as HTMLElement).getByText(meetingPrompt.shortTitle)).toBeVisible();
  });
});
