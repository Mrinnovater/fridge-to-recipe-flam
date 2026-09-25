import { useState, useCallback, useRef, useEffect, Suspense, lazy } from "react";
import { useRecipeGenerator } from "./hooks/useRecipeGenerator.js";
import { InputForm } from "./components/InputForm.jsx";
import { RecipeWorkspace } from "./components/RecipeWorkspace.jsx";
import { CannotGenerateNotice } from "./components/CannotGenerateNotice.jsx";
import { DailyQuotaNotice } from "./components/DailyQuotaNotice.jsx";
import { CreativeLoadingState } from "./components/CreativeLoadingState.jsx";
import { isDailyQuotaError } from "./lib/dailyQuota.js";

const DevSampleLoader = import.meta.env.DEV
  ? lazy(() =>
      import("./components/DevSampleLoader.jsx").then((m) => ({
        default: m.DevSampleLoader
      }))
    )
  : () => null;

export default function App() {
  const {
    prompt,
    setPrompt,
    status,
    recipe,
    recipeInstanceId,
    cannotGenerateInfo,
    errorInfo,
    serviceNotice,
    handleSubmit,
    handleCancel,
    handleRetry,
    handleReset
  } = useRecipeGenerator();

  const [sampleRecipeData, setSampleRecipeData] = useState(null);
  const [sampleInstanceId, setSampleInstanceId] = useState(0);

  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem("recipe_app_theme");
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("recipe_app_theme", theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const workspaceContainerRef = useRef(null);
  const prevLoadingRef = useRef(false);
  const prevSampleIdRef = useRef(sampleInstanceId);

  useEffect(() => {
    if (prevLoadingRef.current && status !== "loading" && Boolean(recipe) && workspaceContainerRef.current) {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      workspaceContainerRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
      const heading = workspaceContainerRef.current.querySelector("h2.workspace-title");
      if (heading) {
        heading.focus();
      }
    }
    prevLoadingRef.current = status === "loading";
  }, [status, recipe]);

  useEffect(() => {
    if (sampleInstanceId > 0 && sampleInstanceId !== prevSampleIdRef.current && Boolean(sampleRecipeData) && workspaceContainerRef.current) {
      prevSampleIdRef.current = sampleInstanceId;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      workspaceContainerRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
      const heading = workspaceContainerRef.current.querySelector("h2.workspace-title");
      if (heading) {
        heading.focus();
      }
    }
  }, [sampleInstanceId, sampleRecipeData]);

  const handleLoadSample = useCallback((sampleRecipe) => {
    setSampleRecipeData(sampleRecipe);
    setSampleInstanceId((prev) => prev + 1);
  }, []);

  const handleEditIngredients = useCallback(() => {
    const inputEl = document.getElementById("ingredient-input");
    if (inputEl) {
      inputEl.focus();
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      inputEl.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center"
      });
    }
  }, []);

  const handleMakeAnotherRecipe = useCallback(() => {
    setSampleRecipeData(null);
    handleReset();
    const textarea = document.getElementById("ingredient-input");
    if (textarea) {
      textarea.focus();
    }
  }, [handleReset]);

  const activeRecipe = recipe || sampleRecipeData;
  const isSample = !recipe && Boolean(sampleRecipeData);
  const workspaceKey = recipe ? `real-${recipeInstanceId}` : `sample-${sampleInstanceId}`;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-group">
            <svg
              className="brand-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 13.8a4 4 0 0 1-2-3.4 3.5 3.5 0 0 1 3.5-3.5 3.5 3.5 0 0 1 3.2 2.1 3.5 3.5 0 0 1 6.6.9 3.5 3.5 0 0 1-1.3 3.9" />
              <path d="M6 14h12v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4z" />
              <line x1="6" y1="18" x2="18" y2="18" />
            </svg>
            <div className="brand-text-block">
              <span className="brand-name">Fridge to Recipe</span>
              <span className="brand-tagline">Chef-Crafted Culinary Guide</span>
            </div>
          </div>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg className="theme-toggle-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg className="theme-toggle-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="editorial-container">
        <div className="editorial-grid">
          {activeRecipe ? (
            <section className="intro-column intro-compact">
              <div className="intro-compact-header">
                <span className="eyebrow">From Your Fridge</span>
                <h1 className="headline headline-compact">A good meal starts with what you have.</h1>
              </div>
              <div className="intro-compact-actions">
                <button
                  type="button"
                  className="edit-ingredients-btn"
                  onClick={handleEditIngredients}
                >
                  Edit ingredients
                </button>
              </div>
            </section>
          ) : (
            <section className="intro-column">
              <span className="eyebrow">From Your Fridge</span>
              <h1 className="headline">A good meal starts with what you have.</h1>
              <p className="supporting-copy">
                Tell us the ingredients waiting on your shelves, your preferred servings, and any dietary preferences. We transform everyday kitchen staples into a clear, step-by-step cooking guide.
              </p>

              <div className="hero-food-wrap">
                <img
                  src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80"
                  alt="Aromatic royal mutton biryani cooked with basmati rice, tender meat, and aromatic whole spices"
                  className="hero-food-image"
                  loading="lazy"
                />
              </div>
            </section>
          )}

          <section className="card-column">
            <Suspense fallback={null}>
              <DevSampleLoader onLoadSample={handleLoadSample} />
            </Suspense>

            <InputForm
              prompt={prompt}
              onChangePrompt={setPrompt}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              status={status}
            />

            <div className="status-tray" aria-live="polite">
              {serviceNotice && (
                <div className="notice-banner notice-info" role="status">
                  <svg
                    className="notice-icon"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <span>{serviceNotice}</span>
                  </div>
                </div>
              )}

              {status === "error" && errorInfo && (
                isDailyQuotaError(errorInfo) ? (
                  <DailyQuotaNotice
                    errorInfo={errorInfo}
                    hasActiveRecipe={Boolean(activeRecipe)}
                    onRetry={handleRetry}
                  />
                ) : (
                  <div className="notice-banner notice-error" role="alert">
                    <svg
                      className="notice-icon"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>
                      <p>{errorInfo.message}</p>
                      {errorInfo.retryable && (
                        <button
                          type="button"
                          className="retry-btn"
                          onClick={handleRetry}
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}

              {status === "cannot_generate" && cannotGenerateInfo && (
                <CannotGenerateNotice info={cannotGenerateInfo} />
              )}
            </div>
          </section>
        </div>

        {status === "loading" && (
          <section className="workspace-full-width" aria-label="Creating recipe">
            <CreativeLoadingState />
          </section>
        )}

        {activeRecipe && (
          <section
            ref={workspaceContainerRef}
            className="workspace-full-width"
            aria-label="Recipe workspace"
          >
            {isSample && (
              <div className="sample-recipe-indicator" role="note">
                <span className="sample-indicator-dot" aria-hidden="true">●</span>
                <span>Sample recipe — not generated by the live AI service.</span>
              </div>
            )}
            <RecipeWorkspace
              key={workspaceKey}
              recipe={activeRecipe}
              onMakeAnotherRecipe={handleMakeAnotherRecipe}
            />
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-copyright">© 2026 Innovator. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
