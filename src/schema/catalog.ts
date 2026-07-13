import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const variablePattern = /^[a-z][a-zA-Z0-9]*$/;

export const inputFieldSchema = z
  .object({
    id: z.string().regex(variablePattern),
    label: z.string().min(1).max(40),
    type: z.enum(["text", "textarea", "select", "url", "number"]),
    placeholder: z.string().max(100).optional(),
    options: z.array(z.string().min(1)).min(1).max(12).optional()
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && !field.options?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "select型にはoptionsが必要です",
        path: ["options"]
      });
    }
    if (field.type !== "select" && field.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "optionsはselect型だけで使用できます",
        path: ["options"]
      });
    }
  });

export const promptSchema = z.object({
  id: z.string().regex(slugPattern),
  type: z.enum(["base", "workflow"]),
  version: z.number().int().min(1),
  title: z.string().min(1).max(60),
  shortTitle: z.string().min(1).max(15),
  emoji: z.string().min(1).max(8),
  problem: z.string().min(1).max(160),
  summary: z.string().min(1).max(160),
  category: z.string().regex(slugPattern),
  intents: z.array(z.string().regex(slugPattern)).min(1).max(5),
  inputTypes: z.array(z.string().regex(slugPattern)).min(1).max(8),
  outputTypes: z.array(z.string().regex(slugPattern)).min(1).max(8),
  audiences: z.array(z.string().regex(slugPattern)).max(8),
  stages: z.array(z.string().regex(slugPattern)).max(8),
  tags: z.array(z.string().min(1).max(24)).max(8),
  searchPhrases: z.array(z.string().min(2).max(80)).min(5).max(10),
  requiredInputs: z.array(inputFieldSchema).max(2),
  optionalInputs: z.array(inputFieldSchema).max(4),
  promptTemplate: z.string().min(20),
  compatibleModifiers: z.array(z.string().regex(slugPattern)).max(20),
  relatedIds: z.array(z.string().regex(slugPattern)).max(10),
  mobilePriority: z.number().int().min(1).max(5),
  updatedAt: z.string().regex(datePattern)
});

export const modifierSchema = z.object({
  id: z.string().regex(slugPattern),
  title: z.string().min(1).max(30),
  emoji: z.string().min(1).max(8),
  summary: z.string().min(1).max(100),
  slot: z.enum(["stance", "scope", "audience", "output", "process"]),
  text: z.string().min(10),
  conflictsWith: z.array(z.string().regex(slugPattern)).max(10),
  searchPhrases: z.array(z.string().min(2).max(60)).min(2).max(10)
});

export const categorySchema = z.object({
  slug: z.string().regex(slugPattern),
  label: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

export const intentSchema = z.object({
  slug: z.string().regex(slugPattern),
  label: z.string().min(1).max(20),
  order: z.number().int().min(0)
});

export const synonymDictionarySchema = z.record(
  z.string().min(1),
  z.array(z.string().min(1)).min(1)
);

export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  prompts: z.array(promptSchema),
  modifiers: z.array(modifierSchema),
  dictionaries: z.object({
    synonyms: synonymDictionarySchema,
    intents: z.array(intentSchema),
    categories: z.array(categorySchema)
  })
});

export type InputField = z.infer<typeof inputFieldSchema>;
export type Prompt = z.infer<typeof promptSchema>;
export type Modifier = z.infer<typeof modifierSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
