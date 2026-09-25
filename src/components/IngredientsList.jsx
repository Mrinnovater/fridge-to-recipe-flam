import { formatIngredientQuantity, formatSwapQuantity } from "../lib/scaling.js";

export function IngredientsList({ ingredients, activeSwap, selectedServings, baseServings }) {
  const supplied = ingredients.filter((i) => i.type === "supplied");
  const additional = ingredients.filter((i) => i.type === "additional_required");

  const renderItem = (ing) => {
    const isSwapped = activeSwap && activeSwap.targetIngredientId === ing.id;

    if (isSwapped) {
      const swapQty = formatSwapQuantity(activeSwap, selectedServings, baseServings);
      return (
        <li key={ing.id} className="ingredient-item swapped-ingredient">
          <div className="ingredient-info">
            <span className="ingredient-name swapped-out">{ing.name}</span>
            <span className="swap-arrow" aria-hidden="true">→</span>
            <span className="ingredient-name swap-in">{activeSwap.replacementName}</span>
            <span className="swap-badge-inline">Active Swap</span>
          </div>
          <span className="ingredient-qty">
            {swapQty || "as desired"}
          </span>
        </li>
      );
    }

    const qty = formatIngredientQuantity(ing, selectedServings, baseServings);
    return (
      <li key={ing.id} className="ingredient-item">
        <div className="ingredient-info">
          <span className="ingredient-name">{ing.name}</span>
        </div>
        <span className="ingredient-qty">{qty}</span>
      </li>
    );
  };

  return (
    <div className="ingredients-container">
      <div className="ingredients-group">
        <div className="group-header">
          <span className="group-badge supplied-badge">Supplied</span>
          <h4 className="group-heading">From Your Kitchen</h4>
        </div>
        {supplied.length > 0 ? (
          <ul className="ingredients-list">
            {supplied.map(renderItem)}
          </ul>
        ) : (
          <p className="quiet-text">No items from your kitchen listed.</p>
        )}
      </div>

      {additional.length > 0 && (
        <div className="ingredients-group">
          <div className="group-header">
            <span className="group-badge additional-badge">Required</span>
            <h4 className="group-heading">Additional Ingredients</h4>
          </div>
          <ul className="ingredients-list">
            {additional.map(renderItem)}
          </ul>
        </div>
      )}
    </div>
  );
}
