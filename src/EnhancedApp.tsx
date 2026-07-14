import { useState } from "react";
import App from "./App";
import { LocalPromptLifecycleManager } from "./components/LocalPromptLifecycleManager";

export default function EnhancedApp() {
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <>
      <App />
      {!managerOpen && (
        <button
          type="button"
          aria-label="自作プロンプトを整理"
          onClick={() => setManagerOpen(true)}
          className="fixed bottom-20 z-40 grid min-h-14 min-w-14 place-items-center rounded-2xl border border-zinc-700 bg-zinc-900/95 px-3 text-xs font-black text-white shadow-2xl backdrop-blur active:scale-95"
          style={{ right: "max(1rem, calc((100vw - 430px) / 2 + 1rem))" }}
        >
          <span className="block text-xl" aria-hidden="true">🗂️</span>
          <span>整理</span>
        </button>
      )}
      {managerOpen && <LocalPromptLifecycleManager onClose={() => setManagerOpen(false)} />}
    </>
  );
}
