# CLAUDE.md

This document guides AI code assistants when working in this repository. It summarizes the architecture, directory layout, key files, and coding rules that are easy to miss.

## Project Overview

VibeCode Grasshopper Editor is a desktop app (Electron + Next.js) for editing Grasshopper GHPython components with real-time sync to Grasshopper. It enables AI-assisted code generation for IronPython/Python 2.7 scripts and context-aware assistance based on the Grasshopper canvas.

## High-level Architecture

- Electron shell launches the Next.js UI and provides a packaged desktop experience.
- Next.js/React UI (TypeScript, Tailwind) hosts the code editor, AI controls, context viewers, and configuration panels.
- A local HTTP server inside Grasshopper (`ghserver.py`) exposes endpoints for reading/writing component code, parameters, and canvas context.
- Optional build artifacts for web export (`out/`) and desktop installers (`dist-electron/`).

## Directory Overview (selected)

```text
/
├─ electron/
│  └─ main.js                Electron main process (create windows, load Next app)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx          App shell
│  │  └─ page.tsx            Main application page
│  ├─ components/
│  │  ├─ AIPanel.tsx         AI prompt/completion controls
│  │  ├─ AppHeader.tsx       Top navigation/header
│  │  ├─ CodeEditor.tsx      Code editor for GHPython scripts
│  │  ├─ ConfigPanel.tsx     Settings & configuration UI
│  │  ├─ ContextControls.tsx Context provider toggles and actions
│  │  ├─ ContextPanel.tsx    Canvas context data viewer
│  │  ├─ ContextViewer.tsx   Rendered context display
│  │  ├─ DocsPanel.tsx       Inline docs/help panel
│  │  ├─ ErrorBoundary.tsx   UI error containment
│  │  ├─ GraphicalView.tsx   Visual preview / future graph UI
│  │  ├─ InputParameters.tsx Input parameter editor
│  │  ├─ ModelSelector.tsx   Model selection (GPT-5 variants)
│  │  ├─ OutputParameters.tsx Output parameter editor
│  │  ├─ ParameterCard.tsx   Parameter card UI
│  │  ├─ StatusBar.tsx       Footer/status
│  │  └─ TabNavigation.tsx   Section tabs
│  ├─ lib/
│  │  ├─ grasshopper-api.ts  Client for GH server HTTP endpoints
│  │  ├─ openai-api.ts       OpenAI API integration
│  │  ├─ context-*.ts        Context extraction/exporters (Markdown/JSON)
│  │  ├─ graph-traversal.ts  Compute-order traversal helpers
│  │  ├─ image-utils.ts      Image handling for AI context
│  │  ├─ features.ts         Feature flags/toggles
│  │  ├─ use-client-init.ts  Client bootstrapping & effects
│  │  └─ types.ts            Shared type definitions
│  └─ store/
│     ├─ app-store.ts        Central state (Zustand) and slices wiring
│     ├─ slices/             UI, settings, editor, component cache
│     ├─ types.ts            Store-specific types
│     └─ utils/              Helpers: storage, ids, revisions, parameters
├─ ghserver.py               Grasshopper in-process HTTP server (:9998)
├─ gh_client_snippet.gh      Example GH definition with server component
├─ dist-electron/            Built installers (desktop distribution)
├─ dist/, out/               Web build outputs
├─ public/                   Static assets (images, docs)
├─ next.config.js            Next.js config
├─ tailwind.config.ts        Tailwind config
├─ tsconfig.json             TypeScript config
└─ package.json              Scripts and builder config
```

## Common Tasks

- Install deps: `npm install`
- Dev (Electron + Next.js): `npm run electron:dev`
- Dev (browser only): `npm run dev` → open `http://localhost:3000`
- Build web: `npm run build`
- Package desktop app: `npm run dist`

For end-to-end usage, see `README.md` (Getting Started, Troubleshooting).

## Rules for AI-Generated GHPython Code

- Target IronPython/Python 2.7.
  - Do not use f-strings, type hints, or modern Python syntax.
  - Prefer `"{}".format(...)` for string formatting.
- Assume Rhino 7 + Grasshopper environment with `rhinoscriptsyntax` and GH APIs available.
- Keep generated code readable and explicit; avoid clever one-liners.
- When updating parameters, ensure consistency with the UI and server contract.

## UI/Parameter Text Conventions

- Write short, meaningful descriptions for each parameter and component.
- Mirror parameter/component descriptions between the app and Grasshopper when round-tripping.
- Parameter card titles in the UI should omit the "Input:"/"Output:" prefix; display just the name.

## Frontend Code Guidelines (TypeScript/React)

- Use clear, descriptive names; avoid `any` and unsafe casts.
- Prefer early returns and shallow component trees; handle edge cases first.
- Keep components focused; push shared logic into `src/lib/` or the store.
- Match existing formatting; avoid drive-by refactors unrelated to your change.

## Where Things Happen

- GH communication: `src/lib/grasshopper-api.ts`
- AI requests: `src/lib/openai-api.ts`
- Context generation: `src/lib/context-*.ts`, `src/lib/graph-traversal.ts`
- Global state: `src/store/app-store.ts` with slices in `src/store/slices/`
- Desktop shell: `electron/main.js`
- GH local server: `ghserver.py`

If you add or move files, update this document and `README.md` accordingly.