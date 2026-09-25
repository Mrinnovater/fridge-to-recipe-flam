import { useState, useEffect } from "react";

const LOADING_MESSAGES = [
  "Firing up the virtual stoves...",
  "Chopping the ingredients...",
  "Balancing the flavors...",
  "Simmering the spices...",
  "Plating your masterpiece..."
];

export function CreativeLoadingState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="creative-loading-container" role="status" aria-live="polite">
      <div className="creative-loading-header">
        <div className="cooking-animation-wrap">
          <div className="cooking-pot-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="steam-svg">
              <path d="M8 2c0 2-2 3-2 5" className="steam-line steam-1" />
              <path d="M12 1c0 2-2 3-2 5" className="steam-line steam-2" />
              <path d="M16 2c0 2-2 3-2 5" className="steam-line steam-3" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pot-svg">
              <path d="M2 12h20" />
              <path d="M20 12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5" />
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="12" y1="5" x2="12" y2="8" />
            </svg>
          </div>
          <div className="spinner-ring" aria-hidden="true" />
        </div>
        <p className="creative-loading-message">{LOADING_MESSAGES[index]}</p>
        <span className="creative-loading-subtext">Curating your customized chef recipe...</span>
      </div>

      <div className="loading-skeleton-preview" aria-hidden="true">
        <div className="skeleton-bar skeleton-title" />
        <div className="skeleton-row">
          <div className="skeleton-badge" />
          <div className="skeleton-badge" />
          <div className="skeleton-badge" />
        </div>
        <div className="skeleton-bar skeleton-desc" />
        <div className="skeleton-bar skeleton-desc short" />
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card tall" />
        </div>
      </div>
    </div>
  );
}

export function useRotatingLoadingMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return LOADING_MESSAGES[index];
}
