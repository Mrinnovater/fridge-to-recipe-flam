import { CONFIG } from "./config.js";
import {
  ALLOWED_UNITS,
  SuccessResponseSchema,
  CannotGenerateSchema,
  validateRecipeBusinessRules,
  createErrorResponse,
  extractIngredientTokens
} from "../shared/contract.js";

export const PROVIDER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: {
      type: "STRING",
      enum: ["success", "cannot_generate"]
    },
    reason: { type: "STRING" },
    code: {
      type: "STRING",
      enum: [
        "INSUFFICIENT_INGREDIENTS",
        "INCORRECT_OR_INEDIBLE_ITEMS",
        "IRRECONCILABLE_RESTRICTIONS"
      ]
    },
    suggestions: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    recipe: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        title: { type: "STRING" },
        description: { type: "STRING" },
        baseServings: { type: "INTEGER" },
        prepTimeMinutes: { type: "INTEGER" },
        cookTimeMinutes: { type: "INTEGER" },
        assumptions: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        ingredients: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              name: { type: "STRING" },
              type: {
                type: "STRING",
                enum: ["supplied", "additional_required"]
              },
              quantityType: {
                type: "STRING",
                enum: ["numeric", "non_numeric"]
              },
              baseAmount: { type: "NUMBER", nullable: true },
              unit: {
                type: "STRING",
                enum: ALLOWED_UNITS,
                nullable: true
              },
              displayText: { type: "STRING", nullable: true }
            },
            required: ["id", "name", "type", "quantityType"]
          }
        },
        swaps: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              targetIngredientId: { type: "STRING" },
              replacementName: { type: "STRING" },
              type: {
                type: "STRING",
                enum: ["supplied", "additional_required"]
              },
              quantityType: {
                type: "STRING",
                enum: ["numeric", "non_numeric"]
              },
              baseAmount: { type: "NUMBER", nullable: true },
              unit: {
                type: "STRING",
                enum: ALLOWED_UNITS,
                nullable: true
              },
              stepOverrides: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    stepId: { type: "STRING" },
                    instruction: { type: "STRING" }
                  },
                  required: ["stepId", "instruction"]
                }
              }
            },
            required: ["id", "targetIngredientId", "replacementName", "type", "quantityType"]
          }
        },
        steps: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              stepNumber: { type: "INTEGER" },
              instruction: { type: "STRING" },
              ingredientReferences: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: ["id", "stepNumber", "instruction", "ingredientReferences"]
          }
        }
      },
      required: [
        "id",
        "title",
        "description",
        "baseServings",
        "prepTimeMinutes",
        "cookTimeMinutes",
        "assumptions",
        "ingredients",
        "steps",
        "swaps"
      ]
    }
  },
  required: ["status"]
};

const SYSTEM_INSTRUCTION = `You are a culinary chef assistant. Output must be extremely concise to minimize generation time.
Analyze user-supplied kitchen ingredients, pantry items, and dietary rules.
If items are inedible, unsafe, insufficient to form a recipe, or have contradictory restrictions:
Return status: "cannot_generate" with code (INSUFFICIENT_INGREDIENTS, INCORRECT_OR_INEDIBLE_ITEMS, or IRRECONCILABLE_RESTRICTIONS), a clear reason, and 1-3 suggestions.
If plant-based alternatives are requested (e.g. vegan beef stew), generate a creative plant-based recipe using mushroom or soy alternatives, stating assumptions.

When generating a recipe (status: "success"):
- Recipe ID format: must match regex ^[a-z0-9-]+$ (e.g. "rcp-egg-fried-rice"). Never use underscores.
- Timing: prepTimeMinutes and cookTimeMinutes must be realistic, consistent, and account for all necessary waiting, resting, marinating, or simmering time.
- Ingredients:
  - id format: MUST match regex ^ing-[a-z0-9]+$ (e.g. "ing-1", "ing-2", "ing-3"). Never use underscores.
  - name: clearly specify the culinary state of the ingredient (e.g. "uncooked white rice" vs "cooked white rice", "raw whole eggs", "diced onions").
  - type: "supplied" for items in user prompt; "additional_required" for unlisted items (even oil, salt, water).
  - If user strictly specifies only listed ingredients, do not add additional required ingredients unless strictly essential, and if impossible return cannot_generate.
  - quantityType: "numeric" MUST have a positive float baseAmount, unit strictly from [g, ml, tbsp, tsp, cup, pieces, cloves, slices, pinches], and displayText MUST be null.
  - quantityType: "non_numeric" (e.g. to taste) MUST have baseAmount: null, unit: null, and displayText: "to taste" or similar string.
  - Any ambiguous quantities (e.g. "half a block") or initial states must be noted as assumptions.
- Assumptions:
  - Keep assumptions brief to reduce total token generation time. List only essential culinary assumptions, initial states, or equipment expectations consistent with the steps.
- Steps:
  - id format: MUST match regex ^step-[0-9]+$ (e.g. "step-1", "step-2"). Never use underscores.
  - stepNumber: sequential integer 1, 2, 3...
  - instruction: MUST be extremely concise. Limit step descriptions to 1-2 short sentences maximum. MUST use literal tokens like {ing:ing-1} for all ingredient references. Do NOT hardcode ingredient names or quantities in instruction text. Instructions must be consistent with the ingredients, states, and assumptions.
  - ingredientReferences: list of all ingredient IDs referenced by {ing:...} in this step. Every token used MUST be in ingredientReferences.
- Swaps:
  - 0 to 3 simple 1-to-1 replacements that require no undeclared extra ingredients.
  - Never invent substitutions that violate the user's ingredient restrictions or dietary rules.
  - id format: MUST match regex ^swap-[0-9]+$ (e.g. "swap-1").
  - targetIngredientId: valid ingredient ID matching an ingredient in ingredients.
  - stepOverrides: array of { stepId, instruction } overriding affected steps with new instructions using {ing:...} tokens.`;

export function extractSanitizedQuotaDetails(response, rawError) {
  let retryAfterHeader = null;
  if (response?.headers?.get) {
    retryAfterHeader = response.headers.get("retry-after") || null;
  }
  const errorObj = rawError?.error || {};
  const details = Array.isArray(errorObj.details) ? errorObj.details : [];

  let retryDelay = null;
  let quotaMetric = null;
  let quotaId = null;
  let quotaValue = null;
  let modelDimension = null;
  let locationDimension = null;

  for (const detail of details) {
    if (detail["@type"]?.includes("RetryInfo") || detail.retryDelay) {
      if (typeof detail.retryDelay === "string") {
        retryDelay = detail.retryDelay;
      } else if (detail.retryDelay && typeof detail.retryDelay.seconds !== "undefined") {
        retryDelay = `${detail.retryDelay.seconds}s`;
      }
    }
    if (detail["@type"]?.includes("QuotaFailure") && Array.isArray(detail.violations)) {
      for (const v of detail.violations) {
        if (v.quotaMetric) quotaMetric = v.quotaMetric;
        if (v.quotaId) quotaId = v.quotaId;
        if (v.quotaValue) quotaValue = v.quotaValue;
      }
    }
    if (detail["@type"]?.includes("ErrorInfo")) {
      const metadata = detail.metadata || {};
      if (metadata.model) modelDimension = metadata.model;
      if (metadata.location) locationDimension = metadata.location;
      if (metadata.quota_metric && !quotaMetric) quotaMetric = metadata.quota_metric;
    }
  }

  const effectiveRetry = retryAfterHeader || retryDelay;
  const isDailyLimit = Boolean(
    (quotaId && /perday|daily/i.test(quotaId)) ||
    (quotaMetric && /perday|daily/i.test(quotaMetric))
  );

  return {
    httpStatus: response?.status || 429,
    providerStatus: errorObj.status || "RESOURCE_EXHAUSTED",
    quotaMetric,
    quotaId,
    quotaValue,
    modelDimension,
    locationDimension,
    retryDelay: effectiveRetry,
    isDailyLimit
  };
}

export function getNextPacificMidnightIso(refDate = new Date()) {
  const date = new Date(refDate);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid reference date");
  }

  const getParts = (d) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23"
    }).formatToParts(d);
    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour, 10),
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10)
    };
  };

  const currentLocal = getParts(date);
  const nextCalendarDayUtc = new Date(
    Date.UTC(currentLocal.year, currentLocal.month - 1, currentLocal.day + 1, 12, 0, 0)
  );
  const targetYear = nextCalendarDayUtc.getUTCFullYear();
  const targetMonth = nextCalendarDayUtc.getUTCMonth() + 1;
  const targetDay = nextCalendarDayUtc.getUTCDate();

  for (const h of [7, 8, 6, 9]) {
    const candidate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, h, 0, 0, 0));
    const p = getParts(candidate);
    if (
      p.year === targetYear &&
      p.month === targetMonth &&
      p.day === targetDay &&
      p.hour === 0 &&
      p.minute === 0 &&
      p.second === 0
    ) {
      return candidate.toISOString();
    }
  }

  throw new Error("Unable to determine Pacific midnight");
}

export function normalizeModelName(model) {
  if (!model || typeof model !== "string") {
    return "gemini-3.5-flash-lite";
  }
  const trimmed = model.trim();
  if (
    trimmed === "gemini-1.5-flash" ||
    trimmed === "gemini-1.5-pro" ||
    trimmed === "gemini-2.0-flash" ||
    trimmed === "gemini-2.5-flash" ||
    trimmed === "gemini-3.5-flash"
  ) {
    return "gemini-3.5-flash-lite";
  }
  return trimmed;
}

export function sanitizeRecipePayload(parsed) {
  if (!parsed || parsed.status !== "success" || !parsed.recipe || typeof parsed.recipe !== "object") {
    return parsed;
  }
  const r = parsed.recipe;
  if (typeof r.id === "string") {
    r.id = r.id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  }
  if (!r.id || !/^[a-z0-9-]+$/.test(r.id)) {
    r.id = "recipe-1";
  }

  const idMap = new Map();
  if (Array.isArray(r.ingredients)) {
    r.ingredients.forEach((ing, i) => {
      if (!ing || typeof ing !== "object") return;
      const rawId = typeof ing.id === "string" ? ing.id.trim() : "";
      const cleaned = rawId.replace(/^ing[-_]?/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const newId = `ing-${cleaned || i + 1}`;
      if (rawId) {
        idMap.set(rawId, newId);
      }
      idMap.set(`ing_${i + 1}`, newId);
      idMap.set(`ing-${i + 1}`, newId);
      ing.id = newId;

      if (ing.quantityType === "numeric") {
        ing.displayText = null;
        if (typeof ing.baseAmount !== "number" || ing.baseAmount <= 0 || !Number.isFinite(ing.baseAmount)) {
          ing.baseAmount = 1;
        }
        if (!ing.unit || !ALLOWED_UNITS.includes(ing.unit)) {
          ing.unit = "pieces";
        }
      } else {
        ing.quantityType = "non_numeric";
        ing.baseAmount = null;
        ing.unit = null;
        if (!ing.displayText || typeof ing.displayText !== "string" || !ing.displayText.trim()) {
          ing.displayText = "to taste";
        }
      }
    });
  }

  const stepMap = new Map();
  if (Array.isArray(r.steps)) {
    r.steps.forEach((step, i) => {
      if (!step || typeof step !== "object") return;
      const rawId = typeof step.id === "string" ? step.id.trim() : "";
      const cleaned = rawId.replace(/^step[-_]?/i, "").replace(/[^0-9]/g, "");
      const newId = `step-${cleaned || i + 1}`;
      if (rawId) {
        stepMap.set(rawId, newId);
      }
      stepMap.set(`step_${i + 1}`, newId);
      stepMap.set(`step-${i + 1}`, newId);
      step.id = newId;
      step.stepNumber = i + 1;

      if (typeof step.instruction === "string") {
        for (const [oldId, mappedId] of idMap.entries()) {
          step.instruction = step.instruction.replaceAll(`{ing:${oldId}}`, `{ing:${mappedId}}`);
        }
      }

      const extractedTokens = extractIngredientTokens(step.instruction || "");
      const validIngredientIds = new Set((r.ingredients || []).map((ing) => ing.id));
      const refSet = new Set(
        Array.isArray(step.ingredientReferences)
          ? step.ingredientReferences.map((ref) => idMap.get(ref) || (typeof ref === "string" ? ref.replace(/^ing_/, "ing-") : ref)).filter((ref) => validIngredientIds.has(ref))
          : []
      );
      for (const token of extractedTokens) {
        if (validIngredientIds.has(token)) {
          refSet.add(token);
        }
      }
      step.ingredientReferences = Array.from(refSet);
    });
  }

  if (Array.isArray(r.swaps)) {
    const validStepIds = new Set((r.steps || []).map((s) => s.id));
    const validIngIds = new Set((r.ingredients || []).map((ing) => ing.id));
    const seenSwapIds = new Set();

    r.swaps = r.swaps.filter((swap, i) => {
      if (!swap || typeof swap !== "object") return false;
      const rawId = typeof swap.id === "string" ? swap.id.trim() : "";
      const cleaned = rawId.replace(/^swap[-_]?/i, "").replace(/[^0-9]/g, "");
      const newId = `swap-${cleaned || i + 1}`;
      swap.id = newId;
      if (seenSwapIds.has(newId)) return false;
      seenSwapIds.add(newId);

      const targetId = idMap.get(swap.targetIngredientId) || (typeof swap.targetIngredientId === "string" ? swap.targetIngredientId.replace(/^ing_/, "ing-") : "");
      if (!validIngIds.has(targetId)) return false;
      swap.targetIngredientId = targetId;

      if (Array.isArray(swap.stepOverrides)) {
        const seenOverrides = new Set();
        swap.stepOverrides = swap.stepOverrides.filter((ov) => {
          if (!ov || typeof ov !== "object") return false;
          const mappedStepId = stepMap.get(ov.stepId) || (typeof ov.stepId === "string" ? ov.stepId.replace(/^step_/, "step-") : "");
          if (!validStepIds.has(mappedStepId) || seenOverrides.has(mappedStepId)) return false;
          seenOverrides.add(mappedStepId);
          ov.stepId = mappedStepId;
          if (typeof ov.instruction === "string") {
            for (const [oldId, mappedId] of idMap.entries()) {
              ov.instruction = ov.instruction.replaceAll(`{ing:${oldId}}`, `{ing:${mappedId}}`);
            }
          }
          return true;
        });
      } else {
        swap.stepOverrides = [];
      }
      return true;
    });
  }

  return parsed;
}

export async function callGeminiRecipe(prompt, options = {}) {
  const apiKey = options.apiKey !== undefined ? options.apiKey : (process.env.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY);
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_actual_key_here") {
    console.error(new Error("GEMINI_API_KEY is missing or unconfigured in environment."));
    return {
      httpStatus: 503,
      payload: createErrorResponse(
        "SERVICE_NOT_CONFIGURED",
        "Recipe generation is not connected yet.",
        false
      )
    };
  }

  const rawModel = options.model || CONFIG.GEMINI_MODEL;
  const model = normalizeModelName(rawModel);
  const timeoutMs = options.timeoutMs || CONFIG.GEMINI_TIMEOUT_MS;
  const fetchFn = options.fetchFn || globalThis.fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let cleanupClientSignal = null;
  if (options.clientSignal) {
    if (options.clientSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      const onClientAbort = () => {
        controller.abort();
      };
      options.clientSignal.addEventListener("abort", onClientAbort);
      cleanupClientSignal = () => {
        options.clientSignal.removeEventListener("abort", onClientAbort);
      };
    }
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: PROVIDER_RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 4096
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const startTime = Date.now();

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const rawError = await response.json().catch(() => ({}));
      clearTimeout(timer);
      if (cleanupClientSignal) {
        cleanupClientSignal();
      }
      console.error(rawError);
      const errorObj = rawError.error || {};
      console.warn(`[Gemini Provider] status=${response.status} code=${errorObj.status || "UNKNOWN"} duration=${duration}ms`);

      if (!options.isFallback && (!options.fetchFn || options.fetchFn === globalThis.fetch) && (response.status === 404 || response.status === 503)) {
        const fallbackModel = model === "gemini-3.5-flash-lite" ? "gemini-flash-lite-latest" : "gemini-3.5-flash-lite";
        console.warn(`[Gemini Provider] Retrying with fallback model: ${fallbackModel}`);
        return callGeminiRecipe(prompt, {
          ...options,
          model: fallbackModel,
          isFallback: true
        });
      }

      if (
        response.status === 400 &&
        (errorObj.message?.includes("API key not valid") ||
          (Array.isArray(errorObj.details) && errorObj.details.some((d) => d.reason === "API_KEY_INVALID")))
      ) {
        return {
          httpStatus: 503,
          payload: createErrorResponse(
            "SERVICE_NOT_CONFIGURED",
            "AI service authentication is misconfigured.",
            false
          )
        };
      }

      if (response.status === 400) {
        return {
          httpStatus: 400,
          payload: createErrorResponse("BAD_REQUEST", "Invalid request to AI service.", false)
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          httpStatus: 503,
          payload: createErrorResponse(
            "SERVICE_NOT_CONFIGURED",
            "AI service authentication is misconfigured.",
            false
          )
        };
      }
      if (response.status === 429) {
        const quotaInfo = extractSanitizedQuotaDetails(response, rawError);
        console.warn(
          `[Gemini Quota 429] status=${quotaInfo.httpStatus} providerStatus=${quotaInfo.providerStatus} ` +
          `quotaMetric=${quotaInfo.quotaMetric || "none"} quotaId=${quotaInfo.quotaId || "none"} ` +
          `quotaValue=${quotaInfo.quotaValue || "none"} model=${quotaInfo.modelDimension || "none"} ` +
          `location=${quotaInfo.locationDimension || "none"} retryDelay=${quotaInfo.retryDelay || "none"}`
        );

        if (quotaInfo.isDailyLimit) {
          const expectedResetAt = options.referenceTime
            ? getNextPacificMidnightIso(options.referenceTime)
            : getNextPacificMidnightIso();
          return {
            httpStatus: 429,
            payload: createErrorResponse(
              "PROVIDER_QUOTA",
              "The AI service’s daily request limit has been reached. Please try again after the quota resets.",
              false,
              expectedResetAt
            )
          };
        }

        const errorMessage = quotaInfo.retryDelay
          ? `AI service quota exceeded. Please retry after ${quotaInfo.retryDelay}.`
          : "The AI service quota is currently unavailable. Please try again later.";

        return {
          httpStatus: 429,
          payload: createErrorResponse("PROVIDER_QUOTA", errorMessage, true)
        };
      }
      const rawMessage = errorObj.message || (typeof rawError === "string" ? rawError : "");
      const errorMsg = rawMessage
        ? `AI service error: ${rawMessage}`
        : "AI service is currently unavailable. Please try again.";
      return {
        httpStatus: 502,
        payload: createErrorResponse(
          "INTERNAL_ERROR",
          errorMsg,
          true
        )
      };
    }

    const rawData = await response.json();
    clearTimeout(timer);
    if (cleanupClientSignal) {
      cleanupClientSignal();
    }
    const candidate = rawData.candidates?.[0];

    if (!candidate) {
      return {
        httpStatus: 502,
        payload: createErrorResponse(
          "SCHEMA_VALIDATION_FAILED",
          "AI service returned an empty response.",
          true
        )
      };
    }

    if (candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      return {
        httpStatus: 200,
        payload: {
          status: "cannot_generate",
          reason: "The request could not be safely fulfilled.",
          code: "IRRECONCILABLE_RESTRICTIONS",
          suggestions: ["Please check the ingredients and dietary restrictions and try again."]
        }
      };
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      return {
        httpStatus: 502,
        payload: createErrorResponse(
          "SCHEMA_VALIDATION_FAILED",
          "AI response was truncated before completion.",
          true
        )
      };
    }

    const textOutput = candidate.content?.parts?.[0]?.text;
    if (!textOutput || !textOutput.trim()) {
      return {
        httpStatus: 502,
        payload: createErrorResponse(
          "SCHEMA_VALIDATION_FAILED",
          "AI service returned empty content.",
          true
        )
      };
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(textOutput);
    } catch {
      return {
        httpStatus: 502,
        payload: createErrorResponse(
          "SCHEMA_VALIDATION_FAILED",
          "AI service returned malformed JSON.",
          true
        )
      };
    }

    if (parsedResult.status === "cannot_generate") {
      const validatedCannotGen = CannotGenerateSchema.safeParse(parsedResult);
      if (!validatedCannotGen.success) {
        return {
          httpStatus: 502,
          payload: createErrorResponse(
            "SCHEMA_VALIDATION_FAILED",
            "AI service returned invalid cannot_generate schema.",
            true
          )
        };
      }
      return {
        httpStatus: 200,
        payload: validatedCannotGen.data
      };
    }

    if (parsedResult.status === "success") {
      parsedResult = sanitizeRecipePayload(parsedResult);
      const validatedSuccess = SuccessResponseSchema.safeParse(parsedResult);
      if (!validatedSuccess.success) {
        return {
          httpStatus: 502,
          payload: createErrorResponse(
            "SCHEMA_VALIDATION_FAILED",
            "AI service returned invalid recipe schema.",
            true
          )
        };
      }

      const businessRules = validateRecipeBusinessRules(validatedSuccess.data.recipe);
      if (!businessRules.valid) {
        return {
          httpStatus: 502,
          payload: createErrorResponse(
            "SCHEMA_VALIDATION_FAILED",
            `Recipe failed consistency checks: ${businessRules.errors.join("; ")}`,
            true
          )
        };
      }

      return {
        httpStatus: 200,
        payload: validatedSuccess.data
      };
    }

    return {
      httpStatus: 502,
      payload: createErrorResponse(
        "SCHEMA_VALIDATION_FAILED",
        "AI response status was unrecognized.",
        true
      )
    };
  } catch (err) {
    clearTimeout(timer);
    if (cleanupClientSignal) {
      cleanupClientSignal();
    }
    console.error(err);
    const duration = Date.now() - startTime;
    console.warn(`[Gemini Provider] error=${err.name} duration=${duration}ms`);
    if (err.name === "AbortError") {
      return {
        httpStatus: 504,
        payload: createErrorResponse(
          "PROVIDER_TIMEOUT",
          "AI service request timed out. Please try again.",
          true
        )
      };
    }
    return {
      httpStatus: 502,
      payload: createErrorResponse(
        "INTERNAL_ERROR",
        "Failed to communicate with AI service.",
        true
      )
    };
  }
}
