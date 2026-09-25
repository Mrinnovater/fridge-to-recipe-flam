import { z } from "zod";

export const ALLOWED_UNITS = [
  "g",
  "ml",
  "tbsp",
  "tsp",
  "cup",
  "pieces",
  "cloves",
  "slices",
  "pinches"
];

export const RequestPayloadSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Prompt must be at least 3 characters.")
    .max(2000, "Prompt must not exceed 2000 characters.")
});

export const IngredientSchema = z
  .object({
    id: z.string().regex(/^ing-[a-z0-9]+$/, "Invalid ingredient ID format."),
    name: z.string().min(2).max(60),
    type: z.enum(["supplied", "additional_required"]),
    quantityType: z.enum(["numeric", "non_numeric"]),
    baseAmount: z.number().positive().finite().max(50000).nullable(),
    unit: z.enum(ALLOWED_UNITS).nullable(),
    displayText: z.string().min(1).max(40).nullable()
  })
  .superRefine((data, ctx) => {
    if (data.quantityType === "numeric") {
      if (data.baseAmount === null || data.baseAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric ingredients must have a positive baseAmount.",
          path: ["baseAmount"]
        });
      }
      if (data.unit === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric ingredients must have a valid unit.",
          path: ["unit"]
        });
      }
      if (data.displayText !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric ingredients must have null displayText.",
          path: ["displayText"]
        });
      }
    } else {
      if (data.baseAmount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-numeric ingredients must have null baseAmount.",
          path: ["baseAmount"]
        });
      }
      if (data.unit !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-numeric ingredients must have null unit.",
          path: ["unit"]
        });
      }
      if (data.displayText === null || data.displayText.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-numeric ingredients must provide displayText.",
          path: ["displayText"]
        });
      }
    }
  });

export const StepOverrideSchema = z.object({
  stepId: z.string().regex(/^step-[0-9]+$/, "Invalid step override ID."),
  instruction: z.string().min(5).max(500)
});

export const SwapSchema = z
  .object({
    id: z.string().regex(/^swap-[0-9]+$/, "Invalid swap ID format."),
    targetIngredientId: z.string(),
    replacementName: z.string().min(2).max(60),
    type: z.enum(["supplied", "additional_required"]),
    quantityType: z.enum(["numeric", "non_numeric"]),
    baseAmount: z.number().positive().finite().max(50000).nullable(),
    unit: z.enum(ALLOWED_UNITS).nullable(),
    stepOverrides: z.array(StepOverrideSchema).max(5).default([])
  })
  .superRefine((data, ctx) => {
    if (data.quantityType === "numeric") {
      if (data.baseAmount === null || data.baseAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric swaps must have a positive baseAmount.",
          path: ["baseAmount"]
        });
      }
      if (data.unit === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Numeric swaps must have a valid unit.",
          path: ["unit"]
        });
      }
    } else {
      if (data.baseAmount !== null || data.unit !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-numeric swaps must have null baseAmount and unit.",
          path: ["baseAmount"]
        });
      }
    }
  });

export const StepSchema = z.object({
  id: z.string().regex(/^step-[0-9]+$/, "Invalid step ID format."),
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(5).max(500),
  ingredientReferences: z.array(z.string()).default([])
});

export const RecipePayloadSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).min(3).max(32),
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(300),
  baseServings: z.number().int().min(1).max(12),
  prepTimeMinutes: z.number().int().min(0).max(360),
  cookTimeMinutes: z.number().int().min(0).max(360),
  assumptions: z.array(z.string().min(5).max(200)).max(10).default([]),
  ingredients: z.array(IngredientSchema).min(1).max(40),
  swaps: z.array(SwapSchema).max(8).default([]),
  steps: z.array(StepSchema).min(1).max(30)
});

export const CannotGenerateSchema = z.object({
  status: z.literal("cannot_generate"),
  reason: z.string().min(5).max(500),
  code: z.enum([
    "INSUFFICIENT_INGREDIENTS",
    "INCORRECT_OR_INEDIBLE_ITEMS",
    "IRRECONCILABLE_RESTRICTIONS"
  ]),
  suggestions: z.array(z.string().min(3).max(200)).min(1).max(5)
});

export const SuccessResponseSchema = z.object({
  status: z.literal("success"),
  recipe: RecipePayloadSchema
});

export const ErrorResponseSchema = z.object({
  status: z.literal("error"),
  error: z.object({
    code: z.enum([
      "BAD_REQUEST",
      "SERVICE_NOT_CONFIGURED",
      "PROVIDER_TIMEOUT",
      "PROVIDER_QUOTA",
      "SCHEMA_VALIDATION_FAILED",
      "INTERNAL_ERROR"
    ]),
    message: z.string(),
    retryable: z.boolean(),
    expectedResetAt: z.string().datetime().nullable().optional().catch(null)
  })
});

export function extractIngredientTokens(instruction) {
  const matches = instruction.matchAll(/\{ing:([a-z0-9-]+)\}/g);
  const ids = [];
  for (const match of matches) {
    ids.push(match[1]);
  }
  return ids;
}

export function validateRecipeBusinessRules(recipe) {
  const errors = [];

  const ingredientIds = new Set();
  for (const ingredient of recipe.ingredients) {
    if (ingredientIds.has(ingredient.id)) {
      errors.push(`Duplicate ingredient ID: ${ingredient.id}`);
    }
    ingredientIds.add(ingredient.id);
  }

  const stepIds = new Set();
  for (const step of recipe.steps) {
    if (stepIds.has(step.id)) {
      errors.push(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);

    const stepIngredientRefs = new Set(step.ingredientReferences);
    for (const ref of step.ingredientReferences) {
      if (!ingredientIds.has(ref)) {
        errors.push(`Step ${step.id} references non-existent ingredient: ${ref}`);
      }
    }

    const tokenIds = extractIngredientTokens(step.instruction);
    for (const tokenId of tokenIds) {
      if (!ingredientIds.has(tokenId)) {
        errors.push(`Step ${step.id} has token pointing to unknown ingredient: ${tokenId}`);
      }
      if (!stepIngredientRefs.has(tokenId)) {
        errors.push(`Step ${step.id} token ${tokenId} not listed in ingredientReferences`);
      }
    }
  }

  const swapIds = new Set();
  for (const swap of recipe.swaps) {
    if (swapIds.has(swap.id)) {
      errors.push(`Duplicate swap ID: ${swap.id}`);
    }
    swapIds.add(swap.id);

    if (!ingredientIds.has(swap.targetIngredientId)) {
      errors.push(`Swap ${swap.id} targets non-existent ingredient: ${swap.targetIngredientId}`);
    }

    const seenOverrideSteps = new Set();
    for (const override of swap.stepOverrides) {
      if (!stepIds.has(override.stepId)) {
        errors.push(`Swap ${swap.id} overrides non-existent step: ${override.stepId}`);
      }
      if (seenOverrideSteps.has(override.stepId)) {
        errors.push(`Swap ${swap.id} overrides step ${override.stepId} more than once`);
      }
      seenOverrideSteps.add(override.stepId);

      const overrideTokens = extractIngredientTokens(override.instruction);
      for (const tokenId of overrideTokens) {
        if (!ingredientIds.has(tokenId)) {
          errors.push(`Swap ${swap.id} override token points to unknown ingredient: ${tokenId}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createErrorResponse(code, message, retryable = false, expectedResetAt = null) {
  const error = {
    code,
    message,
    retryable
  };
  if (expectedResetAt !== null && expectedResetAt !== undefined) {
    error.expectedResetAt = expectedResetAt;
  }
  return {
    status: "error",
    error
  };
}
