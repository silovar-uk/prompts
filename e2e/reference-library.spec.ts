import { expect, test } from "@playwright/test";

test("既定のReference Libraryがスマホ幅で崩れない", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: /人が読んで選び/ })).toBeVisible();
  await expect(page.getByLabel("プロンプトを検索")).toBeVisible();
  await expect(page.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".rl-row").first()).toBeVisible();
  await expect(page.locator(".rl-row-fit b").first()).toHaveText("こんなとき");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("Reference Libraryの選択状態が支援技術にも伝わる", async ({ page }) => {
  await page.goto("./");

  const favorite = page.locator(".rl-favorite").first();
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");

  const darkMode = page.getByRole("button", { name: "暗い" });
  await darkMode.click();
  await expect(darkMode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("検索条件を保ったまま詳細を見て検索結果へ戻れる", async ({ page }) => {
  await page.goto("./");

  const search = page.getByLabel("プロンプトを検索");
  await search.fill("会議");
  const meetingFilter = page.getByRole("button", { name: "会議・議事録" });
  await meetingFilter.click();

  await expect(page.getByRole("heading", { name: "「会議」 × 会議・議事録" })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("会議");
  await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("meeting");
  await expect(page.locator(".rl-row-main").first()).toBeVisible();

  await page.locator(".rl-row-main").first().click();
  const returnLink = page.getByRole("link", { name: /検索結果へ戻る/ });
  await expect(returnLink).toBeVisible();
  await returnLink.click();

  await expect(page.getByLabel("プロンプトを検索")).toHaveValue("会議");
  await expect(page.getByRole("button", { name: "会議・議事録" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("会議");
  await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("meeting");
});

test("0件から検索条件をすぐ戻せる", async ({ page }) => {
  await page.goto("./");

  await page.getByLabel("プロンプトを検索").fill("zzqv998877noresult");
  await expect(page.getByText(/に合うプロンプトはありません/)).toBeVisible();
  await page.getByRole("button", { name: "検索をクリア" }).click();

  await expect(page.getByLabel("プロンプトを検索")).toHaveValue("");
  await expect(page.locator(".rl-row").first()).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
});

test("0件でも検索意図を残して絞り込みだけ広げられる", async ({ page }) => {
  await page.goto("./");

  const search = page.getByLabel("プロンプトを検索");
  await search.fill("議事録");
  await page.getByRole("button", { name: "🖼️ 画像生成" }).click();

  await expect(page.getByText("検索と絞り込みの組み合わせに合うプロンプトはありません。")).toBeVisible();
  await page.getByRole("button", { name: "絞り込みを解除" }).click();

  await expect(search).toHaveValue("議事録");
  await expect(page.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".rl-row").first()).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("議事録");
  await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBeNull();
});
