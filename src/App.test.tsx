import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const catalog = {
  schemaVersion: 1,
  generatedAt: "2026-07-13T00:00:00.000Z",
  prompts: [],
  modifiers: [],
  dictionaries: { synonyms: {}, intents: [], categories: [] }
};

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
  });

  it("Phase 0の基盤状態を表示する", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Prompt Launcher" })).toBeInTheDocument();
    expect(await screen.findByText(/0件のシード/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
  });
});
