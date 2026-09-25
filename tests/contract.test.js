import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  RequestPayloadSchema,
  RecipePayloadSchema,
  validateRecipeBusinessRules
} from "../shared/contract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const validFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "valid-recipe.json"), "utf-8")
);

test("valid fixture passes schema and business rule validation", () => {
  const parsed = RecipePayloadSchema.safeParse(validFixture);
  assert.equal(parsed.success, true);

  const businessRules = validateRecipeBusinessRules(parsed.data);
  assert.equal(businessRules.valid, true);
  assert.equal(businessRules.errors.length, 0);
});

test("request payload validation enforces length limits", () => {
  const tooShort = RequestPayloadSchema.safeParse({ prompt: "ab" });
  assert.equal(tooShort.success, false);

  const emptyWhitespace = RequestPayloadSchema.safeParse({ prompt: "   " });
  assert.equal(emptyWhitespace.success, false);

  const validPrompt = RequestPayloadSchema.safeParse({ prompt: "Eggs, tomatoes, cheese" });
  assert.equal(validPrompt.success, true);

  const tooLongPrompt = RequestPayloadSchema.safeParse({ prompt: "a".repeat(2001) });
  assert.equal(tooLongPrompt.success, false);
});

test("rejects invalid numeric quantities", () => {
  const invalidNegative = JSON.parse(JSON.stringify(validFixture));
  invalidNegative.ingredients[0].baseAmount = -10;
  const parsedNegative = RecipePayloadSchema.safeParse(invalidNegative);
  assert.equal(parsedNegative.success, false);

  const invalidZero = JSON.parse(JSON.stringify(validFixture));
  invalidZero.ingredients[0].baseAmount = 0;
  const parsedZero = RecipePayloadSchema.safeParse(invalidZero);
  assert.equal(parsedZero.success, false);

  const invalidNonNumericWithAmount = JSON.parse(JSON.stringify(validFixture));
  invalidNonNumericWithAmount.ingredients[5].baseAmount = 5;
  const parsedNonNumeric = RecipePayloadSchema.safeParse(invalidNonNumericWithAmount);
  assert.equal(parsedNonNumeric.success, false);
});

test("detects duplicate ingredient, step, and swap IDs", () => {
  const duplicateIng = JSON.parse(JSON.stringify(validFixture));
  duplicateIng.ingredients.push({ ...duplicateIng.ingredients[0] });
  const ingRules = validateRecipeBusinessRules(duplicateIng);
  assert.equal(ingRules.valid, false);
  assert.ok(ingRules.errors.some((e) => e.includes("Duplicate ingredient ID")));

  const duplicateStep = JSON.parse(JSON.stringify(validFixture));
  duplicateStep.steps.push({ ...duplicateStep.steps[0] });
  const stepRules = validateRecipeBusinessRules(duplicateStep);
  assert.equal(stepRules.valid, false);
  assert.ok(stepRules.errors.some((e) => e.includes("Duplicate step ID")));

  const duplicateSwap = JSON.parse(JSON.stringify(validFixture));
  duplicateSwap.swaps.push({ ...duplicateSwap.swaps[0] });
  const swapRules = validateRecipeBusinessRules(duplicateSwap);
  assert.equal(swapRules.valid, false);
  assert.ok(swapRules.errors.some((e) => e.includes("Duplicate swap ID")));
});

test("detects missing ingredient references and invalid tokens", () => {
  const missingRef = JSON.parse(JSON.stringify(validFixture));
  missingRef.steps[0].ingredientReferences = ["ing-nonexistent"];
  missingRef.steps[0].instruction = "Cut {ing:ing-nonexistent} into pieces.";
  const refRules = validateRecipeBusinessRules(missingRef);
  assert.equal(refRules.valid, false);
  assert.ok(refRules.errors.some((e) => e.includes("references non-existent ingredient")));

  const undeclaredToken = JSON.parse(JSON.stringify(validFixture));
  undeclaredToken.steps[0].instruction = "Cut {ing:ing-2} and {ing:ing-1} into pieces.";
  const tokenRules = validateRecipeBusinessRules(undeclaredToken);
  assert.equal(tokenRules.valid, false);
  assert.ok(tokenRules.errors.some((e) => e.includes("not listed in ingredientReferences")));
});

test("detects invalid swap targets and step overrides", () => {
  const invalidSwapTarget = JSON.parse(JSON.stringify(validFixture));
  invalidSwapTarget.swaps[0].targetIngredientId = "ing-unknown";
  const swapTargetRules = validateRecipeBusinessRules(invalidSwapTarget);
  assert.equal(swapTargetRules.valid, false);
  assert.ok(swapTargetRules.errors.some((e) => e.includes("targets non-existent ingredient")));

  const invalidOverrideStep = JSON.parse(JSON.stringify(validFixture));
  invalidOverrideStep.swaps[0].stepOverrides = [
    { stepId: "step-99", instruction: "Do something with {ing:ing-1}." }
  ];
  const overrideRules = validateRecipeBusinessRules(invalidOverrideStep);
  assert.equal(overrideRules.valid, false);
  assert.ok(overrideRules.errors.some((e) => e.includes("overrides non-existent step")));

  const duplicateOverride = JSON.parse(JSON.stringify(validFixture));
  duplicateOverride.swaps[0].stepOverrides = [
    { stepId: "step-1", instruction: "First override for {ing:ing-1}." },
    { stepId: "step-1", instruction: "Second override for {ing:ing-1}." }
  ];
  const duplicateOverrideRules = validateRecipeBusinessRules(duplicateOverride);
  assert.equal(duplicateOverrideRules.valid, false);
  assert.ok(duplicateOverrideRules.errors.some((e) => e.includes("more than once")));
});
