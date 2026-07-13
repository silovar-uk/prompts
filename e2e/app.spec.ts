import { expect, test } from "@playwright/test";

test("モバイル幅で基盤画面が表示され、横スクロールがない", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Prompt Launcher" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
  await expect(page.getByText(/3件のシード/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
