import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogSchema, type Catalog } from "../src/schema/catalog.ts";
import { imagePrompts } from "./image-prompts.ts";
import { studyPrompts } from "./study-prompts.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "public/catalog.json");

// `problem` is shown directly under "こんなとき" in the Reference Library.
// Keep it as a short situation/problem cue, rather than repeating the action in the title.
const problemCopyOverrides: Record<string, string> = {
  "writing-005": "公開前で誤字や分かりにくさが不安",
  "planning-005": "実行前だが失敗要因や対策が見えていない",
  "pr-004": "緊急時で対外説明の表現や不足が不安",
  "image-001": "告知情報はあるがKVの構図が決まらない",
  "image-002": "試合情報はあるが高揚感のある見せ方が決まらない",
  "image-003": "募集内容はあるが参加したくなる見せ方が弱い",
  "image-004": "情報量が多く1枚で伝わる整理ができない",
  "image-005": "長い内容を何枚にどう分けるか決まらない",
  "image-006": "比較項目はあるが違いが一目で伝わらない",
  "image-007": "出来事が多く時系列の流れが伝わりにくい",
  "image-008": "小さい表示では主題や訴求が埋もれてしまう",
  "image-009": "小さい表示でアプリらしさを識別しにくい",
  "image-010": "16px表示で形や特徴が潰れてしまう",
  "image-011": "機能は多いがアプリの価値を1枚で伝えにくい",
  "image-012": "LPの価値はあるが第一印象で伝わりきらない",
  "image-013": "イメージはあるが画像AIへの指示が曖昧",
  "image-014": "複数画像の共通ルールと個別指示が混ざっている",
  "image-015": "画像指示の固定部分と差し替え部分が混ざっている",
  "image-016": "生成画像に違和感はあるが直し方を言語化できない",
  "image-017": "内容違いを量産するとデザインがばらつく",
  "image-018": "複数枚投稿の流れが弱く途中で読まれにくい",
  "learning-002": "長い資料を思い出す練習用の教材へ変えにくい"
};

function polishProblemCopy(prompts: Catalog["prompts"]): Catalog["prompts"] {
  return prompts.map((prompt) => ({
    ...prompt,
    problem: problemCopyOverrides[prompt.id] ?? prompt.problem
  }));
}

function validateProblemCopy(prompts: Catalog["prompts"]): void {
  const issues = prompts.flatMap((prompt) => {
    const problems: string[] = [];
    if (prompt.problem.length > 24) problems.push(`${prompt.problem.length}文字`);
    if (/(?:作りたい|したい)$/.test(prompt.problem)) problems.push("タイトルと重複しやすい願望表現");
    return problems.length ? [`${prompt.id}: ${problems.join(" / ")} — ${prompt.problem}`] : [];
  });

  if (issues.length) {
    throw new Error(`カード用problem文言の品質基準を満たしていません:\n${issues.join("\n")}`);
  }
}

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
    "量産": ["バリエーション", "差し替え版", "別バージョン"],
    "暗記カード": ["フラッシュカード", "一問一答", "学習カード", "暗記教材"],
    "文字起こし": ["トランスクリプト", "字幕", "動画書き起こし", "会話ログ"],
    "PDF教材": ["学習PDF", "暗記PDF", "問題集PDF", "スマホ教材"],
    "出典": ["参考文献", "引用元", "根拠", "ソース"]
  };

  const merged = { ...current };
  for (const [canonical, variants] of Object.entries(additions)) {
    merged[canonical] = [...new Set([...(merged[canonical] ?? []), ...variants])];
  }
  return merged;
}

async function main() {
  const baseCatalog = catalogSchema.parse(JSON.parse(await fs.readFile(catalogPath, "utf8")));
  const additions = [...imagePrompts, ...studyPrompts];
  const additionIds = new Set(additions.map((prompt) => prompt.id));
  const categories = [
    ...baseCatalog.dictionaries.categories.filter((category) => category.slug !== "image"),
    { slug: "image", label: "画像生成", color: "#4B71D8" }
  ];
  const prompts = polishProblemCopy([
    ...baseCatalog.prompts.filter((prompt) => !additionIds.has(prompt.id)),
    ...additions
  ]);

  validateProblemCopy(prompts);

  const nextCatalog: Catalog = {
    ...baseCatalog,
    generatedAt: new Date().toISOString(),
    prompts,
    dictionaries: {
      ...baseCatalog.dictionaries,
      categories,
      synonyms: mergeSynonyms(baseCatalog.dictionaries.synonyms)
    }
  };

  const validated = catalogSchema.parse(nextCatalog);
  await fs.writeFile(catalogPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  console.log(`✓ catalog extended: ${validated.prompts.length} prompts (${imagePrompts.length} image, ${studyPrompts.length} study; ${Object.keys(problemCopyOverrides).length} problem labels polished)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
