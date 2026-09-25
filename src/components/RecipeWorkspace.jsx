import { useReducer, useCallback } from "react";
import {
  createWorkspaceInitialState,
  workspaceReducer,
  deriveCookingStatus
} from "../lib/recipeWorkspace.js";
import { ServingsControl } from "./ServingsControl.jsx";
import { IngredientsList } from "./IngredientsList.jsx";
import { SwapsSection } from "./SwapsSection.jsx";
import { CookingSteps } from "./CookingSteps.jsx";

export function RecipeWorkspace({ recipe, headingRef, onMakeAnotherRecipe }) {
  if (!recipe) {
    return null;
  }

  const [state, dispatch] = useReducer(
    workspaceReducer,
    recipe,
    createWorkspaceInitialState
  );

  const { selectedServings, activeSwapId, completedStepIds, swapNotice, isFinished } = state;
  const activeSwap = recipe.swaps?.find((s) => s.id === activeSwapId) || null;
  const cookingStatus = deriveCookingStatus(completedStepIds.size, recipe.steps.length, isFinished);

  const handleDecreaseServings = useCallback(() => {
    dispatch({ type: "DECREASE_SERVINGS" });
  }, []);

  const handleIncreaseServings = useCallback(() => {
    dispatch({ type: "INCREASE_SERVINGS" });
  }, []);

  const handleSelectSwap = useCallback((swapId) => {
    dispatch({ type: "SELECT_SWAP", swapId });
  }, []);

  const handleClearSwap = useCallback(() => {
    dispatch({ type: "CLEAR_SWAP" });
  }, []);

  const handleToggleStep = useCallback((stepId) => {
    dispatch({ type: "TOGGLE_STEP", stepId });
  }, []);

  const handleResetSteps = useCallback(() => {
    dispatch({ type: "RESET_STEPS" });
  }, []);

  const handleFinishCooking = useCallback(() => {
    dispatch({ type: "FINISH_COOKING" });
  }, []);

  const handleBackToRecipe = useCallback(() => {
    dispatch({ type: "BACK_TO_RECIPE" });
  }, []);

  const handleDismissNotice = useCallback(() => {
    dispatch({ type: "CLEAR_NOTICE" });
  }, []);

  return (
    <article className="recipe-workspace-card">
      <div className="recipe-visual-masthead" role="img" aria-label="Culinary recipe showcase">
        <img
          src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80"
          alt="Freshly prepared culinary meal"
          className="masthead-bg-image"
          loading="lazy"
        />
        <div className="masthead-gradient-overlay" />
        <div className="masthead-content">
          <div className="masthead-icon-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="masthead-svg">
              <path d="M18 2v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V2" />
              <line x1="12" y1="14" x2="12" y2="22" />
              <line x1="9" y1="22" x2="15" y2="22" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="12" y1="2" x2="12" y2="6" />
            </svg>
          </div>
          <div className="masthead-details">
            <span className="masthead-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", marginRight: "5px", verticalAlign: "-1px" }}>
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
              Chef Crafted • Freshly Plated
            </span>
            <span className="masthead-cuisine">{recipe.title}</span>
          </div>
        </div>
      </div>

      <header className="workspace-header">
        <div className="workspace-header-top">
          <span className="workspace-eyebrow">Interactive Kitchen Guide</span>
          <h2
            ref={headingRef}
            tabIndex="-1"
            className="workspace-title"
          >
            {recipe.title}
          </h2>
          <p className="workspace-description">
            {recipe.description}
            {activeSwap && (
              <span className="active-swap-note">
                {" "}(Adjusted: using {activeSwap.replacementName} instead of {recipe.ingredients.find((i) => i.id === activeSwap.targetIngredientId)?.name || "original ingredient"}.)
              </span>
            )}
          </p>
        </div>

        <div className="workspace-meta-bar">
          <ServingsControl
            servings={selectedServings}
            onDecrease={handleDecreaseServings}
            onIncrease={handleIncreaseServings}
          />
          <div className="meta-time-group">
            <div className="meta-time-badge">
              <span className="time-label">Prep Time</span>
              <span className="time-val">{recipe.prepTimeMinutes} mins</span>
            </div>
            <div className="meta-time-badge">
              <span className="time-label">Cook Time</span>
              <span className="time-val">{recipe.cookTimeMinutes} mins</span>
            </div>
            <div className="meta-time-badge">
              <span className="time-label">Total Time</span>
              <span className="time-val">{recipe.prepTimeMinutes + recipe.cookTimeMinutes} mins</span>
            </div>
          </div>
        </div>

        {recipe.assumptions && recipe.assumptions.length > 0 && (
          <div className="workspace-overview-assumptions" role="note" aria-label="Recipe assumptions">
            <h4 className="assumptions-heading">Assumptions &amp; Prep Notes</h4>
            <ul className="assumptions-list">
              {recipe.assumptions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {swapNotice && (
        <div className="swap-notice-banner" role="status">
          <div className="swap-notice-content">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>{swapNotice}</span>
          </div>
          <button
            type="button"
            className="dismiss-notice-btn"
            onClick={handleDismissNotice}
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      <div className="workspace-body-layout">
        <aside className="workspace-aside">
          <section className="workspace-panel ingredients-panel">
            <h3 className="panel-title">Ingredients</h3>
            <IngredientsList
              ingredients={recipe.ingredients}
              activeSwap={activeSwap}
              selectedServings={selectedServings}
              baseServings={recipe.baseServings}
            />
          </section>

          <section className="workspace-panel swaps-panel">
            <SwapsSection
              swaps={recipe.swaps}
              ingredients={recipe.ingredients}
              activeSwapId={activeSwapId}
              onSelectSwap={handleSelectSwap}
              onClearSwap={handleClearSwap}
              selectedServings={selectedServings}
              baseServings={recipe.baseServings}
            />
          </section>
        </aside>

        <main className="workspace-main-panel">
          <section className="workspace-panel steps-panel">
            <CookingSteps
              steps={recipe.steps}
              ingredients={recipe.ingredients}
              activeSwap={activeSwap}
              completedStepIds={completedStepIds}
              cookingStatus={cookingStatus}
              onToggleStep={handleToggleStep}
              onResetSteps={handleResetSteps}
              onFinishCooking={handleFinishCooking}
              onBackToRecipe={handleBackToRecipe}
              onMakeAnotherRecipe={onMakeAnotherRecipe}
            />
          </section>
        </main>
      </div>
    </article>
  );
}
