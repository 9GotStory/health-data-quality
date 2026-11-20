# AGENTS.md

Monorepo template: **React (Vite + TypeScript + Tailwind CSS + TanStack Query)** in `frontend/` and **Google Apps Script (GAS) Web App + Google Sheets** in `backend/`.

## Read on Demand

- **Before writing or reviewing code:** read `CODING_STANDARDS.md` (rule IDs `ARCH-*`, `FE-*`, `GAS-*`, `SEC-*`, `TEST-*`, `EXC-*`).
- **Before `/grill-with-docs` or `/to-spec`:** read `GLOSSARY.md` for domain terms and Sheet-to-entity mappings.
- **Before changing architecture or API contracts:** check `docs/adr/` (use `docs/adr/0000-template.md` for new ADRs).
- **Before designing or building UI pages:** read `design-system/MASTER.md` and relevant files in `design-system/pages/` (generated via `/ui-ux-pro-max`).
- **Local specs and tickets:** store working specs/tickets in `.scratch/` (gitignored).

## Verification Commands

Run from the repository root before finishing any change:

- `npm run check` — runs `typecheck`, `lint`, `format:check`, and `test` across all workspaces.
- `npm run typecheck` — TypeScript check for `frontend` and `backend`.
- `npm run lint` — ESLint across `frontend` and `backend`.
- `npm run format:check` — Prettier check across the repo.
- `npm run test` — Vitest offline unit tests for `frontend` and `backend`.
- `npm run build` — production Vite build for `frontend`.

## Routing Rule

- `react-router` is **not** pre-installed. Keep single-page apps simple; when a spec requires multiple pages/routes, install and use `react-router` as the standard router.

## Hard Guardrails

1. **No `useEffect` + `fetch`:** all frontend server data must go through the single GAS API client and TanStack Query hooks.
2. **Validate at boundaries:** parse external JSON as `unknown` before narrowing (`frontend` and `backend`).
3. **Batch Sheets I/O only:** never call `getValue`, `setValue`, or `appendRow` inside loops.
4. **Preserve leading zeros/codes:** always call `.setNumberFormat("@")` before `.setValues()` on string/code columns.
5. **Lock every write:** wrap Sheet writes in `LockService.getScriptLock()` and release in `finally`.
6. **No hardcoded secrets or IDs:** read Spreadsheet IDs from Script Properties (`PropertiesService`) and API URLs from `VITE_GAS_API_URL`.
7. **Sanitize Sheet inputs:** neutralize formula injection (`=`, `+`, `-`, `@`) before writing user strings to Sheets.
