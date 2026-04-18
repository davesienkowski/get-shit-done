# Phase 9: Foundation and Test Infrastructure - Research

**Researched:** 2026-04-08
**Domain:** TypeScript SDK CLI extension, error taxonomy, command registry, golden file testing
**Confidence:** HIGH

## Summary

Phase 9 establishes the foundation that all subsequent SDK migration phases (10-14) build on. The core deliverables are: (1) an error classification system with semantic exit codes, (2) a `query` subcommand in the existing CLI with a flat command registry, (3) two initial utility commands (`generate-slug`, `current-timestamp`) as proof of concept, (4) a golden file test harness that captures gsd-tools.cjs output and compares it against SDK-native output, and (5) a wrapper-count metric script.

The existing codebase is well-structured for this work. `cli.ts` already uses `parseArgs` from `node:util` and routes `run`, `auto`, `init` subcommands. The `GSDTools` class in `gsd-tools.ts` is the bridge being replaced over phases 10-14. Error handling follows the pattern of custom error classes extending `Error` with a `name` property and contextual properties. Tests are co-located in `src/` as `*.test.ts` files using Vitest.

**Primary recommendation:** Build this as a three-layer architecture: error taxonomy types (standalone), query registry with `--pick` support (depends on errors), and golden file test harness (depends on registry). The `generate-slug` and `current-timestamp` commands are simple enough to serve as the first two native SDK query implementations, proving the registry and golden file patterns end-to-end.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Error classification enum (validation, execution, blocked, interruption) | Extend existing `GSDToolsError` pattern; new `GSDError` base class with `classification` enum property |
| FOUND-02 | Exit code semantics (0/1/10/11) for CLI mode | Map classification enum to exit codes in `cli.ts` query handler |
| FOUND-03 | `gsd-sdk query` subcommand with flat command registry routing | Add `query` to `cli.ts` routing; registry is a `Map<string, QueryHandler>` in `sdk/src/query/registry.ts` |
| FOUND-04 | JSON output with `--pick` field extraction | Port `extractField()` from gsd-tools.cjs; apply to query output before printing |
| FOUND-05 | One-file-per-domain module structure under `sdk/src/query/` | Each domain (utils, state, config, etc.) is one file exporting handler functions |
| FOUND-06 | Slug generation and timestamp utilities as typed functions | Port `cmdGenerateSlug` and `cmdCurrentTimestamp` logic; pure functions, no I/O |
| MIGR-01 | Golden file tests validate SDK output matches gsd-tools.cjs output | Capture gsd-tools.cjs output as `.golden.json` fixtures; Vitest snapshot comparison |
| MIGR-02 | Wrapper tracking metric counts remaining bridge calls | Script in `scripts/` that greps `sdk/src/` for `GSDTools` method calls, outputs count |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Backwards compatibility**: All existing GSD commands must continue working
- **Architecture**: Follow existing GSD patterns (commands->workflows->agents, state in .planning/)
- **Naming**: Use `gsd-` prefix for agents, `/gsd:` prefix for commands
- **Style**: Follow GSD-STYLE.md commit format and code conventions
- **No co-author**: Never add co-author tags to commits
- **ESM-only**: All SDK source uses ESM with `.js` extensions in imports
- **TypeScript strict mode**: ES2022 target, `strict: true`
- **Vitest**: Unit tests as `*.test.ts`, integration as `*.integration.test.ts`
- **Error classes**: Extend `Error`, set `name` property, include contextual properties
- **One class/export per file**: Helpers colocated with primary export

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | Type-safe SDK code | Already in SDK devDependencies [VERIFIED: sdk/package.json] |
| Vitest | 3.2.4 (SDK), 4.1.2 (root) | Test runner for unit + integration | Already configured with projects [VERIFIED: vitest.config.ts] |
| node:util `parseArgs` | Node 20+ built-in | CLI argument parsing | Already used in cli.ts [VERIFIED: sdk/src/cli.ts] |
| node:child_process | Node 20+ built-in | Golden file capture (execFile for gsd-tools.cjs) | Already used in gsd-tools.ts [VERIFIED: sdk/src/gsd-tools.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | Built-in | Golden file read/write | Reading/writing .golden.json fixtures |
| node:path | Built-in | Path resolution | Cross-platform path handling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flat `Map<string, Handler>` registry | Commander.js / yargs | Overkill for 65 commands; parseArgs already handles args; no new dependency needed |
| Vitest inline snapshots | Jest snapshots | Vitest already configured; inline snapshots don't work well for golden file comparison of captured process output |
| Custom golden file harness | vitest-golden | No such mature library exists; the comparison is simple JSON deep-equal |

**No new dependencies required.** Everything needed is already in the project or available as Node.js built-ins.

## Architecture Patterns

### Recommended Project Structure

```
sdk/src/
├── cli.ts                          # Add 'query' subcommand routing
├── errors.ts                       # NEW: GSDError base, ErrorClassification enum, exit code mapping
├── query/
│   ├── registry.ts                 # NEW: QueryRegistry class, QueryHandler type, --pick support
│   ├── utils.ts                    # NEW: generate-slug, current-timestamp handlers
│   └── index.ts                    # NEW: Re-export registry with all handlers registered
├── query/utils.test.ts             # NEW: Unit tests for utility commands
├── query/registry.test.ts          # NEW: Unit tests for registry routing, --pick, fallback
├── errors.test.ts                  # NEW: Unit tests for error classification + exit codes
└── golden/                         # NEW: Golden file test infrastructure
    ├── golden.test.ts              # NEW: Golden file comparison tests
    ├── capture.ts                  # NEW: Helper to capture gsd-tools.cjs output
    └── fixtures/                   # NEW: .golden.json files (captured reference output)
        ├── generate-slug.golden.json
        └── current-timestamp.golden.json
scripts/
└── wrapper-count.cjs               # NEW: Metric script for MIGR-02
```

### Pattern 1: Error Classification Enum

**What:** A discriminated error taxonomy that classifies SDK errors into four categories with semantic exit codes.
**When to use:** Every error thrown by SDK query commands must carry a classification.
**Example:**

```typescript
// Source: FOUND-01 + FOUND-02 requirements, existing GSDToolsError pattern
export enum ErrorClassification {
  Validation = 'validation',     // Bad input, missing args, schema violations → exit 10
  Execution = 'execution',       // Runtime failure, file I/O, parse errors → exit 1
  Blocked = 'blocked',           // Dependency missing, phase not found → exit 11
  Interruption = 'interruption', // Timeout, signal, user cancel → exit 1
}

export class GSDError extends Error {
  readonly classification: ErrorClassification;
  readonly name = 'GSDError';

  constructor(message: string, classification: ErrorClassification) {
    super(message);
    this.classification = classification;
  }
}

export function exitCodeFor(classification: ErrorClassification): number {
  switch (classification) {
    case ErrorClassification.Validation: return 10;
    case ErrorClassification.Blocked: return 11;
    case ErrorClassification.Execution:
    case ErrorClassification.Interruption:
    default: return 1;
  }
}
```

[VERIFIED: Exit code mapping from success criteria: "0=success, 1=execution error, 10=validation error, 11=blocked"]

### Pattern 2: Flat Command Registry

**What:** A `Map<string, QueryHandler>` that maps command names to handler functions. Unknown commands fall back to gsd-tools.cjs.
**When to use:** All `gsd-sdk query <command>` routing goes through this registry.
**Example:**

```typescript
// Source: FOUND-03 + FOUND-05, modeled after gsd-tools.cjs switch/case routing
export interface QueryResult {
  data: unknown;
  rawValue?: string;  // For --raw mode compatibility
}

export type QueryHandler = (args: string[], projectDir: string) => Promise<QueryResult>;

export class QueryRegistry {
  private handlers = new Map<string, QueryHandler>();

  register(command: string, handler: QueryHandler): void {
    this.handlers.set(command, handler);
  }

  has(command: string): boolean {
    return this.handlers.has(command);
  }

  async dispatch(command: string, args: string[], projectDir: string): Promise<QueryResult> {
    const handler = this.handlers.get(command);
    if (!handler) {
      // Fallback to gsd-tools.cjs bridge (FOUND-03 success criteria #3)
      return this.fallbackToGsdTools(command, args, projectDir);
    }
    return handler(args, projectDir);
  }

  private async fallbackToGsdTools(command: string, args: string[], projectDir: string): Promise<QueryResult> {
    const { GSDTools } = await import('./gsd-tools.js');
    const tools = new GSDTools({ projectDir });
    const result = await tools.exec(command, args);
    return { data: result };
  }
}
```

[VERIFIED: Fallback behavior from success criteria #3: "unknown command falls back to gsd-tools.cjs and returns the same output"]

### Pattern 3: Golden File Test Harness

**What:** Tests that capture gsd-tools.cjs output for specific commands and compare against SDK-native output.
**When to use:** Every migrated command gets a golden file test to validate output parity.
**Example:**

```typescript
// Source: MIGR-01, modeled after existing gsd-tools.test.ts exec patterns
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function captureGsdToolsOutput(
  command: string,
  args: string[],
  projectDir: string,
  gsdToolsPath: string,
): Promise<unknown> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [gsdToolsPath, command, ...args],
    { cwd: projectDir },
  );
  return JSON.parse(stdout.trim());
}

// In test file:
it('generate-slug output matches gsd-tools.cjs', async () => {
  const gsdOutput = await captureGsdToolsOutput('generate-slug', ['My Phase'], projectDir, gsdToolsPath);
  const sdkOutput = await registry.dispatch('generate-slug', ['My Phase'], projectDir);
  expect(sdkOutput.data).toEqual(gsdOutput);
});
```

### Pattern 4: --pick Field Extraction

**What:** Port the `extractField()` function from gsd-tools.cjs to TypeScript, supporting dot-notation and bracket syntax.
**When to use:** When `--pick <field>` is passed to `gsd-sdk query`.
**Example:**

```typescript
// Source: gsd-tools.cjs lines 361-382 [VERIFIED: direct port]
export function extractField(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const bracketMatch = part.match(/^(.+?)\[(-?\d+)]$/);
    if (bracketMatch) {
      const key = bracketMatch[1];
      const index = parseInt(bracketMatch[2], 10);
      current = (current as Record<string, unknown>)[key];
      if (!Array.isArray(current)) return undefined;
      current = index < 0 ? current[current.length + index] : current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
```

### Anti-Patterns to Avoid

- **Importing gsd-tools.cjs internals directly:** The CJS modules are not importable from ESM. Always shell out via `execFile` for golden file comparison.
- **Coupling query handlers to GSDTools class:** New native handlers must be pure TypeScript; they should NOT import or use GSDTools. Only the fallback path uses GSDTools.
- **Shared mutable state in registry:** The registry should be a simple Map, not a singleton with side effects. Create it in a factory function.
- **Process.exit() in handlers:** Error classification flows up to cli.ts which sets `process.exitCode`. Handlers throw `GSDError`, never call `process.exit()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom arg parser | `parseArgs` from `node:util` | Already used in cli.ts, handles strict mode, types, positionals |
| JSON field extraction | New jq-like system | Direct port of `extractField()` from gsd-tools.cjs | Proven, handles dot-notation and bracket syntax, 20 lines |
| Test snapshots | Custom file-diff system | Vitest `expect().toEqual()` with captured JSON | Vitest provides clear diffs on assertion failure |
| Slug generation | npm slug library | Direct port (5 lines of regex) | Zero dependencies, exact output parity required |

**Key insight:** This phase is about infrastructure plumbing, not complex algorithms. The implementations being ported (`generate-slug`, `current-timestamp`) are trivially simple. The value is in the registry routing, error taxonomy, and golden file comparison patterns that future phases will use dozens of times.

## Common Pitfalls

### Pitfall 1: ESM/CJS Boundary in Golden File Tests
**What goes wrong:** Trying to `import()` the CJS gsd-tools.cjs modules from ESM test code
**Why it happens:** The golden file tests need to capture gsd-tools.cjs output, but it's CJS and the SDK is ESM-only
**How to avoid:** Always use `execFile` to shell out to `node gsd-tools.cjs <command>` — never try to import CJS modules
**Warning signs:** `ERR_REQUIRE_ESM` or `ERR_MODULE_NOT_FOUND` errors in tests

### Pitfall 2: Timestamp Non-Determinism in Golden Files
**What goes wrong:** `current-timestamp` output changes every millisecond, making golden file comparison flaky
**Why it happens:** Time-based commands inherently produce different output each invocation
**How to avoid:** For time-based commands, validate structure/format rather than exact values. Use regex pattern matching or parse the timestamp and validate it's a valid ISO date. Golden files for `current-timestamp` should validate the format, not the exact value.
**Warning signs:** Intermittently failing tests on `current-timestamp` golden comparison

### Pitfall 3: Exit Code Not Set When GSDError Thrown
**What goes wrong:** `process.exitCode` remains 0 even when a classified error occurs
**Why it happens:** The error is caught but the classification-to-exit-code mapping isn't wired in the catch handler
**How to avoid:** In `cli.ts` query handler, catch `GSDError` specifically and call `exitCodeFor(err.classification)` to set `process.exitCode`
**Warning signs:** All errors exit with code 1 regardless of classification

### Pitfall 4: Rollup Native Binary Missing (Vitest on Windows)
**What goes wrong:** Vitest fails to start due to `@rollup/rollup-win32-x64-msvc` not being found
**Why it happens:** `npm install` sometimes doesn't install optional platform-specific rollup binaries
**How to avoid:** Run `npm install` in the SDK directory. If still failing, `npm rebuild` or delete `node_modules` and reinstall.
**Warning signs:** `MODULE_NOT_FOUND` error for `@rollup/rollup-win32-x64-msvc` when running tests

### Pitfall 5: gsd-tools.cjs Output Contains stderr Noise
**What goes wrong:** Golden file capture includes stderr warnings mixed into stdout
**Why it happens:** gsd-tools.cjs uses `fs.writeSync(2, ...)` for errors and `fs.writeSync(1, ...)` for output, but some Node.js warnings may leak
**How to avoid:** In `captureGsdToolsOutput`, only use `stdout`; ignore `stderr` unless exit code is non-zero
**Warning signs:** Golden file comparisons fail due to extra text before/after the JSON

## Code Examples

### CLI query Subcommand Integration

```typescript
// Source: existing cli.ts routing pattern [VERIFIED: sdk/src/cli.ts lines 197-209]
// Add to cli.ts main() after auto command check:

if (args.command === 'query') {
  const queryArgs = argv.slice(1); // everything after 'query'
  const { createRegistry } = await import('./query/index.js');
  const registry = createRegistry();

  const queryCommand = queryArgs[0];
  if (!queryCommand) {
    console.error('Error: "gsd-sdk query" requires a command');
    process.exitCode = 10; // validation error
    return;
  }

  // Extract --pick before dispatch
  const pickIdx = queryArgs.indexOf('--pick');
  let pickField: string | undefined;
  if (pickIdx !== -1) {
    pickField = queryArgs[pickIdx + 1];
    queryArgs.splice(pickIdx, 2);
  }

  try {
    const result = await registry.dispatch(queryCommand, queryArgs.slice(1), args.projectDir);
    let output = result.data;

    if (pickField) {
      output = extractField(output, pickField);
    }

    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    if (err instanceof GSDError) {
      console.error(`Error: ${err.message}`);
      process.exitCode = exitCodeFor(err.classification);
    } else {
      console.error(`Error: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }
  return;
}
```

### Wrapper Count Metric Script

```javascript
// scripts/wrapper-count.cjs — MIGR-02
// Counts remaining gsd-tools.cjs bridge calls in SDK source files
'use strict';
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const SRC_DIR = join(__dirname, '..', 'sdk', 'src');
const PATTERNS = [
  /tools\.(exec|execRaw)\s*\(/g,
  /new GSDTools\s*\(/g,
  /GSDTools/g,
];

function countInFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  let count = 0;
  // Count calls to exec/execRaw methods (the actual bridge calls)
  const matches = content.match(/this\.(exec|execRaw)\s*\(/g);
  if (matches) count += matches.length;
  return count;
}

// ... walk sdk/src/*.ts (non-test), sum counts, output JSON
```

[ASSUMED: Script structure is illustrative; exact implementation will count `this.exec(` and `this.execRaw(` calls in gsd-tools.ts which are the actual bridge methods]

### Existing Bridge Call Baseline

Current bridge calls in `sdk/src/gsd-tools.ts` (production code only): **12 calls** across the typed convenience methods (stateLoad, roadmapAnalyze, phaseComplete, commit, verifySummary, initExecutePhase, initPhaseOp, configGet, stateBeginPhase, phasePlanIndex, initNewProject, configSet). [VERIFIED: grep of gsd-tools.ts]

Call sites in production SDK code consuming these methods:
- `init-runner.ts`: 7 calls
- `phase-runner.ts`: 7 calls
- `index.ts`: 2 calls
- Total production call sites: **16** [VERIFIED: grep of sdk/src/*.ts excluding test files]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gsd-tools.cjs monolith (12K+ lines CJS) | SDK TypeScript with typed query system | This phase (v3.0) | Type safety, tree-shaking, no child_process overhead |
| `process.exit(1)` for all errors | Classified errors with semantic exit codes | This phase | Agents can distinguish validation vs blocked vs execution errors |
| Switch/case routing in gsd-tools.cjs | Map-based registry with fallback | This phase | Incremental migration; unknown commands still work via bridge |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Golden file fixtures should be `.golden.json` files stored in the test directory | Architecture Patterns | Low -- naming convention only, easy to change |
| A2 | `generate-slug` and `current-timestamp` are sufficient proof-of-concept commands for the registry | Phase Requirements | Low -- success criteria explicitly mention generate-slug; other commands come in Phase 10+ |
| A3 | The wrapper-count script should be CJS (`.cjs`) to run without TS compilation | Code Examples | Low -- could be .ts with tsx runner, but CJS matches existing scripts/ convention |

## Open Questions (RESOLVED)

1. **Golden file update workflow**
   - What we know: Golden files need to be captured from gsd-tools.cjs and stored as fixtures
   - What's unclear: Should there be a script to regenerate golden files, or are they hand-captured once?
   - RESOLVED: Provide a capture script (`scripts/capture-golden.cjs`) that regenerates all golden fixtures from gsd-tools.cjs. This ensures golden files stay current if gsd-tools.cjs behavior changes during the migration.

2. **Query command naming convention**
   - What we know: Success criteria uses `gsd-sdk query generate-slug "My Phase"` (flat names)
   - What's unclear: Later phases use dot-notation like `gsd-sdk query state.load` (Phase 10 success criteria)
   - RESOLVED: Support both flat (`generate-slug`) and dotted (`state.load`) command names in the registry. The registry is just a Map so both patterns work naturally.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All SDK code | Yes | 22.21.1 | -- |
| TypeScript | SDK compilation | Yes | 5.7.0 | -- |
| Vitest | Unit + golden file tests | Yes | 3.2.4 (SDK) / 4.1.2 (root) | -- |
| gsd-tools.cjs | Golden file capture, fallback | Yes | Bundled in repo | -- |

**Missing dependencies:** None. All infrastructure is already in place.

**Note:** Vitest has a rollup native binary issue on this Windows machine (`@rollup/rollup-win32-x64-msvc` missing). This may need `npm rebuild` or `node_modules` cleanup before tests can run. [VERIFIED: observed during research]

## Sources

### Primary (HIGH confidence)
- `sdk/src/cli.ts` -- existing CLI routing, parseArgs usage, subcommand pattern
- `sdk/src/gsd-tools.ts` -- GSDToolsError class, bridge pattern, exec/execRaw methods
- `sdk/src/types.ts` -- existing type definitions, error patterns
- `sdk/vitest.config.ts` -- test project configuration (unit + integration)
- `get-shit-done/bin/gsd-tools.cjs` -- command routing, --pick implementation, generate-slug and current-timestamp implementations
- `get-shit-done/bin/lib/commands.cjs` -- cmdGenerateSlug, cmdCurrentTimestamp implementations
- `get-shit-done/bin/lib/core.cjs` -- output() and error() helper functions, @file: pattern
- `.planning/ROADMAP.md` -- Phase 9 success criteria and requirements
- `.planning/REQUIREMENTS.md` -- FOUND-01 through FOUND-06, MIGR-01, MIGR-02 definitions

### Secondary (MEDIUM confidence)
- Bridge call count (16 production call sites) -- verified by grep but count depends on exact regex

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified in existing codebase
- Architecture: HIGH -- patterns directly derived from existing cli.ts and gsd-tools.cjs code
- Pitfalls: HIGH -- ESM/CJS boundary and Windows Vitest issues observed directly during research

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable infrastructure, no external dependency changes expected)
