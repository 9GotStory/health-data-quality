# Coding Standards

> Covers architecture, runtime invariants, and judgement calls across Frontend and GAS Backend.
> Formatting, import ordering, and basic syntax/type checks are enforced by Prettier, ESLint, and `tsc` — do not duplicate them in reviews.

## 1. Monorepo & API Boundaries (Hard Violations)

- **[ARCH-1] Strict Workspace Separation:** `frontend/` must never import GAS globals or `backend/` runtime code; `backend/` must never depend on DOM, browser APIs, or React modules.
- **[ARCH-2] Single Frontend API Client:** React components must not call `fetch` directly against GAS Web App URLs. Route all requests through `frontend/src/api/gasClient.ts`, which encapsulates endpoint URLs, payload serialization, and error normalization.
- **[ARCH-3] Decoupled GAS Domain Logic:** Separate pure transformation and validation logic (`backend/src/`) from `SpreadsheetApp`, `LockService`, and `PropertiesService` calls in `backend/Code.gs` so core backend rules remain unit-testable offline in Vitest.
- **[ARCH-4] No Speculative Abstraction:** Do not introduce generic wrappers, factories, or shared monorepo packages until at least two distinct use cases require them.

## 2. Frontend: React, TypeScript, TanStack Query & Tailwind (Conventions)

- **[FE-1] No `useEffect` + `fetch`:** Never fetch or mutate server data inside `useEffect`. Route all server state through TanStack Query (`useQuery`, `useMutation`) hooks wrapping `gasClient`.
- **[FE-2] GAS-Friendly QueryClient Defaults:** Keep `refetchOnWindowFocus: false`, `staleTime: 5 * 60 * 1000`, and `retry: 1` to respect GAS execution quotas and cold-start latency.
- **[FE-3] Validate at the API Boundary:** Treat raw JSON returned by GAS as `unknown` and validate/parse the `{ ok: true, data }` / `{ ok: false, error }` envelope before entering UI state. Do not use blind type assertions (`as SomeType`) on unvalidated network responses.
- **[FE-4] Derive State Instead of Syncing:** Compute derived values during render rather than storing duplicate state synchronized via `useEffect`.
- **[FE-5] Explicit Async States & Routing:** Every GAS-backed view must handle loading, empty, and error states explicitly. When a spec requires multiple pages/routes, install and use `react-router` instead of ad-hoc state switching.

## 3. Backend: Google Apps Script & Sheets (Hard Violations)

- **[GAS-1] Batch Sheet I/O Only:** Never call `getValue()`, `setValue()`, or `appendRow()` inside a loop. Always read/write ranges in bulk with `getValues()` and `setValues()`.
- **[GAS-2] Preserve String Columns Before Writing:** Always call `.setNumberFormat("@")` on target string ranges **before** calling `.setValues()` for columns that may contain leading zeros, IDs, or phone numbers, preventing Google Sheets from silently coercing values to numbers/dates.
- **[GAS-3] Lock Concurrent Writes:** Wrap state-mutating Sheet writes (create/update/delete) in `LockService.getScriptLock()` with a bounded `waitLock()` timeout and release in a `finally` block.
- **[GAS-4] Centralized Column Schema:** Resolve columns via header mapping or a single schema definition rather than scattering hardcoded numeric column indices across handlers.
- **[GAS-5] Explicit Response Envelope:** Every `doGet` / `doPost` path must return a consistent JSON shape (`{ ok: true, data }` or `{ ok: false, error }`) via `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JSON)`.

## 4. Security & Data Integrity (Hard Violations)

- **[SEC-1] Validate Backend Inputs:** Validate required fields, types, and allowed actions in `doGet`/`doPost` before touching any Sheet range.
- **[SEC-2] No Hardcoded Secrets or Sheet IDs:** Read Spreadsheet IDs and tokens from `PropertiesService.getScriptProperties()` in GAS and `import.meta.env.VITE_GAS_API_URL` in Vite.
- **[SEC-3] Guard Against Formula Injection:** Sanitize user-supplied strings starting with `=`, `+`, `-`, or `@` (e.g., prefixing `'` or rejecting per spec) before writing them into Google Sheets cells.

## 5. Testing & Seams (Conventions)

- **[TEST-1] Test Behavior at Seams:** Write Vitest tests against public component behavior, API client contracts, and pure GAS transform functions. Do not assert on Tailwind utility class names or internal hook implementation details.
- **[TEST-2] Isolated & Deterministic:** Mock network boundaries (`fetch`) in frontend tests and pass fake clocks/IDs where needed; tests must never hit a live GAS deployment or real Google Sheet.

## 6. Deliberate Exceptions (Do Not Flag)

- **[EXC-1] GAS CORS `text/plain` POST Requests:** Sending JSON payloads from `frontend/` to GAS with `Content-Type: text/plain;charset=utf-8` (to bypass CORS preflight limitations in GAS Web Apps) is intentional. Do not flag this as an incorrect `Content-Type` header.
- **[EXC-2] GAS Global Entrypoints:** Top-level `doGet`, `doPost`, and global GAS service references inside `backend/` entrypoints are required platform idioms.
- **[EXC-3] Intentional Type Duplication:** Duplicating small API DTO types between `frontend/` and `backend/` is acceptable when avoiding a shared build pipeline keeps GAS deployment simple.
