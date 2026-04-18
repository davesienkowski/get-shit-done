# SDK Coding Conventions

**Analysis Date:** 2026-04-07
**Scope:** `sdk/src/` — the `@gsd-build/sdk` package

---

## TypeScript Configuration

**Compiler settings** (`sdk/tsconfig.json`):
- `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`
- `strict: true` — strict null checks, no implicit any
- `isolatedModules: true` — each file must be independently compilable
- `declaration: true`, `declarationMap: true`, `sourceMap: true`
- Test files (`*.test.ts`, `*.integration.test.ts`) are excluded from the compiler via `tsconfig.json`; Vitest handles them separately

**TypeScript patterns used:**
- Discriminated unions for all event types — `GSDEvent` in `sdk/src/types.ts` is a union of 25+ specific event interfaces, each with a literal `type` field
- Index signatures for extensibility: `[key: string]: unknown` on `PlanFrontmatter`, `GSDConfig`, `InitNewProjectInfo` to allow forward-compatible evolution
- Type guards as inline predicates: `(b): b is { type: 'text'; text: string } => b.type === 'text'` in `sdk/src/event-stream.ts`
- `satisfies` operator not used — type assertions (`as TypeName`) are used when narrowing SDK message types after switch case matching
- `const` enums avoided — regular `enum` used for `PhaseType`, `GSDEventType`, `PhaseStepType` so values are accessible at runtime
- `structuredClone` used to prevent mutation of `CONFIG_DEFAULTS` in `sdk/src/config.ts`
- `Partial<T>` used in deep-merge patterns: `...(parsed.git as Partial<GitConfig> ?? {})`
- Explicit `Promise<void>` return types on all async functions that return nothing

---

## Naming Patterns

**Files:** kebab-case throughout
- `phase-runner.ts`, `gsd-tools.ts`, `plan-parser.ts`, `context-engine.ts`
- Test files mirror source: `phase-runner.test.ts`, `phase-runner.integration.test.ts`

**Functions:** camelCase
- `loadConfig()`, `parsePlanFile()`, `buildExecutorPrompt()`, `resolveGsdToolsPath()`
- Factory helpers: `makePhaseOp()`, `makeConfig()`, `makeDeps()`, `makePlanResult()` (in test files)
- Stream helpers: `processQueryStream()`, `mapSDKMessage()`, `mapAndEmit()`
- Boolean-returning predicates: `isResultMessage()`, `isSuccessResult()`, `isErrorResult()`

**Variables/Parameters:** camelCase
- `tmpDir`, `phaseOp`, `sessionOpts`, `currentPhases`, `queryStream`
- Unused parameters prefixed with `_`: `_encoding`, `_write` (in `BufferStream` test helper)

**Constants:** UPPER_SNAKE_CASE
- `DEFAULT_TIMEOUT_MS`, `BLOCKED_PATTERNS`, `LOG_LEVEL_PRIORITY`, `DEFAULT_ALLOWED_TOOLS`
- `BUNDLED_GSD_TOOLS_PATH`, `GSD_TEMPLATES_DIR`, `RESEARCH_STEP_MAP`

**Types and Interfaces:** PascalCase
- Interfaces: `GSDOptions`, `PhaseRunnerDeps`, `ParsedPlan`, `SessionOptions`
- Suffix conventions:
  - `Options` — config/input objects: `SessionOptions`, `GSDOptions`, `PhaseRunnerOptions`, `MilestoneRunnerOptions`
  - `Config` — configuration structures: `GSDConfig`, `GitConfig`, `WorkflowConfig`, `InitConfig`
  - `Result` — output/return types: `PlanResult`, `PhaseRunnerResult`, `MilestoneRunnerResult`, `InitResult`, `PhaseStepResult`
  - `Deps` — dependency injection bags: `PhaseRunnerDeps`, `InitRunnerDeps`
  - `Info` — data-holding structs from gsd-tools: `PhaseOpInfo`, `InitNewProjectInfo`, `PlanInfo`
  - `Callbacks` — callback maps: `HumanGateCallbacks`
  - `Event` — typed events: `GSDPhaseStartEvent`, `GSDSessionCompleteEvent`

**Enums:** PascalCase names, PascalCase members
- `PhaseType.Discuss`, `GSDEventType.SessionInit`, `PhaseStepType.PlanCheck`

---

## Code Style

**Indentation:** 2 spaces (no tabs)

**No formatter config** — no `.prettierrc` or `biome.json` in `sdk/`; style is consistent with manual convention following modern TypeScript idioms.

**No ESLint config** — no `.eslintrc` in `sdk/`; TypeScript strict mode serves as the primary linting layer.

**Line length:** ~100 chars is common; no hard limit enforced.

**Trailing commas:** Used in multi-line argument lists and object literals.

**Semicolons:** Always present.

---

## Import Organization

**Order (observed pattern):**
1. Node built-ins with explicit `node:` prefix: `import { readFile } from 'node:fs/promises'`
2. Third-party packages: `import { query } from '@anthropic-ai/claude-agent-sdk'`
3. Local relative imports: `import { parsePlan } from './plan-parser.js'`

**All relative imports use explicit `.js` extension** — required for `NodeNext` module resolution:
- `'./types.js'`, `'./logger.js'`, `'./event-stream.js'`

**Type-only imports use `import type`** for tree-shaking and to satisfy `isolatedModules`:
```typescript
import type { GSDOptions, PlanResult, SessionOptions } from './types.js';
import { GSDEventType } from './types.js';  // value import, not type-only
```

**No path aliases** — all imports are relative paths, no `@/` or `~/` aliases configured.

---

## Module Design

**Named exports only** — default export is never used in SDK source files.

**One primary class per file:**
- `GSDLogger` in `sdk/src/logger.ts`
- `GSDEventStream` in `sdk/src/event-stream.ts`
- `GSDTools` in `sdk/src/gsd-tools.ts`
- `PhaseRunner` in `sdk/src/phase-runner.ts`
- `ContextEngine` in `sdk/src/context-engine.ts`

**Helper functions colocated with primary export:**
- `resolveGsdToolsPath()` in `sdk/src/gsd-tools.ts` alongside `GSDTools`
- `resolveModel()`, `processQueryStream()`, `stepTypeToPhaseType()` in `sdk/src/session-runner.ts`

**Public API re-exported from `sdk/src/index.ts`:**
- `sdk/src/index.ts` re-exports every public symbol from all modules
- Sections marked with comments: `// S02: Event stream...`, `// S03: Phase lifecycle state machine`, `// S05: Transports`
- Type exports use `export type { TypeName }` syntax

**Centralized types in `sdk/src/types.ts`:**
- All domain types, interfaces, enums defined in `sdk/src/types.ts`
- Module-specific types defined within their own files (e.g. `GSDConfig` in `sdk/src/config.ts`, `FileSpec` in `sdk/src/context-engine.ts`)

---

## Error Handling

**Custom error classes extend `Error` with contextual properties:**

```typescript
// sdk/src/gsd-tools.ts
export class GSDToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GSDToolsError';
  }
}

// sdk/src/phase-runner.ts
export class PhaseRunnerError extends Error {
  constructor(
    message: string,
    public readonly phaseNumber: string,
    public readonly step: PhaseStepType,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PhaseRunnerError';
  }
}
```

**Error class pattern rules:**
- Always set `this.name` to the class name for reliable `instanceof` checks
- Add domain-specific properties as `public readonly` in constructor
- Include `cause?: Error` parameter when re-wrapping lower-level errors
- Message format: `Context that failed: ${err instanceof Error ? err.message : String(err)}`

**Always check `instanceof Error` before accessing `.message`:**
```typescript
err instanceof Error ? err.message : String(err)
```

**Never let transport errors propagate** — `GSDEventStream.emitEvent()` wraps each transport call in try/catch and silently swallows transport errors to prevent one bad transport from killing the stream.

**Async error handling:** Errors from async operations caught in try/catch, then rethrown as domain-specific errors. The session runner catches streaming errors and converts them to a `PlanResult` with `success: false` — no exceptions bubble out of `runPlanSession()`.

**`success: boolean` on result objects** — session/phase/milestone runners signal failure via `result.success = false` rather than throwing, making them safe to chain without try/catch.

---

## Logging

**Class:** `GSDLogger` in `sdk/src/logger.ts`

**Initialization:**
```typescript
const logger = new GSDLogger({ output: process.stderr, level: 'info' });
// or with context:
const logger = new GSDLogger({ output, level: 'debug', phase: PhaseType.Execute, plan: 'plan-01' });
```

**Four log levels:** `debug`, `info`, `warn`, `error` — filtered by `LOG_LEVEL_PRIORITY` record.

**All log entries are newline-delimited JSON** written to stderr (or configured `Writable`):
```json
{"timestamp":"2026-04-07T10:00:00.000Z","level":"info","phase":"execute","plan":"01-auth-01","sessionId":"sess-abc","message":"Starting execute step","data":{"turns":50}}
```

**Context setters for runtime updates:** `.setPhase()`, `.setPlan()`, `.setSessionId()` — called during phase transitions to keep log context accurate.

**Logger is optional in all classes** — passed as `logger?: GSDLogger` in dependency injection interfaces. Absence of logger is silent (no fallback to `console.log`).

**Design intent:** Logger is a debugging facility only. The primary observability mechanism is the `GSDEventStream` event bus, not logs.

---

## Function Design

**Parameter objects over multiple positional arguments:**
```typescript
// Always:
new GSDLogger(options: GSDLoggerOptions)
new PhaseRunner(deps: PhaseRunnerDeps)

// Not:
new GSDLogger(level, output, phase, plan, sessionId)
```

**Dependency injection for testability** — classes receive their collaborators via a `Deps` interface rather than constructing them internally:
```typescript
export interface PhaseRunnerDeps {
  projectDir: string;
  tools: GSDTools;
  promptFactory: PromptFactory;
  contextEngine: ContextEngine;
  eventStream: GSDEventStream;
  config: GSDConfig;
  logger?: GSDLogger;
}
```

**Destructuring in parameters:**
```typescript
constructor({ projectDir, tools, ...deps }: PhaseRunnerDeps)
```

**Return structured objects with explicit types:**
```typescript
async function loadConfig(projectDir: string): Promise<GSDConfig>
async function runPlanSession(...): Promise<PlanResult>
async run(phaseNumber: string, options?: PhaseRunnerOptions): Promise<PhaseRunnerResult>
```

**Long orchestrators use comment separators:**
```typescript
// ── Step 1: Discuss ──
// ── Step 2: Research ──
// ── Init: query phase state ──
```

**Optional parameters use `?` in interface**, not function overloads.

---

## Comments

**Module-level `/** ... */` block at top of every file** describing purpose and export pattern. Example from `sdk/src/gsd-tools.ts`:
```typescript
/**
 * GSD Tools Bridge — shells out to `gsd-tools.cjs` for state management.
 *
 * All `.planning/` state operations go through gsd-tools.cjs rather than
 * reimplementing 12K+ lines of logic.
 */
```

**Section separators** using `// ─── Section Name ───...` pattern (unicode em-dash + trailing dashes to column ~80):
```typescript
// ─── Error type ──────────────────────────────────────────────────────────────
// ─── GSDTools class ──────────────────────────────────────────────────────────
// ─── Typed convenience methods ─────────────────────────────────────────────
```

**Inline comments** for non-obvious logic:
```typescript
// Safety net: kill if child doesn't respond to timeout signal
// Silently ignore transport errors
// Not found at this path, try next
```

**Public API with `@example` blocks** in `sdk/src/index.ts` at class level.

**JSDoc on exported functions** with `@param name - Description` and `@returns Description` format.

---

## Special Patterns

**`@file:` prefix for large gsd-tools outputs** — `GSDTools.parseOutput()` checks if stdout starts with `@file:` and reads the referenced file path instead. Used to handle outputs exceeding pipe buffer limits.

**Guard clauses over nested if-else** — validation failures are handled early and throw before business logic runs.

**Temporal coupling avoidance** — `structuredClone(CONFIG_DEFAULTS)` is called on every `loadConfig()` call to prevent tests from polluting defaults.

---

*Convention analysis: 2026-04-07*
