import { useRef, useEffect } from "react";
import {
  resolveTokensToParts,
  resolveStepInstruction,
  calculateProgress
} from "../lib/recipeWorkspace.js";

export function CookingSteps({
  steps,
  ingredients,
  activeSwap,
  completedStepIds,
  cookingStatus,
  onToggleStep,
  onResetSteps,
  onFinishCooking,
  onBackToRecipe,
  onMakeAnotherRecipe
}) {
  const completionHeadingRef = useRef(null);
  const { completedCount, totalSteps, percent } = calculateProgress(
    completedStepIds.size,
    steps.length
  );

  useEffect(() => {
    if (cookingStatus === "finished" && completionHeadingRef.current) {
      completionHeadingRef.current.focus();
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      completionHeadingRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest"
      });
    }
  }, [cookingStatus]);

  return (
    <div className="steps-container">
      <div className="steps-header">
        <div>
          <h3 className="steps-heading">Cooking Steps</h3>
          <p className="steps-progress-text">
            {completedCount} of {totalSteps} steps completed ({percent}%)
          </p>
        </div>
        <button
          type="button"
          className="reset-steps-btn"
          onClick={onResetSteps}
          disabled={completedCount === 0}
        >
          Reset progress
        </button>
      </div>

      <div
        className="steps-progress-track"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label="Cooking progress"
      >
        <div
          className="steps-progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="steps-interactive-list">
        {steps.map((step) => {
          const isCompleted = completedStepIds.has(step.id);
          const instructionText = resolveStepInstruction(step, activeSwap);
          const parts = resolveTokensToParts(instructionText, ingredients, activeSwap);
          const checkboxId = `step-check-${step.id}`;

          return (
            <li
              key={step.id}
              className={`step-interactive-item ${isCompleted ? "step-completed" : ""}`}
            >
              <div className="step-check-wrap">
                <input
                  type="checkbox"
                  id={checkboxId}
                  className="step-checkbox"
                  checked={isCompleted}
                  onChange={() => onToggleStep(step.id)}
                  aria-label={`Mark step ${step.stepNumber} complete`}
                />
              </div>
              <label htmlFor={checkboxId} className="step-content-label">
                <div className="step-number-tag">Step {step.stepNumber}</div>
                <div className="step-instruction-body">
                  {parts.map((p, idx) =>
                    p.type === "ingredient" ? (
                      <strong key={p.key || idx} className="instruction-ingredient">
                        {p.name}
                      </strong>
                    ) : (
                      <span key={idx}>{p.value}</span>
                    )
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ol>

      {cookingStatus === "ready_to_finish" && (
        <section className="cooking-panel ready-to-finish-panel" aria-label="Ready to finish cooking">
          <div className="completion-content">
            <h4 className="completion-heading">The Final Touch</h4>
            <p className="completion-message">Every step is complete. Time to plate your creation.</p>
          </div>
          <button
            type="button"
            className="finish-cooking-btn"
            onClick={onFinishCooking}
          >
            Serve &amp; Enjoy
          </button>
        </section>
      )}

      {cookingStatus === "finished" && (
        <section
          className="cooking-panel finished-panel"
          aria-label="Cooking finished"
        >
          <div className="completion-content">
            <h4
              ref={completionHeadingRef}
              tabIndex="-1"
              className="completion-heading finished-heading"
            >
              Bon Appétit!
            </h4>
            <p className="completion-message">
              Your culinary masterpiece is ready. Enjoy the meal you crafted.
            </p>
          </div>
          <div className="finished-actions-row">
            <button
              type="button"
              className="make-another-btn"
              onClick={onMakeAnotherRecipe}
            >
              Whip Up Another Recipe
            </button>
            <button
              type="button"
              className="back-to-recipe-btn"
              onClick={onBackToRecipe}
            >
              Review Current Recipe
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
