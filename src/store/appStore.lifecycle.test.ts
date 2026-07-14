import { beforeEach, describe, expect, it } from "vitest";
import type { Prompt } from "../schema/catalog";
import { createDefaultSnapshot, useAppStore } from "./appStore";
import { createDefaultLifecycleSnapshot, useLocalLifecycleStore } from "./localLifecycleStore";

function prompt(id: string, title: string): Prompt {
  return {
    id,
    type: "base",
    version: 1,
    title,
    shortTitle: title.slice(0, 15),
    emoji: "🧰",
    problem: `${title}を実行する`,
    summary: `${title}を実行する`,
    category: "writing",
    intents: ["create"],
    inputTypes: ["text"],
    outputTypes: ["body"],
    audiences: [],
    stages: ["draft"],
    tags: ["自作"],
    searchPhrases: [title, `${title}したい`, `${title}方法`, `${title}依頼`, `${title}プロンプト`],
    requiredInputs: [{ id: "targetText", label: "対象", type: "textarea" }],
    optionalInputs: [],
    promptTemplate: `${title}してください。\n\n{{targetText}}`,
    compatibleModifiers: [],
    relatedIds: [],
    mobilePriority: 4,
    updatedAt: "2026-07-14"
  };
}

describe("local prompt lifecycle", () => {
  const first = prompt("local-first", "最初のプロンプト");
  const second = prompt("local-second", "二つ目のプロンプト");
  const third = prompt("local-third", "三つ目のプロンプト");

  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState(createDefaultSnapshot());
    useLocalLifecycleStore.setState(createDefaultLifecycleSnapshot());
  });

  it("手動の上下移動と一括並べ替えを保存できる", () => {
    useAppStore.setState({ localPrompts: [first, second, third] });
    useAppStore.getState().moveLocalPrompt("local-second", -1);
    expect(useAppStore.getState().localPrompts.map((item) => item.id)).toEqual(["local-second", "local-first", "local-third"]);

    useAppStore.getState().setLocalPromptOrder(["local-third", "local-second"]);
    expect(useAppStore.getState().localPrompts.map((item) => item.id)).toEqual(["local-third", "local-second", "local-first"]);
  });

  it("編集更新では既存の並び順を変えない", () => {
    useAppStore.setState({ localPrompts: [first, second] });
    useAppStore.getState().upsertLocalPrompt({ ...second, title: "更新した二つ目" });
    expect(useAppStore.getState().localPrompts.map((item) => item.id)).toEqual(["local-first", "local-second"]);
    expect(useAppStore.getState().localPrompts[1].title).toBe("更新した二つ目");
  });

  it("アーカイブ記録を保持して利用中から外せる", () => {
    useAppStore.setState({ localPrompts: [first] });
    useLocalLifecycleStore.getState().archivePrompt(first);
    useAppStore.getState().removeLocalPrompt(first.id);

    expect(useAppStore.getState().localPrompts).toHaveLength(0);
    expect(useLocalLifecycleStore.getState().archivedPrompts[0].prompt.id).toBe(first.id);
  });

  it("正式版へお気に入り・履歴・回数・設定を移す", () => {
    useAppStore.setState({
      localPrompts: [first],
      favorites: [first.id],
      usage: {
        [first.id]: { copyCount: 2, lastCopiedAt: "2026-07-13T10:00:00.000Z" },
        "writing-001": { copyCount: 3, lastCopiedAt: "2026-07-14T10:00:00.000Z" }
      },
      history: [{ promptId: first.id, copiedAt: "2026-07-13T10:00:00.000Z", modifiers: [], optionalValues: {} }],
      lastSettings: { [first.id]: { modifiers: ["mod-critical"], optionalValues: {} } }
    });

    useAppStore.getState().transferLocalPromptToOfficial(first.id, "writing-001");

    const state = useAppStore.getState();
    expect(state.localPrompts).toHaveLength(0);
    expect(state.favorites).toEqual(["writing-001"]);
    expect(state.usage["writing-001"].copyCount).toBe(5);
    expect(state.history[0].promptId).toBe("writing-001");
    expect(state.lastSettings["writing-001"].modifiers).toEqual(["mod-critical"]);
    expect(state.usage[first.id]).toBeUndefined();
  });
});
