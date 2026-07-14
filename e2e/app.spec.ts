import { expect, test } from "@playwright/test";

const localPrompt = {
  id: "local-writing-001",
  type: "base",
  version: 1,
  title: "文章を短くする自分用版",
  shortTitle: "文章を短くする",
  emoji: "✂️",
  problem: "長い文章を短くする",
  summary: "意味を保ちながら文章を短くする",
  category: "writing",
  intents: ["arrange"],
  inputTypes: ["text"],
  outputTypes: ["body"],
  audiences: ["general"],
  stages: ["draft"],
  tags: ["自作"],
  searchPhrases: ["文章を短くする", "意味を保って短く", "長文を縮める", "文章を簡潔に", "重複を削る"],
  requiredInputs: [{ id: "targetText", label: "対象の文章", type: "textarea", placeholder: "文章を貼り付け" }],
  optionalInputs: [],
  promptTemplate: "意味を変えずに文章を短くしてください。\n\n{{targetText}}",
  compatibleModifiers: [],
  relatedIds: [],
  mobilePriority: 4,
  updatedAt: "2026-07-14"
};

const secondLocalPrompt = {
  ...localPrompt,
  id: "local-planning-001",
  title: "企画を整理する",
  shortTitle: "企画整理",
  emoji: "🧭",
  problem: "企画の論点を整理する",
  summary: "企画の論点と次の行動を整理する",
  category: "planning",
  intents: ["think"],
  inputTypes: ["memo"],
  searchPhrases: ["企画を整理", "論点を整理", "企画メモ", "次の行動", "企画の課題"],
  promptTemplate: "企画の論点と次の行動を整理してください。\n\n{{targetText}}"
};

test("モバイル幅で検索からプロンプト使用画面まで進める", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "何をしたい？" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();

  await page.getByLabel("プロンプトを検索").fill("文章を短くしたい");
  const card = page.getByText("内容を変えずに文章を短くする").first();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "使う" }).first().click();

  await expect(page.getByRole("heading", { name: "内容を変えずに文章を短くする" })).toBeVisible();
  await expect(page.getByLabel("対象の文章")).toBeVisible();
  await expect(page.getByRole("button", { name: "📋 プロンプトをコピー" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("スマホで自作プロンプトを追加・編集・複製できる", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "設定" }).click();
  await page.getByRole("button", { name: "＋ 自分用プロンプトを追加" }).click();

  await page.getByLabel("名前").fill("企画の弱点を洗い出す");
  await page.getByLabel("何に使う？").fill("企画メモから実現性とリスクを点検する");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByLabel("AIへの指示").fill("前提を疑い、問題点の根拠と実行可能な改善案を示してください。");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "保存して使う" }).click();

  await expect(page.getByRole("heading", { name: "企画の弱点を洗い出す" })).toBeVisible();
  await page.getByRole("button", { name: "✏️ 編集" }).click();
  await page.getByLabel("名前").fill("企画の弱点と優先順位を整理する");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "更新して使う" }).click();

  await expect(page.getByRole("heading", { name: "企画の弱点と優先順位を整理する" })).toBeVisible();
  await page.getByRole("button", { name: "⧉ 複製" }).click();
  await expect(page.getByLabel("名前")).toHaveValue("企画の弱点と優先順位を整理する（コピー）");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "複製して使う" }).click();

  await expect(page.getByRole("heading", { name: "企画の弱点と優先順位を整理する（コピー）" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("自作プロンプトを並べ替え・アーカイブ・正式版へ移行できる", async ({ page }) => {
  await page.addInitScript(({ first, second }) => {
    localStorage.setItem("prompt-launcher-personal", JSON.stringify({
      state: {
        schemaVersion: 1,
        usage: { [first.id]: { copyCount: 2, lastCopiedAt: "2026-07-14T00:00:00.000Z" } },
        favorites: [first.id],
        history: [{ promptId: first.id, copiedAt: "2026-07-14T00:00:00.000Z", modifiers: [], optionalValues: {} }],
        lastSettings: {},
        recentQueries: [],
        localPrompts: [first, second],
        prefs: { theme: "dark", lastAi: "chatgpt" }
      },
      version: 1
    }));
    localStorage.removeItem("prompt-launcher-local-lifecycle");
  }, { first: localPrompt, second: secondLocalPrompt });

  await page.goto("./");
  await page.getByRole("button", { name: "自作プロンプトを整理" }).click();
  await expect(page.getByRole("heading", { name: "自作プロンプト管理" })).toBeVisible();

  await page.getByRole("button", { name: "企画を整理するを上へ" }).click();
  await expect(page.getByText("企画を整理する").first()).toBeVisible();

  await page.getByRole("button", { name: "アーカイブ" }).first().click();
  await page.getByRole("button", { name: /アーカイブ.*1/ }).click();
  await expect(page.getByRole("button", { name: "利用中へ戻す" })).toBeVisible();
  await page.getByRole("button", { name: "利用中へ戻す" }).click();

  await page.getByRole("button", { name: "正式版へ移行" }).first().click();
  await page.getByLabel("正式プロンプトを検索").fill("内容を変えずに文章を短くする");
  await page.getByRole("button").filter({ hasText: "内容を変えずに文章を短くする" }).first().click();

  await expect(page.getByRole("button", { name: /移行済み.*1/ })).toBeVisible();
  await expect(page.getByText("→ 内容を変えずに文章を短くする")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
