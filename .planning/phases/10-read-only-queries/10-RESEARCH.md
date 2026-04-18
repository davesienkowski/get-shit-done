# Phase 10: Read-Only Queries - Research

**Researched:** 2026-04-08
**Domain:** SDK TypeScript migration of read-only .planning/ state queries
**Confidence:** HIGH

## Summary

Phase 10 ports read-only query operations from five CJS source files (state.cjs, core.cjs, commands.cjs, frontmatter.cjs, roadmap.cjs) into native TypeScript SDK modules. The Phase 9 foundation provides the query registry, CLI routing, error classification, and golden file test infrastructure -- this phase fills the registry with handlers for the six QUERY requirements.

The porting scope is well-bounded: only the read paths are needed (no mutations), and the CJS implementations serve as exact behavioral specifications. The golden file testing pattern from Phase 9 ensures output parity. The main complexity lies in STATE.md parsing (regex-based field extraction from markdown with multiple format variants) and roadmap analysis (multi-pass regex parsing with disk correlation).

**Primary recommendation:** Create one TypeScript module per domain under `sdk/src/query/` (state.ts, config.ts, phase.ts, roadmap.ts, progress.ts, frontmatter.ts), register all handlers in `createRegistry()`, and validate each with golden file integration tests against gsd-tools.cjs output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (pure infrastructure phase).

### Claude's Discretion
All implementation choices are at Claude's discretion. Key patterns from Phase 9 to follow:
- Query handlers return `QueryResult` type from `sdk/src/query/utils.ts`
- One-file-per-domain under `sdk/src/query/` (FOUND-05)
- Register handlers in `createRegistry()` via `sdk/src/query/index.ts`
- Golden file tests validate output parity with gsd-tools.cjs
- Error classification via `GSDError` from `sdk/src/errors.ts`
- ESM-only with `.js` extensions, TypeScript strict mode

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUERY-01 | SDK can load and parse STATE.md into typed structure (state json, state get, state-snapshot) | Ports `cmdStateJson` (builds frontmatter from body+disk), `cmdStateGet` (field/section extraction), `cmdStateSnapshot` (structured snapshot). See CJS Functions Inventory below. |
| QUERY-02 | SDK can find phase directories on disk and list phases with metadata (find-phase, phases list, phase-plan-index) | Ports `cmdFindPhase` (directory lookup), `cmdPhasePlanIndex` (plan/wave indexing), phases list. Uses `findPhaseInternal`, `normalizePhaseName`, `searchPhaseInDir` from core.cjs. |
| QUERY-03 | SDK can read config.json with typed access to all config keys (config-get, resolve-model, config-ensure-section) | Extends existing `sdk/src/config.ts` `loadConfig()` for full config access. Ports `cmdConfigGet` (dot-notation traversal) and `cmdResolveModel` from commands.cjs. |
| QUERY-04 | SDK can parse and analyze ROADMAP.md with disk status correlation (roadmap analyze, roadmap get-phase) | Ports `cmdRoadmapAnalyze` (multi-pass parsing with disk correlation) and `getRoadmapPhaseInternal` (single-phase extraction) from roadmap.cjs. |
| QUERY-05 | SDK can render progress information in JSON format (progress json) | Ports `cmdProgressRender` (JSON format only) from commands.cjs. Reuses phase-finding utilities from QUERY-02. |
| QUERY-06 | SDK can parse YAML frontmatter from any .planning artifact (frontmatter get) | Ports `extractFrontmatter` parser and `cmdFrontmatterGet` command from frontmatter.cjs. Read-only; set/merge/validate are Phase 11 (mutations). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | SDK source language | Already in project, ES2022 target [VERIFIED: sdk/tsconfig.json] |
| Vitest | 3.1.1 | Unit + integration tests | Already configured with unit/integration projects [VERIFIED: sdk/vitest.config.ts] |
| Node.js | 20+ | Runtime | Required by package.json engines [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs/promises | built-in | Async file reads | All query handlers reading .planning/ files |
| node:path | built-in | Path resolution | Phase directory resolution, cross-platform paths |

### Alternatives Considered
None -- this phase uses only built-in Node.js modules and the existing SDK infrastructure. No external dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
sdk/src/query/
  index.ts          # createRegistry() factory (MODIFY - add new handlers)
  registry.ts       # QueryRegistry class (NO CHANGES)
  utils.ts          # QueryResult, QueryHandler types, generateSlug, currentTimestamp (NO CHANGES)
  state.ts          # NEW: state.load, state.get, state-snapshot handlers
  config.ts         # NEW: config-get handler (note: sdk/src/config.ts already has loadConfig)
  phase.ts          # NEW: find-phase, phases-list, phase-plan-index handlers
  roadmap.ts        # NEW: roadmap.analyze, roadmap.get-phase handlers
  progress.ts       # NEW: progress-json handler
  frontmatter.ts    # NEW: frontmatter.get handler + extractFrontmatter parser
  state.test.ts     # Unit tests
  config.test.ts    # Unit tests (query config, not the existing config loader)
  phase.test.ts     # Unit tests
  roadmap.test.ts   # Unit tests
  progress.test.ts  # Unit tests
  frontmatter.test.ts # Unit tests
sdk/src/golden/
  golden.integration.test.ts  # MODIFY: add golden file tests for all new commands
  fixtures/
    state-json.golden.json        # NEW
    state-snapshot.golden.json    # NEW (structure-only)
    find-phase.golden.json        # NEW
    config-get.golden.json        # NEW
    roadmap-analyze.golden.json   # NEW (structure-only)
    progress-json.golden.json     # NEW (structure-only)
    frontmatter-get.golden.json   # NEW
```

### Pattern 1: Query Handler Signature
**What:** Every handler follows the established `QueryHandler` type
**When to use:** All new query implementations
**Example:**
```typescript
// Source: sdk/src/query/utils.ts (Phase 9)
export type QueryHandler = (args: string[], projectDir: string) => Promise<QueryResult>;

// New handler follows same pattern:
export const stateLoad: QueryHandler = async (args, projectDir) => {
  // Implementation...
  return { data: result };
};
```

### Pattern 2: Golden File Testing
**What:** Integration tests compare SDK output against gsd-tools.cjs subprocess output
**When to use:** Every new query handler must have at least one golden file test
**Example:**
```typescript
// Source: sdk/src/golden/golden.integration.test.ts (Phase 9)
import { captureGsdToolsOutput } from './capture.js';
import { createRegistry } from '../query/index.js';

it('state.load matches gsd-tools.cjs output', async () => {
  const registry = createRegistry();
  const sdkResult = await registry.dispatch('state.load', [], projectDir);
  const cjsResult = await captureGsdToolsOutput('state', ['json'], projectDir);
  // Compare structurally (some fields are time-varying)
  expect(sdkResult.data).toMatchObject(/* structure checks */);
});
```

### Pattern 3: Shared Internal Helpers
**What:** Extract reusable parsing functions used by multiple handlers into a shared module
**When to use:** When the same logic (normalizePhaseName, stateExtractField, escapeRegex) is needed across state.ts, phase.ts, roadmap.ts, progress.ts
**Example:**
```typescript
// Could go in utils.ts or a new helpers.ts
export function normalizePhaseName(phase: string): string {
  const stripped = phase.replace(/^[A-Z]{1,6}-(?=\d)/, '');
  const match = stripped.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (match) {
    const padded = match[1].padStart(2, '0');
    const letter = match[2] ? match[2].toUpperCase() : '';
    const decimal = match[3] || '';
    return padded + letter + decimal;
  }
  return phase;
}
```

### Pattern 4: Config-Get vs Config-Load Distinction
**What:** `config-get` (raw JSON traversal, no defaults) vs existing `loadConfig()` (merged with defaults)
**When to use:** `config-get` for the query handler (matching gsd-tools.cjs behavior). `loadConfig()` already handles the merged config for SDK internal use.
**Important:** The CJS `cmdConfigGet` reads raw config.json and traverses dot-notation paths without default merging. The SDK `loadConfig()` merges with defaults. These are different operations and both need to exist.

### Anti-Patterns to Avoid
- **Importing from CJS files:** Never `require()` or dynamic import CJS modules. Port the logic as TypeScript.
- **Mutating state in read handlers:** Phase 10 is read-only. No `fs.writeFileSync` calls.
- **Synchronous fs in handlers:** Use `fs/promises` (async) to match the async QueryHandler signature. The CJS code uses sync fs, but SDK should be async.
- **Duplicating frontmatter parser:** The `extractFrontmatter` parser from frontmatter.cjs is needed by both `frontmatter.get` and `state.load` (via `buildStateFrontmatter`). Port it once in `query/frontmatter.ts` and import where needed.

## CJS Functions Inventory

This maps exactly which CJS functions each requirement needs ported.

### QUERY-01: State Queries
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `cmdStateJson` | state.cjs | 872-901 | `state.load` / `state.json` | HIGH - calls buildStateFrontmatter, extractFrontmatter, stripFrontmatter |
| `cmdStateGet` | state.cjs | 72-113 | `state.get` | MEDIUM - regex field/section extraction |
| `cmdStateSnapshot` | state.cjs | 546-641 | `state-snapshot` | MEDIUM - structured field extraction |
| `buildStateFrontmatter` | state.cjs | 650-760 | (internal helper) | HIGH - disk scanning, milestone resolution, progress calculation |
| `stateExtractField` | state.cjs | 17-25 | (internal helper) | LOW - regex extraction |
| `stripFrontmatter` | state.cjs | 762-774 | (internal helper) | LOW - regex stripping |

### QUERY-02: Phase Finding
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `cmdFindPhase` | phase.cjs | 152-196 | `find-phase` | MEDIUM - directory scanning + token matching |
| `cmdPhasePlanIndex` | phase.cjs | 203-300+ | `phase-plan-index` | MEDIUM - plan/wave indexing with frontmatter |
| `normalizePhaseName` | core.cjs | 874-888 | (internal helper) | LOW |
| `comparePhaseNum` | core.cjs | 890-920 | (internal helper) | LOW |
| `phaseTokenMatches` | core.cjs | 944-954 | (internal helper) | LOW |
| `getPhaseFileStats` | core.cjs | 1461-1471 | (internal helper) | LOW |

### QUERY-03: Config Access
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `cmdConfigGet` | config.cjs | 362-396 | `config-get` | LOW - dot-notation JSON traversal |
| `cmdResolveModel` | commands.cjs | 234-248 | `resolve-model` | LOW - model profile lookup |

### QUERY-04: Roadmap Analysis
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `cmdRoadmapAnalyze` | roadmap.cjs | 115-248 | `roadmap.analyze` | HIGH - multi-pass regex, disk correlation |
| `getRoadmapPhaseInternal` | core.cjs | 1189-1222 | `roadmap.get-phase` | MEDIUM - section extraction |
| `extractCurrentMilestone` | core.cjs | 1082-1101 | (internal helper) | MEDIUM - milestone scoping |
| `stripShippedMilestones` | core.cjs | 1082-1084 | (internal helper) | LOW |

### QUERY-05: Progress
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `cmdProgressRender` (JSON format) | commands.cjs | 535-597 | `progress` / `progress.json` | MEDIUM - disk scanning, status determination |
| `determinePhaseStatus` | commands.cjs | 15-36 | (internal helper) | LOW |
| `getMilestoneInfo` | core.cjs | (used by progress) | (shared helper) | LOW |

### QUERY-06: Frontmatter
| CJS Function | File | Lines | SDK Handler Name | Complexity |
|--------------|------|-------|------------------|------------|
| `extractFrontmatter` | frontmatter.cjs | 43-120 | (shared parser) | HIGH - nested YAML parsing with stack-based state machine |
| `cmdFrontmatterGet` | frontmatter.cjs | 311-326 | `frontmatter.get` | LOW - calls extractFrontmatter |
| `splitInlineArray` | frontmatter.cjs | 15-41 | (internal helper) | LOW - quote-aware CSV splitting |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | New YAML parser library | Port existing `extractFrontmatter` from frontmatter.cjs | The CJS parser handles GSD-specific quirks (multiple stacked blocks, CRLF, nested objects/arrays) that a standard YAML lib wouldn't match exactly. Output parity with gsd-tools.cjs is required. |
| Markdown section extraction | Custom markdown parser | Port the regex patterns from `stateExtractField` / `cmdStateGet` | These are simple targeted regex patterns, not general markdown parsing. Using a full parser would be overkill and risk behavioral differences. |
| Phase directory matching | Glob-based file search | Port `normalizePhaseName` + `phaseTokenMatches` | The matching logic handles project-code prefixes (CK-01), decimal phases (12.1), letter suffixes (12A), and custom IDs (PROJ-42). Must match exactly. |

**Key insight:** Every CJS function being ported is the behavioral specification. The SDK versions must produce identical JSON output. Port the logic, not a reimagination of it.

## Common Pitfalls

### Pitfall 1: CJS loadConfig vs SDK loadConfig Shape Mismatch
**What goes wrong:** The CJS `loadConfig()` (core.cjs:245) returns a flat object with keys like `plan_checker`, `research`, `verifier` as top-level properties (flattened from nested sections). The SDK `loadConfig()` (sdk/src/config.ts) preserves the nested structure (`workflow.plan_check`, `workflow.research`). The `state.load` handler must match the CJS output shape.
**Why it happens:** Two different config loading implementations with different flattening strategies.
**How to avoid:** For `state.load`, call the CJS-compatible flattened config directly from the raw JSON (matching cmdStateLoad), or transform the SDK config to match the flat shape.
**Warning signs:** Golden file tests will catch shape mismatches -- if `config.plan_checker` vs `config.workflow.plan_check` differs.

### Pitfall 2: Time-Varying Fields in Golden Tests
**What goes wrong:** `state.json` rebuilds frontmatter with `last_updated: new Date().toISOString()`. `progress` includes percentages that change as SUMMARY files are added. Direct equality comparison fails.
**Why it happens:** Some fields are derived from current time or current disk state.
**How to avoid:** Use structure-only golden files (validate shape and stable fields, not time-varying values). Phase 9 already established this pattern with `current-timestamp.golden.json`.
**Warning signs:** Flaky integration tests that pass on first run but fail on subsequent runs.

### Pitfall 3: Regex lastIndex Bug with Global Flag
**What goes wrong:** Several CJS functions use regex with `/g` flag (`phasePattern.exec()` in loops). If reusing the same regex instance across calls, `lastIndex` persists.
**Why it happens:** JavaScript regex with `/g` flag is stateful.
**How to avoid:** Either create new regex instances per call, or explicitly reset `lastIndex = 0` before reuse. The `roadmap.analyze` function's while loop with `exec()` requires the `/g` flag and is safe within a single call -- just don't cache the regex across invocations.
**Warning signs:** Missing phases in roadmap analysis, inconsistent results on repeated calls.

### Pitfall 4: Path Separators on Windows
**What goes wrong:** CJS uses `toPosixPath()` to normalize paths to forward slashes. Omitting this in TypeScript produces backslash paths on Windows.
**Why it happens:** `path.join()` on Windows uses backslashes.
**How to avoid:** Port the `toPosixPath()` helper and apply it to all path values in output JSON.
**Warning signs:** Golden file tests pass on Linux CI but fail on Windows.

### Pitfall 5: State.json Progress Derived from Disk
**What goes wrong:** `cmdStateJson` (state.cjs:872) does NOT just parse frontmatter. It calls `buildStateFrontmatter(body, cwd)` which scans the phases directory to compute actual plan/summary counts. Returning cached frontmatter produces stale progress.
**Why it happens:** A naive port might just parse the existing YAML frontmatter and return it.
**How to avoid:** The SDK handler must replicate the disk-scanning logic in `buildStateFrontmatter` (state.cjs:650-760), including milestone phase filtering.
**Warning signs:** Progress percentage in SDK output doesn't match gsd-tools.cjs output.

### Pitfall 6: extractFrontmatter Handles Edge Cases
**What goes wrong:** Multiple stacked frontmatter blocks (corruption recovery), CRLF line endings, empty objects that get converted to arrays when followed by `- item` lines.
**Why it happens:** Real-world STATE.md files can have frontmatter corruption from CRLF mismatches or concurrent writes.
**How to avoid:** Port the full stack-based parser including the "use LAST block" logic and the empty-object-to-array conversion.
**Warning signs:** Frontmatter parsing silently returns wrong data on Windows or after concurrent modifications.

## Code Examples

### Verified: stateExtractField Pattern (core parsing logic)
```typescript
// Source: state.cjs lines 17-25 [VERIFIED: codebase]
function stateExtractField(content: string, fieldName: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:\\s*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}
```

### Verified: normalizePhaseName (used across multiple handlers)
```typescript
// Source: core.cjs lines 874-888 [VERIFIED: codebase]
export function normalizePhaseName(phase: string): string {
  const str = String(phase);
  const stripped = str.replace(/^[A-Z]{1,6}-(?=\d)/, '');
  const match = stripped.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (match) {
    const padded = match[1].padStart(2, '0');
    const letter = match[2] ? match[2].toUpperCase() : '';
    const decimal = match[3] || '';
    return padded + letter + decimal;
  }
  return str;
}
```

### Verified: cmdConfigGet (simple dot-notation traversal)
```typescript
// Source: config.cjs lines 362-396 [VERIFIED: codebase]
export const configGet: QueryHandler = async (args, projectDir) => {
  const keyPath = args[0];
  if (!keyPath) {
    throw new GSDError('Usage: config-get <key.path>', ErrorClassification.Validation);
  }
  const configPath = join(projectDir, '.planning', 'config.json');
  const raw = await readFile(configPath, 'utf-8');
  const config = JSON.parse(raw);
  
  const keys = keyPath.split('.');
  let current: unknown = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      throw new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Validation);
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (current === undefined) {
    throw new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Validation);
  }
  return { data: current };
};
```

### Verified: Command-to-Handler Name Mapping
```typescript
// Source: gsd-tools.cjs routing [VERIFIED: codebase]
// CJS command syntax → SDK query command name
// state json         → state.json (or state.load)
// state get          → state.get
// state-snapshot     → state-snapshot
// find-phase         → find-phase
// phase-plan-index   → phase-plan-index
// config-get         → config-get
// resolve-model      → resolve-model
// roadmap analyze    → roadmap.analyze
// roadmap get-phase  → roadmap.get-phase
// progress json      → progress (or progress.json)
// frontmatter get    → frontmatter.get
```

## Dependency Graph Between Query Modules

Handlers share internal helpers. Understanding dependencies prevents circular imports:

```
frontmatter.ts  (standalone - extractFrontmatter, splitInlineArray)
     |
     v
state.ts  (uses frontmatter.ts extractFrontmatter, plus internal helpers)
     |
     v
phase.ts  (uses shared normalizePhaseName, comparePhaseNum, phaseTokenMatches)
     |
     v
roadmap.ts  (uses phase.ts helpers for disk correlation)
progress.ts (uses phase.ts helpers for disk scanning + commands.cjs determinePhaseStatus)
config.ts   (standalone - reads raw config.json)
```

**Recommended shared helpers file:** Create `sdk/src/query/helpers.ts` for cross-cutting utilities:
- `escapeRegex(s: string): string`
- `normalizePhaseName(phase: string): string`
- `comparePhaseNum(a: string, b: string): number`
- `phaseTokenMatches(dirName: string, normalized: string): string`
- `toPosixPath(p: string): string`
- `planningPaths(projectDir: string): PlanningPaths` (path builder)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `state.load` command name maps to `state json` in gsd-tools.cjs (success criteria says "state.load returns same as state json") | CJS Functions Inventory | Handler registers under wrong name; CLI routing breaks |
| A2 | Phase 10 only needs JSON output format for progress (not table/bar) | QUERY-05 | Missing format support if agents request table/bar format |
| A3 | `getMilestoneInfo()` and `getMilestonePhaseFilter()` from core.cjs are needed by state.ts and progress.ts | Dependency Graph | If these are complex, they add scope; if simple, they're just helper ports |

## Open Questions (RESOLVED)

1. **Command naming convention: dots vs dashes**
   - What we know: Success criteria uses `state.load`, `config.get`, `phase.find`, `roadmap.analyze`, `frontmatter.get` (dot notation). CJS uses `state json`, `config-get`, `find-phase`, `roadmap analyze`, `frontmatter get` (mixed).
   - What's unclear: Should SDK register both names (dot and legacy) for backwards compatibility?
   - RESOLVED: Register under the dot-notation names from success criteria. The registry fallback will still handle legacy names via gsd-tools.cjs bridge until Phase 14 migrates call sites.

2. **getMilestoneInfo scope**
   - What we know: `buildStateFrontmatter`, `cmdProgressRender`, and `cmdRoadmapAnalyze` all call `getMilestoneInfo(cwd)` to get version/name.
   - What's unclear: How complex is this function? It reads STATE.md frontmatter and ROADMAP.md headers.
   - RESOLVED: Port it as a shared helper. It's a read-only function that fits this phase.

## Project Constraints (from CLAUDE.md)

- **No co-author tags** on commits
- **Backwards compatibility**: All existing gsd-tools.cjs commands must continue working (registry fallback handles this)
- **Naming**: Use `gsd-` prefix for agents, `/gsd:` prefix for commands
- **Style**: Follow GSD-STYLE.md commit format
- **Architecture**: Follow existing GSD patterns (one-file-per-domain in sdk/src/query/)
- **TypeScript strict mode**, ES2022 target, ESM-only with `.js` extensions
- **2-space indentation**, camelCase functions, PascalCase types
- **Error classes** extend Error with `name` property
- **Vitest** for testing (unit + integration projects)

## Sources

### Primary (HIGH confidence)
- `sdk/src/query/utils.ts` - QueryResult/QueryHandler types, established handler pattern
- `sdk/src/query/registry.ts` - QueryRegistry with fallback, extractField
- `sdk/src/query/index.ts` - createRegistry factory pattern
- `sdk/src/config.ts` - Existing loadConfig with GSDConfig interface
- `sdk/src/errors.ts` - GSDError, ErrorClassification
- `sdk/src/golden/capture.ts` - Golden file capture utility
- `get-shit-done/bin/lib/state.cjs` - STATE.md operations (1,353 lines)
- `get-shit-done/bin/lib/core.cjs` - Config, phase finding, roadmap helpers (1,533 lines)
- `get-shit-done/bin/lib/commands.cjs` - Progress rendering, resolve-model (1,013 lines)
- `get-shit-done/bin/lib/frontmatter.cjs` - Frontmatter YAML parser (381 lines)
- `get-shit-done/bin/lib/roadmap.cjs` - Roadmap analysis (353 lines)
- `get-shit-done/bin/lib/phase.cjs` - Phase finding, plan indexing (931 lines)
- `get-shit-done/bin/gsd-tools.cjs` - Command routing/dispatch
- `sdk/vitest.config.ts` - Test configuration

### Secondary (MEDIUM confidence)
None needed -- all research based on direct codebase inspection.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - uses only existing project dependencies
- Architecture: HIGH - follows established Phase 9 patterns exactly
- Pitfalls: HIGH - identified from direct CJS source code analysis and known JavaScript regex gotchas

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable internal codebase, no external dependencies)
