import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryFirstApp from "./LibraryFirstApp";
import { useAppStore } from "./store/appStore";
import { useLocalLifecycleStore } from "./store/localLifecycleStore";

const prompt = {
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

const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-07-14T00:00:00.000Z",
  prompts: [prompt],
  modifiers: [],
  dictionaries: {
    synonyms: { 会議: ["ミーティング", "打ち合わせ"] },
    intents: [{ slug: "arrange", label: "整える", order: 1 }],
    categories: [{ slug: "meeting", label: "会議・議事録", color: "#D59B16" }]
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

  it("ホームで検索結果を一覧表示して開ける", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(prompt.title);

    fireEvent.change(screen.getByLabelText("プロンプトを検索"), { target: { value: "会議を整理" } });
    expect(screen.getByText(prompt.title)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(prompt.title) }));
    expect(screen.getByRole("heading", { name: prompt.title })).toBeVisible();
  });

  it("ライブラリで全件・お気に入りを切り替えられる", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(prompt.title);

    fireEvent.click(screen.getByRole("button", { name: /一覧/ }));
    expect(screen.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
    expect(screen.getByText(prompt.title)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "お気に入りに追加" }));
    fireEvent.click(screen.getByRole("button", { name: /お気に入り/ }));

    expect(screen.getByText(prompt.title)).toBeVisible();
    expect(useAppStore.getState().favorites).toContain(prompt.id);
  });

  it("ライブラリ検索で一覧を絞り込める", async () => {
    render(<LibraryFirstApp />);
    await screen.findByText(prompt.title);
    fireEvent.click(screen.getByRole("button", { name: /一覧/ }));

    fireEvent.change(screen.getByLabelText("ライブラリを検索"), { target: { value: "会議メモ" } });
    expect(screen.getByText(prompt.title)).toBeVisible();

    fireEvent.change(screen.getByLabelText("ライブラリを検索"), { target: { value: "画像を作る" } });
    expect(screen.getByText("該当するプロンプトはありません。")).toBeVisible();
  });
});
