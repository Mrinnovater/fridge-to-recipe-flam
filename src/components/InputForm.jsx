import { useRotatingLoadingMessage } from "./CreativeLoadingState.jsx";

export function InputForm({
  prompt,
  onChangePrompt,
  onSubmit,
  onCancel,
  status
}) {
  const trimmedLength = prompt.trim().length;
  const isTooShort = trimmedLength < 3;
  const isTooLong = prompt.length > 2000;
  const isLoading = status === "loading";
  const rotatingMessage = useRotatingLoadingMessage();

  return (
    <div className="kitchen-card">
      <h2 className="card-title">What’s in your kitchen?</h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="ingredient-input" className="form-label">
            Ingredients, pantry items, or leftovers
          </label>
          <div className="textarea-wrap">
            <textarea
              id="ingredient-input"
              className="kitchen-textarea"
              placeholder="Rice, eggs, onions, a little oil… Dinner for two, mildly spicy."
              value={prompt}
              onChange={(e) => onChangePrompt(e.target.value)}
              disabled={isLoading}
              maxLength={2000}
              aria-describedby="field-helper char-indicator"
            />
          </div>
          <div className="field-meta">
            <span id="field-helper" className="helper-text">
              Include quantities, servings, and anything you avoid.
            </span>
            <span
              id="char-indicator"
              className={`counter ${prompt.length >= 1900 ? "near-limit" : ""}`}
              aria-live="polite"
            >
              {prompt.length} / 2000
            </span>
          </div>
        </div>

        <div className="actions-row">
          <button
            type="submit"
            className="submit-btn"
            disabled={isTooShort || isTooLong || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-icon" aria-hidden="true" />
                <span>{rotatingMessage}</span>
              </>
            ) : (
              "Create my recipe"
            )}
          </button>

          {isLoading && (
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
