import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { callGeminiRecipe } from "../server/gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const validRecipe = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "valid-recipe.json"), "utf-8")
);

function mockFetch(status, responseData, delayMs = 0) {
  return async (url, options) => {
    if (delayMs > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        if (options && options.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseData,
      text: async () => JSON.stringify(responseData)
    };
  };
}

test("returns 503 SERVICE_NOT_CONFIGURED when API key is missing", async () => {
  const result = await callGeminiRecipe("Eggs and spinach", {
    apiKey: ""
  });
  assert.equal(result.httpStatus, 503);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SERVICE_NOT_CONFIGURED");
  assert.equal(result.payload.error.retryable, false);
});

test("returns 503 SERVICE_NOT_CONFIGURED when API key is placeholder", async () => {
  const result = await callGeminiRecipe("Eggs and spinach", {
    apiKey: "your_actual_key_here"
  });
  assert.equal(result.httpStatus, 503);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SERVICE_NOT_CONFIGURED");
  assert.equal(result.payload.error.retryable, false);
});

test("maps Google 400 API_KEY_INVALID to SERVICE_NOT_CONFIGURED", async () => {
  const googleKeyError = {
    error: {
      code: 400,
      message: "API key not valid. Please pass a valid API key.",
      status: "INVALID_ARGUMENT",
      details: [{ reason: "API_KEY_INVALID" }]
    }
  };

  const result = await callGeminiRecipe("Eggs and spinach", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(400, googleKeyError)
  });

  assert.equal(result.httpStatus, 503);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SERVICE_NOT_CONFIGURED");
  assert.equal(result.payload.error.retryable, false);
});

test("handles valid success response from provider", async () => {
  const providerData = {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ text: JSON.stringify({ status: "success", recipe: validRecipe }) }]
        }
      }
    ]
  };

  const result = await callGeminiRecipe("Firm tofu, eggs, spinach", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.status, "success");
  assert.equal(result.payload.recipe.title, "Crispy Tofu and Spinach Scramble");
});

test("handles cannot_generate response from provider", async () => {
  const cannotGenData = {
    status: "cannot_generate",
    reason: "Only tap water and salt provided.",
    code: "INSUFFICIENT_INGREDIENTS",
    suggestions: ["Add at least one vegetable or protein."]
  };

  const providerData = {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ text: JSON.stringify(cannotGenData) }]
        }
      }
    ]
  };

  const result = await callGeminiRecipe("Water and salt", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.status, "cannot_generate");
  assert.equal(result.payload.code, "INSUFFICIENT_INGREDIENTS");
});

test("rejects empty output from provider", async () => {
  const providerData = {
    candidates: []
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 502);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SCHEMA_VALIDATION_FAILED");
});

test("rejects truncated output from provider (MAX_TOKENS)", async () => {
  const providerData = {
    candidates: [
      {
        finishReason: "MAX_TOKENS",
        content: {
          parts: [{ text: '{"status": "success", "recipe": {' }]
        }
      }
    ]
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 502);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SCHEMA_VALIDATION_FAILED");
});

test("handles provider safety refusal", async () => {
  const providerData = {
    candidates: [
      {
        finishReason: "SAFETY"
      }
    ]
  };

  const result = await callGeminiRecipe("Harmful input", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 200);
  assert.equal(result.payload.status, "cannot_generate");
  assert.equal(result.payload.code, "IRRECONCILABLE_RESTRICTIONS");
});

test("handles malformed JSON from provider", async () => {
  const providerData = {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ text: "{ not valid json at all }" }]
        }
      }
    ]
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 502);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SCHEMA_VALIDATION_FAILED");
});

test("rejects recipe with invalid cross-references", async () => {
  const invalidRecipe = JSON.parse(JSON.stringify(validRecipe));
  invalidRecipe.steps[0].ingredientReferences = ["ing-nonexistent"];
  invalidRecipe.steps[0].instruction = "Heat {ing:ing-nonexistent} in pan.";

  const providerData = {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ text: JSON.stringify({ status: "success", recipe: invalidRecipe }) }]
        }
      }
    ]
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(200, providerData)
  });

  assert.equal(result.httpStatus, 502);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SCHEMA_VALIDATION_FAILED");
});

test("handles provider quota error (429)", async () => {
  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(429, { error: { message: "Quota exceeded" } })
  });

  assert.equal(result.httpStatus, 429);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "PROVIDER_QUOTA");
  assert.equal(result.payload.error.retryable, true);
});

test("prioritizes daily quota message over RetryInfo delay when daily quota exceeded", async () => {
  const dailyQuotaError = {
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      message: "Resource has been exhausted",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [
            {
              quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
              quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
              quotaValue: "20"
            }
          ]
        },
        {
          "@type": "type.googleapis.com/google.rpc.RetryInfo",
          retryDelay: "19s"
        }
      ]
    }
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(429, dailyQuotaError)
  });

  assert.equal(result.httpStatus, 429);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "PROVIDER_QUOTA");
  assert.equal(
    result.payload.error.message,
    "The AI service’s daily request limit has been reached. Please try again after the quota resets."
  );
  assert.equal(result.payload.error.retryable, false);
  assert.equal(typeof result.payload.error.expectedResetAt, "string");
  assert.ok(result.payload.error.expectedResetAt.endsWith("Z"));
});

test("handles provider authentication error (401)", async () => {
  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    fetchFn: mockFetch(401, { error: { message: "API key not valid" } })
  });

  assert.equal(result.httpStatus, 503);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "SERVICE_NOT_CONFIGURED");
});

test("handles provider timeout and aborts signal", async () => {
  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    timeoutMs: 50,
    fetchFn: mockFetch(200, {}, 200)
  });

  assert.equal(result.httpStatus, 504);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "PROVIDER_TIMEOUT");
  assert.equal(result.payload.error.retryable, true);
});

test("propagates client disconnect signal to abort provider request", async () => {
  const clientController = new AbortController();
  setTimeout(() => clientController.abort(), 20);

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    timeoutMs: 5000,
    clientSignal: clientController.signal,
    fetchFn: mockFetch(200, {}, 200)
  });

  assert.equal(result.httpStatus, 504);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "PROVIDER_TIMEOUT");
});

test("provider timeout covers delayed response body streaming", async () => {
  const delayedBodyFetch = async (url, init) => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 150);
          if (init.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
        return {};
      }
    };
  };

  const result = await callGeminiRecipe("Ingredients", {
    apiKey: "dummy-key",
    timeoutMs: 50,
    fetchFn: delayedBodyFetch
  });

  assert.equal(result.httpStatus, 504);
  assert.equal(result.payload.status, "error");
  assert.equal(result.payload.error.code, "PROVIDER_TIMEOUT");
  assert.equal(result.payload.error.retryable, true);
});
