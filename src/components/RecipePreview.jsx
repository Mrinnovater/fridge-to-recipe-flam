import { formatIngredientQuantity } from "../lib/scaling.js";

function renderInstructionWithTokens(instruction, ingredients) {
  const parts = [];
  let lastIndex = 0;
  const regex = /\{ing:([a-z0-9-]+)\}/g;
  let match;

  while ((match = regex.exec(instruction)) !== null) {
    if (match.index > lastIndex) {
      parts.push(instruction.slice(lastIndex, match.index));
    }
    const ingredientId = match[1];
    const found = ingredients.find((i) => i.id === ingredientId);
    parts.push(
      <strong key={`${ingredientId}-${match.index}`} className="instruction-ingredient">
        {found ? found.name : ingredientId}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < instruction.length) {
    parts.push(instruction.slice(lastIndex));
  }

  return parts;
}

export function RecipePreview({ recipe }) {
  if (!recipe) {
    return null;
  }

  const suppliedIngredients = recipe.ingredients.filter((i) => i.type === "supplied");
  const additionalIngredients = recipe.ingredients.filter((i) => i.type === "additional_required");

  return (
    <article className="recipe-preview-card">
      <header className="recipe-preview-header">
        <span className="recipe-eyebrow">Your Recipe</span>
        <h2 className="recipe-title">{recipe.title}</h2>
        <p className="recipe-description">{recipe.description}</p>
        <div className="recipe-meta-row">
          <div className="meta-badge">
            <span className="meta-label">Servings</span>
            <span className="meta-value">{recipe.baseServings}</span>
          </div>
          <div className="meta-badge">
            <span className="meta-label">Prep time</span>
            <span className="meta-value">{recipe.prepTimeMinutes} mins</span>
          </div>
          <div className="meta-badge">
            <span className="meta-label">Cook time</span>
            <span className="meta-value">{recipe.cookTimeMinutes} mins</span>
          </div>
        </div>
      </header>

      {recipe.assumptions && recipe.assumptions.length > 0 && (
        <section className="recipe-assumptions">
          <h3 className="section-title-sm">Recipe Notes & Assumptions</h3>
          <ul className="assumptions-list">
            {recipe.assumptions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="recipe-ingredients-section">
        <h3 className="section-title">Ingredients</h3>

        {suppliedIngredients.length > 0 && (
          <div className="ingredient-group">
            <h4 className="ingredient-group-title">From Your Kitchen</h4>
            <ul className="ingredients-list">
              {suppliedIngredients.map((ing) => (
                <li key={ing.id} className="ingredient-item">
                  <span className="ingredient-name">{ing.name}</span>
                  <span className="ingredient-qty">
                    {formatIngredientQuantity(ing, recipe.baseServings, recipe.baseServings)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {additionalIngredients.length > 0 && (
          <div className="ingredient-group">
            <h4 className="ingredient-group-title">Additional Required</h4>
            <ul className="ingredients-list">
              {additionalIngredients.map((ing) => (
                <li key={ing.id} className="ingredient-item">
                  <span className="ingredient-name">{ing.name}</span>
                  <span className="ingredient-qty">
                    {formatIngredientQuantity(ing, recipe.baseServings, recipe.baseServings)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="recipe-steps-section">
        <h3 className="section-title">Cooking Steps</h3>
        <ol className="steps-list">
          {recipe.steps.map((step) => (
            <li key={step.id} className="step-item">
              <span className="step-number">{step.stepNumber}</span>
              <p className="step-text">
                {renderInstructionWithTokens(step.instruction, recipe.ingredients)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.swaps && recipe.swaps.length > 0 && (
        <section className="recipe-swaps-preview">
          <h3 className="section-title-sm">Available Swaps</h3>
          <ul className="swaps-preview-list">
            {recipe.swaps.map((swap) => {
              const target = recipe.ingredients.find((i) => i.id === swap.targetIngredientId);
              return (
                <li key={swap.id} className="swap-preview-item">
                  <span>
                    Replace <strong>{target ? target.name : swap.targetIngredientId}</strong> with{" "}
                    <strong>{swap.replacementName}</strong>
                    {swap.baseAmount ? ` (${swap.baseAmount} ${swap.unit || ""})` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </article>
  );
}
