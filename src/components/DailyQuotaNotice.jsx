import { useState, useEffect } from "react";
import { getDailyQuotaDisplayState } from "../lib/dailyQuota.js";

export function DailyQuotaNotice({
  errorInfo,
  hasActiveRecipe = false,
  onRetry,
  locale,
  currentTime
}) {
  const rawReset = errorInfo?.expectedResetAt;
  const resetDate = rawReset ? new Date(rawReset) : null;
  const isValidReset = resetDate instanceof Date && !Number.isNaN(resetDate.getTime());
  const resetTime = isValidReset ? resetDate.getTime() : null;

  const [now, setNow] = useState(() =>
    typeof currentTime === "number" ? currentTime : Date.now()
  );

  useEffect(() => {
    if (typeof currentTime === "number") {
      setNow(currentTime);
    }
  }, [currentTime]);

  useEffect(() => {
    if (!resetTime || typeof currentTime === "number") {
      return;
    }
    const msRemaining = resetTime - Date.now();
    if (msRemaining <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, msRemaining + 50);
    return () => clearTimeout(timer);
  }, [resetTime, currentTime]);

  const activeTime = typeof currentTime === "number" ? currentTime : now;
  const display = getDailyQuotaDisplayState({
    errorInfo,
    hasActiveRecipe,
    currentTime: activeTime,
    locale
  });

  return (
    <div className="notice-banner notice-error daily-quota-banner daily-quota-friendly" role="alert">
      <div className="daily-quota-icon-wrap" aria-hidden="true">
        <svg
          className="notice-icon quota-friendly-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="daily-quota-content">
        <p className="daily-quota-heading">{display.heading}</p>
        {display.countdownText && (
          <p className="daily-quota-friendly-text">
            Our kitchen opens again in <strong>{display.countdownText}</strong>.
          </p>
        )}
        {display.waitingMessage && (
          <p className="daily-quota-reset-message">{display.waitingMessage}</p>
        )}
        {display.existingRecipeMessage && (
          <p className="daily-quota-existing-recipe">{display.existingRecipeMessage}</p>
        )}
        {display.canRetry && (
          <button
            type="button"
            className="retry-btn"
            onClick={onRetry}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
