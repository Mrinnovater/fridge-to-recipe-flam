import { useState, useRef, useCallback } from "react";
import {
  SuccessResponseSchema,
  CannotGenerateSchema,
  ErrorResponseSchema
} from "../../shared/contract.js";
import { isDailyQuotaError } from "../lib/dailyQuota.js";

export function processRecipeResponse(payload, currentRecipe = null) {
  if (!payload || typeof payload !== "object") {
    return {
      status: "error",
      errorInfo: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Received invalid response from server.",
        retryable: true
      },
      recipe: currentRecipe,
      serviceNotice: null,
      cannotGenerateInfo: null
    };
  }

  if (payload.status === "error") {
    const parsedError = ErrorResponseSchema.safeParse(payload);
    if (parsedError.success && parsedError.data.error.code === "SERVICE_NOT_CONFIGURED") {
      return {
        status: "idle",
        errorInfo: null,
        recipe: currentRecipe,
        serviceNotice: "Recipe generation is being set up.",
        cannotGenerateInfo: null
      };
    }
    console.error("Recipe API error payload:", payload);
    return {
      status: "error",
      errorInfo: parsedError.success
        ? parsedError.data.error
        : {
            code: "INTERNAL_ERROR",
            message: "Failed to generate recipe.",
            retryable: true
          },
      recipe: currentRecipe,
      serviceNotice: null,
      cannotGenerateInfo: null
    };
  }

  if (payload.status === "cannot_generate") {
    const parsedCannotGen = CannotGenerateSchema.safeParse(payload);
    if (parsedCannotGen.success) {
      return {
        status: "cannot_generate",
        errorInfo: null,
        recipe: null,
        serviceNotice: null,
        cannotGenerateInfo: parsedCannotGen.data
      };
    }
    return {
      status: "error",
      errorInfo: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Received malformed cannot_generate payload.",
        retryable: true
      },
      recipe: currentRecipe,
      serviceNotice: null,
      cannotGenerateInfo: null
    };
  }

  if (payload.status === "success") {
    const parsedSuccess = SuccessResponseSchema.safeParse(payload);
    if (parsedSuccess.success) {
      return {
        status: "success",
        errorInfo: null,
        recipe: parsedSuccess.data.recipe,
        serviceNotice: null,
        cannotGenerateInfo: null
      };
    }
    return {
      status: "error",
      errorInfo: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "Received malformed recipe payload.",
        retryable: true
      },
      recipe: currentRecipe,
      serviceNotice: null,
      cannotGenerateInfo: null
    };
  }

  return {
    status: "error",
    errorInfo: {
      code: "SCHEMA_VALIDATION_FAILED",
      message: "Unrecognized response status from server.",
      retryable: true
    },
    recipe: currentRecipe,
    serviceNotice: null,
    cannotGenerateInfo: null
  };
}

export function useRecipeGenerator() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle");
  const [recipe, setRecipe] = useState(null);
  const [cannotGenerateInfo, setCannotGenerateInfo] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [serviceNotice, setServiceNotice] = useState(null);
  const [recipeInstanceId, setRecipeInstanceId] = useState(0);

  const activeRequestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const handleCancel = useCallback(() => {
    activeRequestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
  }, []);

  const executeRequest = useCallback(async (textToSubmit) => {
    const trimmedPrompt = textToSubmit.trim();
    if (trimmedPrompt.length < 3) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentRequestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = currentRequestId;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("loading");
    setErrorInfo(null);
    setServiceNotice(null);
    setCannotGenerateInfo(null);

    const clientTimeoutTimer = setTimeout(() => {
      controller.abort();
    }, 65000);

    try {
      const response = await fetch("/api/recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
        signal: controller.signal
      });

      clearTimeout(clientTimeoutTimer);
      const payload = await response.json().catch(() => null);

      if (activeRequestIdRef.current !== currentRequestId) {
        return;
      }

      if (!response.ok || payload?.status === "error" || !payload) {
        console.error("Recipe API response status:", response.status, "payload:", payload);
      }

      const processed = processRecipeResponse(payload, recipe);
      setStatus(processed.status);
      setErrorInfo(processed.errorInfo);
      setServiceNotice(processed.serviceNotice);
      setCannotGenerateInfo(processed.cannotGenerateInfo);

      if (processed.status === "success") {
        setRecipe(processed.recipe);
        setRecipeInstanceId((id) => id + 1);
      } else if (processed.status === "cannot_generate") {
        setRecipe(null);
      }
    } catch (err) {
      clearTimeout(clientTimeoutTimer);
      if (activeRequestIdRef.current !== currentRequestId) {
        return;
      }
      console.error("Recipe API request exception:", err);
      if (err.name === "AbortError") {
        setStatus("error");
        setErrorInfo({
          code: "PROVIDER_TIMEOUT",
          message: "Request took too long to complete. Please try again.",
          retryable: true
        });
        return;
      }
      setStatus("error");
      setErrorInfo({
        code: "NETWORK_ERROR",
        message: "Unable to reach the recipe server. Please check your connection and try again.",
        retryable: true
      });
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        abortControllerRef.current = null;
      }
    }
  }, [recipe]);

  const handleSubmit = useCallback((e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    executeRequest(prompt);
  }, [prompt, executeRequest]);

  const handleRetry = useCallback(() => {
    executeRequest(prompt);
  }, [prompt, executeRequest]);

  const handleReset = useCallback(() => {
    activeRequestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setRecipe(null);
    setPrompt("");
    setCannotGenerateInfo(null);
    setServiceNotice(null);
    const hasActiveQuota = errorInfo && isDailyQuotaError(errorInfo);
    if (!hasActiveQuota) {
      setErrorInfo(null);
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }, [errorInfo]);

  return {
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
  };
}
