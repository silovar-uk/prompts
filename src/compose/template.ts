import type { Modifier, Prompt } from "../schema/catalog";

const optionalBlockPattern = /{{#([a-zA-Z0-9-]+)}}([\s\S]*?){{\/\1}}/g;
const variablePattern = /{{([a-zA-Z0-9-]+)}}/g;
const slotOrder: Modifier["slot"][] = ["stance", "scope", "audience", "output", "process"];

export function renderTemplate(template: string, values: Record<string, string | number | undefined>): string {
  const withOptionalBlocks = template.replace(optionalBlockPattern, (_match, key: string, body: string) => {
    const value = values[key];
    return value === undefined || value === "" ? "" : body;
  });

  return withOptionalBlocks
    .replace(variablePattern, (_match, key: string) => String(values[key] ?? ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function composePrompt(
  prompt: Prompt,
  values: Record<string, string | number | undefined>,
  modifiers: Modifier[]
): string {
  const rendered = renderTemplate(prompt.promptTemplate, values);
  const ordered = [...modifiers].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );
  return [rendered, ...ordered.map((modifier) => modifier.text.trim())]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
