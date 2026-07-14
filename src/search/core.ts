import type { Prompt } from "../schema/catalog";

export type SynonymDictionary = Record<string, string[]>;

export function katakanaToHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)
  );
}

export function normalizeText(value: string | null | undefined, synonyms: SynonymDictionary = {}): string {
  const source = value ?? "";
  let normalized = katakanaToHiragana(source.normalize("NFKC").toLowerCase())
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();

  for (const [canonical, variants] of Object.entries(synonyms)) {
    for (const variant of variants) {
      const from = katakanaToHiragana(variant.normalize("NFKC").toLowerCase())
        .replace(/[\s\p{P}\p{S}]+/gu, "")
        .trim();
      if (from) normalized = normalized.split(from).join(canonical);
    }
  }

  return normalized;
}

export function bigrams(value: string): Set<string> {
  const result = new Set<string>();
  if (value.length < 2) {
    if (value) result.add(value);
    return result;
  }
  for (let index = 0; index < value.length - 1; index += 1) {
    result.add(value.slice(index, index + 2));
  }
  return result;
}

function overlapScore(query: string, target: string): number {
  const queryGrams = bigrams(query);
  const targetGrams = bigrams(target);
  if (!queryGrams.size || !targetGrams.size) return 0;
  let shared = 0;
  queryGrams.forEach((gram) => {
    if (targetGrams.has(gram)) shared += 1;
  });
  return shared / queryGrams.size;
}

export function scorePrompt(
  rawQuery: string,
  prompt: Prompt,
  synonyms: SynonymDictionary = {}
): number {
  const query = normalizeText(rawQuery, synonyms);
  if (!query) return prompt.mobilePriority / 100;

  const normalizedPhrases = prompt.searchPhrases.map((phrase) => normalizeText(phrase, synonyms));
  const normalizedTitle = normalizeText(prompt.title, synonyms);
  const normalizedShortTitle = normalizeText(prompt.shortTitle, synonyms);

  const fields: Array<[string, number]> = [
    [prompt.searchPhrases.join(" "), 3],
    [prompt.title, 2.5],
    [`${prompt.problem ?? ""} ${prompt.summary ?? ""}`, 1.5],
    [(prompt.tags ?? []).join(" "), 1]
  ];

  const weighted = fields.reduce((total, [field, weight]) => {
    return total + overlapScore(query, normalizeText(field, synonyms)) * weight;
  }, 0);
  const weightTotal = fields.reduce((sum, [, weight]) => sum + weight, 0);

  const phraseExactBonus = normalizedPhrases.includes(query) ? 0.42 : 0;
  const phraseContainmentBonus = phraseExactBonus
    ? 0
    : normalizedPhrases.some((phrase) => phrase.startsWith(query) || phrase.includes(query))
      ? 0.16
      : 0;
  const titleBonus = normalizedTitle === query || normalizedShortTitle === query
    ? 0.28
    : normalizedTitle.includes(query) || normalizedShortTitle.includes(query)
      ? 0.1
      : 0;

  const relevance = (weighted / weightTotal) * 0.72
    + phraseExactBonus
    + phraseContainmentBonus
    + titleBonus;

  return relevance > 0 ? relevance + prompt.mobilePriority * 0.01 : 0;
}

export function searchPrompts(
  query: string,
  prompts: Prompt[],
  synonyms: SynonymDictionary = {},
  limit = 5
): Prompt[] {
  return prompts
    .map((prompt) => ({ prompt, score: scorePrompt(query, prompt, synonyms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.prompt.mobilePriority - left.prompt.mobilePriority)
    .slice(0, limit)
    .map(({ prompt }) => prompt);
}
