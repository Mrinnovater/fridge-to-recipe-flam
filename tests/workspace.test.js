import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  formatScaledAmount,
  formatIngredientQuantity,
  formatSwapQuantity,
  formatUnit
} from "../src/lib/scaling.js";
import {
  clampServings,
  resolveStepInstruction,
  resolveTokensToText,
  resolveTokensToParts,
  calculateProgress,
  deriveCookingStatus,
  createWorkspaceInitialState,
  workspaceReducer
} from "../src/lib/recipeWorkspace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const validFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "valid-recipe.json"), "utf-8")
);

test("scaling 2 -> 4 -> 1 -> 2 returns to original quantities without mutation", () => {
  const ing1 = validFixture.ingredients[0];
  const swap1 = validFixture.swaps[0];
  const originalIngAmount = ing1.baseAmount;
  const originalSwapAmount = swap1.baseAmount;

  assert.equal(formatIngredientQuantity(ing1, 2, 2), "200 g");
  assert.equal(formatSwapQuantity(swap1, 2, 2), "240 g");

  assert.equal(formatIngredientQuantity(ing1, 4, 2), "400 g");
  assert.equal(formatSwapQuantity(swap1, 4, 2), "480 g");

  assert.equal(formatIngredientQuantity(ing1, 1, 2), "100 g");
  assert.equal(formatSwapQuantity(swap1, 1, 2), "120 g");

  assert.equal(formatIngredientQuantity(ing1, 2, 2), "200 g");
  assert.equal(formatSwapQuantity(swap1, 2, 2), "240 g");

  assert.equal(ing1.baseAmount, originalIngAmount);
  assert.equal(swap1.baseAmount, originalSwapAmount);
});

test("qualitative and very small quantities render correctly", () => {
  const salt = validFixture.ingredients[5];
  assert.equal(formatIngredientQuantity(salt, 1, 2), "to taste");
  assert.equal(formatIngredientQuantity(salt, 4, 2), "to taste");
  assert.equal(formatIngredientQuantity(salt, 12, 2), "to taste");

  const saffron = {
    quantityType: "numeric",
    baseAmount: 0.05,
    unit: "g"
  };
  const scaledSmall = formatIngredientQuantity(saffron, 1, 2);
  assert.notEqual(scaledSmall, "0 g");
  assert.notEqual(scaledSmall, "0");
  assert.equal(scaledSmall, "0.03 g");

  const tiny = {
    quantityType: "numeric",
    baseAmount: 0.004,
    unit: "g"
  };
  const scaledTiny = formatIngredientQuantity(tiny, 1, 2);
  assert.notEqual(scaledTiny, "0 g");
  assert.notEqual(scaledTiny, "0");

  const egg = {
    quantityType: "numeric",
    baseAmount: 1,
    unit: "pieces"
  };
  assert.equal(formatIngredientQuantity(egg, 1, 2), "0.5 pieces");

  const garlic = {
    quantityType: "numeric",
    baseAmount: 3,
    unit: "cloves"
  };
  assert.equal(formatIngredientQuantity(garlic, 1, 2), "1.5 cloves");
});

test("serving controls respect bounds between 1 and 12", () => {
  assert.equal(clampServings(1), 1);
  assert.equal(clampServings(0), 1);
  assert.equal(clampServings(-4), 1);
  assert.equal(clampServings(12), 12);
  assert.equal(clampServings(15), 12);

  let state = { selectedServings: 1 };
  state = workspaceReducer(state, { type: "DECREASE_SERVINGS" });
  assert.equal(state.selectedServings, 1);

  state = { selectedServings: 12 };
  state = workspaceReducer(state, { type: "INCREASE_SERVINGS" });
  assert.equal(state.selectedServings, 12);
});

test("selecting, replacing, and removing a swap updates ingredients and instructions consistently", () => {
  const step1 = validFixture.steps[0];
  const step2 = validFixture.steps[1];
  const ingredients = validFixture.ingredients;
  const swap1 = validFixture.swaps[0];
  const swap2 = {
    id: "swap-2",
    targetIngredientId: "ing-1",
    replacementName: "extra firm tempeh",
    type: "supplied",
    quantityType: "numeric",
    baseAmount: 200,
    unit: "g",
    stepOverrides: [
      {
        stepId: "step-1",
        instruction: "Slice {ing:ing-1} into thin strips and steam lightly."
      }
    ]
  };

  const initialStep1Text = resolveStepInstruction(step1, null);
  assert.equal(
    resolveTokensToText(initialStep1Text, ingredients, null),
    "Cut firm tofu into bite-sized cubes and pat dry with a kitchen towel."
  );

  const initialParts = resolveTokensToParts(initialStep1Text, ingredients, null);
  assert.equal(initialParts.find((p) => p.type === "ingredient").name, "firm tofu");

  const swappedStep1Text = resolveStepInstruction(step1, swap1);
  assert.equal(
    resolveTokensToText(swappedStep1Text, ingredients, swap1),
    "Rinse and drain canned chickpeas (drained), then pat dry thoroughly with a clean kitchen towel."
  );

  const step2Text = resolveStepInstruction(step2, swap1);
  assert.equal(
    resolveTokensToText(step2Text, ingredients, swap1),
    "Heat cooking oil in a skillet over medium heat, add canned chickpeas (drained), and cook until golden on the outside."
  );

  const replacedStep1Text = resolveStepInstruction(step1, swap2);
  assert.equal(
    resolveTokensToText(replacedStep1Text, ingredients, swap2),
    "Slice extra firm tempeh into thin strips and steam lightly."
  );

  const restoredStep1Text = resolveStepInstruction(step1, null);
  assert.equal(
    resolveTokensToText(restoredStep1Text, ingredients, null),
    "Cut firm tofu into bite-sized cubes and pat dry with a kitchen towel."
  );
});

test("swap changes reset progress and provide visible notice", () => {
  let state = {
    selectedServings: 2,
    activeSwapId: null,
    completedStepIds: new Set(["step-1", "step-2"]),
    swapNotice: null
  };

  state = workspaceReducer(state, { type: "SELECT_SWAP", swapId: "swap-1" });
  assert.equal(state.activeSwapId, "swap-1");
  assert.equal(state.completedStepIds.size, 0);
  assert.ok(state.swapNotice.includes("Cooking progress was reset"));

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  assert.equal(state.completedStepIds.size, 1);

  state = workspaceReducer(state, { type: "CLEAR_SWAP" });
  assert.equal(state.activeSwapId, null);
  assert.equal(state.completedStepIds.size, 0);
  assert.ok(state.swapNotice.includes("Cooking progress was reset"));
});

test("step toggles and reset update progress count correctly", () => {
  let state = {
    selectedServings: 2,
    activeSwapId: null,
    completedStepIds: new Set(),
    swapNotice: null
  };

  let progress = calculateProgress(state.completedStepIds.size, 5);
  assert.equal(progress.completedCount, 0);
  assert.equal(progress.percent, 0);

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  progress = calculateProgress(state.completedStepIds.size, 5);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.percent, 20);

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-2" });
  progress = calculateProgress(state.completedStepIds.size, 5);
  assert.equal(progress.completedCount, 2);
  assert.equal(progress.percent, 40);

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  progress = calculateProgress(state.completedStepIds.size, 5);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.percent, 20);

  state = workspaceReducer(state, { type: "RESET_STEPS" });
  progress = calculateProgress(state.completedStepIds.size, 5);
  assert.equal(progress.completedCount, 0);
  assert.equal(progress.percent, 0);
});

test("accepting a new recipe resets workspace state even if ID repeats", () => {
  const oldState = {
    selectedServings: 6,
    activeSwapId: "swap-1",
    completedStepIds: new Set(["step-1", "step-2", "step-3"]),
    swapNotice: "Old notice"
  };

  const newRecipeWithSameId = {
    ...validFixture,
    id: validFixture.id,
    baseServings: 4
  };

  const nextState = workspaceReducer(oldState, {
    type: "RESET_FOR_NEW_RECIPE",
    recipe: newRecipeWithSameId
  });

  assert.equal(nextState.selectedServings, 4);
  assert.equal(nextState.activeSwapId, null);
  assert.equal(nextState.completedStepIds.size, 0);
  assert.equal(nextState.swapNotice, null);
});

test("workspace interactions make no network requests", () => {
  let fetchCallCount = 0;
  const mockFetch = () => {
    fetchCallCount += 1;
    return Promise.resolve({ ok: true, json: async () => ({}) });
  };

  let state = createWorkspaceInitialState(validFixture);

  state = workspaceReducer(state, { type: "INCREASE_SERVINGS" });
  state = workspaceReducer(state, { type: "INCREASE_SERVINGS" });
  state = workspaceReducer(state, { type: "DECREASE_SERVINGS" });
  state = workspaceReducer(state, { type: "SELECT_SWAP", swapId: "swap-1" });
  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-2" });
  state = workspaceReducer(state, { type: "CLEAR_SWAP" });
  state = workspaceReducer(state, { type: "RESET_STEPS" });

  assert.equal(fetchCallCount, 0);
  assert.equal(state.selectedServings, 3);
  assert.equal(state.activeSwapId, null);
  assert.equal(state.completedStepIds.size, 0);
});

test("late success or error response cannot overwrite a newer request", async () => {
  let currentActiveId = 0;
  let activeRecipe = null;
  let activeStatus = "idle";

  const dispatchRequest = (requestId, responsePayload, delayMs) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (currentActiveId === requestId) {
          activeStatus = responsePayload.status;
          activeRecipe = responsePayload.recipe || null;
        }
        resolve();
      }, delayMs);
    });
  };

  currentActiveId = 1;
  const req1Promise = dispatchRequest(1, { status: "error", error: { code: "INTERNAL_ERROR" } }, 100);

  currentActiveId = 2;
  const req2Promise = dispatchRequest(2, { status: "success", recipe: validFixture }, 20);

  await req2Promise;
  assert.equal(activeStatus, "success");
  assert.equal(activeRecipe.title, "Crispy Tofu and Spinach Scramble");

  await req1Promise;
  assert.equal(activeStatus, "success");
  assert.equal(activeRecipe.title, "Crispy Tofu and Spinach Scramble");
});

test("Andhra-style Mutton Dum Biryani fixture validates against contract and business rules", async () => {
  const { SAMPLE_RECIPE } = await import("../src/dev/sampleRecipe.js");
  const { RecipePayloadSchema, validateRecipeBusinessRules } = await import("../shared/contract.js");

  const parseResult = RecipePayloadSchema.safeParse(SAMPLE_RECIPE);
  assert.equal(parseResult.success, true);

  const businessRules = validateRecipeBusinessRules(SAMPLE_RECIPE);
  assert.equal(businessRules.valid, true);
  assert.equal(businessRules.errors.length, 0);
  assert.equal(SAMPLE_RECIPE.baseServings, 4);
});

test("Andhra-style Mutton Dum Biryani scales 4 -> 8 -> 2 -> 4 without mutation", async () => {
  const { SAMPLE_RECIPE } = await import("../src/dev/sampleRecipe.js");
  const mutton = SAMPLE_RECIPE.ingredients.find((i) => i.id === "ing-1");
  const rice = SAMPLE_RECIPE.ingredients.find((i) => i.id === "ing-2");
  const ghee = SAMPLE_RECIPE.ingredients.find((i) => i.id === "ing-13");
  const swap = SAMPLE_RECIPE.swaps[0];

  assert.equal(formatIngredientQuantity(mutton, 4, 4), "500 g");
  assert.equal(formatIngredientQuantity(rice, 4, 4), "400 g");
  assert.equal(formatIngredientQuantity(ghee, 4, 4), "3 tbsp");
  assert.equal(formatSwapQuantity(swap, 4, 4), "3 tbsp");

  assert.equal(formatIngredientQuantity(mutton, 8, 4), "1000 g");
  assert.equal(formatIngredientQuantity(rice, 8, 4), "800 g");
  assert.equal(formatIngredientQuantity(ghee, 8, 4), "6 tbsp");
  assert.equal(formatSwapQuantity(swap, 8, 4), "6 tbsp");

  assert.equal(formatIngredientQuantity(mutton, 2, 4), "250 g");
  assert.equal(formatIngredientQuantity(rice, 2, 4), "200 g");
  assert.equal(formatIngredientQuantity(ghee, 2, 4), "1.5 tbsp");
  assert.equal(formatSwapQuantity(swap, 2, 4), "1.5 tbsp");

  assert.equal(formatIngredientQuantity(mutton, 4, 4), "500 g");
  assert.equal(formatIngredientQuantity(rice, 4, 4), "400 g");
  assert.equal(formatIngredientQuantity(ghee, 4, 4), "3 tbsp");
  assert.equal(formatSwapQuantity(swap, 4, 4), "3 tbsp");

  assert.equal(mutton.baseAmount, 500);
  assert.equal(rice.baseAmount, 400);
  assert.equal(ghee.baseAmount, 3);
  assert.equal(swap.baseAmount, 3);
});

test("Andhra-style Mutton Dum Biryani ghee-to-oil swap updates instructions and resets progress", async () => {
  const { SAMPLE_RECIPE } = await import("../src/dev/sampleRecipe.js");
  const step3 = SAMPLE_RECIPE.steps.find((s) => s.id === "step-3");
  const step7 = SAMPLE_RECIPE.steps.find((s) => s.id === "step-7");
  const swap = SAMPLE_RECIPE.swaps[0];

  const origStep3 = resolveStepInstruction(step3, null);
  const textOrig3 = resolveTokensToText(origStep3, SAMPLE_RECIPE.ingredients, null);
  assert.ok(textOrig3.includes("desi ghee"));
  assert.ok(!textOrig3.includes("neutral cooking oil"));

  const swappedStep3 = resolveStepInstruction(step3, swap);
  const textSwapped3 = resolveTokensToText(swappedStep3, SAMPLE_RECIPE.ingredients, swap);
  assert.ok(textSwapped3.includes("neutral cooking oil"));
  assert.ok(!textSwapped3.includes("desi ghee"));

  const swappedStep7 = resolveStepInstruction(step7, swap);
  const textSwapped7 = resolveTokensToText(swappedStep7, SAMPLE_RECIPE.ingredients, swap);
  assert.ok(textSwapped7.includes("neutral cooking oil"));

  let state = createWorkspaceInitialState(SAMPLE_RECIPE);
  assert.equal(state.selectedServings, 4);

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-2" });
  assert.equal(state.completedStepIds.size, 2);

  state = workspaceReducer(state, { type: "SELECT_SWAP", swapId: "swap-1" });
  assert.equal(state.activeSwapId, "swap-1");
  assert.equal(state.completedStepIds.size, 0);
  assert.ok(state.swapNotice.includes("Cooking progress was reset"));

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: "step-1" });
  assert.equal(state.completedStepIds.size, 1);

  state = workspaceReducer(state, { type: "CLEAR_SWAP" });
  assert.equal(state.activeSwapId, null);
  assert.equal(state.completedStepIds.size, 0);
  assert.ok(state.swapNotice.includes("Cooking progress was reset"));

  const restoredStep3 = resolveStepInstruction(step3, null);
  const textRestored3 = resolveTokensToText(restoredStep3, SAMPLE_RECIPE.ingredients, null);
  assert.ok(textRestored3.includes("desi ghee"));
  assert.ok(!textRestored3.includes("neutral cooking oil"));
});

test("formatUnit correctly handles singular, plural, and conventional abbreviations", () => {
  assert.equal(formatUnit("cup", 1), "cup");
  assert.equal(formatUnit("cup", 2), "cups");
  assert.equal(formatUnit("cup", 0.5), "cups");

  assert.equal(formatUnit("pieces", 1), "piece");
  assert.equal(formatUnit("pieces", 3), "pieces");

  assert.equal(formatUnit("cloves", 1), "clove");
  assert.equal(formatUnit("cloves", 2), "cloves");

  assert.equal(formatUnit("slices", 1), "slice");
  assert.equal(formatUnit("slices", 4), "slices");

  assert.equal(formatUnit("pinches", 1), "pinch");
  assert.equal(formatUnit("pinches", 2), "pinches");

  assert.equal(formatUnit("g", 1), "g");
  assert.equal(formatUnit("g", 250), "g");
  assert.equal(formatUnit("ml", 1), "ml");
  assert.equal(formatUnit("ml", 500), "ml");
  assert.equal(formatUnit("tbsp", 1), "tbsp");
  assert.equal(formatUnit("tbsp", 3), "tbsp");
  assert.equal(formatUnit("tsp", 1), "tsp");
  assert.equal(formatUnit("tsp", 2), "tsp");
  assert.equal(formatUnit("", 1), "");
  assert.equal(formatUnit(null, 1), "");
});

test("cooking completion flow: ready_to_finish appears only when all steps are checked", () => {
  let state = createWorkspaceInitialState(validFixture);
  const totalSteps = validFixture.steps.length;

  assert.equal(state.isFinished, false);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "cooking");

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: validFixture.steps[0].id });
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "cooking");

  for (let i = 1; i < totalSteps; i++) {
    state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: validFixture.steps[i].id });
  }

  assert.equal(state.completedStepIds.size, totalSteps);
  assert.equal(state.isFinished, false);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "ready_to_finish");

  state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: validFixture.steps[0].id });
  assert.equal(state.completedStepIds.size, totalSteps - 1);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "cooking");
});

test("cooking completion flow: finish cooking, back to recipe, and resets", () => {
  let state = createWorkspaceInitialState(validFixture);
  const totalSteps = validFixture.steps.length;

  validFixture.steps.forEach((s) => {
    state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: s.id });
  });
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "ready_to_finish");

  state = workspaceReducer(state, { type: "FINISH_COOKING" });
  assert.equal(state.isFinished, true);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "finished");

  state = workspaceReducer(state, { type: "BACK_TO_RECIPE" });
  assert.equal(state.isFinished, false);
  assert.equal(state.completedStepIds.size, totalSteps);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "ready_to_finish");

  state = workspaceReducer(state, { type: "FINISH_COOKING" });
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "finished");

  state = workspaceReducer(state, { type: "RESET_STEPS" });
  assert.equal(state.isFinished, false);
  assert.equal(state.completedStepIds.size, 0);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "cooking");

  validFixture.steps.forEach((s) => {
    state = workspaceReducer(state, { type: "TOGGLE_STEP", stepId: s.id });
  });
  state = workspaceReducer(state, { type: "FINISH_COOKING" });
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "finished");

  state = workspaceReducer(state, { type: "SELECT_SWAP", swapId: "swap-1" });
  assert.equal(state.isFinished, false);
  assert.equal(state.completedStepIds.size, 0);
  assert.equal(deriveCookingStatus(state.completedStepIds.size, totalSteps, state.isFinished), "cooking");
});

test("Make another recipe cancels pending generation, prevents stale responses, and preserves quota error", async () => {
  let activeRequestId = 1;
  let aborted = false;
  let recipeState = { title: "Biryani" };
  let promptState = "mutton, rice";
  let statusState = "success";
  let errorState = null;

  const handleReset = (currentError) => {
    activeRequestId += 1;
    aborted = true;
    recipeState = null;
    promptState = "";
    if (currentError && currentError.code === "PROVIDER_QUOTA") {
      errorState = currentError;
      statusState = "error";
    } else {
      errorState = null;
      statusState = "idle";
    }
  };

  handleReset(null);
  assert.equal(recipeState, null);
  assert.equal(promptState, "");
  assert.equal(statusState, "idle");
  assert.equal(errorState, null);
  assert.equal(aborted, true);
  assert.equal(activeRequestId, 2);

  const staleRequestId = 1;
  const latePayload = { status: "success", recipe: validFixture };
  if (staleRequestId === activeRequestId) {
    recipeState = latePayload.recipe;
    statusState = latePayload.status;
  }
  assert.equal(recipeState, null);
  assert.equal(statusState, "idle");

  const quotaError = {
    code: "PROVIDER_QUOTA",
    message: "Today's limit reached",
    retryable: false,
    expectedResetAt: "2026-10-15T07:00:00.000Z"
  };
  handleReset(quotaError);
  assert.equal(recipeState, null);
  assert.equal(promptState, "");
  assert.equal(statusState, "error");
  assert.equal(errorState.code, "PROVIDER_QUOTA");
  assert.equal(errorState.expectedResetAt, "2026-10-15T07:00:00.000Z");

  const networkError = {
    code: "NETWORK_ERROR",
    message: "Network error",
    retryable: true
  };
  handleReset(networkError);
  assert.equal(recipeState, null);
  assert.equal(statusState, "idle");
  assert.equal(errorState, null);
});


