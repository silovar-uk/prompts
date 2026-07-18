import { expect, test } from "@playwright/test";

test("スマホでホーム・ライブラリ・マイ棚を往復できる", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /何をしますか/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();

  await page.getByRole("button", { name: "ライブラリ" }).click();
  await expect(page.getByRole("heading", { name: "プロンプトを一覧から探す" })).toBeVisible();

  await page.getByRole("button", { name: /^★ マイ棚/ }).click();
  await expect(page.getByRole("heading", { name: "戻ってきた道具" })).toBeVisible();

  await page.getByRole("button", { name: /Prompts/ }).click();
  await expect(page.getByRole("heading", { name: /何をしますか/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("やりたいことを検索し、個別ページの使用パネルを開ける", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("やりたいことからプロンプトを検索").fill("会議メモを整理したい");
  await expect(page.getByRole("heading", { name: /会議メモを整理したい/ })).toBeVisible();

  await page.locator(".rl-row-main").first().click();
  await expect(page.getByRole("button", { name: "このプロンプトを使う" })).toBeVisible();
  await page.getByRole("button", { name: "このプロンプトを使う" }).click();

  const composer = page.locator("details.composer");
  await expect(composer).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "実行用テキストを作る" })).toBeVisible();

  const firstField = composer.locator("textarea, select, input").first();
  if (await firstField.count()) await firstField.fill("会議で決まったことと担当、期限を整理したい");
  await page.getByRole("button", { name: "実行用テキストを作る" }).click();
  await expect(page.getByRole("button", { name: "作ったテキストをコピー" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("検索結果をマイ棚へ固定できる", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("やりたいことからプロンプトを検索").fill("画像を作りたい");
  const result = page.locator(".rl-row").first();
  await expect(result).toBeVisible();
  await result.locator(".rl-favorite").click();

  await page.getByRole("button", { name: /^★ マイ棚/ }).click();
  await expect(page.getByRole("heading", { name: "固定したプロンプト" })).toBeVisible();
  await expect(page.locator(".rl-quick-card").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
