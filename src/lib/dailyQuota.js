export function formatExpectedResetTime(isoString, locale) {
  if (!isoString || typeof isoString !== "string") {
    return null;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(date);
  } catch {
    return null;
  }
}

export function isDailyQuotaError(errorInfo) {
  if (!errorInfo || typeof errorInfo !== "object") {
    return false;
  }
  return (
    errorInfo.code === "PROVIDER_QUOTA" &&
    (!errorInfo.retryable || Boolean(errorInfo.expectedResetAt))
  );
}

export function getDailyQuotaDisplayState({
  errorInfo,
  hasActiveRecipe = false,
  currentTime = Date.now(),
  locale
}) {
  const rawReset = errorInfo?.expectedResetAt;
  const resetDate = rawReset ? new Date(rawReset) : null;
  const isValidReset = resetDate instanceof Date && !Number.isNaN(resetDate.getTime());
  const resetTime = isValidReset ? resetDate.getTime() : null;

  const hasResetPassed = resetTime !== null && currentTime >= resetTime;

  let waitingMessage = null;
  let countdownText = null;
  let localResetTimeFormatted = null;

  if (!hasResetPassed) {
    const formatted = isValidReset ? formatExpectedResetTime(rawReset, locale) : null;
    localResetTimeFormatted = formatted;
    waitingMessage = formatted
      ? `New recipes are expected to become available after ${formatted}.`
      : "New recipes are expected to become available after the scheduled daily reset.";

    if (isValidReset && resetTime > currentTime) {
      const diffMs = resetTime - currentTime;
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        countdownText = `${hours} hours and ${minutes} minutes`;
      } else {
        countdownText = `${minutes} minutes`;
      }
    }
  }

  const existingRecipeMessage = hasActiveRecipe
    ? "You can continue using your current recipe."
    : null;

  return {
    heading: "Today’s recipe generation limit has been reached.",
    hasResetPassed,
    waitingMessage,
    countdownText,
    localResetTimeFormatted,
    existingRecipeMessage,
    canRetry: hasResetPassed
  };
}

export function renderDailyQuotaNoticeHtml({
  errorInfo,
  hasActiveRecipe = false,
  currentTime = Date.now(),
  locale
}) {
  const display = getDailyQuotaDisplayState({
    errorInfo,
    hasActiveRecipe,
    currentTime,
    locale
  });

  const parts = [
    `<div class="notice-banner notice-error daily-quota-banner" role="alert">`,
    `<p class="daily-quota-heading">${display.heading}</p>`
  ];
  if (display.waitingMessage) {
    parts.push(`<p class="daily-quota-reset-message">${display.waitingMessage}</p>`);
  }
  if (display.existingRecipeMessage) {
    parts.push(`<p class="daily-quota-existing-recipe">${display.existingRecipeMessage}</p>`);
  }
  if (display.canRetry) {
    parts.push(`<button type="button" class="retry-btn">Try again</button>`);
  }
  parts.push(`</div>`);
  return parts.join("");
}
