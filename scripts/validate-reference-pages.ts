import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema } from "../src/schema/catalog.ts";
import { referencePromptSchema } from "../src/schema/reference.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

async function readRequired(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(`生成物がありません: ${path.relative(root, filePath)}`);
  }
}

function assertIncludes(content: string, expected: string, filePath: string): void {
  if (!content.includes(expected)) {
    throw new Error(`${path.relative(root, filePath)} に「${expected}」がありません`);
  }
}

async function validatePrompt(prompt: { id: string; version: number; title: string }): Promise<void> {
  const latestDir = path.join(publicDir, "p", prompt.id);
  const versionDir = path.join(latestDir, "v", String(prompt.version));
  const pageSets = [latestDir, versionDir];

  for (const directory of pageSets) {
    const htmlPath = path.join(directory, "index.html");
    const markdownPath = path.join(directory, "prompt.md");
    const jsonPath = path.join(directory, "prompt.json");
    const [html, markdown, jsonText] = await Promise.all([
      readRequired(htmlPath),
      readRequired(markdownPath),
      readRequired(jsonPath)
    ]);

    assertIncludes(html, prompt.title, htmlPath);
    assertIncludes(html, "AI向け実行仕様", htmlPath);
    assertIncludes(html, `Version ${prompt.version}`, htmlPath);
    assertIncludes(markdown, `Prompt ID: \`${prompt.id}\``, markdownPath);
    assertIncludes(markdown, "## 人向けの説明", markdownPath);
    assertIncludes(markdown, "## AI向け実行仕様", markdownPath);

    const reference = referencePromptSchema.parse(JSON.parse(jsonText));
    if (reference.id !== prompt.id || reference.version !== prompt.version) {
      throw new Error(`${path.relative(root, jsonPath)} のIDまたはVersionが一致しません`);
    }
  }
}

async function main() {
  const catalogPath = path.join(publicDir, "catalog.json");
  const catalog = catalogSchema.parse(JSON.parse(await readRequired(catalogPath)));
  await Promise.all(catalog.prompts.map((prompt) => validatePrompt(prompt)));

  const requiredIndexes = ["prompts.md", "llms.txt", "reference-catalog.json", "sitemap.xml", "robots.txt"];
  for (const filename of requiredIndexes) {
    const filePath = path.join(publicDir, filename);
    const content = await readRequired(filePath);
    if (!content.trim()) throw new Error(`${filename} が空です`);
  }

  const referenceCatalog = JSON.parse(await readRequired(path.join(publicDir, "reference-catalog.json"))) as { prompts?: unknown[] };
  if (referenceCatalog.prompts?.length !== catalog.prompts.length) {
    throw new Error(`reference-catalog.json の件数が一致しません: ${referenceCatalog.prompts?.length ?? 0}/${catalog.prompts.length}`);
  }

  console.log(`✓ reference artifacts validated: ${catalog.prompts.length} prompts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
