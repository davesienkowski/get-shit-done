# Architecture Patterns

**Domain:** SDK-First CLI Migration (`gsd-sdk query` integration)
**Researched:** 2026-04-07

## Recommended Architecture

### High-Level View

```
Workflow Markdown (agents)
    |
    | bash: gsd-sdk query <command> [args] [--json]
    v
sdk/src/cli.ts  (process.argv dispatch)
    |
    | command routing
    v
sdk/src/query/registry.ts  (command registry)
    |
    | dispatches to
    v
sdk/src/query/<domain>.ts  (typed query modules)
    |  - state.ts, config.ts, phase.ts, roadmap.ts, etc.
    |  - each exports handler functions
    v
sdk/src/index.ts  (public library API)
    |
    | same typed functions available for programmatic use
    v
External consumers (tests, CI, other SDKs)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `cli.ts` | Parse argv, route to `run`/`auto`/`init`/`query` subcommands, manage process lifecycle (exit codes, transports) | `query/registry.ts`, `GSD` class, transports |
| `query/registry.ts` | Map command strings to handler functions, validate arguments, format output (JSON vs raw) | `query/*.ts` handlers, `cli.ts` |
| `query/<domain>.ts` | Implement typed query/mutation logic against `.planning/` state. One file per domain (state, config, phase, roadmap, etc.) | File system, `config.ts`, `types.ts` |
| `index.ts` | Re-export public API for library consumers. Expose query handlers alongside existing `GSD`, `PhaseRunner`, etc. | All SDK modules |
| `gsd-tools.ts` | Temporary bridge — shells out to `gsd-tools.cjs` for un-migrated commands | `gsd-tools.cjs` (child process) |
| `types.ts` | Central type definitions, extended with query input/output types | All modules |
| `event-stream.ts` | Emit events for state-mutating query operations | `query/<domain>.ts` for mutations |

## Architecture Decision 1: CLI Entry Point Design

### Problem

`cli.ts` currently handles `run`, `auto`, `init` commands. Adding `query` must not bloat this file into another monolith.

### Decision: Extend cli.ts with a `query` subcommand that delegates to a registry

`cli.ts` gains one new branch in its command dispatch:

```typescript
// In cli.ts main()
case 'query':
  return handleQuery(args.positionals.slice(1), args.projectDir);
```

The `handleQuery` function lives in `query/registry.ts` and owns all query routing. This keeps `cli.ts` thin (it stays a process lifecycle manager, not a command router).

### Why Not a Separate Binary

A second `gsd-query` binary would split the package surface and complicate installation. One binary (`gsd-sdk`) with subcommands (`run`, `auto`, `init`, `query`) follows standard CLI conventions (cf. `git`, `docker`).

## Architecture Decision 2: Query Module Structure

### Decision: One file per domain, flat registry, no plugin system

```
sdk/src/query/
  registry.ts      # Command→handler map, argument parsing, output formatting
  state.ts         # state load, state json, state get, state update, state patch, etc.
  config.ts        # config get, config set, config ensure-section
  phase.ts         # find-phase, phase complete, phase add, phase insert, phase remove
  roadmap.ts       # roadmap get-phase, roadmap analyze, roadmap update-plan-progress
  init-queries.ts  # init phase-op, init new-project, init execute-phase, etc.
  verify.ts        # verify-summary, verify plan-structure, verify plan-coverage, etc.
  scaffold.ts      # scaffold context, scaffold uat, scaffold verification, etc.
  frontmatter.ts   # frontmatter get/set/merge/validate
  intel.ts         # intel query, intel status, intel update, etc.
  progress.ts      # progress, stats, history-digest
  commit.ts        # commit, commit-to-subrepo, check-commit
  misc.ts          # generate-slug, current-timestamp, list-todos, verify-path-exists, resolve-model
```

### Why One File Per Domain (Not One Per Command)

- gsd-tools.cjs has ~60 commands but only ~15 logical domains. One-file-per-command creates 60+ files with heavy cross-imports. One-file-per-domain keeps related logic together (phase CRUD, state CRUD, config CRUD).
- Each file exports individual handler functions that the registry maps. This preserves fine-grained tree-shaking for library consumers.
- No plugin system. Plugins are warranted when you have external contributors adding commands at runtime. GSD commands are static and known at build time. A registry map is simpler, faster, and fully type-checked.

### Registry Pattern

```typescript
// query/registry.ts
import type { QueryResult } from './types.js';

export interface QueryHandler {
  (args: string[], projectDir: string): Promise<QueryResult>;
}

export interface QueryResult {
  data: unknown;       // Structured output (JSON-serializable)
  raw?: string;        // Optional raw text output (for --raw mode)
  exitCode?: number;   // 0 = success, 1 = error, 10 = validation, 11 = blocked
}

const HANDLERS: Record<string, QueryHandler> = {
  'state.load': stateLoad,
  'state.json': stateJson,
  'config.get': configGet,
  'config.set': configSet,
  'phase.find': findPhase,
  'phase.complete': phaseComplete,
  'roadmap.analyze': roadmapAnalyze,
  // ... all commands
};

export async function handleQuery(
  argv: string[],
  projectDir: string,
): Promise<void> {
  const commandKey = argv[0];
  const handler = HANDLERS[commandKey];
  if (!handler) {
    // Fall back to gsd-tools.cjs bridge for un-migrated commands
    return handleLegacyFallback(argv, projectDir);
  }
  const result = await handler(argv.slice(1), projectDir);
  // Output: JSON to stdout (default), raw text with --raw flag
  process.stdout.write(JSON.stringify(result.data));
  process.exitCode = result.exitCode ?? 0;
}
```

### Command Naming Convention

gsd-tools.cjs uses space-separated subcommands (`state load`, `roadmap analyze`). The query registry uses dot-separated keys (`state.load`, `roadmap.analyze`) for unambiguous single-token routing. The CLI accepts both:

```bash
gsd-sdk query state.load          # Dot form (canonical)
gsd-sdk query state load          # Space form (backwards compat)
```

## Architecture Decision 3: Dual-Mode (Library + CLI)

### Problem

The SDK must work as both:
1. **Library**: `import { stateLoad } from '@gsd-build/sdk'` -- returns typed objects
2. **CLI**: `gsd-sdk query state.load` -- prints JSON to stdout, sets exit code

### Decision: Handlers return typed `QueryResult`, CLI serializes

Every query handler is a pure async function: `(args, projectDir) => Promise<QueryResult>`. The CLI layer serializes to stdout. Library consumers import the same handlers and get typed returns.

```typescript
// Library usage
import { stateLoad } from '@gsd-build/sdk/query';
const state = await stateLoad([], '/path/to/project');
// state.data is typed

// CLI usage (cli.ts handles serialization)
// $ gsd-sdk query state.load --project-dir /path/to/project
// {"current_phase":"3","current_plan":"01",...}
```

### Export Strategy

`index.ts` re-exports query modules under a namespace:

```typescript
// sdk/src/index.ts additions
export { handleQuery, type QueryHandler, type QueryResult } from './query/registry.js';
export * as queries from './query/index.js';
```

Where `query/index.ts` is a barrel:

```typescript
export { stateLoad, stateJson, stateGet, stateUpdate } from './state.js';
export { configGet, configSet } from './config.js';
export { findPhase, phaseComplete, phaseAdd } from './phase.js';
// etc.
```

This keeps `index.ts` from growing a massive export list while allowing selective imports.

## Architecture Decision 4: GSD-2 Seed Integration Points

### Error Classification (sdk-error-classification)

**Where:** New `sdk/src/errors.ts` module + modify `query/registry.ts`

```typescript
// sdk/src/errors.ts
export enum GSDErrorClass {
  Validation = 'validation',   // Bad input, missing args, schema mismatch
  Execution = 'execution',     // Runtime failure during operation
  Blocked = 'blocked',         // External dependency not met (phase dep, missing file)
  Interruption = 'interruption', // Timeout, cancellation, budget exceeded
}

export class GSDError extends Error {
  constructor(
    message: string,
    public readonly errorClass: GSDErrorClass,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GSDError';
  }
}
```

**Integration:** Query handlers throw `GSDError` with appropriate class. The registry catches, maps to exit code, and formats structured error output.

**Depends on:** Nothing. Build first as foundation.

### Exit Code Semantics (sdk-exit-codes)

**Where:** `query/registry.ts` error handler

| Exit Code | Error Class | Meaning |
|-----------|-------------|---------|
| 0 | (none) | Success |
| 1 | Execution | General runtime failure |
| 10 | Validation | Input/precondition error (retryable with corrected input) |
| 11 | Blocked | External blocker (dependency not met, resource unavailable) |

**Integration:** Library consumers get typed `GSDError` with `errorClass`. CLI consumers get exit codes. Both get the same structured error data.

**Depends on:** Error Classification.

### Staged Execution (sdk-staged-tool-execution)

**Where:** `query/registry.ts` wraps each handler in a stage pipeline

```typescript
async function executeStaged(
  handler: QueryHandler,
  args: string[],
  projectDir: string,
): Promise<QueryResult> {
  // Stage 1: Preparation — validate args, check preconditions
  const prepared = await prepare(handler, args, projectDir);

  // Stage 2: Execution — run the actual operation
  const result = await execute(prepared);

  // Stage 3: Finalization — emit events for mutations, update state
  await finalize(result);

  return result;
}
```

**When to adopt:** After core query migration is working. The initial migration can use direct handler calls; staging wraps them later without changing handler signatures.

**Depends on:** Error Classification (preparation stage throws validation errors).

### Hook Extensibility (sdk-hook-extensibility)

**Where:** `query/registry.ts` stage pipeline, new `sdk/src/hooks.ts`

```typescript
// sdk/src/hooks.ts
export interface QueryHook {
  beforeQuery?(command: string, args: string[]): Promise<void>;
  afterQuery?(command: string, result: QueryResult): Promise<void>;
}
```

**When to adopt:** After staged execution is stable. Hooks plug into the stage boundaries (before preparation, after finalization).

**Depends on:** Staged Execution.

### Context Compaction (sdk-context-compaction)

**Where:** `sdk/src/context-engine.ts` (extend existing) + `sdk/src/session-runner.ts`

This is orthogonal to the query system. It operates on Agent SDK sessions, not on query commands. The existing `ContextEngine` already does file truncation; conversation compaction extends it to handle in-session history.

**Depends on:** Nothing in the query system. Independent workstream.

### Event Stream Extensions (sdk-event-stream-extensions)

**Where:** `sdk/src/types.ts` (new event types) + `sdk/src/event-stream.ts`

New event types for query operations:

```typescript
// Additions to GSDEventType enum
QueryStart = 'query_start',
QueryComplete = 'query_complete',
QueryError = 'query_error',
```

State-mutating queries (`state.update`, `phase.complete`, `config.set`) emit events through the existing `GSDEventStream`. Read-only queries do not emit events.

**Depends on:** Core query infrastructure exists.

## Architecture Decision 5: Migration Sequence

### Dependency Graph

```
errors.ts (new)
    ^
    |
query/registry.ts (new) --- depends on ---> errors.ts
    ^
    |
query/config.ts (new) --- depends on ---> sdk/src/config.ts (existing, extend)
query/state.ts (new) --- depends on ---> file I/O only
query/misc.ts (new) --- depends on ---> nothing
query/phase.ts (new) --- depends on ---> state.ts, roadmap.ts
query/roadmap.ts (new) --- depends on ---> file I/O only
query/init-queries.ts (new) --- depends on ---> config.ts, state.ts, phase.ts
query/verify.ts (new) --- depends on ---> plan-parser.ts (existing)
query/frontmatter.ts (new) --- depends on ---> file I/O only
query/scaffold.ts (new) --- depends on ---> config.ts, phase.ts
query/intel.ts (new) --- depends on ---> file I/O only
query/progress.ts (new) --- depends on ---> state.ts, roadmap.ts
query/commit.ts (new) --- depends on ---> git (child process)
```

### Recommended Migration Order

**Wave 1: Foundation (no dependencies)**

| Module | Source | Lines | Rationale |
|--------|--------|-------|-----------|
| `errors.ts` | New | ~50 | Every subsequent module uses error classification |
| `query/registry.ts` | New | ~80 | Routing infrastructure; enables incremental migration |
| `query/misc.ts` | `core.cjs` extract | ~100 | Pure functions (generate-slug, current-timestamp, verify-path-exists). Zero state dependencies. Proves the pattern works. |
| `cli.ts` update | Modify existing | ~30 added | Add `query` subcommand dispatch |

**Wave 2: Read-Only State (file I/O only, no cross-module deps)**

| Module | Source | Lines | Rationale |
|--------|--------|-------|-----------|
| `query/config.ts` | `config.cjs` (469 lines) | ~120 | Config get/set. Extends existing `sdk/src/config.ts` `loadConfig()`. |
| `query/state.ts` | `state.cjs` (1353 lines) | ~300 | State load/json/get — read paths first, then mutation paths |
| `query/frontmatter.ts` | `frontmatter.cjs` (381 lines) | ~150 | YAML frontmatter CRUD. Self-contained. |
| `query/roadmap.ts` | `roadmap.cjs` (353 lines) | ~150 | Roadmap parse/analyze. Self-contained. |

**Wave 3: State-Mutating Operations**

| Module | Source | Lines | Rationale |
|--------|--------|-------|-----------|
| `query/state.ts` (mutations) | `state.cjs` | ~200 added | state update/patch/begin-phase/signal-waiting — builds on Wave 2 reads |
| `query/phase.ts` | `phase.cjs` (931 lines) | ~250 | Phase CRUD. Depends on state + roadmap for validation. |
| `query/commit.ts` | `core.cjs` extract | ~100 | Git commit operations. Independent but state-aware. |

**Wave 4: Complex Operations**

| Module | Source | Lines | Rationale |
|--------|--------|-------|-----------|
| `query/verify.ts` | `verify.cjs` (1032 lines) | ~300 | Verification suite. Depends on plan-parser, frontmatter. |
| `query/init-queries.ts` | `init.cjs` (1522 lines) | ~350 | Init queries. Depends on config, state, phase. |
| `query/scaffold.ts` | `template.cjs` (222 lines) + `core.cjs` | ~150 | Template scaffolding. Depends on config, phase. |

**Wave 5: Remaining + Cleanup**

| Module | Source | Lines | Rationale |
|--------|--------|-------|-----------|
| `query/intel.ts` | `intel.cjs` (660 lines) | ~200 | Intel system. Independent but complex. |
| `query/progress.ts` | `core.cjs` extract | ~100 | Progress rendering. Depends on state + roadmap. |
| Legacy bridge removal | `gsd-tools.ts` | Delete | Remove shell-out bridge once all commands migrated |
| `gsd-tools.cjs` retirement | `gsd-tools.cjs` + `lib/*.cjs` | Delete | Full retirement after all workflows updated |

### Staged Execution + Hooks (Post-Migration)**

After Wave 5:
- Wrap registry dispatch in staged execution pipeline
- Add hook extensibility points
- Extend event stream for query events

## Patterns to Follow

### Pattern 1: Handler Signature Consistency

**What:** Every query handler has the same signature: `(args: string[], projectDir: string) => Promise<QueryResult>`

**When:** Always. No exceptions.

**Example:**
```typescript
// query/state.ts
export async function stateLoad(
  _args: string[],
  projectDir: string,
): Promise<QueryResult> {
  const config = await loadConfig(projectDir);
  const statePath = join(projectDir, '.planning', 'STATE.md');
  // ... read and parse
  return { data: parsed };
}
```

### Pattern 2: Legacy Fallback During Migration

**What:** Un-migrated commands fall through to `gsd-tools.cjs` via the existing `GSDTools.exec()` bridge.

**When:** During migration (Waves 1-5). Removed after Wave 5.

**Example:**
```typescript
// query/registry.ts
async function handleLegacyFallback(
  argv: string[],
  projectDir: string,
): Promise<void> {
  const tools = new GSDTools({ projectDir });
  const result = await tools.exec(argv[0]!, argv.slice(1));
  process.stdout.write(JSON.stringify(result));
}
```

### Pattern 3: Mutation Events

**What:** State-mutating operations emit events through `GSDEventStream`.

**When:** Only for mutations (state update, phase complete, config set). Never for reads.

**Example:**
```typescript
export async function phaseComplete(
  args: string[],
  projectDir: string,
  eventStream?: GSDEventStream,
): Promise<QueryResult> {
  // ... perform completion logic
  eventStream?.emitEvent({
    type: GSDEventType.PhaseComplete,
    // ...
  });
  return { data: { completed: true } };
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Command File

**What:** Putting all command handlers in one file (replicating gsd-tools.cjs's switch-case pattern in TypeScript).
**Why bad:** Defeats the purpose of migration. Same untestable, undiscoverable blob in a different language.
**Instead:** One file per domain with individually exportable/testable handlers.

### Anti-Pattern 2: String-In/String-Out Bridge

**What:** Wrapping gsd-tools.cjs calls as the permanent architecture.
**Why bad:** No type safety. Process spawn overhead. Two runtimes. Untestable without integration tests.
**Instead:** Rewrite each handler as typed TypeScript. The bridge is scaffolding, not architecture.

### Anti-Pattern 3: Global State in Handlers

**What:** Handlers storing state in module-level variables between calls.
**Why bad:** Makes handlers non-reentrant and untestable. Breaks library usage where multiple GSD instances coexist.
**Instead:** Pass `projectDir` (and optionally `eventStream`) to every handler. All state comes from the file system.

### Anti-Pattern 4: Overloading QueryResult.data

**What:** Returning different shapes from the same handler based on input flags.
**Why bad:** TypeScript can't narrow the return type. Consumers need runtime type guards.
**Instead:** Different shapes = different handlers (e.g., `stateLoad` vs `stateJson` vs `stateGet`).

## Module Impact Assessment

### Existing SDK Modules — Modifications Needed

| Module | Change Type | What Changes |
|--------|------------|--------------|
| `cli.ts` | **Extend** | Add `query` subcommand dispatch. ~30 lines added. |
| `types.ts` | **Extend** | Add `QueryResult`, `QueryHandler`, `GSDErrorClass` types. ~40 lines added. |
| `index.ts` | **Extend** | Re-export `query/*` modules and new types. ~10 lines added. |
| `config.ts` | **No change** | Query config module imports `loadConfig` from here. No modifications needed. |
| `event-stream.ts` | **Extend** | Add `QueryStart`/`QueryComplete`/`QueryError` event types (Wave 5+). |
| `gsd-tools.ts` | **Deprecate then delete** | Used as legacy fallback during migration. Deleted after Wave 5. |
| `plan-parser.ts` | **No change** | Used by `query/verify.ts`. No modifications needed. |
| `context-engine.ts` | **Independent extension** | Context compaction seed. Not part of query migration. |

### New SDK Modules

| Module | Purpose | Size Estimate |
|--------|---------|---------------|
| `sdk/src/errors.ts` | Error classification, `GSDError` class | ~50 lines |
| `sdk/src/query/registry.ts` | Command routing, argument parsing, output formatting | ~120 lines |
| `sdk/src/query/state.ts` | State CRUD operations | ~500 lines |
| `sdk/src/query/config.ts` | Config get/set operations | ~120 lines |
| `sdk/src/query/phase.ts` | Phase CRUD operations | ~250 lines |
| `sdk/src/query/roadmap.ts` | Roadmap parse/analyze | ~150 lines |
| `sdk/src/query/init-queries.ts` | Init workflow queries | ~350 lines |
| `sdk/src/query/verify.ts` | Verification suite | ~300 lines |
| `sdk/src/query/frontmatter.ts` | Frontmatter CRUD | ~150 lines |
| `sdk/src/query/scaffold.ts` | Template scaffolding | ~150 lines |
| `sdk/src/query/intel.ts` | Intel system queries | ~200 lines |
| `sdk/src/query/progress.ts` | Progress rendering | ~100 lines |
| `sdk/src/query/commit.ts` | Git commit operations | ~100 lines |
| `sdk/src/query/misc.ts` | Utility commands | ~100 lines |
| `sdk/src/query/index.ts` | Barrel re-exports | ~30 lines |
| `sdk/src/hooks.ts` | Hook extensibility (post-migration) | ~80 lines |

### Total New Code: ~2,750 lines TypeScript
### Total Deleted Code: ~12,000 lines CJS (gsd-tools.cjs + lib/*.cjs)
### Net: ~9,250 lines reduced

## Data Flow

### Query Execution Flow (CLI Mode)

```
1. gsd-sdk query state.load --project-dir /project
2. cli.ts: parseArgs → command='query', positionals=['state.load']
3. cli.ts: handleQuery(['state.load'], '/project')
4. registry.ts: lookup HANDLERS['state.load'] → stateLoad
5. stateLoad([], '/project'):
   a. Read .planning/STATE.md
   b. Parse frontmatter + sections
   c. Return QueryResult { data: {...}, exitCode: 0 }
6. registry.ts: JSON.stringify(result.data) → stdout
7. cli.ts: process.exitCode = 0
```

### Query Execution Flow (Library Mode)

```
1. import { queries } from '@gsd-build/sdk';
2. const result = await queries.stateLoad([], '/project');
3. // result.data is typed, no serialization
```

### Legacy Fallback Flow (During Migration)

```
1. gsd-sdk query intel.query "auth"
2. registry.ts: HANDLERS['intel.query'] → undefined (not yet migrated)
3. registry.ts: handleLegacyFallback(['intel', 'query', 'auth'], '/project')
4. GSDTools.exec('intel', ['query', 'auth'])
5. child_process: node gsd-tools.cjs intel query auth
6. gsd-tools.cjs: switch('intel') → intel.cmdIntelQuery(...)
7. stdout: JSON result → parsed → re-serialized to caller
```

## Scalability Considerations

| Concern | At 60 commands (current) | At 120 commands (2x growth) | At 300 commands (5x growth) |
|---------|--------------------------|-----------------------------|-----------------------------|
| Registry size | Flat map, ~60 entries, <1ms lookup | Still flat map, <1ms | Consider lazy-loading modules |
| File count | ~15 domain files | ~25 domain files | Split large domains into subdirectories |
| Type exports | Manageable barrel | Large barrel, consider namespace exports | Workspace packages per domain |
| Test files | ~15 test files | ~25 test files | Test organization mirrors source |
| Build time | <2s TypeScript compilation | ~3s | Consider incremental builds |

## Sources

- `sdk/src/cli.ts` — Existing CLI entry point (429 lines)
- `sdk/src/index.ts` — Current public API (321 lines)
- `sdk/src/gsd-tools.ts` — Current bridge to gsd-tools.cjs (304 lines)
- `sdk/src/types.ts` — Current type definitions (850 lines)
- `sdk/src/event-stream.ts` — Current event system (439 lines)
- `sdk/src/config.ts` — Current config loader (152 lines)
- `get-shit-done/bin/gsd-tools.cjs` — Monolith entry point (1,047 lines)
- `get-shit-done/bin/lib/*.cjs` — Helper libraries (21 files, ~12,600 total lines)
- `.planning/notes/sdk-first-architecture.md` — Architecture decision record
- `.planning/seeds/sdk-*.md` — GSD-2 seed patterns (4 seeds)
- `.planning/research/questions.md` — Open research questions Q1-Q4
