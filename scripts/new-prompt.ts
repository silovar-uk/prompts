import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const category = (await rl.question("category slug (例: writing): ")).trim();
const sequence = (await rl.question("3桁の連番 (例: 004): ")).trim().padStart(3, "0");
const title = (await rl.question("タイトル: ")).trim();
const id = `${category}-${sequence}`;
const filePath = path.resolve("data/prompts", `${id}.json`);

const prompt = {
  id,
  type: "base",
  version: 1,
  title,
  shortTitle: title.slice(0, 15),
  emoji: "🧰",
  problem: "ここに困りごとを記入",
  summary: "ここに一言説明を記入",
  category,
  intents: ["arrange"],
  inputTypes: ["text"],
  outputTypes: ["body"],
  audiences: [],
  stages: ["draft"],
  tags: [],
  searchPhrases: ["検索文1", "検索文2", "検索文3", "検索文4", "検索文5"],
  requiredInputs: [
    { id: "targetText", label: "対象", type: "textarea", placeholder: "ここに貼り付け" }
  ],
  optionalInputs: [],
  promptTemplate: "あなたは専門家です。以下の対象を整理してください。\n\n## 対象\n{{targetText}}",
  compatibleModifiers: [],
  relatedIds: [],
  mobilePriority: 3,
  updatedAt: new Date().toISOString().slice(0, 10)
};

await fs.writeFile(filePath, JSON.stringify(prompt, null, 2) + "\n", { flag: "wx" });
console.log(`✓ ${filePath} を作成しました`);
rl.close();
