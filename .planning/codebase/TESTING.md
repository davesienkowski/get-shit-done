# Testing Patterns

**Analysis Date:** 2026-04-17

## Test Framework

**Runner (SDK / TypeScript):**

- Vitest — root config: `vitest.config.ts` (projects `unit` and `integration`, `integration` uses `testTimeout: 120_000`).
- SDK-local duplicate: `sdk/vitest.config.ts` defines the same project split for runs whose cwd is `sdk/`.

**Assertion library:**

- Vitest built-ins: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` from `vitest`.

**Runner (legacy CJS / gsd-tools):**

- Node.js built-in test runner: `node --test` via `scripts/run-tests.cjs`, which discovers `tests/*.test.cjs` and runs them with configurable concurrency (`TEST_CONCURRENCY` env, default `--test-concurrency=4`).

**Run commands:**

```bash
npm test
```

Runs `node scripts/run-tests.cjs` from repo root (all `tests/*.test.cjs`).

```bash
cd sdk && npm test
```

Runs `vitest run` for the SDK (uses `sdk/package.json` scripts).

```bash
cd sdk && npm run test:unit
```

`vitest run --project unit` — only `sdk/src/**/*.test.ts` excluding `*.integration.test.ts`.

```bash
cd sdk && npm run test:integration
```

`vitest run --project integration` — only `sdk/src/**/*.integration.test.ts`, 120s timeout per test.

**Coverage (CJS tooling):**

```bash
npm run test:coverage
```

Uses `c8` with `--lines 70`, `--include 'get-shit-done/bin/lib/*.cjs'`, `--exclude 'tests/**'`, `--all`, delegating to `scripts/run-tests.cjs` so `NODE_V8_COVERAGE` propagates.

## Test File Organization

**Location:**

- **SDK unit tests:** Co-located under `sdk/src/` as `*.test.ts` (example: `sdk/src/gsd-tools.test.ts`, `sdk/src/query/helpers.test.ts`).
- **SDK integration tests:** Same tree with `*.integration.test.ts` (example: `sdk/src/golden/golden.integration.test.ts`).
- **Package / installer tests:** `tests/*.test.cjs` at repository root.

**Naming:**

- Unit: `<module>.test.ts`
- Integration: `<feature>.integration.test.ts` or nested under `sdk/src/golden/`

**Structure:**

- Vitest: top-level `describe` per module or feature, nested `describe` for methods or command groups, `it` for single behaviors.
- Node test: `describe` / `test` from `node:test`, `assert` from `node:assert/strict` (see `tests/core.test.cjs`).

## Test Structure

**Suite organization:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GSDTools', () => {
  beforeEach(async () => { /* temp dirs */ });
  afterEach(async () => { /* cleanup */ });

  describe('exec()', () => {
    it('parses valid JSON output', async () => {
      expect(result).toEqual({ ... });
    });
  });
});
```

**Patterns:**

- **Temp directories:** `mkdtemp` / `tmpdir()` + unique suffix, or `join(tmpdir(), \`prefix-${Date.now()}-...\`)` in `sdk/src/gsd-tools.test.ts`.
- **Fixtures:** JSON or markdown under `sdk/src/golden/fixtures/` for golden comparisons; integration tests read via `readFile` and `resolve(__dirname, ...)`.
- **Error assertions:** `await expect(promise).rejects.toThrow(GSDToolsError)` or `try/catch` with `expect(err).toBeInstanceOf(GSDToolsError)` and property checks.

## Mocking

**Framework:** Vitest `vi` API.

**Patterns:**

- **ESM module mocks** — declare `vi.mock('./session-runner.js', () => ({ ... }))` before importing the mocked module, then `import { runPhaseStepSession } from './session-runner.js'` and `const mock = vi.mocked(runPhaseStepSession)` (see `sdk/src/phase-runner.test.ts`).
- **External packages** — e.g. `vi.mock('@anthropic-ai/claude-agent-sdk', () => { ... })` in `sdk/src/session-runner.test.ts` to avoid real API calls.
- **Heavy orchestration tests** — `sdk/src/milestone-runner.test.ts` mocks multiple collaborators (`plan-parser.js`, `config.js`, `session-runner.js`, `gsd-tools.js`, etc.) to keep tests deterministic.

**What to mock:**

- Agent SDK sessions, network, and long-running `query()` flows.
- `GSDTools` construction when testing runners in isolation (`milestone-runner.test.ts`).

**What NOT to mock:**

- Pure helpers under test (`sdk/src/query/helpers.test.ts` exercises real functions).
- Golden / parity tests compare SDK registry output to `gsd-tools.cjs` or fixtures (`sdk/src/golden/golden.integration.test.ts` uses `captureGsdToolsOutput` and `createRegistry().dispatch()`).

## Fixtures and Factories

**Test data:**

- **Factories in test files:** `makePhaseOp()`, `makePlanResult()`, `makeUsage()` in `sdk/src/phase-runner.test.ts` return fully typed objects with spread overrides.
- **Scripts as subprocess fixtures:** `createScript()` writes a `.cjs` file that prints JSON or exits with a code (`sdk/src/gsd-tools.test.ts`).

**Location:**

- Golden JSON/Markdown: `sdk/src/golden/fixtures/`
- Sample sessions / profile data: `sdk/src/golden/fixtures/profile-sample-sessions/` (see `sdk/src/golden/`)

**CJS helpers:**

- `tests/helpers.cjs` exposes `runGsdTools()`, `createTempDir()`, `createTempProject()`, and env sanitization (`TEST_ENV_BASE`) for stable subprocess tests.

## Coverage

**Requirements:**

- Enforced line coverage threshold **70%** for `get-shit-done/bin/lib/*.cjs` when running `npm run test:coverage` (see root `package.json`).

**View coverage:**

```bash
npm run test:coverage
```

**Gaps:**

- SDK TypeScript coverage is not wired to the same `c8` gate in root `package.json`; SDK developers rely on Vitest runs and optional local coverage if configured separately.

## Test Types

**Unit tests:**

- Fast, isolated tests for `sdk/src` modules; default Vitest project `unit` excludes `*.integration.test.ts`.

**Integration tests:**

- Longer timeouts (120s), cross-module flows, golden parity against `gsd-tools.cjs`, filesystem and registry dispatch (`sdk/src/golden/golden.integration.test.ts`).

**E2E tests:**

- Not a separate Playwright/Cypress suite in-repo; “integration” here means SDK + real repo paths + subprocess comparison.

## Common Patterns

**Async testing:**

- `async` `it` callbacks with `await` on promises; use `expect.assertions` or explicit `expect` counts when mixing async branches.

**Error testing:**

```typescript
await expect(tools.exec('state', ['load'])).rejects.toThrow(GSDToolsError);
```

or

```typescript
try {
  await tools.exec(...);
  expect.fail('Should have thrown');
} catch (err) {
  expect(err).toBeInstanceOf(GSDToolsError);
}
```

**Node CJS tests:**

```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
```

---

*Testing analysis: 2026-04-17*
