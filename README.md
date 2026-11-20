# react-gas-starter-template

Monorepo starter template for building full-stack web apps with **React (Vite + TypeScript + Tailwind CSS + TanStack Query)** in `frontend/` and **TypeScript Google Apps Script (GAS) Web App + Google Sheets** bundled with **esbuild** and deployed via **`@google/clasp` v3** in `backend/`, equipped with an AI-ready documentation and skills workflow.

## Prerequisites

- **Node.js** (v20+ recommended) & **npm** (workspaces support)
- **Python 3** (required by the `ui-ux-pro-max` skill's `scripts/search.py`)
- **Google Account** with the [Apps Script API enabled](https://script.google.com/home/usersettings) (required for `@google/clasp`, which is installed directly as a devDependency in `backend/`)

## Tech Stack

- **Frontend (`frontend/`):** React 19, Vite 7, TypeScript, Tailwind CSS v4, TanStack Query v5, ESLint, Prettier, Vitest + Testing Library (`jsdom`)
- **Backend (`backend/`):** TypeScript + `@types/google-apps-script`, `esbuild` bundler (`dist/Code.js` + `dist/appsscript.json`), `@google/clasp` v3 CLI deployment, Google Sheets, offline Vitest unit tests (`node`)
- **AI / Agent System:** `AGENTS.md` (with `CLAUDE.md -> AGENTS.md` symlink), `CODING_STANDARDS.md`, `GLOSSARY.md`, `docs/adr/`, `.mcp.json` (Context7 MCP), and `.agents/skills/` (Matt Pocock Core + UI/UX Pro Max)

## Repository Structure

```text
.
├── AGENTS.md                        # Entrypoint & Read-on-Demand pointers for AI agents
├── CLAUDE.md -> AGENTS.md           # Symlink for Claude Code compatibility
├── CODING_STANDARDS.md              # Architecture, FE, GAS, security, test & exception rules
├── GLOSSARY.md                      # Domain terminology & Sheet-to-entity mappings
├── .mcp.json                        # Context7 MCP server configuration
├── vitest.config.ts                 # Root Vitest projects config (frontend + backend)
├── docs/adr/
│   └── 0000-template.md             # Concise ADR template with 3 filter criteria
├── .agents/skills/                  # Synced Matt Pocock Core + UI/UX Pro Max skills
├── frontend/                        # React + Vite + Tailwind + TanStack Query workspace
│   ├── .env.example                 # VITE_GAS_API_URL template
│   └── src/
│       ├── api/
│       │   ├── gasClient.ts         # Single GAS API client + unknown boundary validation
│       │   └── gasClient.test.ts    # API client & envelope unit tests
│       ├── hooks/useItems.ts        # Sample TanStack Query hooks (useQuery / useMutation)
│       ├── lib/queryClient.ts       # GAS-friendly QueryClient defaults
│       ├── App.tsx                  # Sample UI with loading / empty / error / data states
│       └── App.test.tsx             # Component tests with Testing Library
└── backend/                         # TypeScript GAS Web App + @google/clasp v3 workspace
    ├── .clasp.json.example          # clasp v3 config template (srcDir: "dist")
    ├── appsscript.json              # Apps Script V8 Web App manifest
    ├── build.mjs                    # esbuild bundler -> dist/Code.js + dist/appsscript.json
    └── src/
        ├── main.ts                  # Typed doGet / doPost, LockService, batch Sheets I/O
        ├── sheetsLogic.ts           # Pure schema mapping, validation & sanitization logic
        └── sheetsLogic.test.ts      # Offline Vitest unit tests
```

## Quick Start

### 1. Create & Install

Create a repository from this template on GitHub (**Use this template → Create a new repository**), clone it, and install all workspace dependencies (including `@google/clasp`):

```bash
npm install
```

### 2. Configure & Deploy Backend (`@google/clasp` v3)

1. Enable the Google Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Authenticate `clasp` once on your machine:
   ```bash
   npm run gas:login
   ```
3. Copy `backend/.clasp.json.example` to `backend/.clasp.json` and set your `scriptId` (keeping `"srcDir": "dist"`):
   ```bash
   cp backend/.clasp.json.example backend/.clasp.json
   ```
   _(Alternatively, create a new bound or standalone Apps Script project directly via `npx --workspace=backend clasp create --type sheets --title "My App" --rootDir dist`.)_
4. Build and verify what `clasp` will upload:
   ```bash
   npm run build
   npm run gas:status
   ```
   `clasp` uploads only `backend/dist/Code.js` and `backend/dist/appsscript.json` — never `src/*.test.ts`, `eslint.config.js`, or `node_modules/`.
5. Push code and create a Web App deployment:
   ```bash
   npm run gas:push
   npm run gas:deploy
   ```
   Open the Apps Script editor (`npm run gas:open`) to configure **Project Settings → Script Properties → `SPREADSHEET_ID`** (if using a standalone script) and copy the deployed Web App `/exec` URL.

### 3. Configure & Run Frontend

```bash
cp frontend/.env.example frontend/.env
```

Set `VITE_GAS_API_URL` in `frontend/.env` to the deployed `/exec` URL, then start the dev server and verify everything:

```bash
npm run dev
npm run check
```

## Architecture & Key Design Decisions

- **TypeScript-First GAS with `@google/clasp` v3:** Because `clasp` v3 dropped built-in `ts2gas` transpilation, `backend/build.mjs` bundles `backend/src/main.ts` + `backend/src/sheetsLogic.ts` via `esbuild` into `backend/dist/Code.js` (with a top-level `doGet`/`doPost` global footer for Apps Script V8) and copies `backend/appsscript.json` to `backend/dist/`. There is **zero logic duplication** between what runs in GAS and what Vitest tests offline.
- **Single GAS API Client & Boundary Validation:** All frontend network calls go through `frontend/src/api/gasClient.ts`. Responses are parsed as `unknown` and validated against the `{ ok: true, data }` / `{ ok: false, error }` envelope.
- **TanStack Query (No `useEffect` + `fetch`):** Server state uses TanStack Query hooks with GAS-friendly defaults (`refetchOnWindowFocus: false`, `staleTime: 5 * 60 * 1000`, `retry: 1`) to protect Apps Script quotas and handle cold-start latency.
- **CORS-Safe GAS `POST` Requests:** Mutations send JSON payloads with `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight (`OPTIONS`) failures in GAS Web Apps (documented in `CODING_STANDARDS.md` as `EXC-1`).
- **Safe Google Sheets Writes:** `backend/src/main.ts` performs batch reads/writes only, locks writes via `LockService.getScriptLock().tryLock()` with `finally` release, calls `.setNumberFormat("@")` before `.setValues()` on string/code columns to preserve leading zeros, and neutralizes formula injection (`=`, `+`, `-`, `@`).
- **Routing Policy:** `react-router` is intentionally not pre-installed to keep single-page apps lean. When a spec requires multiple pages/routes, install and use `react-router`.

## AI / Agent Workflow

This template uses a **Read on Demand** documentation model centered on `AGENTS.md` (and `CLAUDE.md` symlink):

1. **Align domain & decisions:** Run `/grill-with-docs` to update `GLOSSARY.md` (terms & Sheet-to-entity mappings) and record major trade-offs in `docs/adr/`.
2. **Design UI (optional):** Run `/ui-ux-pro-max` to generate `design-system/MASTER.md` and `design-system/pages/` before building new pages.
3. **Spec & ticket locally:** Run `/to-spec` → `/to-tickets` (stored in `.scratch/`, which is gitignored).
4. **Implement & verify:** Run `/implement` following `CODING_STANDARDS.md`, query up-to-date library docs via **Context7 MCP** (`.mcp.json`), and pass `npm run check` + `npm run build`.
5. **Review before merge:** Create a commit (or WIP commit) and run `/code-review` to check against both `CODING_STANDARDS.md` and the spec.

## Available Scripts

| Command                                                     | Description                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                                               | Start Vite dev server for `frontend/`                                          |
| `npm run build`                                             | Build both `frontend/dist/` (Vite) and `backend/dist/` (`esbuild` for GAS)     |
| `npm run check`                                             | Run `typecheck`, `lint`, `format:check`, and `test` across workspaces          |
| `npm run typecheck`                                         | Run TypeScript typechecking for `frontend` and `backend`                       |
| `npm run lint`                                              | Run ESLint across `frontend` and `backend`                                     |
| `npm run format:check`                                      | Check formatting across the repo with Prettier                                 |
| `npm run test`                                              | Run offline Vitest unit tests for `frontend` and `backend`                     |
| `npm run test:watch`                                        | Run Vitest in watch mode across both `frontend` and `backend`                  |
| `npm --workspace=frontend run test -- path/to/file.test.ts` | Run a single frontend test file (replace `frontend` with `backend`)            |
| `npm run gas:login`                                         | Authenticate `@google/clasp` with your Google account                          |
| `npm run gas:status`                                        | Inspect files in `backend/dist/` tracked by `clasp` (`clasp show-file-status`) |
| `npm run gas:push`                                          | Build `backend/dist/` and push to Google Apps Script via `clasp push`          |
| `npm run gas:pull`                                          | Pull remote Apps Script files via `clasp pull`                                 |
| `npm run gas:open`                                          | Open the linked Apps Script project in your browser (`clasp open-script`)      |
| `npm run gas:deploy`                                        | Build, push, and create a deployment via `clasp create-deployment`             |
| `npm run skills:sync:matt`                                  | Sync Matt Pocock Core skills (12 skills) into `.agents/skills/`                |
| `npm run skills:sync:ui`                                    | Sync UI/UX Pro Max skill into `.agents/skills/`                                |
| `npm run skills:sync`                                       | Run both `skills:sync:matt` and `skills:sync:ui`                               |

## Security & Gitignore Guardrails

The following sensitive or local-only paths are ignored in `.gitignore` and must never be committed:

- `.env*` (except `.env.example`)
- `.clasp.json` and `.clasprc.json` (only `backend/.clasp.json.example` is tracked)
- `.scratch/` (local specs and tickets)
- `node_modules/`, `dist/`, `build/`
