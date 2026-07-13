import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  catalogSchema,
  categorySchema,
  intentSchema,
  modifierSchema,
  promptSchema,
  synonymDictionarySchema,
  type Modifier,
  type Prompt
} from "../src/schema/catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const errors: string[] = [];

async function readJsonFiles<T>(directory: string): Promise<Array<{ file: string; data: T }>> {
  const absolute = path.join(root, directory);
  const files = (await fs.readdir(absolute)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(path.join(absolute, file), "utf8");
      try {
        return { file, data: JSON.parse(source) as T };
      } catch (error) {
        throw new Error(`${directory}/${file}: JSONの解析に失敗しました: ${String(error)}`);
      }
    })
  );
}

function validateTemplate(prompt: Prompt, file: string): void {
  const defined = new Set([...prompt.requiredInputs, ...prompt.optionalInputs].map((field) => field.id));
  const references = new Set<string>();
  for (const match of prompt.promptTemplate.matchAll(/{{#?\/?([a-zA-Z0-9-]+)}}/g)) {
    references.add(match[1]);
  }

  const unknown = [...references].filter((id) => !defined.has(id));
  const unused = [...defined].filter((id) => !references.has(id));
  if (unknown.length) errors.push(`${file}: 未定義のテンプレート変数: ${unknown.join(", ")}`);
  if (unused.length) errors.push(`${file}: テンプレートで未使用の入力: ${unused.join(", ")}`);

  for (const field of prompt.optionalInputs) {
    const open = `{{#${field.id}}}`;
    const close = `{{/${field.id}}}`;
    if (!prompt.promptTemplate.includes(open) || !prompt.promptTemplate.includes(close)) {
      errors.push(`${file}: 任意入力 ${field.id} は条件ブロック ${open}…${close} で囲んでください`);
    }
  }

  const ids = [...prompt.requiredInputs, ...prompt.optionalInputs].map((field) => field.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) errors.push(`${file}: 入力IDが重複しています: ${[...new Set(duplicates)].join(", ")}`);
}

async function main(): Promise<void> {
  const promptFiles = await readJsonFiles<unknown>("data/prompts");
  const modifierFiles = await readJsonFiles<unknown>("data/modifiers");

  const prompts: Prompt[] = [];
  for (const { file, data } of promptFiles) {
    const result = promptSchema.safeParse(data);
    if (!result.success) {
      errors.push(`${file}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" / ")}`);
      continue;
    }
    const expectedId = path.basename(file, ".json");
    if (result.data.id !== expectedId) errors.push(`${file}: ファイル名とidが一致しません (${result.data.id})`);
    validateTemplate(result.data, file);
    prompts.push(result.data);
  }

  const modifiers: Modifier[] = [];
  for (const { file, data } of modifierFiles) {
    const result = modifierSchema.safeParse(data);
    if (!result.success) {
      errors.push(`${file}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" / ")}`);
      continue;
    }
    const expectedId = path.basename(file, ".json");
    if (result.data.id !== expectedId) errors.push(`${file}: ファイル名とidが一致しません (${result.data.id})`);
    modifiers.push(result.data);
  }

  const promptIds = new Set<string>();
  for (const prompt of prompts) {
    if (promptIds.has(prompt.id)) errors.push(`プロンプトIDが重複しています: ${prompt.id}`);
    promptIds.add(prompt.id);
  }
  const modifierIds = new Set<string>();
  for (const modifier of modifiers) {
    if (modifierIds.has(modifier.id)) errors.push(`モディファイアーIDが重複しています: ${modifier.id}`);
    modifierIds.add(modifier.id);
  }

  const categoriesRaw = JSON.parse(await fs.readFile(path.join(root, "data/dictionaries/categories.json"), "utf8"));
  const intentsRaw = JSON.parse(await fs.readFile(path.join(root, "data/dictionaries/intents.json"), "utf8"));
  const synonymsRaw = JSON.parse(await fs.readFile(path.join(root, "data/dictionaries/synonyms.json"), "utf8"));
  const categories = categorySchema.array().parse(categoriesRaw);
  const intents = intentSchema.array().parse(intentsRaw);
  const synonyms = synonymDictionarySchema.parse(synonymsRaw);
  const categoryIds = new Set(categories.map((category) => category.slug));
  const intentIds = new Set(intents.map((intent) => intent.slug));

  for (const prompt of prompts) {
    if (!categoryIds.has(prompt.category)) errors.push(`${prompt.id}: 存在しないカテゴリ ${prompt.category}`);
    for (const intent of prompt.intents) {
      if (!intentIds.has(intent)) errors.push(`${prompt.id}: 存在しない目的 ${intent}`);
    }
    for (const relatedId of prompt.relatedIds) {
      if (!promptIds.has(relatedId)) errors.push(`${prompt.id}: relatedIdsの参照先が存在しません: ${relatedId}`);
    }
    for (const modifierId of prompt.compatibleModifiers) {
      if (!modifierIds.has(modifierId)) errors.push(`${prompt.id}: compatibleModifiersの参照先が存在しません: ${modifierId}`);
    }
  }

  for (const modifier of modifiers) {
    for (const conflictId of modifier.conflictsWith) {
      if (!modifierIds.has(conflictId)) errors.push(`${modifier.id}: conflictsWithの参照先が存在しません: ${conflictId}`);
      if (conflictId === modifier.id) errors.push(`${modifier.id}: 自分自身とは競合できません`);
    }
  }

  if (errors.length) {
    console.error("\nデータ検証に失敗しました:\n- " + errors.join("\n- "));
    process.exit(1);
  }

  const catalog = catalogSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    prompts: prompts.sort((a, b) => b.mobilePriority - a.mobilePriority || a.id.localeCompare(b.id)),
    modifiers: modifiers.sort((a, b) => a.id.localeCompare(b.id)),
    dictionaries: { synonyms, intents, categories }
  });

  await fs.mkdir(path.join(root, "public"), { recursive: true });
  await fs.mkdir(path.join(root, "data/schema"), { recursive: true });
  await fs.writeFile(path.join(root, "public/catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
  await fs.writeFile(
    path.join(root, "data/schema/prompt.schema.json"),
    JSON.stringify(zodToJsonSchema(promptSchema, "Prompt"), null, 2) + "\n"
  );
  await fs.writeFile(
    path.join(root, "data/schema/modifier.schema.json"),
    JSON.stringify(zodToJsonSchema(modifierSchema, "Modifier"), null, 2) + "\n"
  );
  await fs.writeFile(
    path.join(root, "data/schema/catalog.schema.json"),
    JSON.stringify(zodToJsonSchema(catalogSchema, "Catalog"), null, 2) + "\n"
  );

  console.log(`✓ ${prompts.length} prompts / ${modifiers.length} modifiers validated`);
  console.log(`✓ public/catalog.json generated${checkOnly ? " (check mode)" : ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
