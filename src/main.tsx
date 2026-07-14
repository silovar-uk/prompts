import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import ProductApp from "./ProductApp";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root")!).render(<ProductApp />);
