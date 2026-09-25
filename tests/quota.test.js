import { test } from "node:test";
import assert from "node:assert/strict";
import { getNextPacificMidnightIso } from "../server/gemini.js";
import {
  ErrorResponseSchema,
  createErrorResponse
} from "../shared/contract.js";
import {
  formatExpectedResetTime,
  isDailyQuotaError,
  getDailyQuotaDisplayState,
  renderDailyQuotaNoticeHtml
} from "../src/lib/dailyQuota.js";
import { processRecipeResponse } from "../src/hooks/useRecipeGenerator.js";

test("computes next scheduled Pacific midnight during standard time (PST)", () => {
  const refDate = new Date("2026-01-15T15:00:00.000Z");
  const result = getNextPacificMidnightIso(refDate);
  assert.equal(result, "2026-01-16T08:00:00.000Z");
});

test("computes next scheduled Pacific midnight during daylight saving time (PDT)", () => {
  const refDate = new Date("2026-07-15T15:00:00.000Z");
  const result = getNextPacificMidnightIso(refDate);
  assert.equal(result, "2026-07-16T07:00:00.000Z");
});

test("computes next scheduled Pacific midnight across DST transitions and year boundaries", () => {
  const springForward = new Date("2026-03-08T17:00:00.000Z");
  assert.equal(getNextPacificMidnightIso(springForward), "2026-03-09T07:00:00.000Z");

  const fallBack = new Date("2026-11-01T17:00:00.000Z");
  assert.equal(getNextPacificMidnightIso(fallBack), "2026-11-02T08:00:00.000Z");

  const newYearsEve = new Date("2026-12-31T20:00:00.000Z");
  assert.equal(getNextPacificMidnightIso(newYearsEve), "2027-01-01T08:00:00.000Z");
});

test("rejects invalid reference date in getNextPacificMidnightIso", () => {
  assert.throws(
    () => getNextPacificMidnightIso(new Date("invalid-date")),
    TypeError
  );
});

test("validates error envelope and preserves error on invalid reset metadata", () => {
  const validPayload = createErrorResponse(
    "PROVIDER_QUOTA",
    "The AI service’s daily request limit has been reached. Please try again after the quota resets.",
    false,
    "2026-07-16T07:00:00.000Z"
  );
  const parsed = ErrorResponseSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.error.expectedResetAt, "2026-07-16T07:00:00.000Z");

  const withoutReset = createErrorResponse("BAD_REQUEST", "Invalid prompt.", false);
  const parsedWithout = ErrorResponseSchema.safeParse(withoutReset);
  assert.equal(parsedWithout.success, true);
  assert.equal(parsedWithout.data.error.expectedResetAt, undefined);

  const invalidResetPayload = {
    status: "error",
    error: {
      code: "PROVIDER_QUOTA",
      message: "Daily limit",
      retryable: false,
      expectedResetAt: "not-an-iso-datetime"
    }
  };
  const parsedInvalid = ErrorResponseSchema.safeParse(invalidResetPayload);
  assert.equal(parsedInvalid.success, true);
  assert.equal(parsedInvalid.data.error.code, "PROVIDER_QUOTA");
  assert.equal(parsedInvalid.data.error.expectedResetAt, null);
});

test("formats valid ISO timestamp with localized date, time, and timezone", () => {
  const formattedEn = formatExpectedResetTime("2026-07-16T07:00:00.000Z", "en-US");
  assert.equal(typeof formattedEn, "string");
  assert.ok(formattedEn.includes("2026"));

  assert.equal(formatExpectedResetTime(null), null);
  assert.equal(formatExpectedResetTime("not-a-date"), null);
});

test("falls back cleanly when reset metadata is missing or invalid without inventing a time", () => {
  const missingState = getDailyQuotaDisplayState({
    errorInfo: {
      code: "PROVIDER_QUOTA",
      message: "Daily limit reached",
      retryable: false
    },
    hasActiveRecipe: false
  });
  assert.equal(missingState.hasResetPassed, false);
  assert.equal(missingState.canRetry, false);
  assert.equal(
    missingState.waitingMessage,
    "New recipes are expected to become available after the scheduled daily reset."
  );

  const invalidState = getDailyQuotaDisplayState({
    errorInfo: {
      code: "PROVIDER_QUOTA",
      message: "Daily limit reached",
      retryable: false,
      expectedResetAt: null
    },
    hasActiveRecipe: false
  });
  assert.equal(invalidState.hasResetPassed, false);
  assert.equal(invalidState.canRetry, false);
  assert.equal(
    invalidState.waitingMessage,
    "New recipes are expected to become available after the scheduled daily reset."
  );
});

test("displays existing recipe continuation message when active recipe is present", () => {
  const withRecipe = getDailyQuotaDisplayState({
    errorInfo: {
      code: "PROVIDER_QUOTA",
      retryable: false,
      expectedResetAt: "2026-07-16T07:00:00.000Z"
    },
    hasActiveRecipe: true,
    currentTime: new Date("2026-07-15T20:00:00.000Z").getTime()
  });
  assert.equal(
    withRecipe.existingRecipeMessage,
    "You can continue using your current recipe."
  );

  const withoutRecipe = getDailyQuotaDisplayState({
    errorInfo: {
      code: "PROVIDER_QUOTA",
      retryable: false,
      expectedResetAt: "2026-07-16T07:00:00.000Z"
    },
    hasActiveRecipe: false,
    currentTime: new Date("2026-07-15T20:00:00.000Z").getTime()
  });
  assert.equal(withoutRecipe.existingRecipeMessage, null);
});

test("hides retry before reset and allows manual retry with expired message removed after reset", () => {
  const resetTimestamp = new Date("2026-07-16T07:00:00.000Z").getTime();
  const errorInfo = {
    code: "PROVIDER_QUOTA",
    retryable: false,
    expectedResetAt: "2026-07-16T07:00:00.000Z"
  };

  const beforeReset = getDailyQuotaDisplayState({
    errorInfo,
    hasActiveRecipe: true,
    currentTime: resetTimestamp - 60000,
    locale: "en-US"
  });
  assert.equal(beforeReset.hasResetPassed, false);
  assert.equal(beforeReset.canRetry, false);
  assert.ok(
    beforeReset.waitingMessage.startsWith(
      "New recipes are expected to become available after"
    )
  );

  const afterReset = getDailyQuotaDisplayState({
    errorInfo,
    hasActiveRecipe: true,
    currentTime: resetTimestamp + 1000,
    locale: "en-US"
  });
  assert.equal(afterReset.hasResetPassed, true);
  assert.equal(afterReset.canRetry, true);
  assert.equal(afterReset.waitingMessage, null);
  assert.equal(
    afterReset.existingRecipeMessage,
    "You can continue using your current recipe."
  );
});

test("correctly identifies daily quota errors", () => {
  assert.equal(
    isDailyQuotaError({
      code: "PROVIDER_QUOTA",
      retryable: false
    }),
    true
  );

  assert.equal(
    isDailyQuotaError({
      code: "PROVIDER_QUOTA",
      retryable: false,
      expectedResetAt: "2026-07-16T07:00:00.000Z"
    }),
    true
  );

  assert.equal(
    isDailyQuotaError({
      code: "PROVIDER_QUOTA",
      retryable: true
    }),
    false
  );

  assert.equal(
    isDailyQuotaError({
      code: "PROVIDER_TIMEOUT",
      retryable: true
    }),
    false
  );
});

test("mocked HTTP 429 flow: valid timestamp parses through hook and renders localized date/time", () => {
  const existingRecipe = {
    id: "rcp-existing-1",
    title: "Skillet Scramble",
    baseServings: 2,
    ingredients: [],
    steps: []
  };

  const futureIso = "2026-10-15T07:00:00.000Z";
  const mocked429Payload = {
    status: "error",
    error: {
      code: "PROVIDER_QUOTA",
      message: "The AI service’s daily request limit has been reached. Please try again after the quota resets.",
      retryable: false,
      expectedResetAt: futureIso
    }
  };

  const processed = processRecipeResponse(mocked429Payload, existingRecipe);
  assert.equal(processed.status, "error");
  assert.equal(processed.recipe, existingRecipe);
  assert.equal(processed.errorInfo.code, "PROVIDER_QUOTA");
  assert.equal(processed.errorInfo.retryable, false);
  assert.equal(processed.errorInfo.expectedResetAt, futureIso);

  const beforeTime = new Date("2026-10-15T02:00:00.000Z").getTime();
  const htmlBefore = renderDailyQuotaNoticeHtml({
    errorInfo: processed.errorInfo,
    hasActiveRecipe: Boolean(processed.recipe),
    currentTime: beforeTime,
    locale: "en-US"
  });

  assert.ok(htmlBefore.includes("Today’s recipe generation limit has been reached."));
  assert.ok(htmlBefore.includes("New recipes are expected to become available after"));
  assert.ok(htmlBefore.includes("Oct 15, 2026"));
  assert.ok(htmlBefore.includes("You can continue using your current recipe."));
  assert.ok(!htmlBefore.includes("retry-btn"));
});

test("mocked HTTP 429 flow: missing or invalid timestamp falls back cleanly and preserves recipe", () => {
  const existingRecipe = {
    id: "rcp-existing-2",
    title: "Rice Bowl",
    baseServings: 1
  };

  const mockedMissingPayload = {
    status: "error",
    error: {
      code: "PROVIDER_QUOTA",
      message: "Quota reached",
      retryable: false
    }
  };

  const processedMissing = processRecipeResponse(mockedMissingPayload, existingRecipe);
  assert.equal(processedMissing.status, "error");
  assert.equal(processedMissing.recipe, existingRecipe);
  assert.equal(processedMissing.errorInfo.expectedResetAt, undefined);

  const htmlMissing = renderDailyQuotaNoticeHtml({
    errorInfo: processedMissing.errorInfo,
    hasActiveRecipe: Boolean(processedMissing.recipe),
    currentTime: Date.now(),
    locale: "en-US"
  });

  assert.ok(htmlMissing.includes("Today’s recipe generation limit has been reached."));
  assert.ok(
    htmlMissing.includes("New recipes are expected to become available after the scheduled daily reset.")
  );
  assert.ok(htmlMissing.includes("You can continue using your current recipe."));

  const mockedInvalidPayload = {
    status: "error",
    error: {
      code: "PROVIDER_QUOTA",
      message: "Quota reached",
      retryable: false,
      expectedResetAt: "bad-date-format"
    }
  };

  const processedInvalid = processRecipeResponse(mockedInvalidPayload, existingRecipe);
  assert.equal(processedInvalid.status, "error");
  assert.equal(processedInvalid.recipe, existingRecipe);
  assert.equal(processedInvalid.errorInfo.code, "PROVIDER_QUOTA");
  assert.equal(processedInvalid.errorInfo.expectedResetAt, null);

  const htmlInvalid = renderDailyQuotaNoticeHtml({
    errorInfo: processedInvalid.errorInfo,
    hasActiveRecipe: Boolean(processedInvalid.recipe),
    currentTime: Date.now(),
    locale: "en-US"
  });

  assert.ok(
    htmlInvalid.includes("New recipes are expected to become available after the scheduled daily reset.")
  );
  assert.ok(htmlInvalid.includes("You can continue using your current recipe."));
});

test("mocked HTTP 429 flow: allows manual retry and removes expired notice once reset time passes", () => {
  const resetIso = "2026-10-15T07:00:00.000Z";
  const resetTime = new Date(resetIso).getTime();

  const mockedPayload = {
    status: "error",
    error: {
      code: "PROVIDER_QUOTA",
      message: "Limit reached",
      retryable: false,
      expectedResetAt: resetIso
    }
  };

  const processed = processRecipeResponse(mockedPayload, null);

  const htmlAfter = renderDailyQuotaNoticeHtml({
    errorInfo: processed.errorInfo,
    hasActiveRecipe: false,
    currentTime: resetTime + 5000,
    locale: "en-US"
  });

  assert.ok(htmlAfter.includes("Today’s recipe generation limit has been reached."));
  assert.ok(!htmlAfter.includes("New recipes are expected to become available after"));
  assert.ok(htmlAfter.includes("retry-btn"));
  assert.ok(htmlAfter.includes("Try again"));
});
