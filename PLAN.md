# Project Plan: Fridge-to-Recipe (Flam Frontend Assignment)

## 1. Core Scope and Explicit Exclusions

### Core Scope
- Input: Free-form user input containing ingredients, quantities, dietary restrictions, and requested servings within a single `{ prompt }` string.
- Input Limits: Client enforces a 2,000-character input limit. Backend independently enforces a 2,000-character limit on `prompt` and a 16 KiB body limit on the HTTP request body. Oversized payloads return HTTP 400 or 413.
- AI Integration: Server-side Gemini API invocation using structured JSON configuration. Exact provider schema capabilities are verified during the integration stage.
- Validation Pipeline: Server-side Zod schema validation and business-rule validation verifying token references, numeric bounds, and single-swap constraints.
- Interactive Workspace:
  - Checkable cooking steps with progress tracking. Changing active swap clears completed steps.
  - Scalable servings initialized from model-generated `baseServings`. Scaled quantities derived from immutable base values.
  - At most one active swap (`activeSwapId: string | null`) with `stepOverrides` replacing affected instructions.
  - Distinct application states: Idle, Loading (with cancellation option), Cannot Generate (reason, code, actionable suggestions), Error (actionable message and retry option), and Success (interactive recipe workspace).
  - Request lifecycle guarded by an integer ref (`activeRequestIdRef`), incremented on start and cancellation to drop stale responses.
- Responsive mobile-first interface built using React, Vite, JavaScript, and plain CSS.

### Explicit Exclusions
- No conversational or chatbot interfaces.
- No user authentication or login sessions.
- No database storage in core scope.
- No third-party recipe scraping.
- No image generation or streaming.
- No automatic scaling of cooking or prep times.
- No medical, allergen, or food safety guarantees.
- LocalStorage persistence deferred until all core features are functional.

---

## 2. Proposed Folder Structure and Responsibilities

```
Fridge-to-Recipe/
|-- api/
|   `-- recipe.js                 # Vercel serverless entry point importing shared handler
|-- server/
|   |-- handler.js                # Core request handler (shared between local dev & Vercel)
|   |-- dev-server.js             # Lightweight local development server for npm start
|   `-- config.js                 # Server-side timeouts, limits, and environment constants
|-- shared/
|   `-- contract.js               # Shared Zod schemas, validation rules, and error envelopes
|-- src/
|   |-- components/
|   |   |-- InputForm.jsx         # Prompt input, character count, submit, validation feedback
|   |   |-- RecipeWorkspace.jsx   # Recipe workspace container
|   |   |-- ServingsSelector.jsx  # Serving count adjustment controls
|   |   |-- IngredientsList.jsx   # Ingredients list with supplied/additional sections
|   |   |-- StepChecklist.jsx     # Step checklist with token resolution and step overrides
|   |   |-- SwapSelector.jsx      # Single swap selection and restore controls
|   |   |-- CannotGenerateView.jsx# Clean explanatory state when recipe cannot be made
|   |   |-- ErrorState.jsx        # Failure message display with retry action
|   |   `-- LoadingState.jsx      # Loading indicator with cancellation action
|   |-- hooks/
|   |   `-- useRecipeGenerator.js # Request lifecycle, activeRequestIdRef, AbortController
|   |-- lib/
|   |   `-- scaling.js            # Immutable quantity scaling and unit formatting
|   |-- styles/
|   |   `-- main.css              # Vanilla CSS layout, responsive breakpoints, tokens
|   |-- App.jsx                   # Root component orchestrating page states
|   |-- main.jsx                  # React DOM entry point
|   `-- index.html                # HTML entry point
|-- tests/
|   |-- fixtures/                 # Labelled fixture files for unit tests
|   `-- contract.test.js          # Focused unit tests for contract, bounds, and references
|-- .env.example                  # Template for required environment variables
|-- .gitignore                    # Ignored files (node_modules, dist, .env)
|-- package.json                  # Scripts and dependencies
|-- vite.config.js                # Vite build and proxy configuration
|-- vercel.json                   # Vercel deployment routes and serverless configuration
|-- PLAN.md                       # Implementation plan and tracking
|-- DATA_CONTRACT.md              # Schemas, validation rules, and scaling semantics
|-- ARCHITECTURE.md               # Final architecture documentation
`-- README.md                     # Setup instructions and honest time tracking
```

---

## 3. Implementation Stages (8-Hour Total Budget)

| Stage | Focus Area | Planned Duration | Deliverables |
|---|---|---|---|
| Stage 1 | Planning & Data Contract | 1.0 h | Finalized `PLAN.md` and `DATA_CONTRACT.md` |
| Stage 2 | Scaffolding & Shared Runner | 1.0 h | Vite + React + plain CSS, shared contract, local API shell, single `npm start` |
| Stage 3 | Backend API & Gemini Integration | 1.5 h | `/api/recipe` with Gemini integration, Zod schema validation, business-rule validation |
| Stage 4 | Interactive UI & Scaling Logic | 1.75 h | Recipe workspace, step completion, serving scaling, single swap substitution, plain CSS |
| Stage 5 | Reliability, Edge Cases & Error States | 1.0 h | Malformed response handling, stale request guards, cannot-generate state, timeout handling |
| Stage 6 | Focused Testing & Deployment | 0.75 h | Unit tests (stale updates, invalid references, swaps, reset), Vercel production deployment |
| Stage 7 | Documentation, Demo & Time Tracking | 1.0 h | `ARCHITECTURE.md`, `README.md`, screen recording demo preparation, logged time tracking |
| **Total** | | **8.0 h** | |

---

## 4. Acceptance Checklist

- [ ] Single entry command `npm install && npm start` boots both client and API locally.
- [ ] User submits free-form text containing ingredients, quantities, pantry items, and dietary rules in `{ prompt }`.
- [ ] Client enforces a 2,000-character input limit; backend rejects prompts exceeding 2,000 characters with 400 Bad Request.
- [ ] Backend enforces a 16 KiB HTTP request body limit, rejecting oversized bodies with 413 Payload Too Large.
- [ ] Gemini API key is isolated strictly to the backend environment and never exposed to the client.
- [ ] Backend validates provider JSON with Zod and enforces cross-reference and numeric bounds checks.
- [ ] Incompatible, unsafe, or inedible inputs return a structured `cannot_generate` response with actionable advice.
- [ ] Frontend displays distinct states: Empty/Idle, Loading, Cannot Generate, Error, and Success.
- [ ] Ingredients distinguish supplied items from additional required items.
- [ ] Servings selector scales numeric quantities dynamically from immutable base values without turning small amounts to zero.
- [ ] Non-numeric quantities (e.g., "to taste") remain unscaled; numeric units like "pinches" scale with quantity.
- [ ] Cooking time does not scale with servings.
- [ ] Steps can be toggled as completed with progress tracking.
- [ ] Swaps are limited to at most one active swap; selecting another replaces it, and original can be restored.
- [ ] Changing active swap clears completed steps and swaps step instructions using `stepOverrides`.
- [ ] Stale responses are discarded using `activeRequestIdRef`.
- [ ] Distinguishes intentional user cancellation from network or server timeout errors.
- [ ] Model text is rendered strictly as plain text (no HTML injection vulnerabilities).
- [ ] Unit tests cover valid data, invalid bounds, duplicate IDs, missing references, invalid tokens, and swap overrides.
- [ ] Project deploys successfully to Vercel.
- [ ] `ARCHITECTURE.md`, `README.md`, and demo video are prepared within the 8-hour budget.

---

## 5. Security & Deployment Approach

### Security Approach
- Secret Management: `GEMINI_API_KEY` is stored exclusively in server environment variables (`.env` locally, Vercel environment variables in deployment). The `VITE_` prefix is strictly forbidden for backend secrets.
- Layered Prompt Protection:
  - System instructions are strictly segregated from user input.
  - The model's task is strictly bound to recipe generation and cannot-generate evaluation.
  - The model has no access to external tools, filesystem, environment variables, or executable interpreters.
  - Provider response is validated against an explicit Zod schema before delivery to the client.
- Sanitized Diagnostic Logging:
  - Server logs only metadata: timestamp, request ID, prompt character length, HTTP status, execution latency, and high-level error codes.
  - Never log raw API keys, full user prompt text by default, or raw provider payload dumps.
- Rate Limiting Assessment & Honest Limitations:
  - Vercel serverless functions are ephemeral and stateless; per-instance in-memory counters do not provide global rate limiting across concurrent instances.
  - Baseline mitigations: Client-side debounce on submit, 16 KiB body limit, 2,000-character prompt limit, and 12-second server timeout.
  - Honest disclosure: Global per-IP rate limiting across serverless instances requires external state (e.g. Upstash Redis or edge middleware). Without external paid services, global rate limiting is not claimed.
- Content Security: Plain text rendering only via standard React JSX. Zero use of `dangerouslySetInnerHTML`.
- Configurable Timeouts:
  - Server provider call timeout: bounded at 12 seconds via AbortSignal.
  - Client network request timeout: bounded at 15 seconds via AbortController.
  - User cancellation is tracked distinctly from timeout and network failures.

### Deployment Approach
- Platform: Vercel.
- Build Configuration:
  - Root directory: `./`
  - Build command: `npm run build`
  - Output directory: `dist`
  - Functions directory: `api/`
- Architecture: Single repository serving static Vite assets from the root and routing `/api/recipe` to the serverless function.
