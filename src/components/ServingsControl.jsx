export function ServingsControl({ servings, onDecrease, onIncrease }) {
  return (
    <div className="servings-control" role="group" aria-label="Portion size controls">
      <span className="servings-label">Servings</span>
      <div className="servings-stepper">
        <button
          type="button"
          className="servings-btn"
          onClick={onDecrease}
          disabled={servings <= 1}
          aria-label="Decrease servings"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="servings-count" aria-live="polite">
          {servings}
        </span>
        <button
          type="button"
          className="servings-btn"
          onClick={onIncrease}
          disabled={servings >= 12}
          aria-label="Increase servings"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path fillRule="evenodd" d="M10 4.75a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4.75z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
