import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SuccessResponseSchema,
  validateRecipeBusinessRules
} from "../shared/contract.js";

const PANEER_FRIED_RICE_PAYLOAD = {
  status: "success",
  recipe: {
    id: "rcp-paneer-fried-rice",
    title: "Simple Paneer Fried Rice",
    description: "A minimalist and comforting fried rice dish featuring golden paneer cubes and sautéed onions.",
    baseServings: 2,
    prepTimeMinutes: 20,
    cookTimeMinutes: 15,
    assumptions: [
      "Rice needs to be cooked and cooled slightly before frying to prevent stickiness.",
      "Paneer is firm and ready to be cubed."
    ],
    ingredients: [
      {
        id: "ing-1",
        name: "uncooked white rice",
        type: "supplied",
        quantityType: "numeric",
        baseAmount: 1,
        unit: "cup",
        displayText: null
      },
      {
        id: "ing-2",
        name: "paneer cubed",
        type: "supplied",
        quantityType: "numeric",
        baseAmount: 200,
        unit: "g",
        displayText: null
      },
      {
        id: "ing-3",
        name: "diced onions",
        type: "supplied",
        quantityType: "numeric",
        baseAmount: 1,
        unit: "pieces",
        displayText: null
      },
      {
        id: "ing-4",
        name: "cooking oil",
        type: "supplied",
        quantityType: "numeric",
        baseAmount: 2,
        unit: "tbsp",
        displayText: null
      },
      {
        id: "ing-5",
        name: "salt",
        type: "supplied",
        quantityType: "non_numeric",
        baseAmount: null,
        unit: null,
        displayText: "to taste"
      },
      {
        id: "ing-6",
        name: "water",
        type: "supplied",
        quantityType: "numeric",
        baseAmount: 2,
        unit: "cup",
        displayText: null
      }
    ],
    swaps: [],
    steps: [
      {
        id: "step-1",
        stepNumber: 1,
        instruction: "Rinse {ing:ing-1}, then combine with {ing:ing-6} in a pot. Bring to a boil, cover, simmer until cooked, and let cool.",
        ingredientReferences: ["ing-1", "ing-6"]
      },
      {
        id: "step-2",
        stepNumber: 2,
        instruction: "Heat half of the {ing:ing-4} in a pan. Fry {ing:ing-2} cubes until golden on all sides, then remove and set aside.",
        ingredientReferences: ["ing-2", "ing-4"]
      },
      {
        id: "step-3",
        stepNumber: 3,
        instruction: "Add remaining {ing:ing-4} to the pan and sauté {ing:ing-3} until translucent.",
        ingredientReferences: ["ing-3", "ing-4"]
      },
      {
        id: "step-4",
        stepNumber: 4,
        instruction: "Add the cooked {ing:ing-1}, fried {ing:ing-2}, and {ing:ing-5} to the pan. Toss everything together on high heat for 3 minutes.",
        ingredientReferences: ["ing-1", "ing-2", "ing-5"]
      }
    ]
  }
};

test("integration prompt: paneer fried rice response validates strictly against schema and business rules", () => {
  const parseResult = SuccessResponseSchema.safeParse(PANEER_FRIED_RICE_PAYLOAD);
  assert.equal(parseResult.success, true);

  const recipe = parseResult.data.recipe;
  assert.equal(recipe.baseServings, 2);
  assert.equal(recipe.title, "Simple Paneer Fried Rice");
  assert.equal(recipe.steps.length, 4);

  const businessValidation = validateRecipeBusinessRules(recipe);
  assert.equal(businessValidation.valid, true);
  assert.equal(businessValidation.errors.length, 0);

  const allIngredientsSupplied = recipe.ingredients.every((i) => i.type === "supplied");
  assert.equal(allIngredientsSupplied, true);
});
