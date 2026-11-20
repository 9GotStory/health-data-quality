# Coding Standards

All code and reviews in this repository must adhere to these rules. Deliberate exceptions (`EXC-*`) are explicitly marked so reviewers and automated checks do not flag them.

---

## Architecture (`ARCH-*`)

- **ARCH-01 — Workspace Separation:** Keep browser UI, hooks, and styling in `frontend/`; keep Google Apps Script entrypoints (`Code.gs`) and pure Sheet/domain logic in `backend/`.
- **ARCH-02 — Single GAS API Client:** All HTTP calls from `frontend/` to the GAS Web App must pass through `frontend/src/api/gasClient.ts` (never scatter `fetch()` calls across components or hooks).
- **ARCH-03 — Multi-Page Routing:** `react-router` is not installed by default. When a specification requires multiple pages or URL routes, install and use `react-router` rather than ad-hoc state switching.

---

## Frontend (`FE-*`)

- **FE-01 — No `useEffect` + `fetch`:** Never fetch or mutate server data inside `useEffect`. Use TanStack Query (`useQuery`, `useMutation`) hooks wrapping `gasClient`.
- **FE-02 — GAS-Friendly QueryClient Defaults:** Keep `refetchOnWindowFocus: false`, `staleTime: 5 * 60 * 1000`, and `retry: 1` to respect GAS execution quotas and cold-start latency.
- **FE-03 — Boundary Validation:** Parse JSON responses as `unknown` and validate the `{ ok: true, data }` / `{ ok: false, error }` envelope before returning typed data.
- **FE-04 — Complete UI States:** Every data-driven view must explicitly handle **loading**, **empty**, and **error** states.

---

## Google Apps Script & Sheets (`GAS-*`)

- **GAS-01 — Batch Operations Only (Hard Violation):** Never call `getValue()`, `setValue()`, or `appendRow()` inside a loop. Always read/write ranges in batches via `getValues()` / `setValues()`.
- **GAS-02 — Text Format Before Writing Codes:** Before calling `.setValues()` on any column storing string identifiers or values with leading zeros (e.g., phone numbers, postal codes, item codes), call `.setNumberFormat("@")` on that target range first.
- **GAS-03 — Script Lock on Writes:** Every write operation (`doPost` or mutating action) must acquire `LockService.getScriptLock()` (`waitLock(...)`) and release it in a `try { ... } finally { lock.releaseLock(); }` block.
- **GAS-04 — Header/Schema Mapping:** Map Sheet columns from a central header/schema definition rather than scattering magic column indices (`row[0]`, `row[3]`) across handlers.
- **GAS-05 — Standard JSON Envelope:** All GAS responses must return a JSON envelope: `{ ok: true, data: ... }` on success or `{ ok: false, error: { code, message } }` on failure.

---

## Security (`SEC-*`)

- **SEC-01 — Input Validation:** Validate all query parameters and JSON payloads in `doGet` / `doPost` before touching Sheets.
- **SEC-02 — No Hardcoded Secrets or IDs:** Never commit Spreadsheet IDs, API keys, or deployment URLs. Use `PropertiesService.getScriptProperties()` in GAS and `VITE_GAS_API_URL` in `frontend/.env`.
- **SEC-03 — Formula Injection Prevention:** Sanitize user-supplied strings starting with `=`, `+`, `-`, or `@` (e.g., prefixing `'`) before writing to Google Sheets.

---

## Testing (`TEST-*`)

- **TEST-01 — Pure Logic Separation:** Extract business logic, validation, header mapping, and sanitization out of `Code.gs` into pure TypeScript modules (`backend/src/`) so they run offline in Vitest without GAS globals.
- **TEST-02 — Frontend Verification:** Cover API client envelope validation, error paths, and key UI states with Vitest.

---

## Deliberate Exceptions (`EXC-*` — Do Not Flag)

- **EXC-01 — `text/plain;charset=utf-8` POSTs:** The frontend intentionally sends `POST` requests to GAS with `Content-Type: text/plain;charset=utf-8` (JSON-serialized body) to avoid CORS preflight (`OPTIONS`) failures, which GAS Web Apps do not support.
- **EXC-02 — GAS Global Entrypoints:** Top-level `doGet(e)` and `doPost(e)` functions in `Code.gs` are required by the Apps Script runtime and are exempt from unused-export or module-import rules.
- **EXC-03 — Small DTO Duplication:** Lightweight request/response DTO types may be duplicated between `frontend/` and `backend/` rather than introducing a complex shared build step for `clasp`.
