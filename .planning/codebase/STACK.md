# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- **TypeScript 5.7** — SDK implementation under `sdk/src/` (`sdk/tsconfig.json` targets **ES2022**, **NodeNext** modules, `strict: true`).
- **JavaScript (Node.js)** — Published installer and runtime wiring: `bin/install.js`, `get-shit-done/bin/*.cjs` and `get-shit-done/bin/lib/*.cjs`, hook scripts under `hooks/`, and root test runner `scripts/run-tests.cjs`.

**Secondary:**
- **Shell (bash)** — Optional community hooks copied by `scripts/build-hooks.js` (e.g. `hooks/gsd-session-state.sh`, `hooks/gsd-validate-commit.sh`, `hooks/gsd-phase-boundary.sh`).

## Runtime

**Environment:**
- **Node.js** — Root package `package.json` declares `"engines": { "node": ">=22.0.0" }`. The SDK package `sdk/package.json` declares `"node": ">=20"` for `@gsd-build/sdk` consumers; CI exercises Node **22** and **24** (`.github/workflows/test.yml`).

**Package Manager:**
- **npm** — `package-lock.json` at repo root (lockfileVersion 3). SDK is a separate package under `sdk/` with its own `package.json` (published as `@gsd-build/sdk`).

## Frameworks

**Core (SDK):**
- **`@anthropic-ai/claude-agent-sdk` ^0.2.84** — Agent orchestration via `query()`; used from `sdk/src/session-runner.ts`, `sdk/src/event-stream.ts`, and related tests.

**Event transport:**
- **`ws` ^8.20.0** — WebSocket server for optional event streaming; `sdk/src/ws-transport.ts` exports `WSTransport`, wired from `sdk/src/cli.ts` when `--ws-port` is used.

**Testing:**
- **Vitest** — Root `vitest.config.ts` defines `unit` and `integration` projects rooted at `./sdk` (`sdk/src/**/*.test.ts` vs `*.integration.test.ts`, 120s integration timeout). The SDK also ships `sdk/vitest.config.ts` for local `npm test` in `sdk/`.
- **Node.js built-in test runner** — Root `npm test` runs `node scripts/run-tests.cjs`, which executes `tests/*.test.cjs` via `node --test` (see `scripts/run-tests.cjs`).

**Build / tooling:**
- **TypeScript compiler (`tsc`)** — SDK build: `sdk/package.json` script `"build": "tsc"` output to `sdk/dist/`.
- **esbuild ^0.24.0** — Root devDependency; used by `scripts/build-hooks.js` (hook pipeline; see script header and `HOOKS_DIR`).
- **c8 ^11.0.0** — Coverage for the CJS library tests: `npm run test:coverage` in root `package.json` targets `get-shit-done/bin/lib/*.cjs` with `--lines 70` threshold.

## Key Dependencies

**Critical (SDK runtime):**
- `@anthropic-ai/claude-agent-sdk` — Plan/session execution and message streaming.
- `ws` — Local WebSocket transport for CLI/SDK event consumers.

**Development / quality:**
- `typescript`, `@types/node`, `@types/ws` — SDK typing and compilation (`sdk/package.json`).
- `vitest` — Present at root (^4.1.2) and in `sdk` (^3.1.1) for SDK tests.

**Published npm surface:**
- **`get-shit-done-cc`** (root) — Bin `get-shit-done-cc` → `bin/install.js`; `files` include `bin`, `commands`, `get-shit-done`, `agents`, `hooks`, `scripts`.
- **`@gsd-build/sdk`** (`sdk/`) — Bin `gsd-sdk` → `dist/cli.js`; ships `dist` and `prompts`.

## Configuration

**Project state (GSD):**
- Primary project configuration is **JSON** at `.planning/config.json` (and workstream-specific paths); loading and defaults are implemented in `sdk/src/config.ts` (`loadConfig`, `CONFIG_DEFAULTS`). Mirror reference: `get-shit-done/bin/lib/config.cjs` (noted in `sdk/src/config.ts` header).

**TypeScript / tests:**
- `sdk/tsconfig.json` — `include`: `src/**/*.ts`; excludes test files from build output.
- `vitest.config.ts` (repo root) — Multi-project Vitest for SDK.
- `sdk/vitest.config.ts` — SDK-local Vitest projects.

**Environment:**
- No committed `.env` is required for core operation; optional integration keys are documented under integrations (see `INTEGRATIONS.md`). Runtime toggles include variables read in query handlers (e.g. `GSD_AGENTS_DIR`, `GSD_WORKSTREAM`, `GSD_PROJECT`) — see `sdk/src/query/validate.ts`, `sdk/src/query/workspace.ts`.

**CI:**
- `.github/workflows/test.yml` — `npm ci`, then `npm run test:coverage` on Ubuntu (Node 22, 24) and macOS (Node 24).

## Platform Requirements

**Development:**
- Node.js **22+** for root package scripts and installer alignment with `engines`.
- Git — Used by workflows and tooling assumptions (e.g. branching templates in `sdk/src/config.ts`); not a Node dependency.

**Production / distribution:**
- Stateless CLI and file-based `.planning/` state — no database server shipped with the framework.
- Cross-platform targets: Windows path coverage referenced in `.github/workflows/test.yml` comments; dedicated Windows workflows may exist separately.

---

*Stack analysis: 2026-04-17*
