# Project Agent Guide

## Overview

- **Architecture:** Monorepo with a **React (Vite) + TypeScript + Tailwind CSS + TanStack Query** frontend consuming a **Google Apps Script (GAS) Web App API** backed by Google Sheets.
- **Key Directories:**
  - `frontend/` — React + Vite + TypeScript + Tailwind CSS + TanStack Query application
  - `backend/` — GAS Web App entrypoint (`Code.gs`) and pure TypeScript modules tested offline in Vitest
  - `.scratch/` — Local workspace for specs and tickets (`/to-spec`, `/to-tickets`, gitignored)

## Verification Commands

Run these exact commands from the repository root (do not guess scripts):

- **Full check:** `npm run check` (runs `typecheck`, `lint`, `format:check`, and `test`)
- **Test (single):** `npm --workspace=frontend run test -- path/to/file.test.ts` (or `--workspace=backend`)
- **Test (full):** `npm run test`
- **Typecheck:** `npm run typecheck`
- **Lint & Format:** `npm run lint && npm run format:check`
- **Production Build:** `npm run build`

## Source of Truth (Read on Demand)

Do NOT read all docs upfront. Load only when relevant to the current task:

- `CODING_STANDARDS.md` — Read before writing code, refactoring, or running `/code-review`.
- `GLOSSARY.md` — Read before `/grill-with-docs`, domain modeling, or writing specs to keep Sheet/UI terminology aligned.
- `docs/adr/` — Check Architecture Decision Records (`0000-template.md`) before changing API contracts, Sheet schemas, or structural patterns.
- `design-system/` — Read `design-system/MASTER.md` and relevant `design-system/pages/` files (generated via `/ui-ux-pro-max`) before designing or building UI pages.
- `.scratch/` — Check active specs and tickets before starting `/implement`.
- **Context7 MCP:** Use Context7 (`resolve-library-id` -> `query-docs`) to fetch up-to-date docs for libraries/frameworks (React, TanStack Query, React Router, Tailwind CSS, Vite, Vitest) instead of guessing APIs.

## Workflow & Routing Conventions

- Follow the active skill loop: `/grill-with-docs` -> `/to-spec` -> `/to-tickets` -> `/implement` -> `/code-review`.
- Keep `/implement` strictly scoped to the approved spec/ticket; do not expand scope or rename Sheet columns without approval.
- Commit changes (or create a WIP commit) before running `/code-review`, as it inspects `git diff`.
- **Routing:** `react-router` is not pre-installed. Keep single-page apps simple; when a spec requires multiple pages/routes, install and use `react-router`.

## Hard Guardrails

- Never read, print, or commit `.env*`, `.clasp.json`, Spreadsheet IDs, or API secrets.
- Never run destructive Sheet operations or deploy directly to production GAS without explicit user confirmation.
- Do not manually edit generated or dependency directories (`node_modules/`, `dist/`, `build/`).
- No `useEffect` + `fetch` in `frontend/` — use `gasClient` + TanStack Query hooks only.
- Batch Sheets I/O only, call `.setNumberFormat("@")` before `.setValues()` on string/code columns, wrap writes in `LockService.getScriptLock()` (`finally` release), and sanitize formula injection (`=`, `+`, `-`, `@`).
