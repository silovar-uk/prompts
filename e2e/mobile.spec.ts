import { expect, test } from "@playwright/test";

test("スマホでホームのボタンと下部ナビが反応する", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "何を任せる？" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();

  await page.getByRole("button", { name: /ライブラリ/ }).click();
  await expect(page.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
  await page.getByRole("button", { name: /履歴/ }).click();
  await expect(page.getByRole("heading", { name: "履歴" })).toBeVisible();
  await page.getByRole("button", { name: /設定/ }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await page.getByRole("button", { name: /ホーム/ }).click();
  await expect(page.getByRole("heading", { name: "何を任せる？" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("貼り付けた会議メモから推薦してコピーまで進める", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("材料を貼り付け").fill("会議で決定事項を確認。担当は田中、期限は金曜日。次回までに資料を作る。");
  await page.getByRole("button", { name: "おすすめを見る" }).click();
  await expect(page.getByRole("heading", { name: "この材料に合う3つ" })).toBeVisible();

  await page.getByRole("button", { name: "この道具を使う" }).first().click();
  await expect(page.getByRole("button", { name: "プロンプトをコピー" })).toBeVisible();
  await page.getByRole("button", { name: "プロンプトをコピー" }).click();
  await expect(page.getByRole("heading", { name: "コピー完了。どこで使う？" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("ライブラリから整理画面を開いて閉じられる", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /ライブラリ/ }).click();
  await page.getByRole("button", { name: "整理・アーカイブ・移行" }).click();
  await expect(page.getByRole("heading", { name: "自作プロンプト管理" })).toBeVisible();
  await page.getByRole("button", { name: "← 閉じる" }).click();
  await expect(page.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
});
