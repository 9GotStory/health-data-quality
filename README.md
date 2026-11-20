# react-gas-starter-template

Monorepo starter template for building full-stack web apps with **React (Vite + TypeScript + Tailwind CSS + TanStack Query)** in `frontend/` and **Google Apps Script (GAS) Web App + Google Sheets** in `backend/`, equipped with an AI-ready documentation and skills workflow.

## Prerequisites

- **Node.js** (v20+ recommended) & **npm** (workspaces support)
- **Python 3** (required by the `ui-ux-pro-max` skill's `scripts/search.py`)
- Optional: [`@google/clasp`](https://github.com/google/clasp) if deploying `backend/` from the CLI

## Tech Stack

- **Frontend (`frontend/`):** React 19, Vite 7, TypeScript, Tailwind CSS v4, TanStack Query v5, ESLint, Prettier, Vitest + Testing Library (`jsdom`)
- **Backend (`backend/`):** Google Apps Script (`Code.gs`), Google Sheets, pure TypeScript domain helpers tested offline via Vitest (`node`)
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
└── backend/                         # Google Apps Script API + offline-tested logic
    ├── .clasp.json.example          # clasp config template
    ├── Code.gs                      # doGet / doPost, LockService, batch Sheets I/O
    └── src/
        ├── sheetsLogic.ts           # Pure schema mapping, validation & sanitization logic
        └── sheetsLogic.test.ts      # Offline Vitest unit tests
```

## Quick Start

1. **Create a repository from this template** on GitHub (**Use this template → Create a new repository**) and clone it.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Frontend:**
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   Set `VITE_GAS_API_URL` in `frontend/.env` to your deployed Google Apps Script Web App `/exec` URL.
4. **Configure Backend (GAS + Google Sheets):**
   ```bash
   cp backend/.clasp.json.example backend/.clasp.json
   ```
   - Set `scriptId` in `backend/.clasp.json` (or copy `backend/Code.gs` into the Apps Script editor).
   - In Apps Script **Project Settings → Script Properties**, add `SPREADSHEET_ID` (or bind the script directly to a Google Sheet).
   - Deploy as a **Web App** (Execute as: _Me_, Who has access: _Anyone_).
5. **Run locally & verify:**
   ```bash
   npm run dev
   npm run check
   ```

## Architecture & Key Design Decisions

- **Single GAS API Client & Boundary Validation:** All network calls go through `frontend/src/api/gasClient.ts`. Responses are parsed as `unknown` and validated against the `{ ok: true, data }` / `{ ok: false, error }` envelope.
- **TanStack Query (No `useEffect` + `fetch`):** Server state uses TanStack Query hooks with GAS-friendly defaults (`refetchOnWindowFocus: false`, `staleTime: 5 * 60 * 1000`, `retry: 1`) to protect Apps Script quotas and handle cold-start latency.
- **CORS-Safe GAS `POST` Requests:** Mutations send JSON payloads with `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight (`OPTIONS`) failures in GAS Web Apps (documented in `CODING_STANDARDS.md` as `EXC-1`).
- **Safe Google Sheets Writes:** `backend/Code.gs` performs batch reads/writes only, locks writes via `LockService.getScriptLock().tryLock()` with `finally` release, calls `.setNumberFormat("@")` before `.setValues()` on string/code columns to preserve leading zeros, and neutralizes formula injection (`=`, `+`, `-`, `@`).
- **Offline-Testable Backend Logic:** Pure transformation, header mapping, validation, and sanitization logic live in `backend/src/` and run in Vitest without requiring a live Google Sheet.
- **Routing Policy:** `react-router` is intentionally not pre-installed to keep single-page apps lean. When a spec requires multiple pages/routes, install and use `react-router`.

## AI / Agent Workflow

This template uses a **Read on Demand** documentation model centered on `AGENTS.md` (and `CLAUDE.md` symlink):

1. **Align domain & decisions:** Run `/grill-with-docs` to update `GLOSSARY.md` (terms & Sheet-to-entity mappings) and record major trade-offs in `docs/adr/`.
2. **Design UI (optional):** Run `/ui-ux-pro-max` to generate `design-system/MASTER.md` and `design-system/pages/` before building new pages.
3. **Spec & ticket locally:** Run `/to-spec` → `/to-tickets` (stored in `.scratch/`, which is gitignored).
4. **Implement & verify:** Run `/implement` following `CODING_STANDARDS.md`, query up-to-date library docs via **Context7 MCP** (`.mcp.json`), and pass `npm run check`.
5. **Review before merge:** Create a commit (or WIP commit) and run `/code-review` to check against both `CODING_STANDARDS.md` and the spec.

## Available Scripts

| Command                                                     | Description                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                                               | Start Vite dev server for `frontend/`                                 |
| `npm run build`                                             | Typecheck and build `frontend/` for production (`frontend/dist/`)     |
| `npm run check`                                             | Run `typecheck`, `lint`, `format:check`, and `test` across workspaces |
| `npm run typecheck`                                         | Run TypeScript typechecking for `frontend` and `backend`              |
| `npm run lint`                                              | Run ESLint across `frontend` and `backend`                            |
| `npm run format:check`                                      | Check formatting across the repo with Prettier                        |
| `npm run test`                                              | Run offline Vitest unit tests for `frontend` and `backend`            |
| `npm run test:watch`                                        | Run Vitest in watch mode across both `frontend` and `backend`         |
| `npm --workspace=frontend run test -- path/to/file.test.ts` | Run a single frontend test file (replace `frontend` with `backend`)   |
| `npm run skills:sync:matt`                                  | Sync Matt Pocock Core skills (12 skills) into `.agents/skills/`       |
| `npm run skills:sync:ui`                                    | Sync UI/UX Pro Max skill into `.agents/skills/`                       |
| `npm run skills:sync`                                       | Run both `skills:sync:matt` and `skills:sync:ui`                      |

## Security & Gitignore Guardrails

The following sensitive or local-only paths are ignored in `.gitignore` and must never be committed:

- `.env*` (except `.env.example`)
- `.clasp.json` and `.clasprc.json` (only `backend/.clasp.json.example` is tracked)
- `.scratch/` (local specs and tickets)
- `node_modules/`, `dist/`, `build/`
