import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema } from "../src/schema/catalog.ts";
import { searchPrompts } from "../src/search/core.ts";

interface QueryFixture {
  query: string;
  expectedIds: string[];
  k: number;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const catalog = catalogSchema.parse(
    JSON.parse(await fs.readFile(path.join(root, "public/catalog.json"), "utf8"))
  );
  const fixtures = JSON.parse(
    await fs.readFile(path.join(root, "eval/queries.json"), "utf8")
  ) as QueryFixture[];

  let hitAt3 = 0;
  let hitAt5 = 0;
  const misses: string[] = [];
  for (const fixture of fixtures) {
    const results = searchPrompts(fixture.query, catalog.prompts, catalog.dictionaries.synonyms, 5).map(
      (prompt) => prompt.id
    );
    const expected = new Set(fixture.expectedIds);
    const found3 = results.slice(0, 3).some((id) => expected.has(id));
    const found5 = results.slice(0, 5).some((id) => expected.has(id));
    if (found3) hitAt3 += 1;
    if (found5) hitAt5 += 1;
    if (!results.slice(0, fixture.k).some((id) => expected.has(id))) {
      misses.push(`「${fixture.query}」 → ${results.join(", ")}`);
    }
  }

  const rate3 = fixtures.length ? hitAt3 / fixtures.length : 1;
  const rate5 = fixtures.length ? hitAt5 / fixtures.length : 1;
  console.log(`hit@3 ${(rate3 * 100).toFixed(1)}% / hit@5 ${(rate5 * 100).toFixed(1)}%`);
  if (misses.length) console.error("Misses:\n- " + misses.join("\n- "));
  if (rate3 < 0.9 || rate5 < 0.97 || misses.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
