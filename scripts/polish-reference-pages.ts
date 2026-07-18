import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { referencePromptSchema, type ReferencePrompt } from "../src/schema/reference.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function replaceUseWhen(content: string, before: string[], after: string[], format: "html" | "markdown"): string {
  let next = content;
  for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
    const oldValue = before[index];
    const newValue = after[index];
    if (format === "html") {
      next = next.replaceAll(`<li>${escapeHtml(oldValue)}</li>`, `<li>${escapeHtml(newValue)}</li>`);
    } else {
      next = next.replaceAll(`- ${oldValue}`, `- ${newValue}`);
    }
  }
  return next;
}

function fixComposerRuntime(html: string): string {
  const broken = "const block=new RegExp('{{#'+key+'}}([\\s\\S]*?){{\\/'+key+'}}','g');text=text.replace(block,(_,body)=>value?body.replaceAll('{{'+key+'}}',value):'');";
  const fixed = "const open='{{#'+key+'}}',close='{{/'+key+'}}';let start;while((start=text.indexOf(open))>=0){const end=text.indexOf(close,start+open.length);if(end<0)break;const body=text.slice(start+open.length,end);text=text.slice(0,start)+(value?body.replaceAll('{{'+key+'}}',value):'')+text.slice(end+close.length)}";
  return html.replace(broken, fixed);
}

async function polishPageSet(reference: ReferencePrompt, version: number): Promise<ReferencePrompt> {
  const directories = [
    path.join(publicDir, "p", reference.id),
    path.join(publicDir, "p", reference.id, "v", String(version))
  ];
  const cleanUseWhen = reference.searchPhrases.slice(0, 5).map((value) => value.trim()).filter(Boolean);
  const nextReference = referencePromptSchema.parse({
    ...reference,
    humanGuide: { ...reference.humanGuide, useWhen: cleanUseWhen }
  });

  for (const directory of directories) {
    const htmlPath = path.join(directory, "index.html");
    const markdownPath = path.join(directory, "prompt.md");
    const jsonPath = path.join(directory, "prompt.json");
    const [html, markdown] = await Promise.all([
      fs.readFile(htmlPath, "utf8"),
      fs.readFile(markdownPath, "utf8")
    ]);

    await Promise.all([
      fs.writeFile(htmlPath, fixComposerRuntime(replaceUseWhen(html, reference.humanGuide.useWhen, cleanUseWhen, "html")), "utf8"),
      fs.writeFile(markdownPath, replaceUseWhen(markdown, reference.humanGuide.useWhen, cleanUseWhen, "markdown"), "utf8"),
      fs.writeFile(jsonPath, `${JSON.stringify(nextReference, null, 2)}\n`, "utf8")
    ]);
  }

  return nextReference;
}

async function main() {
  const referenceCatalogPath = path.join(publicDir, "reference-catalog.json");
  const rawCatalog = JSON.parse(await fs.readFile(referenceCatalogPath, "utf8")) as {
    schemaVersion: number;
    generatedAt: string;
    prompts: unknown[];
  };
  const references = rawCatalog.prompts.map((prompt) => referencePromptSchema.parse(prompt));
  const polished = await Promise.all(references.map((reference) => polishPageSet(reference, reference.version)));
  await fs.writeFile(referenceCatalogPath, `${JSON.stringify({ ...rawCatalog, prompts: polished }, null, 2)}\n`, "utf8");
  console.log(`✓ reference pages polished: ${polished.length} prompts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
