import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import LibraryFirstApp from "./LibraryFirstApp";
import ReferenceLibraryApp from "./ReferenceLibraryApp";
import "./index.css";
import "./library-first.css";
import "./image-prompts.css";
import "./reference-library.css";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  legacyMode ? <LibraryFirstApp /> : <ReferenceLibraryApp />
);
