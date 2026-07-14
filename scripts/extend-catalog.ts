import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema, type Catalog } from "../src/schema/catalog";
import { imagePrompts } from "./image-prompts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "public/catalog.json");

function mergeSynonyms(current: Catalog["dictionaries"]["synonyms"]): Catalog["dictionaries"]["synonyms"] {
  const additions: Record<string, string[]> = {
    "画像生成": ["画像を作る", "画像AI", "ビジュアル生成", "イメージ生成"],
    "画像": ["ビジュアル", "イメージ", "グラフィック"],
    "キービジュアル": ["KV", "メインビジュアル", "告知ビジュアル"],
    "サムネイル": ["サムネ", "YouTubeサムネ", "記事サムネ"],
    "アイコン": ["アプリアイコン", "favicon", "ファビコン", "ブラウザアイコン"],
    "図解": ["インフォグラフィック", "説明画像", "解説画像"],
    "複数枚": ["カルーセル", "連番画像", "複数ページ", "スライド画像"],
    "画像プロンプト": ["画像生成プロンプト", "画像指示", "画像AIの指示文"],
    "テンプレート": ["Jinja2", "変数化", "ひな形"],
    "量産": ["バリエーション", "差し替え版", "別バージョン"]
  };

  const merged = { ...current };
  for (const [canonical, variants] of Object.entries(additions)) {
    merged[canonical] = [...new Set([...(merged[canonical] ?? []), ...variants])];
  }
  return merged;
}

async function main() {
  const baseCatalog = catalogSchema.parse(JSON.parse(await fs.readFile(catalogPath, "utf8")));
  const imageIds = new Set(imagePrompts.map((prompt) => prompt.id));
  const categories = [
    ...baseCatalog.dictionaries.categories.filter((category) => category.slug !== "image"),
    { slug: "image", label: "画像生成", color: "#4B71D8" }
  ];

  const nextCatalog: Catalog = {
    ...baseCatalog,
    generatedAt: new Date().toISOString(),
    prompts: [
      ...baseCatalog.prompts.filter((prompt) => !imageIds.has(prompt.id)),
      ...imagePrompts
    ],
    dictionaries: {
      ...baseCatalog.dictionaries,
      categories,
      synonyms: mergeSynonyms(baseCatalog.dictionaries.synonyms)
    }
  };

  const validated = catalogSchema.parse(nextCatalog);
  await fs.writeFile(catalogPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  console.log(`✓ catalog extended: ${validated.prompts.length} prompts (${imagePrompts.length} image prompts)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
