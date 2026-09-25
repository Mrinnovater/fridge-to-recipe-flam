# Architecture & Technical Design

## 1. System Overview

Fridge-to-Recipe is architected as a decoupled, serverless full-stack web application designed for deterministic, structured culinary generation rather than conversational interaction.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                      │
│                  (React 18 + Vite SPA)                      │
│                                                             │
│   • InputForm (Character counting, submit/cancel)           │
│   • RecipeWorkspace (Scaled ingredients, swaps, steps)      │
│   • useRecipeGenerator Hook (AbortController, timeouts)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS POST /api/recipe
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Vercel Serverless Function                  │
│                     (api/recipe.js)                         │
│                                                             │
│   • Request sanitization & 16 KiB size limits               │
│   • API key protection (GEMINI_API_KEY concealed)           │
│   • 60s timeout budget (maxDuration: 60)                    │
│   • Zod contract parsing & business rule validation         │
│   • Pacific Midnight calculation for daily quota resets     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS POST generateContent
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Generative AI                      │
│                  (gemini-3.5-flash)                         │
│                                                             │
│   • responseMimeType: application/json                      │
│   • responseSchema: PROVIDER_RESPONSE_SCHEMA                │
│   • thinkingBudget: 0 (sub-second deterministic output)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Request Flow

1. **User Input & Validation**:
   - The user inputs pantry ingredients and instructions into the textarea.
   - Character length is monitored in real-time. Input must satisfy $3 \le \text{length} \le 2000$.
2. **Client Dispatch (`useRecipeGenerator.js`)**:
   - Creates an `AbortController` instance and registers a 65-second client-side timeout.
   - Sets state to `loading`, activating the creative loading spinner and rotating culinary phrases.
   - Issues a `POST /api/recipe` request with `{ "prompt": string }`.
3. **Vercel Routing**:
   - In production, `vercel.json` intercepts `/api/recipe` and routes to `api/recipe.js`.
   - In local development, the Vite dev server proxies `/api` to the local Node HTTP server running on port 3001.
4. **Serverless Execution (`api/recipe.js`)**:
   - Verifies HTTP method (`POST`) and `Content-Type: application/json`.
   - Rejects payloads exceeding 16 KiB to prevent memory exhaustion.
   - Extracts and sanitizes prompt using `RequestPayloadSchema`.
   - Dispatches a structured call to the Gemini Generative Language API using the server-side `GEMINI_API_KEY`.
5. **Provider Response & Error Inspection**:
   - If Google returns an HTTP 429: extracts quota metadata. If it is a daily limit, computes the next Pacific Midnight ISO timestamp (`America/Los_Angeles`) and sets `retryable: false`.
   - If Google returns an HTTP 503 or unexpected error: dumps raw error payload to stderr via `console.error(rawError)` and returns an `INTERNAL_ERROR` envelope.
6. **Zod Validation & Business Rules (`shared/contract.js`)**:
   - Parses the JSON output against `SuccessResponseSchema` or `CannotGenerateSchema`.
   - Executes `validateRecipeBusinessRules`: verifies identifier formats, ensures every `{ing:...}` token in instructions is declared in `ingredientReferences`, and confirms 1-to-1 swap validity.
7. **Client Rendering & Auto-Scroll**:
   - The client hook parses the envelope.
   - Upon successful status transition, `App.jsx` triggers smooth scrolling to `RecipeWorkspace` using a container `useRef` and focuses the recipe title.

---

## 3. Data Shapes & API Contract

### Request Payload
```json
{
  "prompt": "I have 200 g rice, 3 eggs, 1 onion, 2 carrots, cooking oil, salt, and water. Make a simple fried rice for 2 people."
}
```

### Successful Recipe Response (`200 OK`)
```json
{
  "status": "success",
  "recipe": {
    "id": "rcp-egg-fried-rice",
    "title": "Simple Egg Fried Rice",
    "description": "A quick and comforting fried rice dish utilizing pantry staples and fresh eggs.",
    "baseServings": 2,
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 15,
    "assumptions": [
      "Rice is cooked and cooled prior to frying",
      "A standard skillet or wok is used"
    ],
    "ingredients": [
      {
        "id": "ing-1",
        "name": "cooked white rice",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 300,
        "unit": "g",
        "displayText": null
      },
      {
        "id": "ing-2",
        "name": "eggs",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 3,
        "unit": "pieces",
        "displayText": null
      },
      {
        "id": "ing-3",
        "name": "salt",
        "type": "supplied",
        "quantityType": "non_numeric",
        "baseAmount": null,
        "unit": null,
        "displayText": "to taste"
      }
    ],
    "swaps": [
      {
        "id": "swap-1",
        "targetIngredientId": "ing-2",
        "replacementName": "cubed paneer",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 150,
        "unit": "g",
        "stepOverrides": [
          {
            "stepId": "step-2",
            "instruction": "Sauté {ing:ing-2} until lightly golden, then set aside."
          }
        ]
      }
    ],
    "steps": [
      {
        "id": "step-1",
        "stepNumber": 1,
        "instruction": "Heat pan with oil over medium-high heat.",
        "ingredientReferences": []
      },
      {
        "id": "step-2",
        "stepNumber": 2,
        "instruction": "Scramble {ing:ing-2} softly, then remove from pan.",
        "ingredientReferences": ["ing-2"]
      },
      {
        "id": "step-3",
        "stepNumber": 3,
        "instruction": "Add {ing:ing-1} and season with {ing:ing-3}, tossing thoroughly for 2 minutes.",
        "ingredientReferences": ["ing-1", "ing-3"]
      }
    ]
  }
}
```

### Cannot Generate Response (`200 OK`)
```json
{
  "status": "cannot_generate",
  "reason": "Bleach and motor oil are toxic chemicals unfit for human consumption.",
  "code": "INCORRECT_OR_INEDIBLE_ITEMS",
  "suggestions": [
    "Provide safe, edible culinary staples such as vegetables, grains, or proteins.",
    "Verify ingredients and remove non-food household items."
  ]
}
```

### Error Envelopes

#### 1. Daily Quota Limit Exceeded (`429 Too Many Requests`)
```json
{
  "status": "error",
  "error": {
    "code": "PROVIDER_QUOTA",
    "message": "The AI service’s daily request limit has been reached. Please try again after the quota resets.",
    "retryable": false,
    "expectedResetAt": "2026-09-26T07:00:00.000Z"
  }
}
```

#### 2. Short-Term Burst Limit Exceeded (`429 Too Many Requests`)
```json
{
  "status": "error",
  "error": {
    "code": "PROVIDER_QUOTA",
    "message": "AI service quota exceeded. Please retry after 19s.",
    "retryable": true
  }
}
```

#### 3. Malformed / Invalid Input (`400 Bad Request`)
```json
{
  "status": "error",
  "error": {
    "code": "BAD_REQUEST",
    "message": "Prompt must be at least 3 characters.",
    "retryable": false
  }
}
```

#### 4. Provider Timeout (`504 Gateway Timeout`)
```json
{
  "status": "error",
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "AI service request timed out. Please try again.",
    "retryable": true
  }
}
```

#### 5. Service Not Configured (`503 Service Unavailable`)
```json
{
  "status": "error",
  "error": {
    "code": "SERVICE_NOT_CONFIGURED",
    "message": "Recipe generation is not connected yet.",
    "retryable": false
  }
}
```

#### 6. Internal / Upstream Error (`502 Bad Gateway`)
```json
{
  "status": "error",
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "AI service is currently unavailable. Please try again.",
    "retryable": true
  }
}
```

---

## 4. Security & Failure Handling

### API Key Isolation
- The private `GEMINI_API_KEY` is consumed solely within `api/recipe.js` on Vercel's serverless environment or the local Node dev server.
- The Vite build configuration never injects or embeds the key into client-side JS bundles.

### Slow API & Timeout Protection
- **Backend Limit**: `api/recipe.js` configures an AbortController with a 60,000 ms timeout.
- **Client Limit**: `useRecipeGenerator.js` maintains a 65,000 ms timeout to ensure graceful error display if network transport stalls.
- **Client Disconnection**: The backend listens to `res.on('close')` and immediately aborts the active Google Gemini request if the user navigates away or cancels, avoiding unnecessary API consumption.

### Schema Validation & Anti-Hallucination
- Gemini Flash is invoked with a rigid JSON schema enforcing type definitions for ingredients, units, quantities, and steps.
- The server validates the raw response against `SuccessResponseSchema` before sending it to the client.
- `validateRecipeBusinessRules` checks:
  1. Ingredient reference tokens `{ing:id}` match existing ingredient IDs.
  2. Swap targets point to real ingredients and swaps do not introduce unlisted requirements.
  3. No duplicate step or ingredient identifiers exist.
- If any check fails, the application returns a structured error envelope rather than crashing the client.

### Quota & Rate Limit Grace
- When Google returns a `429 RESOURCE_EXHAUSTED`, the backend inspects `QuotaFailure` violation metadata.
- If a daily quota is identified, `getNextPacificMidnightIso()` deterministically calculates the upcoming midnight in the `America/Los_Angeles` timezone (accounting for daylight saving transitions).
- The client converts this timestamp to the user's localized timezone and renders an amber notice with a dynamic countdown ("Our kitchen opens again in X hours and Y minutes") while allowing users to continue viewing or cooking with their currently loaded recipe.
