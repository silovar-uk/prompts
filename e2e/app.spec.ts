import { expect, test } from "@playwright/test";

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

test("スマホから自分用プロンプトを追加して即座に使える", async ({ page }) => {
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
  await expect(page.getByLabel("対象の内容")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
