import { z } from "zod";

import {
  canonicalizeResearchModeCategories,
  researchModeCategoryOrder,
  researchModeCategorySchema,
  type ResearchModeCategory,
} from "@/lib/research/mode/public-contracts";

export const comparisonPriorityOrder = [
  "affordability",
  "research",
  "scholarships",
  "outcomes",
  "support",
] as const;

export type ComparisonPriority = typeof comparisonPriorityOrder[number];

export const comparisonPriorityCategory: Readonly<Record<ComparisonPriority, ResearchModeCategory>> = {
  affordability: "tuition",
  research: "research",
  scholarships: "scholarships",
  outcomes: "outcomes",
  support: "support",
};

export const comparisonDefaultWeights = {
  affordability: 30,
  research: 30,
  scholarships: 20,
  outcomes: 20,
  support: 0,
} as const satisfies Record<ComparisonPriority, number>;

const comparisonIdSchema = z.string().trim().min(1).max(120);

export const comparisonTargetSchema = z.object({
  universityId: comparisonIdSchema,
  programId: comparisonIdSchema.optional(),
}).strict();

export type ComparisonTarget = z.infer<typeof comparisonTargetSchema>;

export const comparisonPriorityWeightsSchema = z.object({
  affordability: z.number().int().min(0).max(100),
  research: z.number().int().min(0).max(100),
  scholarships: z.number().int().min(0).max(100),
  outcomes: z.number().int().min(0).max(100),
  support: z.number().int().min(0).max(100),
}).strict().superRefine((weights, context) => {
  const total = comparisonPriorityOrder.reduce((sum, priority) => sum + weights[priority], 0);
  if (total !== 100) {
    context.addIssue({
      code: "custom",
      message: "comparison priority weights must total exactly 100",
    });
  }
});

export type ComparisonPriorityWeights = z.infer<typeof comparisonPriorityWeightsSchema>;

export const comparisonSubmissionSchema = z.object({
  targets: z.array(comparisonTargetSchema).min(2).max(4),
  categories: z.array(researchModeCategorySchema).min(1).max(researchModeCategoryOrder.length)
    .transform((categories) => canonicalizeResearchModeCategories(categories)),
  weights: comparisonPriorityWeightsSchema,
  showRankingEvidence: z.boolean(),
  showAnecdotalEvidence: z.boolean(),
  intake: z.string().trim().min(1).max(40).optional(),
  academicYear: z.string().trim().min(1).max(40).optional(),
}).strict().superRefine((submission, context) => {
  const targetKeys = submission.targets.map(comparisonTargetKey);
  if (new Set(targetKeys).size !== targetKeys.length) {
    context.addIssue({ code: "custom", message: "comparison targets must be unique", path: ["targets"] });
  }
  const programScope = submission.targets.map((target) => target.programId !== undefined);
  if (programScope.some((value) => value !== programScope[0])) {
    context.addIssue({ code: "custom", message: "comparison targets must use one scope", path: ["targets"] });
  }
  const selectedCategories = new Set(submission.categories);
  for (const priority of comparisonPriorityOrder) {
    if (submission.weights[priority] > 0 && !selectedCategories.has(comparisonPriorityCategory[priority])) {
      context.addIssue({
        code: "custom",
        message: `positive ${priority} weight requires ${comparisonPriorityCategory[priority]} research`,
        path: ["categories"],
      });
    }
  }
});

export type ComparisonSubmission = Readonly<{
  targets: readonly ComparisonTarget[];
  categories: readonly ResearchModeCategory[];
  weights: Readonly<ComparisonPriorityWeights>;
  showRankingEvidence: boolean;
  showAnecdotalEvidence: boolean;
  intake?: string;
  academicYear?: string;
}>;

export function comparisonTargetKey(target: ComparisonTarget): string {
  return `${target.universityId}::${target.programId ?? ""}`;
}

export function freezeComparisonSubmission(
  input: z.output<typeof comparisonSubmissionSchema>,
): ComparisonSubmission {
  const targets = Object.freeze(input.targets.map((target) => Object.freeze({ ...target })));
  const categories = Object.freeze([...input.categories]);
  const weights = Object.freeze({ ...input.weights });
  return Object.freeze({
    targets,
    categories,
    weights,
    showRankingEvidence: input.showRankingEvidence,
    showAnecdotalEvidence: input.showAnecdotalEvidence,
    ...(input.intake === undefined ? {} : { intake: input.intake }),
    ...(input.academicYear === undefined ? {} : { academicYear: input.academicYear }),
  });
}
