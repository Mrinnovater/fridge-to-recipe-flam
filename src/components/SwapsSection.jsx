import { formatSwapQuantity } from "../lib/scaling.js";

export function SwapsSection({
  swaps,
  ingredients,
  activeSwapId,
  onSelectSwap,
  onClearSwap,
  selectedServings,
  baseServings
}) {
  if (!swaps || swaps.length === 0) {
    return (
      <div className="empty-swaps-box" role="note">
        <span className="empty-swaps-text">No ingredient substitutions available for this recipe.</span>
      </div>
    );
  }

  return (
    <div className="swaps-card">
      <div className="swaps-header">
        <h4 className="swaps-title">Ingredient Swaps</h4>
        <span className="swaps-subtitle">Choose at most one alternative</span>
      </div>

      <div className="swaps-list">
        {swaps.map((swap) => {
          const target = ingredients.find((i) => i.id === swap.targetIngredientId);
          const targetName = target ? target.name : swap.targetIngredientId;
          const isActive = activeSwapId === swap.id;
          const scaledQty = formatSwapQuantity(swap, selectedServings, baseServings);
          const needsSourcing = swap.type === "additional_required";

          return (
            <div
              key={swap.id}
              className={`swap-card-item ${isActive ? "active-swap" : ""}`}
            >
              <div className="swap-card-body">
                <div className="swap-pair">
                  <span className="swap-target-label">Original:</span>
                  <span className="swap-target-name">{targetName}</span>
                </div>
                <div className="swap-arrow-row" aria-hidden="true">↓</div>
                <div className="swap-pair">
                  <span className="swap-replacement-label">Substitute:</span>
                  <span className="swap-replacement-name">
                    {swap.replacementName}
                    {scaledQty ? ` (${scaledQty})` : ""}
                  </span>
                </div>
                <div className="swap-tags">
                  <span className={`swap-source-tag ${needsSourcing ? "needs-source" : "in-kitchen"}`}>
                    {needsSourcing ? "Needs to be sourced" : "In your kitchen"}
                  </span>
                  {isActive && <span className="active-tag">Active</span>}
                </div>
              </div>

              <div className="swap-card-actions">
                {isActive ? (
                  <button
                    type="button"
                    className="swap-btn remove-swap-btn"
                    onClick={onClearSwap}
                  >
                    Use original ingredient
                  </button>
                ) : (
                  <button
                    type="button"
                    className="swap-btn apply-swap-btn"
                    onClick={() => onSelectSwap(swap.id)}
                  >
                    Use {swap.replacementName}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
