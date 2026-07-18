import { z } from "zod";
import { inputFieldSchema } from "./catalog.ts";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const humanGuideSchema = z.object({
  overview: z.string().min(1),
  useWhen: z.array(z.string().min(1)).min(1),
  doNotUseWhen: z.array(z.string().min(1)).min(1),
  requiredMaterials: z.array(z.string().min(1)),
  expectedResult: z.string().min(1),
  exampleInput: z.string().min(1),
  exampleOutput: z.string().min(1)
});

export const executionSpecSchema = z.object({
  role: z.string().min(1),
  requiredInputs: z.array(inputFieldSchema),
  optionalInputs: z.array(inputFieldSchema),
  steps: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).min(1),
  outputContract: z.array(z.string().min(1)).min(1),
  missingInputPolicy: z.string().min(1),
  sourceMaterialPolicy: z.string().min(1),
  instruction: z.string().min(20)
});

export const referencePromptSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().regex(slugPattern),
  slug: z.string().regex(slugPattern),
  version: z.number().int().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  emoji: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().regex(slugPattern),
  categoryLabel: z.string().min(1),
  tags: z.array(z.string().min(1)),
  updatedAt: z.string().regex(datePattern),
  humanGuide: humanGuideSchema,
  executionSpec: executionSpecSchema,
  searchPhrases: z.array(z.string().min(1)),
  relatedIds: z.array(z.string().regex(slugPattern)),
  compatibleModifiers: z.array(z.string().regex(slugPattern)),
  changelog: z.array(z.object({
    version: z.number().int().min(1),
    date: z.string().regex(datePattern),
    note: z.string().min(1)
  })).min(1)
});

export type HumanGuide = z.infer<typeof humanGuideSchema>;
export type ExecutionSpec = z.infer<typeof executionSpecSchema>;
export type ReferencePrompt = z.infer<typeof referencePromptSchema>;
