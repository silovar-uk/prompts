import type { Prompt } from "../schema/catalog";
import { bigrams, normalizeText, type SynonymDictionary } from "../search/core";

export interface DuplicateMatch {
  prompt: Prompt;
  score: number;
  reasons: string[];
}

export interface DuplicatePair {
  first: Prompt;
  second: Prompt;
  score: number;
  reasons: string[];
}

function diceSimilarity(left: string, right: string, synonyms: SynonymDictionary): number {
  const a = bigrams(normalizeText(left, synonyms));
  const b = bigrams(normalizeText(right, synonyms));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((gram) => {
    if (b.has(gram)) shared += 1;
  });
  return (2 * shared) / (a.size + b.size);
}

function textSimilarity(left: string, right: string, synonyms: SynonymDictionary): number {
  const normalizedLeft = normalizeText(left, synonyms);
  const normalizedRight = normalizeText(right, synonyms);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const shorter = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = normalizedLeft.length > normalizedRight.length ? normalizedLeft : normalizedRight;
  const containment = longer.includes(shorter) ? shorter.length / longer.length : 0;
  return Math.max(containment, diceSimilarity(left, right, synonyms));
}

function phraseSimilarity(candidate: Prompt, target: Prompt, synonyms: SynonymDictionary): number {
  const targetPhrases = [target.title, target.summary, ...target.searchPhrases];
  const scores = candidate.searchPhrases
    .map((phrase) => Math.max(...targetPhrases.map((targetPhrase) => textSimilarity(phrase, targetPhrase, synonyms))))
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (!scores.length) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function comparePrompts(
  candidate: Prompt,
  target: Prompt,
  synonyms: SynonymDictionary = {}
): { score: number; reasons: string[] } {
  const title = textSimilarity(candidate.title, target.title, synonyms);
  const summary = textSimilarity(candidate.summary, target.summary, synonyms);
  const phrases = phraseSimilarity(candidate, target, synonyms);
  const template = textSimilarity(candidate.promptTemplate, target.promptTemplate, synonyms);
  const metadataParts = [
    candidate.category === target.category,
    candidate.intents.some((intent) => target.intents.includes(intent)),
    candidate.inputTypes.some((inputType) => target.inputTypes.includes(inputType))
  ];
  const metadata = metadataParts.filter(Boolean).length / metadataParts.length;
  const score = title * 0.34 + summary * 0.23 + phrases * 0.25 + template * 0.13 + metadata * 0.05;

  const reasons: string[] = [];
  if (title >= 0.76) reasons.push("名前が近い");
  if (summary >= 0.68) reasons.push("用途が近い");
  if (phrases >= 0.68) reasons.push("検索語が近い");
  if (template >= 0.7) reasons.push("指示内容が近い");
  if (metadata >= 1) reasons.push("分類と入力材料が同じ");
  if (!reasons.length && score >= 0.5) reasons.push("全体の構成が近い");

  return { score, reasons };
}

export function findPotentialDuplicates(
  candidate: Prompt,
  prompts: Prompt[],
  options: {
    synonyms?: SynonymDictionary;
    excludeIds?: string[];
    threshold?: number;
    limit?: number;
  } = {}
): DuplicateMatch[] {
  const excluded = new Set(options.excludeIds ?? [candidate.id]);
  const threshold = options.threshold ?? 0.5;
  return prompts
    .filter((prompt) => !excluded.has(prompt.id))
    .map((prompt) => ({ prompt, ...comparePrompts(candidate, prompt, options.synonyms) }))
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 3);
}

export function findDuplicatePairs(
  prompts: Prompt[],
  options: {
    synonyms?: SynonymDictionary;
    threshold?: number;
    requireIds?: Set<string>;
    limit?: number;
  } = {}
): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let left = 0; left < prompts.length; left += 1) {
    for (let right = left + 1; right < prompts.length; right += 1) {
      const first = prompts[left];
      const second = prompts[right];
      if (options.requireIds && !options.requireIds.has(first.id) && !options.requireIds.has(second.id)) continue;
      const comparison = comparePrompts(first, second, options.synonyms);
      if (comparison.score >= (options.threshold ?? 0.62)) {
        pairs.push({ first, second, ...comparison });
      }
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, options.limit ?? 8);
}
