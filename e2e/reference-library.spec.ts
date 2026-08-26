import { expect, test } from "@playwright/test";

test("既定のReference Libraryがスマホ幅で崩れない", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: /人が読んで選び/ })).toBeVisible();
  await expect(page.getByLabel("プロンプトを検索")).toBeVisible();
  await expect(page.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".rl-row").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("Reference Libraryの選択状態が支援技術にも伝わる", async ({ page }) => {
  await page.goto("./");

  const favorite = page.getByRole("button", { name: /お気に入りに追加/ }).first();
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");

  const darkMode = page.getByRole("button", { name: "暗い" });
  await darkMode.click();
  await expect(darkMode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
