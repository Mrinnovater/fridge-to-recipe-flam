export function formatScaledAmount(baseAmount, selectedServings, baseServings) {
  if (baseAmount === null || baseAmount === undefined || isNaN(baseAmount)) {
    return "";
  }

  const rawScaled = baseAmount * (selectedServings / baseServings);

  if (rawScaled <= 0) {
    return "0";
  }

  if (Number.isInteger(rawScaled)) {
    return rawScaled.toString();
  }

  const rounded = parseFloat(rawScaled.toFixed(2));
  if (rounded === 0) {
    const rounded3 = parseFloat(rawScaled.toFixed(3));
    return rounded3 === 0 ? "<0.01" : rounded3.toString();
  }

  return rounded.toString();
}

export function formatUnit(unit, amount) {
  if (!unit) {
    return "";
  }
  const isSingular = amount === 1;
  switch (unit) {
    case "cup":
      return isSingular ? "cup" : "cups";
    case "pieces":
      return isSingular ? "piece" : "pieces";
    case "cloves":
      return isSingular ? "clove" : "cloves";
    case "slices":
      return isSingular ? "slice" : "slices";
    case "pinches":
      return isSingular ? "pinch" : "pinches";
    default:
      return unit;
  }
}

export function formatIngredientQuantity(ingredient, selectedServings, baseServings) {
  if (ingredient.quantityType === "non_numeric") {
    return ingredient.displayText || "";
  }

  const amountStr = formatScaledAmount(ingredient.baseAmount, selectedServings, baseServings);
  if (!ingredient.unit) {
    return amountStr;
  }

  const numericVal = parseFloat(amountStr);
  const formattedUnit = formatUnit(ingredient.unit, numericVal);
  return `${amountStr} ${formattedUnit}`;
}

export function formatSwapQuantity(swap, selectedServings, baseServings) {
  if (swap.baseAmount === null || swap.baseAmount === undefined) {
    return "";
  }
  const amountStr = formatScaledAmount(swap.baseAmount, selectedServings, baseServings);
  if (!swap.unit) {
    return amountStr;
  }
  const numericVal = parseFloat(amountStr);
  const formattedUnit = formatUnit(swap.unit, numericVal);
  return `${amountStr} ${formattedUnit}`;
}
