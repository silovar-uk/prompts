import { expect, test } from "@playwright/test";

const launcherPath = "./?mode=launcher";

test("スマホでホームのボタンと下部ナビが反応する", async ({ page }) => {
  await page.goto(launcherPath);
  await expect(page.getByRole("heading", { name: "何をしたい？" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
  await expect(nav).toBeVisible();

  await nav.getByRole("button", { name: "一覧", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
  await nav.getByRole("button", { name: "履歴", exact: true }).click();
  await expect(page.getByRole("heading", { name: "履歴" })).toBeVisible();
  await nav.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
  await nav.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.getByRole("heading", { name: "何をしたい？" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("貼り付けた会議メモから推薦してコピーまで進める", async ({ page }) => {
  await page.goto(launcherPath);
  await page.getByText("文章・メモを貼って候補を出す").click();
  await page.getByPlaceholder("文章、会議メモ、URL、コードを貼り付け").fill("会議で決定事項を確認。担当は田中、期限は金曜日。次回までに資料を作る。");
  await page.getByRole("button", { name: "候補を出す", exact: true }).click();
  await expect(page.getByRole("heading", { name: "この材料に合う候補" })).toBeVisible();

  await page.locator(".lf-row-main").first().click();
  await expect(page.getByRole("button", { name: "プロンプトをコピー", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "プロンプトをコピー", exact: true }).click();
  await expect(page.getByRole("heading", { name: "コピー完了" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("ライブラリから整理画面を開いて閉じられる", async ({ page }) => {
  await page.goto(launcherPath);
  const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
  await nav.getByRole("button", { name: "一覧", exact: true }).click();
  await page.getByRole("button", { name: "整理・アーカイブ・移行", exact: true }).click();
  await expect(page.getByRole("heading", { name: "自作プロンプト管理" })).toBeVisible();
  await page.getByRole("button", { name: "← 閉じる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ライブラリ" })).toBeVisible();
});
