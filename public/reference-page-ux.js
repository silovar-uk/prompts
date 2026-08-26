(() => {
  const link = document.querySelector("[data-return-search]");
  if (!link) return;

  try {
    const referrer = new URL(document.referrer);
    if (
      referrer.origin === window.location.origin
      && referrer.pathname === "/prompts/"
      && (referrer.searchParams.has("q") || referrer.searchParams.has("filter"))
    ) {
      link.href = `${referrer.pathname}${referrer.search}${referrer.hash}`;
      link.textContent = "← 検索結果へ戻る";
    }
  } catch {
    // Keep the default search link when referrer context is unavailable.
  }
})();
