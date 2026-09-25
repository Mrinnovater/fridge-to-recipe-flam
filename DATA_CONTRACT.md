# Data Contract: Fridge-to-Recipe

## 1. Overview and Provider Compatibility

The data contract is split into two operational layers:
1. Provider Generation: The server requests structured JSON output from the Gemini API using provider-supported configuration. Specific schema dialect details are validated against current official documentation during the integration stage.
2. Server-Side Contract Enforcement: An independent Zod schema and business-rule validation suite executes on the Node backend immediately after parsing provider output. Zod guarantees shape and bounds before any payload reaches the client.

---

## 2. API Request and Response Shapes

### 2.1 Request Payload
`POST /api/recipe`

```json
{
  "prompt": "I have 3 eggs, half a block of firm tofu, spinach, and soy sauce. Need dinner for 2 people. Vegetarian only."
}
```

#### Request Validation Rules
| Field | Type | Required | Constraints |
|---|---|---|---|
| `prompt` | string | Yes | Min length 3, max length 2,000 characters. Whitespace trimmed. |

The HTTP request body is limited to 16 KiB to accommodate UTF-8 characters and JSON syntax overhead. Excess payloads return HTTP 413.

---

### 2.2 Response Shapes

#### A. Success Response (`status: "success"`)
Returned when a valid recipe is constructed from the prompt.

```json
{
  "status": "success",
  "recipe": {
    "id": "rcp-9f8a2b",
    "title": "Crispy Tofu and Spinach Scramble",
    "description": "A quick skillet scramble featuring golden tofu cubes, scrambled eggs, and wilted spinach.",
    "baseServings": 2,
    "prepTimeMinutes": 10,
    "cookTimeMinutes": 15,
    "assumptions": [
      "Half a block of firm tofu estimated as 200 g based on a standard 400 g package.",
      "Cooking oil and salt are not assumed to be in the pantry and are listed as additional required ingredients."
    ],
    "ingredients": [
      {
        "id": "ing-1",
        "name": "firm tofu",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 200,
        "unit": "g"
      },
      {
        "id": "ing-2",
        "name": "eggs",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 3,
        "unit": "pieces"
      },
      {
        "id": "ing-3",
        "name": "fresh spinach",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 100,
        "unit": "g"
      },
      {
        "id": "ing-4",
        "name": "soy sauce",
        "type": "supplied",
        "quantityType": "numeric",
        "baseAmount": 1,
        "unit": "tbsp"
      },
      {
        "id": "ing-5",
        "name": "cooking oil",
        "type": "additional_required",
        "quantityType": "numeric",
        "baseAmount": 1,
        "unit": "tbsp"
      },
      {
        "id": "ing-6",
        "name": "salt",
        "type": "additional_required",
        "quantityType": "non_numeric",
        "baseAmount": null,
        "unit": null,
        "displayText": "to taste"
      }
    ],
    "swaps": [
      {
        "id": "swap-1",
        "targetIngredientId": "ing-1",
        "replacementName": "canned chickpeas (drained)",
        "type": "additional_required",
        "quantityType": "numeric",
        "baseAmount": 240,
        "unit": "g",
        "stepOverrides": [
          {
            "stepId": "step-1",
            "instruction": "Rinse and drain {ing:ing-1}, then pat dry thoroughly with a clean kitchen towel."
          }
        ]
      }
    ],
    "steps": [
      {
        "id": "step-1",
        "stepNumber": 1,
        "instruction": "Cut {ing:ing-1} into bite-sized cubes and pat dry with a kitchen towel.",
        "ingredientReferences": ["ing-1"]
      },
      {
        "id": "step-2",
        "stepNumber": 2,
        "instruction": "Heat {ing:ing-5} in a skillet over medium heat, add {ing:ing-1}, and cook until golden on the outside.",
        "ingredientReferences": ["ing-5", "ing-1"]
      },
      {
        "id": "step-3",
        "stepNumber": 3,
        "instruction": "Beat {ing:ing-2} lightly in a small bowl, pour into the skillet around {ing:ing-1}, and stir gently until soft curds form.",
        "ingredientReferences": ["ing-2", "ing-1"]
      },
      {
        "id": "step-4",
        "stepNumber": 4,
        "instruction": "Toss in {ing:ing-3} and drizzle with {ing:ing-4}. Stir until spinach wilts completely.",
        "ingredientReferences": ["ing-3", "ing-4"]
      },
      {
        "id": "step-5",
        "stepNumber": 5,
        "instruction": "Remove from heat, season with {ing:ing-6}, and serve warm.",
        "ingredientReferences": ["ing-6"]
      }
    ]
  }
}
```

---

#### B. Cannot Generate Response (`status: "cannot_generate"`)
Returned when input is insufficient, inedible, or contains conflicting requirements.

```json
{
  "status": "cannot_generate",
  "reason": "The input specifies only tap water and salt, which is insufficient to prepare a meal.",
  "code": "INSUFFICIENT_INGREDIENTS",
  "suggestions": [
    "List at least one primary vegetable, grain, or protein source.",
    "Mention basic items available such as eggs, rice, lentils, or pasta."
  ]
}
```

Allowed `code` values:
- `INSUFFICIENT_INGREDIENTS`: Missing core edible components.
- `INCORRECT_OR_INEDIBLE_ITEMS`: Contains non-food or hazardous items.
- `IRRECONCILABLE_RESTRICTIONS`: Mutually exclusive constraints that cannot be satisfied.

---

#### C. Error Response (`status: "error"`)
Returned when an operational or technical failure occurs.

```json
{
  "status": "error",
  "error": {
    "code": "SERVICE_NOT_CONFIGURED",
    "message": "Recipe generation backend is currently being configured.",
    "retryable": false
  }
}
```

Allowed error codes:
- `BAD_REQUEST`: Invalid input format, excessive length, or malformed JSON.
- `SERVICE_NOT_CONFIGURED`: Backend route is running in shell/unconfigured mode.
- `PROVIDER_TIMEOUT`: Upstream provider exceeded allowed duration.
- `PROVIDER_QUOTA`: Upstream rate limit reached.
- `SCHEMA_VALIDATION_FAILED`: Response violated the required structure.
- `INTERNAL_ERROR`: Unhandled backend exception.

---

## 3. Field Bounds and Validation Rules

### 3.1 Recipe Field Boundaries
| Field | Type | Bounds / Format |
|---|---|---|
| `recipe.id` | string | 3 to 32 characters, pattern `^[a-z0-9-]+$` |
| `recipe.title` | string | 3 to 100 characters |
| `recipe.description` | string | 10 to 300 characters |
| `recipe.baseServings` | integer | Min 1, max 12 |
| `recipe.prepTimeMinutes` | integer | Min 0, max 360 |
| `recipe.cookTimeMinutes` | integer | Min 0, max 360 |
| `recipe.assumptions` | array of strings | 0 to 10 items, each 5 to 200 characters |
| `recipe.ingredients` | array of objects | 1 to 40 items |
| `recipe.steps` | array of objects | 1 to 30 items |
| `recipe.swaps` | array of objects | 0 to 8 items |

### 3.2 Ingredient Field Rules
| Field | Type | Rule |
|---|---|---|
| `id` | string | Unique in recipe. Format `ing-[a-z0-9]+` |
| `name` | string | 2 to 60 characters |
| `type` | enum | `"supplied"` or `"additional_required"` |
| `quantityType` | enum | `"numeric"` or `"non_numeric"` |
| `baseAmount` | number or null | If numeric, finite float where 0.01 <= baseAmount <= 50000. If non-numeric, must be `null`. |
| `unit` | string or null | If numeric, valid unit string (`g`, `ml`, `tbsp`, `tsp`, `cup`, `pieces`, `cloves`, `slices`, `pinches`). If non-numeric, must be `null`. |
| `displayText` | string or null | If non-numeric, string of 1 to 40 characters (e.g. "to taste"). If numeric, must be `null`. |

### 3.3 Step Field Rules
| Field | Type | Rule |
|---|---|---|
| `id` | string | Unique in recipe. Format `step-[0-9]+` |
| `stepNumber` | integer | Sequential 1-based index matching array position |
| `instruction` | string | 5 to 500 characters. Literal tokens format `{ing:<id>}`. No literal amounts or ingredient names that become invalid upon swap/scale. |
| `ingredientReferences` | array of strings | Set of ingredient IDs referenced by `{ing:<id>}` in this instruction. |

### 3.4 Swap Field Rules
| Field | Type | Rule |
|---|---|---|
| `id` | string | Unique in recipe. Format `swap-[0-9]+` |
| `targetIngredientId` | string | Must match an existing `id` in `recipe.ingredients`. |
| `replacementName` | string | 2 to 60 characters |
| `type` | enum | `"supplied"` or `"additional_required"` |
| `quantityType` | enum | `"numeric"` or `"non_numeric"` |
| `baseAmount` | number or null | If numeric, finite float where 0.01 <= baseAmount <= 50000. If non-numeric, `null`. |
| `unit` | string or null | Matching allowed unit list if numeric; `null` if non-numeric. |
| `stepOverrides` | array of objects | 0 to 5 step overrides. Each object contains `stepId` (matching a valid step `id`) and `instruction` (5 to 500 characters with valid `{ing:<id>}` tokens). |

---

## 4. Cross-Reference and Business Consistency Rules

Backend validation verifies these conditions before returning a recipe:
1. Unique IDs: All ingredient IDs, step IDs, and swap IDs are distinct.
2. Step References: All items in `step.ingredientReferences` exist in `recipe.ingredients`.
3. Step Tokens: All `{ing:<id>}` tokens in `step.instruction` parse to IDs matching `step.ingredientReferences`.
4. Swap Targets: Every `swap.targetIngredientId` matches an ingredient in `recipe.ingredients`.
5. Swap Overrides:
   - Every `override.stepId` matches an existing step.
   - Each `stepId` is overridden at most once per swap.
   - Overridden instructions must only use `{ing:<id>}` tokens matching the target step's `ingredientReferences`.
6. Single Swap Constraint: Swaps are simple single-ingredient replacements requiring no undeclared auxiliary ingredients.

---

## 5. Scaling, Swap, and Display Semantics

### 5.1 Quantity Derivation and Scaling
- Base quantities are immutable.
- Formula for numeric quantities:
  `scaledAmount = baseAmount * (selectedServings / baseServings)`
- Display formatting:
  - Values >= 10 are rounded to nearest whole number or 1 decimal place.
  - Values between 1 and 10 are formatted to 1 or 2 decimal places.
  - Tiny positive values (> 0 and < 0.1) are formatted with sufficient precision (e.g. `0.05` or `<0.1`) and never rendered as `0`.
- Units like `pinches` scale with numeric amount (e.g. `2 pinches` -> `4 pinches`).
- Non-numeric items (e.g. "to taste") do not scale; they render `displayText` unchanged.
- `prepTimeMinutes` and `cookTimeMinutes` are static and never scaled.

### 5.2 Single Active Swap Semantics
- At most ONE swap may be active across the entire recipe at any time (`activeSwapId: string | null`).
- Selecting another swap deactivates the previous swap. Selecting the active swap again or clicking a restore button sets `activeSwapId` to `null`.
- When a swap is active:
  - The ingredient list renders the replacement ingredient name and its scaled quantity in place of the target ingredient.
  - In step instructions, `{ing:<id>}` resolves to the replacement name if `<id>` matches the swap's `targetIngredientId`, and to the original ingredient name otherwise.
  - If the swap contains a `stepOverride` for a step, that step's instruction is replaced completely by the override instruction.
  - Changing the active swap clears `completedStepIds` so modified instructions are not marked as completed prematurely.

---

## 6. Separation of Server Data and Frontend State

```
Server Payload (Read-only reference)
|-- recipe.id
|-- recipe.title, description, baseServings
|-- recipe.prepTimeMinutes, cookTimeMinutes
|-- recipe.assumptions[]
|-- recipe.ingredients[]
|-- recipe.swaps[]
`-- recipe.steps[]

Client State (Managed via React Hooks)
|-- selectedServings: number (initialized to recipe.baseServings when valid recipe arrives)
|-- activeSwapId: string | null (defaults to null)
|-- completedStepIds: string[] (defaults to [])
|-- activeRequestIdRef: number (incremented on new request, abort, or invalidation)
|-- requestStatus: "idle" | "loading" | "success" | "cannot_generate" | "error"
|-- cannotGenerateResult: { reason, code, suggestions } | null
`-- errorResult: { code, message, retryable } | null
```

Lifecycle safeguards:
- `activeRequestIdRef` is incremented whenever a request begins or is cancelled.
- Asynchronous responses only update React state if their captured request ID equals `activeRequestIdRef.current`.
- When a new recipe is accepted:
  - `activeSwapId` resets to `null`.
  - `completedStepIds` resets to `[]`.
  - `selectedServings` is initialized to the new recipe's `baseServings`.
