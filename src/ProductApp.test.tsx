import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductApp from "./ProductApp";
import { useAppStore } from "./store/appStore";
import { useLocalLifecycleStore } from "./store/localLifecycleStore";

const prompt = {
  id: "meeting-001",
  type: "base",
  version: 1,
  title: "会議メモから決定事項と次の行動を抜き出す",
  shortTitle: "会議の決定だけ整理",
  emoji: "📝",
  problem: "会議メモが長い",
  summary: "決定事項・担当・期限を整理します。",
  category: "meeting",
  intents: ["arrange", "summarize"],
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
    intents: [
      { slug: "arrange", label: "整える", order: 1 },
      { slug: "summarize", label: "まとめる", order: 2 }
    ],
    categories: [{ slug: "meeting", label: "会議・議事録", color: "#D59B16" }]
  }
};

describe("ProductApp", () => {
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

  it("下部ナビの各ボタンで画面が切り替わる", async () => {
    render(<ProductApp />);
    expect(screen.getByRole("heading", { name: "何を任せる？" })).toBeVisible();
    await screen.findByText("会議メモから決定事項と次の行動を抜き出す");

    fireEvent.click(screen.getByRole("button", { name: /ライブラリ/ }));
    expect(screen.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /履歴/ }));
    expect(screen.getByRole("heading", { name: "履歴" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /設定/ }));
    expect(screen.getByRole("heading", { name: "設定" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(screen.getByRole("heading", { name: "何を任せる？" })).toBeVisible();
  });

  it("貼り付けから推薦を表示してプロンプトを開ける", async () => {
    render(<ProductApp />);
    await screen.findByText("会議メモから決定事項と次の行動を抜き出す");
    fireEvent.change(screen.getByLabelText("材料を貼り付け"), {
      target: { value: "会議で決定事項を確認。担当は田中、期限は金曜日。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "おすすめを見る" }));
    expect(screen.getByRole("heading", { name: "この材料に合う3つ" })).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "この道具を使う" })[0]);
    expect(screen.getByRole("heading", { name: prompt.title })).toBeVisible();
    expect(screen.getByLabelText(/会議メモ/)).toHaveValue("会議で決定事項を確認。担当は田中、期限は金曜日。");
  });

  it("使用画面からコピー完了まで進める", async () => {
    render(<ProductApp />);
    await screen.findByText(prompt.title);
    fireEvent.click(screen.getAllByRole("button", { name: "この道具を使う" })[0]);
    fireEvent.change(screen.getByLabelText(/会議メモ/), { target: { value: "決定事項があります。" } });
    fireEvent.click(screen.getByRole("button", { name: "プロンプトをコピー" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "コピー完了。どこで使う？" })).toBeVisible();
  });
});
