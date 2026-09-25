export const SAMPLE_RECIPE = {
  id: "rcp-andhra-mutton-biryani",
  title: "Andhra-style Mutton Dum Biryani",
  description: "A fragrant, layered Telugu-style dum biryani with tender cooked boneless mutton, whole spices, browned onions, herbs, and parboiled aged basmati rice.",
  baseServings: 4,
  prepTimeMinutes: 25,
  cookTimeMinutes: 65,
  assumptions: [
    "Rice quantity refers to dry, uncooked aged long-grain basmati rice.",
    "Mutton quantity refers to trimmed boneless pieces cut into bite-sized chunks.",
    "Stated times exclude passive 30-minute mutton marination and rice soaking.",
    "Cooked-mutton-first method ensures tender meat before the final dum stage.",
    "Cooking time does not multiply with portions; heat distribution varies by vessel size.",
    "This is an illustrative home-cooking guide, not a certified regional standard."
  ],
  ingredients: [
    {
      id: "ing-1",
      name: "boneless mutton",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 500,
      unit: "g",
      displayText: null
    },
    {
      id: "ing-2",
      name: "aged basmati rice (uncooked)",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 400,
      unit: "g",
      displayText: null
    },
    {
      id: "ing-3",
      name: "plain curd (yogurt)",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 150,
      unit: "g",
      displayText: null
    },
    {
      id: "ing-4",
      name: "red onions",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 3,
      unit: "pieces",
      displayText: null
    },
    {
      id: "ing-5",
      name: "ginger-garlic paste",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 2,
      unit: "tbsp",
      displayText: null
    },
    {
      id: "ing-6",
      name: "green chillies",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 4,
      unit: "pieces",
      displayText: null
    },
    {
      id: "ing-7",
      name: "fresh mint leaves",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 0.5,
      unit: "cup",
      displayText: null
    },
    {
      id: "ing-8",
      name: "fresh coriander leaves",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 0.5,
      unit: "cup",
      displayText: null
    },
    {
      id: "ing-9",
      name: "red chilli powder",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 1.5,
      unit: "tsp",
      displayText: null
    },
    {
      id: "ing-10",
      name: "turmeric powder",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 0.5,
      unit: "tsp",
      displayText: null
    },
    {
      id: "ing-11",
      name: "salt",
      type: "supplied",
      quantityType: "numeric",
      baseAmount: 2,
      unit: "tsp",
      displayText: null
    },
    {
      id: "ing-12",
      name: "whole biryani spices",
      type: "additional_required",
      quantityType: "numeric",
      baseAmount: 1,
      unit: "tbsp",
      displayText: null
    },
    {
      id: "ing-13",
      name: "desi ghee",
      type: "additional_required",
      quantityType: "numeric",
      baseAmount: 3,
      unit: "tbsp",
      displayText: null
    },
    {
      id: "ing-14",
      name: "water",
      type: "additional_required",
      quantityType: "numeric",
      baseAmount: 6,
      unit: "cup",
      displayText: null
    }
  ],
  swaps: [
    {
      id: "swap-1",
      targetIngredientId: "ing-13",
      replacementName: "neutral cooking oil",
      type: "additional_required",
      quantityType: "numeric",
      baseAmount: 3,
      unit: "tbsp",
      stepOverrides: [
        {
          stepId: "step-3",
          instruction: "Heat two-thirds of {ing:ing-13} in a heavy-bottomed pot over medium heat, fry sliced {ing:ing-4} until deep golden brown, reserve half for layering, then add slit {ing:ing-6} and marinated {ing:ing-1}."
        },
        {
          stepId: "step-7",
          instruction: "Top the rice with reserved browned {ing:ing-4}, chopped {ing:ing-7}, {ing:ing-8}, and drizzle remaining {ing:ing-13} over the surface."
        }
      ]
    }
  ],
  steps: [
    {
      id: "step-1",
      stepNumber: 1,
      instruction: "In a bowl, mix {ing:ing-1} with {ing:ing-3}, {ing:ing-5}, {ing:ing-9}, {ing:ing-10}, and half of {ing:ing-11}; set aside to marinate.",
      ingredientReferences: ["ing-1", "ing-3", "ing-5", "ing-9", "ing-10", "ing-11"]
    },
    {
      id: "step-2",
      stepNumber: 2,
      instruction: "Rinse {ing:ing-2} until water runs clear, soak in fresh water for 30 minutes, then drain thoroughly.",
      ingredientReferences: ["ing-2"]
    },
    {
      id: "step-3",
      stepNumber: 3,
      instruction: "Heat two-thirds of {ing:ing-13} in a heavy-bottomed pot over medium heat, fry sliced {ing:ing-4} until deep golden brown, reserve half for layering, then add slit {ing:ing-6} and marinated {ing:ing-1}.",
      ingredientReferences: ["ing-13", "ing-4", "ing-6", "ing-1"]
    },
    {
      id: "step-4",
      stepNumber: 4,
      instruction: "Pour 1 cup of {ing:ing-14} into the pot, cover tightly, and simmer over low heat for 35 to 40 minutes until {ing:ing-1} is tender and coated in thick masala.",
      ingredientReferences: ["ing-14", "ing-1"]
    },
    {
      id: "step-5",
      stepNumber: 5,
      instruction: "In a second pot, boil remaining {ing:ing-14} with {ing:ing-12} and remaining {ing:ing-11}, add drained {ing:ing-2}, cook for 5 to 6 minutes until 70 percent done, then drain.",
      ingredientReferences: ["ing-14", "ing-12", "ing-11", "ing-2"]
    },
    {
      id: "step-6",
      stepNumber: 6,
      instruction: "Evenly spread the cooked {ing:ing-1} masala across the base of the heavy pot, then layer the parboiled {ing:ing-2} over the meat.",
      ingredientReferences: ["ing-1", "ing-2"]
    },
    {
      id: "step-7",
      stepNumber: 7,
      instruction: "Top the rice with reserved browned {ing:ing-4}, chopped {ing:ing-7}, {ing:ing-8}, and drizzle remaining {ing:ing-13} over the surface.",
      ingredientReferences: ["ing-4", "ing-7", "ing-8", "ing-13"]
    },
    {
      id: "step-8",
      stepNumber: 8,
      instruction: "Seal the pot with a heavy tight lid, place over low heat, and cook on dum for 18 to 20 minutes.",
      ingredientReferences: []
    },
    {
      id: "step-9",
      stepNumber: 9,
      instruction: "Rest the biryani off heat for 10 minutes, then gently fluff and serve the spiced {ing:ing-1} with aromatic {ing:ing-2}.",
      ingredientReferences: ["ing-1", "ing-2"]
    }
  ]
};
