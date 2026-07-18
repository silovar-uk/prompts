type CatalogIndex = {
  prompts: Array<{ id: string; title: string }>;
};

export function installReferenceNavigation(): () => void {
  const titleToId = new Map<string, string>();

  void fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() as Promise<CatalogIndex> : Promise.reject(new Error(String(response.status))))
    .then((catalog) => {
      for (const prompt of catalog.prompts) titleToId.set(prompt.title.trim(), prompt.id);
    })
    .catch(() => {
      // The React application still works as a fallback when the static index cannot be loaded.
    });

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest(".lf-row-main");
    if (!row) return;
    const title = row.querySelector(".lf-row-title")?.textContent?.trim();
    if (!title) return;
    const id = titleToId.get(title);
    if (!id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(`${import.meta.env.BASE_URL}p/${id}/`);
  };

  document.addEventListener("click", handleClick, true);
  return () => document.removeEventListener("click", handleClick, true);
}
