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
