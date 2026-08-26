import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

const legacyMode = new URLSearchParams(window.location.search).get("mode") === "launcher";

let triggerServiceWorkerUpdate: ReturnType<typeof registerSW> | undefined;
triggerServiceWorkerUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    void triggerServiceWorkerUpdate?.(true);
  },
  onRegisteredSW(_swUrl, registration) {
    void registration?.update();
    window.setInterval(() => void registration?.update(), 60 * 60 * 1000);
  }
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

async function renderApp() {
  if (legacyMode) {
    const [{ default: LibraryFirstApp }] = await Promise.all([
      import("./LibraryFirstApp"),
      import("./index.css"),
      import("./library-first.css"),
      import("./image-prompts.css")
    ]);
    root.render(<LibraryFirstApp />);
    return;
  }

  const [{ default: ReferenceLibraryApp }] = await Promise.all([
    import("./ReferenceLibraryApp"),
    import("./reference-library.css"),
    import("./reference-cards.css")
  ]);
  root.render(<ReferenceLibraryApp />);
}

void renderApp();
