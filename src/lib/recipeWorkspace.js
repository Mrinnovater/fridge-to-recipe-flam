export function clampServings(servings) {
  if (typeof servings !== "number" || isNaN(servings)) {
    return 1;
  }
  return Math.max(1, Math.min(12, Math.round(servings)));
}

export function resolveStepInstruction(step, activeSwap) {
  if (!step) {
    return "";
  }
  if (activeSwap && Array.isArray(activeSwap.stepOverrides)) {
    const override = activeSwap.stepOverrides.find((o) => o.stepId === step.id);
    if (override && typeof override.instruction === "string") {
      return override.instruction;
    }
  }
  return step.instruction || "";
}

export function resolveTokensToText(instruction, ingredients = [], activeSwap = null) {
  if (!instruction) {
    return "";
  }
  const regex = /\{ing:([a-z0-9-]+)\}/g;
  return instruction.replace(regex, (match, ingredientId) => {
    if (activeSwap && activeSwap.targetIngredientId === ingredientId) {
      return activeSwap.replacementName;
    }
    const found = ingredients.find((i) => i.id === ingredientId);
    return found ? found.name : ingredientId;
  });
}

export function resolveTokensToParts(instruction, ingredients = [], activeSwap = null) {
  if (!instruction) {
    return [];
  }
  const parts = [];
  let lastIndex = 0;
  const regex = /\{ing:([a-z0-9-]+)\}/g;
  let match;

  while ((match = regex.exec(instruction)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: instruction.slice(lastIndex, match.index)
      });
    }
    const ingredientId = match[1];
    let displayName = ingredientId;

    if (activeSwap && activeSwap.targetIngredientId === ingredientId) {
      displayName = activeSwap.replacementName;
    } else {
      const found = ingredients.find((i) => i.id === ingredientId);
      if (found) {
        displayName = found.name;
      }
    }

    parts.push({
      type: "ingredient",
      id: ingredientId,
      name: displayName,
      key: `${ingredientId}-${match.index}`
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < instruction.length) {
    parts.push({
      type: "text",
      value: instruction.slice(lastIndex)
    });
  }

  return parts;
}

export function calculateProgress(completedCount, totalSteps) {
  const safeTotal = Math.max(0, totalSteps);
  const safeCount = Math.max(0, Math.min(safeTotal, completedCount));
  const percent = safeTotal > 0 ? Math.round((safeCount / safeTotal) * 100) : 0;
  return {
    completedCount: safeCount,
    totalSteps: safeTotal,
    percent
  };
}

export function deriveCookingStatus(completedCount, totalSteps, isFinished = false) {
  if (isFinished) {
    return "finished";
  }
  if (totalSteps > 0 && completedCount === totalSteps) {
    return "ready_to_finish";
  }
  return "cooking";
}

export function createWorkspaceInitialState(recipe) {
  return {
    selectedServings: recipe?.baseServings ? clampServings(recipe.baseServings) : 2,
    activeSwapId: null,
    completedStepIds: new Set(),
    swapNotice: null,
    isFinished: false
  };
}

export function workspaceReducer(state, action) {
  switch (action.type) {
    case "DECREASE_SERVINGS":
      return {
        ...state,
        selectedServings: Math.max(1, state.selectedServings - 1)
      };

    case "INCREASE_SERVINGS":
      return {
        ...state,
        selectedServings: Math.min(12, state.selectedServings + 1)
      };

    case "SELECT_SWAP":
      if (state.activeSwapId === action.swapId) {
        return state;
      }
      return {
        ...state,
        activeSwapId: action.swapId,
        completedStepIds: new Set(),
        swapNotice: "Cooking progress was reset because the recipe instructions changed for the selected swap.",
        isFinished: false
      };

    case "CLEAR_SWAP":
      if (state.activeSwapId === null) {
        return state;
      }
      return {
        ...state,
        activeSwapId: null,
        completedStepIds: new Set(),
        swapNotice: "Cooking progress was reset because original ingredients and instructions were restored.",
        isFinished: false
      };

    case "TOGGLE_STEP": {
      const next = new Set(state.completedStepIds);
      if (next.has(action.stepId)) {
        next.delete(action.stepId);
      } else {
        next.add(action.stepId);
      }
      return {
        ...state,
        completedStepIds: next,
        isFinished: false
      };
    }

    case "RESET_STEPS":
      return {
        ...state,
        completedStepIds: new Set(),
        isFinished: false
      };

    case "FINISH_COOKING":
      return {
        ...state,
        isFinished: true
      };

    case "BACK_TO_RECIPE":
      return {
        ...state,
        isFinished: false
      };

    case "CLEAR_NOTICE":
      return {
        ...state,
        swapNotice: null
      };

    case "RESET_FOR_NEW_RECIPE":
      return createWorkspaceInitialState(action.recipe);

    default:
      return state;
  }
}
