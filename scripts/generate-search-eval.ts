import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema } from "../src/schema/catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const catalog = catalogSchema.parse(JSON.parse(await fs.readFile(path.join(root, "public/catalog.json"), "utf8")));
  const fixtures: Array<{ query: string; expectedIds: string[]; k: number }> = [];

  for (const prompt of catalog.prompts) {
    for (const query of prompt.searchPhrases.slice(0, 3)) {
      fixtures.push({ query, expectedIds: [prompt.id], k: 3 });
    }
  }

  let phraseIndex = 3;
  while (fixtures.length < 100) {
    let added = false;
    for (const prompt of catalog.prompts) {
      const query = prompt.searchPhrases[phraseIndex];
      if (!query) continue;
      fixtures.push({ query, expectedIds: [prompt.id], k: 3 });
      added = true;
      if (fixtures.length >= 100) break;
    }
    if (!added) break;
    phraseIndex += 1;
  }

  if (fixtures.length < 100) throw new Error(`検索評価が100件に足りません: ${fixtures.length}件`);
  await fs.writeFile(path.join(root, "eval/queries.json"), `${JSON.stringify(fixtures.slice(0, 100), null, 2)}\n`, "utf8");
  console.log("✓ generated 100 search evaluation queries");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
