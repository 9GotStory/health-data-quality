# react-gas-starter-template

Monorepo starter template for building full-stack web apps with **React (Vite + TypeScript + Tailwind CSS + TanStack Query)** in `frontend/` and **Google Apps Script (GAS) Web App + Google Sheets** in `backend/`.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query v5, ESLint, Prettier, Vitest
- **Backend:** Google Apps Script (`Code.gs`), Google Sheets, pure TypeScript logic tested offline via Vitest
- **AI / Agent Workflow:** `AGENTS.md` (with `CLAUDE.md` symlink), `CODING_STANDARDS.md`, `GLOSSARY.md`, `docs/adr/`, and `.agents/skills/` (Matt Pocock Core + UI/UX Pro Max)

## Repository Structure

```text
.
├── AGENTS.md                 # Entrypoint & conditional pointers for AI agents
├── CLAUDE.md -> AGENTS.md    # Symlink for Claude Code compatibility
├── CODING_STANDARDS.md       # Architecture, security, GAS, and test rules
├── GLOSSARY.md               # Domain terms and Sheet-to-entity mappings
├── docs/adr/                 # Architecture Decision Records (0000-template.md)
├── frontend/                 # React + Vite + Tailwind + TanStack Query app
│   ├── .env.example          # VITE_GAS_API_URL
│   └── src/
│       ├── api/gasClient.ts  # Single GAS API client + boundary validation
│       ├── hooks/useItems.ts # Sample TanStack Query hooks
│       └── lib/queryClient.ts
└── backend/                  # Google Apps Script API + offline-tested logic
    ├── .clasp.json.example
    ├── Code.gs               # doGet / doPost, LockService, batch Sheets I/O
    └── src/sheetsLogic.ts    # Pure logic & Vitest unit tests
```

## Quick Start

1. **Create a repo from this template** on GitHub (`Use this template` → `Create a new repository`) and clone it.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Frontend:**
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   Set `VITE_GAS_API_URL` to your deployed Google Apps Script Web App `/exec` URL.
4. **Configure Backend (GAS + Sheets):**
   ```bash
   cp backend/.clasp.json.example backend/.clasp.json
   ```
   - Set `scriptId` in `backend/.clasp.json` (or paste `backend/Code.gs` into your Apps Script project).
   - In Apps Script **Project Settings → Script Properties**, add `SPREADSHEET_ID` (or bind the script directly to a Google Sheet).
   - Deploy as a **Web App** (Execute as: _Me_, Who has access: _Anyone_).
5. **Run locally & verify:**
   ```bash
   npm run dev
   npm run check
   ```

## Scripts

| Command                | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Start Vite dev server for `frontend/`                                 |
| `npm run build`        | Typecheck and build `frontend/` for production                        |
| `npm run check`        | Run `typecheck`, `lint`, `format:check`, and `test` across workspaces |
| `npm run typecheck`    | Run TypeScript typechecking for `frontend` and `backend`              |
| `npm run lint`         | Run ESLint across `frontend` and `backend`                            |
| `npm run format:check` | Check formatting with Prettier                                        |
| `npm run test`         | Run offline Vitest unit tests for `frontend` and `backend`            |
| `npm run skills:sync`  | Sync Matt Pocock Core skills and UI/UX Pro Max into `.agents/skills/` |
