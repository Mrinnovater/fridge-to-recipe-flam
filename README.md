# Fridge-to-Recipe: AI-Powered Culinary Assistant

A production-ready full-stack culinary assistant that transforms arbitrary pantry ingredients into structured, step-by-step cooking recipes. Built with React 18, Vite, and Vercel Serverless Functions powered by Google Gemini Flash.

---

## 1. Core Requirements Checklist

- [x] **React with Hooks**: Functional component architecture utilizing `useState`, `useEffect`, `useCallback`, and `useRef`.
- [x] **Free-Form Text Input**: Accepts natural language input of pantry items, portions, and dietary preferences without rigid input forms.
- [x] **LLM Integration (Gemini Flash)**: Integrated with Google Gemini Flash using zero-thinking budget and strict JSON response schemas for deterministic output.
- [x] **Structured JSON Output (Non-Chatbot)**: Strictly non-conversational. Returns rigid, validated JSON recipe data structures rather than chat messages.
- [x] **Deployment-Ready Serverless Architecture**: Fully encapsulated in `api/recipe.js` with `vercel.json` rewrites and 60-second execution caps.
- [x] **Comprehensive Error Handling**: Robust recovery for HTTP 503s, 60-second timeouts, malformed responses, client disconnections, and Pacific midnight daily quota resets.

---

## 2. Features

- **Scalable Servings**: Non-destructive mathematical scaling from 1 to 12 servings. Qualitative ingredients ("to taste") and singular/plural units (`1 piece` vs `3 pieces`, `1 cup` vs `2 cups`) remain consistent.
- **Context-Aware Ingredient Swaps**: Generates 0 to 3 simple 1-to-1 substitutions with instruction overrides that require no undeclared ingredients.
- **Checkable Cooking Steps**: Interactive progress tracking with real-time percentage progress bar and instruction highlight tokens.
- **Culinary Visual Experience**: Deep culinary food background with 60% visibility overlay (`rgba(0,0,0,0.6)`), glassmorphic cards, plated dish cover photos, and custom culinary iconography.
- **"Serve & Enjoy" Completion Flow**: Step completion activates a dedicated finish panel with options to review the current recipe or start a new creation.
- **Resilient Daily Quota Management**: Detects Google Gemini free-tier daily caps, computes the scheduled midnight reset in `America/Los_Angeles` (accounting for DST), and renders a localized countdown notice ("Our kitchen opens again in X hours and Y minutes").

---

## 3. Local Setup & Testing

### Prerequisites
- Node.js >= 20.12.0
- npm >= 10.0.0

### Installation
```bash
git clone <repository-url>
cd Fridge-to-Recipe
npm install
```

### Environment Configuration
Copy the sample environment file to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with your Google Gemini API key:
```env
PORT=3001
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=60000
```

### Running Locally
To test both the Vite frontend and the backend API server locally before deployment:
```bash
npm start
```
- Client application: `http://localhost:5173`
- Backend API server: `http://localhost:3001`

### Running Automated Tests
Run the test suite to verify contract validation, business rules, timeout cancellations, and serverless handlers:
```bash
npm test
```

### Building for Production
Validate syntax and bundle assets:
```bash
npm run build
```

---

## 4. Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `GEMINI_API_KEY` | Local (`.env`) & Vercel Dashboard | Google Gemini API Key (*Mandatory*) |
| `GEMINI_MODEL` | Local (`.env`) & Vercel Dashboard | Model name (default: `gemini-3.5-flash-lite`) |
| `GEMINI_TIMEOUT_MS` | Local (`.env`) & Vercel Dashboard | Backend execution timeout in milliseconds (default: `60000`) |
| `PORT` | Local only | Local Node HTTP server port (default: `3001`) |

> **Important**: `GEMINI_API_KEY` must be configured in `.env` for local testing and added to the **Vercel Project Settings > Environment Variables** for production deployment. The client bundle never accesses this key.

---

## 5. Deployment Instructions (Vercel)

1. Connect this repository to Vercel via the Vercel Dashboard or run `npx vercel`.
2. Select the **Vite** framework preset:
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add `GEMINI_API_KEY` in **Project Settings > Environment Variables**.
4. Deploy. Vercel automatically exposes `api/recipe.js` as a serverless endpoint and routes `/api/recipe` based on `vercel.json`.

---

## 6. AI Usage Disclosure (Mandatory)

In compliance with assignment guidelines, AI tools were utilized during development for:
- Accelerating initial boilerplate code generation for React components and serverless handlers.
- Structuring mathematical edge cases for unit scaling and Zod contract schemas.
- Drafting initial CSS design tokens, glassmorphism filters, and SVG icons.
- Generating focused regression tests for HTTP 429 quota handling and timeout cancellation.

All architectural decisions, contract enforcement, bug fixes, business rules, and UI polish were reviewed, debugged, and verified manually.

---

## 7. Known Limitations

- **Single Active Swap Constraint**: Only one ingredient swap may be activated at a time to prevent conflicting instruction overrides and recipe inconsistencies.
- **Culinary Accuracy Disclaimer**: Recipes are generated by an AI model; cooking times, temperatures, and proportions are realistic approximations and should be evaluated with common culinary judgment.
- **Free-Tier API Quota Limits**: Dependent on Google Gemini free-tier quotas (15 RPM and 20 RPD on free tier). When exceeded, the app provides localized reset countdowns and prompts retries after the quota reset window.

