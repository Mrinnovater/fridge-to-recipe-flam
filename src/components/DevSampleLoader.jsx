export function DevSampleLoader({ onLoadSample }) {
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleClick = async () => {
    const { SAMPLE_RECIPE } = await import("../dev/sampleRecipe.js");
    onLoadSample(SAMPLE_RECIPE);
  };

  return (
    <div className="dev-sample-bar" role="region" aria-label="Development testing tools">
      <span className="dev-badge">DEV TOOL</span>
      <button
        type="button"
        className="dev-load-sample-btn"
        onClick={handleClick}
      >
        Load sample recipe
      </button>
    </div>
  );
}
