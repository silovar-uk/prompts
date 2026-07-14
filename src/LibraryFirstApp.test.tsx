import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryFirstApp from "./LibraryFirstApp";
import { useAppStore } from "./store/appStore";
import { useLocalLifecycleStore } from "./store/localLifecycleStore";

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

describe("LibraryFirstApp", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearPersonalData();
    useLocalLifecycleStore.getState().clearLifecycleData();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([]) }
    });
  });

  it("ホームで検索結果を一覧表示して入力なしで開ける", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(meetingPrompt.title);

    fireEvent.change(screen.getByLabelText("プロンプトを検索"), { target: { value: "会議を整理" } });
    expect(screen.getByText(meetingPrompt.title)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(meetingPrompt.title) }));
    expect(screen.getByRole("heading", { name: meetingPrompt.title })).toBeVisible();
    expect(screen.getByLabelText(/会議メモ/)).toHaveValue("");
  });

  it("画像生成だけをホームで即時表示できる", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(meetingPrompt.title);

    fireEvent.click(screen.getByRole("button", { name: "🖼️ 画像生成" }));

    expect(screen.getByText(imagePrompt.title)).toBeVisible();
    expect(screen.queryByText(meetingPrompt.title)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "画像生成プロンプト" })).toBeVisible();
  });

  it("ライブラリで画像生成・お気に入りを切り替えられる", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(meetingPrompt.title);

    fireEvent.click(screen.getByRole("button", { name: /一覧/ }));
    expect(screen.getByRole("heading", { name: "ライブラリ" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /画像生成 1/ }));
    expect(screen.getByText(imagePrompt.title)).toBeVisible();
    expect(screen.queryByText(meetingPrompt.title)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "お気に入りに追加" }));
    fireEvent.click(screen.getByRole("button", { name: /お気に入り/ }));

    expect(screen.getByText(imagePrompt.title)).toBeVisible();
    expect(useAppStore.getState().favorites).toContain(imagePrompt.id);
  });

  it("ライブラリ検索で一覧を絞り込める", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(meetingPrompt.title);
    fireEvent.click(screen.getByRole("button", { name: /一覧/ }));

    fireEvent.change(screen.getByLabelText("ライブラリを検索"), { target: { value: "会議メモ" } });
    expect(screen.getByText(meetingPrompt.title)).toBeVisible();

    fireEvent.change(screen.getByLabelText("ライブラリを検索"), { target: { value: "存在しない用途" } });
    expect(screen.getByText("該当するプロンプトはありません。")).toBeVisible();
  });
});
