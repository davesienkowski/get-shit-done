# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**

- TypeScript sources use kebab-case: `phase-runner.ts`, `gsd-tools.ts`, `plan-parser.ts`, `normalize-query-command.ts`.
- Test files mirror the module name with suffixes: `phase-runner.test.ts` (unit), `golden.integration.test.ts` (integration).
- Legacy CommonJS in the installer and tools uses `.cjs` (for example `get-shit-done/bin/lib/core.cjs`, `tests/*.test.cjs`).

**Functions:**

- Use camelCase for functions and methods: `loadConfig()`, `executePlan()`, `createRegistry()`, `resolveGsdToolsPath()`.
- Factory helpers use descriptive verbs: `makePhaseOp()`, `makePlanResult()` (see `sdk/src/phase-runner.test.ts` for test factories).

**Variables:**

- camelCase for locals and parameters: `tmpDir`, `projectDir`, `gsdToolsPath`.
- Prefix unused parameters with a single underscore when required by signatures: `_encoding` (project convention in `CLAUDE.md`).

**Types:**

- PascalCase for classes, interfaces, enums, and type aliases: `GSDConfig`, `PhaseRunnerDeps`, `ParsedPlan`, `LogEntry`, `ErrorClassification`.
- Enum members use PascalCase: `ErrorClassification.Validation` in `sdk/src/errors.ts`.
- Suffix conventions: `Options` for input objects (`GSDLoggerOptions`, `SessionOptions`), `Result` for outputs (`PlanResult`, `PhaseRunnerResult`), `Config` for configuration (`GSDConfig`), `Deps` for dependency injection (`PhaseRunnerDeps`), `Info` for data bundles (`PhaseOpInfo`, `InitNewProjectInfo`).

**Constants:**

- UPPER_SNAKE_CASE for module-level constants: `DEFAULT_TIMEOUT_MS`, `LOG_LEVEL_PRIORITY`, `BUNDLED_GSD_TOOLS_PATH` in `sdk/src/gsd-tools.ts` and `sdk/src/logger.ts`.

## Code Style

**Formatting:**

- No committed Prettier or ESLint config was found at the repository root; style follows TypeScript defaults and team IDE settings.
- Indentation is 2 spaces (consistent across `sdk/src`).

**TypeScript:**

- `sdk/tsconfig.json` enables `strict: true`, `module` / `moduleResolution`: `NodeNext`, target `ES2022`.
- Test and integration files are excluded from the `tsc` emit via `exclude` in `sdk/tsconfig.json` so they are type-checked only when pulled into Vitest’s compilation path.

## Import Organization

**Order:**

1. Node built-ins with `node:` prefix where used: `import { readFile } from 'node:fs/promises'`.
2. Blank line.
3. Type-only imports from local modules: `import type { GSDOptions, PlanResult } from './types.js'`.
4. Value imports from local modules: `import { GSDEventType } from './types.js'`.

**ESM and paths:**

- SDK sources are ESM (`sdk/package.json` has `"type": "module"`).
- Relative imports use explicit `.js` extensions (TypeScript emits `.js` for NodeNext): `'./logger.js'`, `'./gsd-tools.js'`.
- No path aliases (`@/`); imports stay relative to the file.

## Error Handling

**Domain errors:**

- `GSDError` in `sdk/src/errors.ts` extends `Error`, sets `readonly name = 'GSDError'`, and carries `ErrorClassification` for CLI exit code mapping via `exitCodeFor()`.
- `GSDToolsError` in `sdk/src/gsd-tools.ts` extends `Error`, sets `name` to `GSDToolsError`, and attaches `command`, `args`, `exitCode`, `stderr` for subprocess failures.
- `PhaseRunnerError` and similar extend the same pattern (see `sdk/src/phase-runner.ts`).

**Patterns:**

- Prefer throwing typed errors with context rather than string-only `Error` for public SDK surfaces.
- For async boundaries, tests use `expect(...).rejects.toThrow(GSDToolsError)` or try/catch with `instanceof` checks (see `sdk/src/gsd-tools.test.ts`).
- Unknown caught values: check `err instanceof Error` before reading `.message` (project error-handling convention).

## Logging

**Framework:** `GSDLogger` in `sdk/src/logger.ts`.

**Patterns:**

- Levels: `debug`, `info`, `warn`, `error`; minimum level filtered via `LOG_LEVEL_PRIORITY`.
- Default output is `process.stderr` (configurable `Writable`).
- Entries are structured objects (`LogEntry`) suitable for JSON logging; optional context: `phase`, `plan`, `sessionId`.

## Comments

**Module headers:**

- Files start with a `/** ... */` block describing purpose and sometimes `@example` for public API (`sdk/src/index.ts`, `sdk/src/errors.ts`).

**Section separators:**

- Use `// ─── Section Name ─────────────────...` style between logical regions (`sdk/src/index.ts`, `sdk/src/gsd-tools.ts`, `sdk/src/query/helpers.test.ts`).

**When to comment:**

- Explain non-obvious behavior, invariants, or regression context (bug IDs appear in `tests/core.test.cjs` and similar).

**JSDoc/TSDoc:**

- Public classes and functions use `@param`, `@returns`, and `@example` where the API is exported for consumers (`sdk/src/errors.ts`, `sdk/src/index.ts`).

## Function Design

**Size:**

- Most functions are focused; large orchestrators (for example `PhaseRunner`) split work with private helpers and clear step comments.

**Parameters:**

- Prefer options objects for constructors and complex calls (`GSDOptions`, `GSDLoggerOptions`, `PhaseRunnerDeps`).

**Return values:**

- Structured results use explicit types (`PlanResult` with `success`, cost, usage, optional `error`).
- CLI-oriented code maps `GSDError` classification to exit codes via `exitCodeFor()`.

## Module Design

**Exports:**

- Named exports are standard; the package entry `sdk/src/index.ts` re-exports the public surface.
- Use `export type { ... }` for type-only re-exports where tree-shaking matters.

**Barrel files:**

- Query subsystem aggregates handlers through `sdk/src/query/index.ts` (`createRegistry()`); prefer adding handlers there following existing patterns.

**Default exports:**

- Avoided for library code; CLI may use shebang files (`sdk/src/cli.ts`).

---

*Convention analysis: 2026-04-17*
