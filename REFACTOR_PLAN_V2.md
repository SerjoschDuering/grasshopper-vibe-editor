# VibeCode → React (Next.js) Migration — Clean, Structured Plan

**Date:** August 30, 2025
**Phase:** Week 1, Days 1–6 COMPLETED ✅
**Progress:** \~45% (of a 10–14 day scope)

---

## 🚀 Current Status

### ✅ What's Working Now (Days 1-6 Complete):

**Foundation & Layout:**
- Next.js 14 with TypeScript and Tailwind CSS
- 3-column responsive layout matching original design
- Font Awesome icons integrated
- Custom CSS animations and transitions

**Code Editor:**
- Monaco Editor with Python syntax highlighting
- Dynamic import for performance
- Proper cursor preservation on external updates
- Python/IronPython code highlighting

**Parameter Management (FULLY FUNCTIONAL):**
- ✅ Add/Remove Input and Output parameters
- ✅ Parameter cards with all fields:
  - Name and Description
  - Type hints (str, int, float, bool, point, vector, curve, surface, brep, mesh, generic)
  - Access levels (item, list, tree)
  - Optional parameter checkbox
- ✅ Default output protection (can't rename or remove 'output')
- ✅ Drag & drop reordering with @dnd-kit (feature flag enabled)
- ✅ Individual card collapse to title-only view
- ✅ Parameter count badges
- ✅ Smooth animations for all interactions

**State Management:**
- Zustand store fully configured
- LocalStorage persistence for:
  - API key
  - Auto-fetch preference
  - Collapsed card states
- Status message system with auto-dismiss
- Loading states for all async operations
 - Normalized component cache with `componentsById` and `selectedComponentId`
 - Draft/snapshot model with `dirty`, `baseRevision`, `isBaseOutdated` and conflict detection

**UI/UX Features:**
- Load Test Data button (functional)
- Status bar with success/error/warning/info messages
- Responsive design
- Custom scrollbars
- Hover effects and transitions
 - Editor header shows state badges (Uncommitted, Out of sync, Conflict) with actions

**Grasshopper API & Polling:**
- Fetch/send wired to GH server
- Auto-fetch polling every 2s with guarded updates (no overwrite of dirty drafts)
- Stable revision hashing to detect server changes (code + normalized params)
- Selected-component polling supports multiple message types for compatibility

### 🔄 What's Next (Days 7-14):

**Day 7 - State & API:**
- Conflict resolution UX final polish (copy/tooltips)
- Optional “Disconnected” indicator after repeated failures

**Days 8-9 - AI Integration:**
- Prompt polish and result summarization copy
- Minor validation tweaks if needed

**Days 10-14 - Polish & Deploy:**
- Bug fixes and smoke tests (GH round-trip, AI generation)
- Production deployment

---

## 1) Goals, Scope, and Principles

### Primary Goal

A **1:1 feature migration** of the existing HTML app to React (Next.js 14), with the **same API**, **same UI/UX**, and **same keyboard & color scheme**, while improving maintainability. Enhancements come **after** parity.

### In-Scope (v1.0)

* Single-page Next.js app with 3-column layout.
* Monaco editor (Python syntax), replacing Ace.
* Parameters UI (inputs/outputs) with **default output protection**.
* Local storage for user prefs (e.g., autoFetch).
* Grasshopper API round-trips (fetch/send).
* Optional **auto-fetch polling** toggle.
* OpenAI integration for code/parameter generation (with **robust validation**).
* UX polish (animations, hover/focus, status bar).
* **Drag-and-drop parameter reordering** behind a feature flag (enabled by default).
* **AI Context system** (extensible context providers configurable in UI).

### Out-of-Scope (v1.0) — defer to v1.1+

* Component libraries (e.g., shadcn/ui).
* React Query; use native `fetch`.
* DB, auth, WebSockets (HTTP polling is sufficient).
* Complex routing (single page).
* Formal tests initially (add later).
* Complex animation libs (CSS only).

**Guiding Principle:** *Keep it simple. Ship parity fast. Then iterate.*

---

## 2) Tech Stack

* **Next.js 14** (App Router) + **TypeScript**
* **Tailwind CSS** (+ small custom CSS vars/animations)
* **Monaco Editor** (lazy/dynamic import to manage bundle size)
* **Zustand** (single store; optional Immer middleware)
* **Font Awesome** (icons)
* **Native fetch** (no React Query)

---

## 3) Project Structure (finalized for v1.0)

> Repo name remains as currently initialized: **`grasshopper-vibe-editor/`**
> (If you prefer “vibecode”, rename later—purely cosmetic.)

```
grasshopper-vibe-editor/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # AppShell 3-column layout
│   │   └── globals.css         # Tailwind base + custom animations/vars
│   ├── components/
│   │   ├── CodeEditor.tsx
│   │   ├── ParameterCard.tsx
│   │   ├── InputParameters.tsx
│   │   ├── OutputParameters.tsx
│   │   ├── ConfigPanel.tsx
│   │   ├── AIPanel.tsx
│   │   └── StatusBar.tsx
│   ├── lib/
│   │   ├── grasshopper-api.ts
│   │   ├── openai-api.ts
│   │   └── types.ts
│   └── store/
│       └── app-store.ts
├── public/
├── .env.local.example          # GH_BASE_URL, NEXT_PUBLIC_FEATURE_FLAGS, etc.
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── next-env.d.ts
```

> **Note on CORS:** Default is **direct fetch** to Grasshopper server (no backend changes). If a CORS blockage appears in a target environment, switch to a minimal Next API proxy (`app/api/gh/route.ts`) without changing the Grasshopper backend. Keep this ready but **don’t enable unless needed**.

---

## 4) Types & Data Schema (single source of truth)

All in `src/lib/types.ts`:

```ts
export type ParameterTypeHint =
  | 'str' | 'int' | 'float' | 'bool' | 'guid'
  | 'point' | 'vector' | 'curve' | 'surface' | 'brep' | 'mesh' | 'generic';

export type ParameterAccess = 'item' | 'list' | 'tree';

export interface Status {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
}

export interface BaseParameter {
  id: string;
  kind: 'input' | 'output';
  name: string;
  description: string;
}

export interface InputParameter extends BaseParameter {
  kind: 'input';
  typehint: ParameterTypeHint;
  access: ParameterAccess;
  optional: boolean;
}

export interface OutputParameter extends BaseParameter {
  kind: 'output';
}

export type Parameter = InputParameter | OutputParameter;

export interface AiOptions {
  generateParams: boolean;
}

export interface GrasshopperUpdatePayload {
  type: 'update_script';
  instance_guid: string;
  code: string;
  description?: string;
  message_to_user?: string;
  param_definitions: Array<
    | {
        type: 'input';
        name: string;
        description: string;
        typehint: ParameterTypeHint;
        access: ParameterAccess;
        optional: boolean;
      }
    | {
        type: 'output';
        name: string;
        description: string;
      }
  >;
}
```

---

## 5) State Management (Zustand) — definitive contract

`src/store/app-store.ts`

```ts
interface LoadingFlags {
  ai: boolean;
  fetch: boolean;
  send: boolean;
  autoFetch: boolean;
}

export interface AppState {
  // Editor
  code: string;
  targetGuid: string;

  // Parameters
  inputs: InputParameter[];
  outputs: OutputParameter[];

  // Settings
  apiKey: string;
  autoFetch: boolean;

  // AI
  aiPrompt: string;
  aiGenerateParams: boolean;

  // UI
  loading: LoadingFlags;
  status?: Status;

  // Sync actions
  setCode: (code: string) => void;
  setTargetGuid: (guid: string) => void;
  setApiKey: (key: string) => void;
  setAiPrompt: (prompt: string) => void;
  setAiGenerateParams: (on: boolean) => void;

  addInput: () => void;
  addOutput: () => void;
  updateParameter: (p: Parameter) => void;
  removeParameter: (id: string) => void;

  setAutoFetch: (on: boolean) => void;
  toggleAutoFetch: () => void;

  showStatus: (status: Status) => void;
  clearStatus: () => void;

  // Async ops
  fetchFromGrasshopper: () => Promise<void>;
  sendToGrasshopper: () => Promise<void>;
  generateWithAI: () => Promise<void>;
  loadTestData: () => void;

  // Optional: reordering
  reorderInputs?: (activeId: string, overId: string) => void;
  reorderOutputs?: (activeId: string, overId: string) => void;
}
```

**Rules baked-in from the start**

* **Persist** `autoFetch` to `localStorage` and initialize from it.
* Keep polling `setInterval` handles **outside persisted state** (avoid HMR leaks).
* Default output parameter named **`output`** is **non-removable** and **read-only name**.
* Prefer **selector-based** usage in components to minimize re-renders.

---

## 6) API Modules

`src/lib/grasshopper-api.ts`

* `const GH_BASE_URL = process.env.NEXT_PUBLIC_GH_BASE_URL ?? 'http://127.0.0.1:9998'`
* `getSelectedComponent()` → tries multiple types: `get_selected_script_component`, `get_selected_python_component`, `get_selected_component`
* `getComponentByGuid(instanceGuid)` → tries `get_script_component`, `get_python_component`, `get_component_by_guid`, then falls back to selected
* `updateScript(payload: GrasshopperUpdatePayload)`
* `startAutoFetch(onTick: () => Promise<void>)` / `stopAutoFetch()`
* `mapStoreToParamDefinitions(inputs, outputs)` (mirrors original collection rules)

`src/lib/openai-api.ts`

* `generateWithAI({ prompt, apiKey, state, generateParams })`

  * Build system prompt & JSON schema (as per original).
  * POST `https://api.openai.com/v1/chat/completions`.
  * Parse & validate result; update code/params.

> **CORS/Secrets:** Direct client fetch by default. If CORS arises, switch to Next proxy route. API keys are user-provided and kept in local state/localStorage; provide an **env-var fallback** for dev.

---

## 7) Component Architecture & Contracts

1. **AppShell (page.tsx)**
   3-column responsive layout; children: `ConfigPanel`, `CodeEditor`, `AIPanel`, `InputParameters`, `OutputParameters`, `StatusBar`. Strict parity in spacing & visuals (Tailwind + CSS vars).

2. **ConfigPanel**
   Fields: `targetGuid`, `apiKey`, `autoFetch` toggle, **Load Test Data**, **Fetch**.

   * Persist `autoFetch`.
   * Disable manual fetch while auto-fetch is on.

3. **CodeEditor**
   Monaco (Python), dynamic import; controlled by store (`code`, `setCode`).

   * Keep cursor on external updates.
   * Options mirror Ace config (font, tabs/spaces).

4. **AIPanel**
   Prompt textarea, “Generate parameters” checkbox, submit.

   * Validates prompt/API key.
   * Shows **AI speech bubble** + loading animation.
   * On success: updates `code` & params, shows status.

5. **InputParameters**
   List of `ParameterCard` (`variant='input'`) + **Add** button.

   * Scroll-into-view on add.
   * Enter animation on mount.
   * **Drag-and-drop** reordering (feature flag).

6. **OutputParameters**
   List of `ParameterCard` (`variant='output'`) + **Add** button.

   * Ensure one default output named **`output`** exists on first load.
   * Default output is **non-removable** and **name read-only**.
   * **Drag-and-drop** reordering (feature flag), except default stays protected.

7. **ParameterCard**
   Props: `variant`, `parameter`, `onChange`, `onRemove`, `disableRemove?`.

   * Title reflects name; read-only name when default output.
   * Input-only fields: typehint, access, optional.

8. **StatusBar**
   Global status/toast with auto-hide; type-based color/icon.

9. **AutoFetchIndicator** *(tiny helper, optional)*
   Shows polling state next to toggle.

---

## 8) Built-in Animations & Visual Feedback

* **Card enter** (fade/translate) and **status fade** preserved.
* **Button pulse** on quick actions.
* **AI “thinking”** keyframes for loading.
  *(All in `globals.css`, used via Tailwind utility classes or small CSS classes.)*

---

## 9) Feature Flags (v1.0 baked in)

* `ENABLE_DRAG_DROP_REORDER` (default: **true**)
* `USE_NEXT_GH_PROXY` (default: **false**, enable only if CORS fails)

Expose flags via `NEXT_PUBLIC_FEATURE_FLAGS` (JSON) or a small `features.ts`.

---

## 10) AI Context System (extensible from day one)

* **Providers** with `id`, `name`, `enabled`, `priority`, `getContext()`.
* Built-ins:

  * `grasshopper-env` (on; Python 2.7, IronPython, Rhino/Grasshopper modules)
  * `custom-instructions` (on; localStorage)
  * `component-neighbors` (off by default)
  * `canvas-state` (off by default)
* **AIPanel** includes context settings UI to toggle providers.

The final prompt builder stitches contexts in priority order and attaches current code + parameters, with **rules**: Python 2.7, `import rhinoscriptsyntax as rs`, IronPython practices.

---

## 11) Test Data (exact shape) & Loader

```ts
const TEST_DATA = {
  type: 'component_data',
  instance_guid: 'test-guid-12345',
  code: `import rhinoscriptsyntax as rs

def process_points(points, scale_factor=1.0):
    """Scale and process input points"""
    if not points:
        return []
    
    scaled_points = []
    for pt in points:
        if pt:
            # Scale point from origin
            scaled = rs.PointScale(pt, [0,0,0], [scale_factor]*3)
            scaled_points.append(scaled)
    
    return scaled_points

# Main execution
output = process_points(points, scale)`,
  param_definitions: [
    { type: 'input',  name: 'points', description: 'List of points to process', typehint: 'point', access: 'list', optional: false },
    { type: 'input',  name: 'scale',  description: 'Scale factor for points',    typehint: 'float', access: 'item', optional: true },
    { type: 'output', name: 'output', description: 'Scaled points' }
  ]
};
```

`loadTestData()` maps this into store (generating `id`s, setting `kind`), sets `code`/`targetGuid`, and shows success status.

---

## 12) Validation (enforced at UI level)

Utilities:

* **API key**: non-empty, starts with `sk-`.
* **Prompt**: non-empty, min length 10.
* **Parameter name**: required, valid Python identifier, unique among peers.
* **GUID**: basic GUID regex.

**On validation failure**: show error status and block action.

---

## 13) Behavior Mapping (HTML → React)

* `updateCardTitle` → handled inside `ParameterCard`.
* `createInputCard/createOutputCard` → `addInput`/`addOutput` + render list.
* Remove delegation → per-card `onRemove`.
* `showStatus` → `StatusBar` + store actions.
* `fetchSelectedComponentData` → `fetchFromGrasshopper`.
* `getUIData` → `mapStoreToParamDefinitions` before `updateScript`.
* `sendDataToGrasshopper` → `sendToGrasshopper`.
* `handleAISubmit` → `generateWithAI` + store orchestration.
* `loadDataFromPayload` → used inside `fetchFromGrasshopper` and `loadTestData`.
* Auto-fetch (2s) → `startAutoFetch/stopAutoFetch`, toggle in panel, indicator in UI.

---

## 14) Implementation Roadmap (10–14 days)

### ✅ Days 1–2 — Foundation (COMPLETED)

* Next.js + TS + Tailwind; base layout identical (3 columns).
* CSS vars & animations ported; folders scaffolded.
* Types created; dev server at `http://localhost:3000`.
* Font Awesome integrated.

### ✅ Days 3–4 — Monaco (COMPLETED)

* ✅ Swapped Ace → Monaco; Python language; options mirrored.
* ✅ Dynamic import; ensure no cursor jumps on external updates.

### ✅ Days 5–6 — Parameters (COMPLETED)

* ✅ Ported parameter UI; add/remove; typehint/access/optional.
* ✅ Default output presence + protection (can't rename or remove).
* ✅ DnD reordering behind flag; smooth enter animation.
* ✅ **BONUS**: Individual parameter card collapse functionality with persistence
* ✅ Full Zustand store integration with localStorage persistence
* ✅ Type hints dropdown (str, int, float, bool, point, vector, curve, etc.)
* ✅ Access levels (item, list, tree)
* ✅ Optional parameter checkbox for inputs
* ✅ Parameter count badges in section headers
* ✅ Smooth animations and transitions

### Day 7 — State & API

* Wire Zustand store; selectors; statuses. (COMPLETED)
* Grasshopper API fetch/send; auto-fetch loop & indicator. (COMPLETED)
* Map store → param definitions. (COMPLETED)

### Days 8–9 — AI

* OpenAI integration (prompt, generateParams). (COMPLETED)
* Animated “AI thinking” + speech bubble. (COMPLETED)
* Robust validation & error surfacing. (COMPLETED)

### Day 10 — Settings & Test Data

* Load **Test Data** button. (COMPLETED)
* LocalStorage for prefs (autoFetch, optionally API key). (COMPLETED)
* GUID input UX & validation; Config panel polish. (PARTIAL)

### Days 11–12 — Polish & QA

* Visual parity (hover/focus/icons). (COMPLETED)
* Error handling paths; performance pass (code-splitting OK). (PARTIAL)
* Accessibility basics (labels, aria). (PENDING)

### Days 13–14 — Deploy & Docs

* Env vars; Vercel deployment. (PENDING)
* Production smoke tests. (PENDING)
* Documentation updates (README, FEATURES, project-specs cross-references). (PENDING)

---

## 15) Success Criteria

**Must-have (v1.0)**

* Feature parity with current HTML app.
* Equal or better perceived performance (first paint + editor load).
* Works on the same browsers.
* No data loss; same API compatibility.

**Nice-to-have (v1.1+)**

* Better completion, faster AI, smaller bundle, improved mobile.

---

## 16) Performance & Reliability (embedded requirements)

* **Monaco** via **dynamic import**; load only when editor is visible.
* Avoid storing interval IDs in persisted state (prevent memory leaks).
* Use **explicit selectors** for store reads to reduce re-renders.
* If **CORS** encountered, flip `USE_NEXT_GH_PROXY` flag and route requests via a tiny Next API handler (no GH backend change).

---

## 17) Deployment & Rollout Strategy

**Day 1 of Go-Live**

1. Deploy to **Vercel subdomain** (e.g., `beta.domain.com`).
2. Keep HTML version online.
3. Add “Try New Version” button in the HTML app.

**After 1 Week**

1. Gather feedback; fix criticals.
2. Make React version default.
3. Keep HTML as a **legacy** link.

---

## 18) Acceptance Criteria by Component

* **ConfigPanel:** Reflects store; toggling auto-fetch starts/stops polling; fetch disabled during polling; `.env.local` base URL supported.
* **CodeEditor:** Controlled, Python syntax; external updates keep cursor; lazy-loaded.
* **ParameterCard:** Name ↔ title; input-only fields present; default output non-removable/read-only name.
* **Inputs/Outputs Lists:** Add/Remove/Scroll; DnD (flagged) works; animations smooth.
* **StatusBar:** Auto-hide; persistent errors longer or until user action.
* **AIPanel:** Validates inputs; shows loading; updates code/params on success; speech bubble displays summary; edits flow through draft layer.

---

## 19) Detailed DoD Checklist

**Phase 1: Foundation & Types**

* [x] `types.ts` compiles; consumed by store & components.
* [x] Tailwind config maps CSS vars; animations available.

**Phase 2: Store & Wiring**

* [x] `app-store.ts` implements full contract.
* [x] `autoFetch` persisted to localStorage.
* [x] `StatusBar` + `showStatus/clearStatus`.

**Phase 3: Layout & Core UI**

* [x] `AppShell` parity layout.
* [ ] `ConfigPanel` bindings + disabled fetch during polling.
* [x] `CodeEditor` Monaco dynamic import; cursor preserved.
* [x] `InputParameters` & `OutputParameters` (default output guarded).
* [x] `ParameterCard` variants & basic constraints.

**Phase 4: Grasshopper API**

* [x] `grasshopper-api.ts` (base URL, helpers, multi-type fallbacks).
* [x] `fetchFromGrasshopper` populates state correctly and detects conflicts via revision hashing.
* [x] `sendToGrasshopper` builds correct payload and reports status; marks draft clean.
* [x] Auto-fetch loop 2s; indicator reflects state; continues polling even when draft is dirty.

**Phase 5: AI Integration**

* [ ] `openai-api.ts` request/parse; errors handled.
* [ ] `AIPanel` + store; AI context providers configurable.

**Phase 6: UX Polish**

* [x] Hover/focus/iconography parity.
* [x] Card/status animations; no layout jank.
* [x] **BONUS**: Individual parameter card collapse (not in original spec)
* [ ] Accessibility pass.

**Phase 7: Testing & Readiness**

* [ ] GH round-trip smoke test.
* [ ] AI generation smoke test.
* [ ] Bundle split verified (editor lazy).
* [ ] Env handling documented (localStorage fallback OK).

---

## 20) Built-in Code Pieces (ready-to-use)

### Drag & Drop (with feature flag)

* Use `@dnd-kit` sortable (inputs/outputs lists).
* Provide `reorderInputs`/`reorderOutputs` store actions.
* Disable DnD by setting feature flag.

### Default Output Protection

* `isDefaultOutput = (p) => p.name.toLowerCase() === 'output'`
* In `ParameterCard`, lock name & disable remove if default.

### AI Prompt Builder (context providers)

* Providers gather GH env, neighbors, canvas, custom instructions.
* Build system prompt with strict rules: **Python 2.7**, `rs` imports, IronPython patterns.

### Validation

* API key `sk-` prefix.
* Prompt length ≥ 10.
* Parameter name unique + python identifier regex.
* GUID regex.

*(All samples from your original plan remain intact and are integrated across components and modules.)*

---

## 21) Documentation Updates

* **README.md:** local dev, env vars (`NEXT_PUBLIC_GH_BASE_URL`, OpenAI key), flags, run scripts.
* **FEATURES.md:** feature flags and toggles (DnD, proxy).
* **project-specs.md:** reference to React components/sections replacing prior HTML line refs.

---

## 22) Future Phases (post-parity)

* **Phase 2 (Context):** graph viewer, upstream/downstream, canvas browser, AI context toggles default-on.
* **Phase 3 (Docs):** tutorials, prompt templates, best practices.
* **Phase 4 (Nice-to-haves):** dark mode, export/import config, version history, shortcuts panel.

---
