# Phase 11: State Mutations - Research

**Researched:** 2026-04-08
**Domain:** SDK TypeScript migration of state-mutating .planning/ operations
**Confidence:** HIGH

## Summary

Phase 11 ports all write/mutation operations from gsd-tools.cjs CJS modules (state.cjs, frontmatter.cjs, config.cjs, commands.cjs, template.cjs) into native TypeScript SDK handlers. Phase 10 built the read-only foundation (15 query handlers) -- this phase adds the write-side counterparts. The mutation scope covers six requirement areas: STATE.md field updates (MUTATE-01), frontmatter writing (MUTATE-02), config.json writes (MUTATE-03), git commit creation (MUTATE-04), template filling (MUTATE-05), and typed event emission on every mutation (MUTATE-06).

The key technical challenge is atomicity. STATE.md mutations in gsd-tools.cjs use a lockfile-based read-modify-write pattern (`acquireStateLock`/`releaseStateLock`) with frontmatter synchronization (`syncStateFrontmatter`) on every write. This pattern prevents lost updates when parallel agents modify STATE.md concurrently. The SDK port must preserve this atomicity guarantee while using async/await instead of synchronous fs operations.

The event emission requirement (MUTATE-06) is cross-cutting: every mutation handler must emit a typed `GSDEvent` after successful writes. The existing `GSDEventType` enum needs new mutation-specific event types (e.g., `StateMutation`, `ConfigMutation`, `FrontmatterMutation`, `GitCommit`, `TemplateFill`). The `GSDEventStream.emitEvent()` infrastructure already exists -- mutation handlers just need to accept an optional event stream and emit after writes.

**Primary recommendation:** Create new mutation handler modules under `sdk/src/query/` following the established one-file-per-domain pattern. Add a `MutationHandler` type signature that extends `QueryHandler` with an optional `GSDEventStream` parameter for event emission. Register all mutation handlers in `createRegistry()` alongside existing query handlers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (pure infrastructure phase).

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUTATE-01 | SDK can update STATE.md fields atomically (state update, state patch, state begin-phase, state advance-plan) | Ports `cmdStateUpdate` (single field), `cmdStatePatch` (batch), `cmdStateBeginPhase` (multi-field phase start), `cmdStateAdvancePlan` (plan counter increment), `cmdStateRecordMetric`, `cmdStateUpdateProgress`, `cmdStateAddDecision`, `cmdStateAddBlocker`, `cmdStateResolveBlocker`, `cmdStateRecordSession` from state.cjs. Requires lockfile atomicity, frontmatter sync, `stateReplaceField`/`stateReplaceFieldWithFallback` helpers, and `updateCurrentPositionFields`. |
| MUTATE-02 | SDK can write YAML frontmatter to .planning artifacts (frontmatter set, merge, validate) | Ports `cmdFrontmatterSet` (single field), `cmdFrontmatterMerge` (JSON merge), `cmdFrontmatterValidate` (schema check) from frontmatter.cjs. Uses existing `extractFrontmatter`, needs `reconstructFrontmatter` and `spliceFrontmatter` ported to SDK. |
| MUTATE-03 | SDK can write config.json values with schema validation (config-set, config-set-model-profile, config-new-project) | Ports `cmdConfigSet` (with `VALID_CONFIG_KEYS` + `isValidConfigKey` validation), `cmdConfigSetModelProfile` (profile validation + agent map), `cmdConfigNewProject` (idempotent creation with user choices + defaults). |
| MUTATE-04 | SDK can create git commits for planning artifacts (commit, check-commit) | Ports `cmdCommit` (stage + commit with branching strategy, commit_docs check, gitignore check, amend, no-verify) and `cmdCheckCommit` (pre-commit validation) from commands.cjs. Requires `execGit` helper for subprocess git calls. |
| MUTATE-05 | SDK can fill templates for summary, plan, and verification artifacts (template fill) | Ports `cmdTemplateFill` (summary/plan/verification templates with frontmatter generation) and `cmdTemplateSelect` (heuristic template selection) from template.cjs. Uses `reconstructFrontmatter` and `normalizeMd`. |
| MUTATE-06 | SDK emits typed events through existing event stream on every state mutation | New capability: add mutation event types to `GSDEventType` enum, create event interfaces, emit events from each mutation handler after successful writes. Uses existing `GSDEventStream.emitEvent()` infrastructure. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | built-in | Async file I/O for mutations | Standard Node.js async pattern; replaces CJS `fs.readFileSync`/`fs.writeFileSync` [VERIFIED: codebase] |
| Node.js `child_process` | built-in | Git command execution for commits | Required for `git add`, `git commit`, `git rev-parse` subprocess calls [VERIFIED: codebase] |
| Vitest | 3.1.1 (sdk) | Unit testing for mutation handlers | Already configured in sdk/vitest.config.ts with unit/integration projects [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sdk/src/errors.ts` | existing | GSDError with ErrorClassification | Validation errors (missing args, invalid keys, schema violations) [VERIFIED: codebase] |
| `sdk/src/event-stream.ts` | existing | GSDEventStream + GSDEventType | Event emission on mutations (MUTATE-06) [VERIFIED: codebase] |
| `sdk/src/query/helpers.ts` | existing | planningPaths, escapeRegex, stateExtractField | Shared utilities for path resolution and field extraction [VERIFIED: codebase] |
| `sdk/src/query/frontmatter.ts` | existing | extractFrontmatter, stripFrontmatter | Read-side frontmatter parsing; mutation handlers extend with write [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| File-based lockfile | `proper-lockfile` npm package | External dependency vs. simple O_EXCL implementation; CJS uses lockfile -- keep same pattern for parity |
| YAML library (js-yaml) | Hand-rolled `reconstructFrontmatter` | CJS uses hand-rolled serialization -- port that for exact output parity; adding js-yaml would change output format |
| `simple-git` npm package | Direct `child_process.execSync` | CJS uses raw git commands; keep same approach for output compatibility |

**No new dependencies needed.** All mutation operations use Node.js built-ins and extend existing SDK modules.

## Architecture Patterns

### Recommended Project Structure
```
sdk/src/query/
  state-mutation.ts       # STATE.md write handlers (MUTATE-01)
  state-mutation.test.ts  # Unit tests
  frontmatter-mutation.ts # Frontmatter write handlers (MUTATE-02)
  frontmatter-mutation.test.ts
  config-mutation.ts      # Config write handlers (MUTATE-03)
  config-mutation.test.ts
  commit.ts               # Git commit handlers (MUTATE-04)
  commit.test.ts
  template.ts             # Template fill handlers (MUTATE-05)
  template.test.ts
sdk/src/
  types.ts                # Extended GSDEventType enum (MUTATE-06)
  event-stream.ts         # No changes needed (emitEvent already works)
```

### Pattern 1: Mutation Handler Signature
**What:** Mutation handlers follow the same `QueryHandler` signature as read handlers (`(args, projectDir) => Promise<QueryResult>`). Event emission is handled via a shared module-level emitter function, not baked into the handler signature.
**When to use:** All mutation handlers.
**Why:** The registry dispatches all commands uniformly. Mutation event emission is an orthogonal concern that can be added via a wrapper or post-dispatch hook rather than changing the `QueryHandler` type. This preserves backwards compatibility with the existing registry.
**Example:**
```typescript
// Source: Derived from existing codebase patterns [VERIFIED: codebase]
import type { QueryHandler } from './utils.js';
import { GSDError, ErrorClassification } from '../errors.js';

export const stateUpdate: QueryHandler = async (args, projectDir) => {
  const field = args[0];
  const value = args[1];
  if (!field || value === undefined) {
    throw new GSDError('field and value required for state update', ErrorClassification.Validation);
  }
  // ... read-modify-write with lock ...
  return { data: { updated: true } };
};
```

### Pattern 2: Lockfile-Based Atomicity for STATE.md
**What:** Use O_EXCL file creation for mutual exclusion during STATE.md read-modify-write cycles.
**When to use:** All STATE.md mutations that read+modify+write.
**Why:** CJS uses this exact pattern (`acquireStateLock`/`releaseStateLock`). Prevents lost updates when parallel agents modify STATE.md concurrently. The SDK version should use async equivalents (`fs.open` with O_CREAT|O_EXCL flags).
**Example:**
```typescript
// Source: Port of state.cjs lines 798-836 [VERIFIED: codebase]
import { open, unlink, stat, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';

async function acquireStateLock(statePath: string): Promise<string> {
  const lockPath = statePath + '.lock';
  const maxRetries = 10;
  const retryDelay = 200;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.write(String(process.pid));
      await fd.close();
      return lockPath;
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        try {
          const s = await stat(lockPath);
          if (Date.now() - s.mtimeMs > 10000) {
            await unlink(lockPath);
            continue;
          }
        } catch { /* lock released between check */ }
        if (i === maxRetries - 1) {
          try { await unlink(lockPath); } catch {}
          return lockPath;
        }
        await new Promise(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
      } else {
        throw err;
      }
    }
  }
  return lockPath; // fallback
}

async function releaseStateLock(lockPath: string): Promise<void> {
  try { await unlink(lockPath); } catch { /* already gone */ }
}
```

### Pattern 3: Frontmatter Sync on STATE.md Write
**What:** Every STATE.md write must rebuild YAML frontmatter from body content + disk state before writing. This ensures frontmatter always reflects ground truth.
**When to use:** All STATE.md mutations (not frontmatter mutations to other files).
**Why:** CJS `writeStateMd` calls `syncStateFrontmatter` which calls `buildStateFrontmatter` (already ported in `stateLoad`). The SDK already has this logic in `state.ts` -- extract it as a shared function.
**Example:**
```typescript
// Source: Port of state.cjs lines 776-852 [VERIFIED: codebase]
async function writeStateMd(statePath: string, content: string, projectDir: string): Promise<void> {
  const synced = await syncStateFrontmatter(content, projectDir);
  const lockPath = await acquireStateLock(statePath);
  try {
    await writeFile(statePath, normalizeMd(synced), 'utf-8');
  } finally {
    await releaseStateLock(lockPath);
  }
}
```

### Pattern 4: Event Emission Post-Mutation
**What:** After a successful mutation, emit a typed event through the event stream.
**When to use:** All mutation handlers (MUTATE-06).
**Why:** WebSocket listeners need to observe state changes in real time. Events are fire-and-forget -- mutation success is not dependent on event delivery.
**Example:**
```typescript
// Source: Derived from GSDEventStream pattern [VERIFIED: codebase]
// Add to GSDEventType enum in types.ts:
// StateMutation = 'state_mutation',
// ConfigMutation = 'config_mutation',
// FrontmatterMutation = 'frontmatter_mutation',
// GitCommit = 'git_commit',
// TemplateFill = 'template_fill',
```

### Anti-Patterns to Avoid
- **Synchronous fs in async handlers:** CJS uses `readFileSync`/`writeFileSync`. SDK MUST use `readFile`/`writeFile` from `fs/promises`. The lockfile acquisition can use the async `open` API with O_EXCL flags. [VERIFIED: codebase convention]
- **Skipping frontmatter sync:** Every STATE.md write must go through `writeStateMd` (which calls `syncStateFrontmatter`). Direct `writeFile` to STATE.md would cause frontmatter drift. [VERIFIED: state.cjs lines 838-852]
- **Mutating registry type:** Do NOT change `QueryHandler` signature to accommodate events. Keep the handler interface pure; event emission should be a separate concern (wrapper, post-hook, or module-level emitter). [ASSUMED]
- **Regex `g` flag with `.test()` then `.replace()`:** CJS has this gotcha. The `stateReplaceField` function uses separate regex instances (no `g` flag) for `.test()` and `.replace()`, avoiding `lastIndex` persistence. Port this pattern exactly. [VERIFIED: state.cjs lines 211-223, also documented in MEMORY.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter serialization | Custom YAML stringifier | Port `reconstructFrontmatter` from frontmatter.cjs (lines 122-183) | Already handles nested objects, arrays, inline arrays, quote escaping -- 60 lines of battle-tested code |
| YAML frontmatter splicing | String concatenation with `---` markers | Port `spliceFrontmatter` from frontmatter.cjs (lines 186-193) | Handles existing frontmatter replacement vs. prepending correctly |
| STATE.md field replacement | Raw string.replace() | Port `stateReplaceField` + `stateReplaceFieldWithFallback` from state.cjs (lines 211-245) | Handles bold/plain format variants, case-insensitive matching, fallback field names, missing field logging |
| Markdown normalization | Custom line-ending fixer | Port `normalizeMd` from core.cjs (lines 434-490) | Handles CRLF normalization, trailing whitespace, code fence preservation, blank line collapsing |
| Config key validation | Custom allowlist | Port `VALID_CONFIG_KEYS` + `isValidConfigKey` from config.cjs (lines 14-53) | Includes dynamic patterns (`agent_skills.<type>`, `features.<name>`), suggested corrections for typos |
| Git command execution | Raw `child_process.exec` | Port `execGit` helper pattern from commands.cjs | Handles cwd, error codes, stdout/stderr separation |

**Key insight:** Every mutation function in gsd-tools.cjs is a well-defined behavioral specification. The SDK port should match behavior exactly (verified by golden tests) rather than reimagining the logic.

## CJS Functions Inventory

### state.cjs (1,353 lines) -- Mutation Functions to Port

| CJS Function | Line | Command Name | SDK Handler | Complexity |
|-------------|------|-------------|-------------|------------|
| `cmdStateUpdate` | 173 | `state update` | `stateUpdate` | LOW - single field replace |
| `cmdStatePatch` | 132 | `state patch` | `statePatch` | LOW - batch field replace with validation |
| `cmdStateBeginPhase` | 909 | `state begin-phase` | `stateBeginPhase` | HIGH - 10+ field updates + Current Position section |
| `cmdStateAdvancePlan` | 273 | `state advance-plan` | `stateAdvancePlan` | MEDIUM - compound format parsing + phase completion detection |
| `cmdStateRecordMetric` | 329 | `state record-metric` | `stateRecordMetric` | MEDIUM - table row append in Performance Metrics |
| `cmdStateUpdateProgress` | 363 | `state update-progress` | `stateUpdateProgress` | MEDIUM - disk scanning + progress bar generation |
| `cmdStateAddDecision` | 408 | `state add-decision` | `stateAddDecision` | LOW - section append with placeholder removal |
| `cmdStateAddBlocker` | 446 | `state add-blocker` | `stateAddBlocker` | LOW - section append |
| `cmdStateResolveBlocker` | 479 | `state resolve-blocker` | `stateResolveBlocker` | LOW - line removal from section |
| `cmdStateRecordSession` | 511 | `state record-session` | `stateRecordSession` | LOW - session field updates |
| Helper: `stateReplaceField` | 211 | (internal) | shared helper | LOW |
| Helper: `stateReplaceFieldWithFallback` | 231 | (internal) | shared helper | LOW |
| Helper: `updateCurrentPositionFields` | 253 | (internal) | shared helper | LOW |
| Helper: `writeStateMd` | 844 | (internal) | shared helper | MEDIUM - lock + sync |
| Helper: `readModifyWriteStateMd` | 860 | (internal) | shared helper | MEDIUM - atomic RMW |
| Helper: `syncStateFrontmatter` | 776 | (internal) | shared helper | MEDIUM - frontmatter rebuild |
| Helper: `acquireStateLock` | 798 | (internal) | shared helper | LOW |
| Helper: `releaseStateLock` | 834 | (internal) | shared helper | LOW |

### frontmatter.cjs -- Mutation Functions to Port

| CJS Function | Line | Command Name | SDK Handler | Complexity |
|-------------|------|-------------|-------------|------------|
| `cmdFrontmatterSet` | 328 | `frontmatter set` | `frontmatterSet` | LOW - extract + modify + splice |
| `cmdFrontmatterMerge` | 344 | `frontmatter merge` | `frontmatterMerge` | LOW - extract + Object.assign + splice |
| `cmdFrontmatterValidate` | 358 | `frontmatter validate` | `frontmatterValidate` | LOW - schema check against required fields |
| Helper: `reconstructFrontmatter` | 122 | (internal) | shared export | MEDIUM - YAML serialization with nesting |
| Helper: `spliceFrontmatter` | 186 | (internal) | shared export | LOW - content replacement |
| Constant: `FRONTMATTER_SCHEMAS` | varies | (internal) | shared constant | LOW - plan/summary/verification schemas |

### config.cjs -- Mutation Functions to Port

| CJS Function | Line | Command Name | SDK Handler | Complexity |
|-------------|------|-------------|-------------|------------|
| `cmdConfigSet` | 333 | `config-set` | `configSet` | MEDIUM - key validation + value parsing + dot-notation write |
| `cmdConfigSetModelProfile` | 403 | `config-set-model-profile` | `configSetModelProfile` | MEDIUM - profile validation + agent map |
| `cmdConfigNewProject` | 196 | `config-new-project` | `configNewProject` | HIGH - defaults merging + API key detection |
| `cmdConfigEnsureSection` | 275 | `config-ensure-section` | `configEnsureSection` | LOW - idempotent creation |
| Helper: `setConfigValue` | 291 | (internal) | shared helper | LOW - dot-notation write |
| Helper: `isValidConfigKey` | 44 | (internal) | shared helper | LOW |
| Helper: `buildNewProjectConfig` | 88 | (internal) | shared helper | MEDIUM - defaults + env detection |
| Constant: `VALID_CONFIG_KEYS` | 14 | (internal) | shared constant | LOW |

### commands.cjs -- Commit Functions to Port

| CJS Function | Line | Command Name | SDK Handler | Complexity |
|-------------|------|-------------|-------------|------------|
| `cmdCommit` | 250 | `commit` | `commit` | HIGH - branching strategy, commit_docs check, gitignore check, stage + commit |
| `cmdCheckCommit` | 968 | `check-commit` | `checkCommit` | LOW - config check + staged file check |

### template.cjs -- Template Functions to Port

| CJS Function | Line | Command Name | SDK Handler | Complexity |
|-------------|------|-------------|-------------|------------|
| `cmdTemplateFill` | 56 | `template fill` | `templateFill` | MEDIUM - 3 template types with frontmatter generation |
| `cmdTemplateSelect` | 10 | `template select` | `templateSelect` | LOW - heuristic selection |

## Common Pitfalls

### Pitfall 1: Regex `lastIndex` Persistence
**What goes wrong:** Using a regex with `g` flag in `.test()` then `.replace()` on the same content causes `.replace()` to start from the wrong position because `.test()` advances `lastIndex`.
**Why it happens:** JavaScript regex objects with `g` flag maintain state across calls.
**How to avoid:** Create separate regex instances for `.test()` and `.replace()`, or avoid `g` flag when not iterating. The CJS `stateReplaceField` already does this correctly -- port exactly.
**Warning signs:** Intermittent field replacement failures where the same code works sometimes.

### Pitfall 2: Lost Updates from Non-Atomic Read-Modify-Write
**What goes wrong:** Two parallel agents read STATE.md simultaneously, both modify, second write clobbers first write's changes.
**Why it happens:** No locking between read and write.
**How to avoid:** Always use `readModifyWriteStateMd` (holds lock across entire cycle) for multi-field mutations. Single-field `stateUpdate` can use read-then-write-with-lock since it's a single mutation.
**Warning signs:** STATE.md fields reverting to previous values during parallel execution.

### Pitfall 3: Async Lockfile Race Conditions
**What goes wrong:** CJS lockfile uses synchronous fs which is naturally atomic. Async `fs.open` with O_EXCL is still atomic at the OS level, but the retry loop needs careful await handling.
**Why it happens:** The `open(path, O_CREAT|O_EXCL)` call is atomic even async -- the OS guarantees exclusivity. But the retry delay must properly await.
**How to avoid:** Use `await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY)` -- the O_EXCL flag ensures atomicity regardless of sync/async. Port the stale lock cleanup (10s timeout) and jitter exactly.
**Warning signs:** Lock files persisting after crashes (no cleanup).

### Pitfall 4: Frontmatter Drift on Direct STATE.md Writes
**What goes wrong:** Writing STATE.md body without rebuilding frontmatter causes stale progress counters, status, and milestone fields.
**Why it happens:** STATE.md frontmatter is derived from body + disk state. If you write body changes without `syncStateFrontmatter`, the frontmatter diverges.
**How to avoid:** ALL STATE.md writes go through `writeStateMd` which calls `syncStateFrontmatter`. Never call `writeFile(statePath, ...)` directly.
**Warning signs:** `state.load` returns different progress than expected after a mutation.

### Pitfall 5: Config Value Type Coercion
**What goes wrong:** Setting config values like `"true"`, `"false"`, `"3"` as strings instead of their native types.
**Why it happens:** CLI args are always strings; CJS has explicit coercion logic.
**How to avoid:** Port the value parsing logic from `cmdConfigSet` exactly: `"true"` -> `true`, `"false"` -> `false`, numeric strings -> numbers, JSON strings -> parsed objects.
**Warning signs:** Config values like `commit_docs: "false"` (truthy string!) instead of `commit_docs: false`.

### Pitfall 6: `normalizeMd` Must Be Ported for Write Operations
**What goes wrong:** CJS uses `normalizeMd()` to clean up markdown before every file write. Skipping it produces inconsistent line endings, excess blank lines, and trailing whitespace.
**Why it happens:** `normalizeMd` handles CRLF normalization, trailing whitespace stripping, blank line collapsing (except in code fences), and terminal newline insertion.
**How to avoid:** Port `normalizeMd` from core.cjs (lines 434-490) and use it in `writeStateMd`, `spliceFrontmatter` calls, and template fills.
**Warning signs:** Git diffs showing whitespace-only changes; inconsistent line endings across files.

## Code Examples

### stateReplaceField -- Core Helper for All STATE.md Mutations
```typescript
// Source: Port of state.cjs lines 211-223 [VERIFIED: codebase]
function stateReplaceField(content: string, fieldName: string, newValue: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(boldPattern, (_match: string, prefix: string) => `${prefix}${newValue}`);
  }
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(plainPattern, (_match: string, prefix: string) => `${prefix}${newValue}`);
  }
  return null;
}
```

### reconstructFrontmatter -- YAML Serialization
```typescript
// Source: Port of frontmatter.cjs lines 122-183 [VERIFIED: codebase]
export function reconstructFrontmatter(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.every(v => typeof v === 'string') && value.length <= 3 && value.join(', ').length < 60) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          const needsQuote = typeof item === 'string' && (item.includes(':') || item.includes('#'));
          lines.push(`  - ${needsQuote ? `"${item}"` : item}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      // ... nested object serialization (2 levels deep) ...
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n');
}
```

### spliceFrontmatter -- Replace or Prepend Frontmatter
```typescript
// Source: Port of frontmatter.cjs lines 186-193 [VERIFIED: codebase]
export function spliceFrontmatter(content: string, newObj: Record<string, unknown>): string {
  const yamlStr = reconstructFrontmatter(newObj);
  const match = content.match(/^---\r?\n[\s\S]+?\r?\n---/);
  if (match) {
    return `---\n${yamlStr}\n---` + content.slice(match[0].length);
  }
  return `---\n${yamlStr}\n---\n\n` + content;
}
```

### Config Value Parsing
```typescript
// Source: Port of config.cjs lines 344-351 [VERIFIED: codebase]
function parseConfigValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!isNaN(Number(value)) && value !== '') return Number(value);
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}
```

### Git Command Execution
```typescript
// Source: Derived from commands.cjs execGit pattern [VERIFIED: codebase]
import { execSync } from 'node:child_process';

function execGit(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`git ${args.join(' ')}`, { 
      cwd, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      const execErr = err as { status: number; stdout?: string; stderr?: string };
      return { 
        exitCode: execErr.status || 1, 
        stdout: String(execErr.stdout || '').trim(), 
        stderr: String(execErr.stderr || '').trim() 
      };
    }
    return { exitCode: 1, stdout: '', stderr: String(err) };
  }
}
```

## Shared Helpers to Extract

Several internal helpers from Phase 10 state.ts (read-only) are needed by Phase 11 mutations. These should be extracted to shared locations:

| Helper | Currently In | Needed By | Action |
|--------|-------------|-----------|--------|
| `buildStateFrontmatter` | `sdk/src/query/state.ts` (private) | `syncStateFrontmatter` in state-mutation.ts | Export from state.ts |
| `getMilestonePhaseFilter` | `sdk/src/query/state.ts` (private) | `stateUpdateProgress` in state-mutation.ts | Export from state.ts |
| `stateExtractField` | `sdk/src/query/helpers.ts` (exported) | state-mutation.ts | Already available |
| `escapeRegex` | `sdk/src/query/helpers.ts` (exported) | state-mutation.ts | Already available |
| `planningPaths` | `sdk/src/query/helpers.ts` (exported) | All mutation modules | Already available |
| `normalizePhaseName` | `sdk/src/query/helpers.ts` (exported) | template.ts, state-mutation.ts | Already available |

## Event Types for MUTATE-06

New event types to add to `GSDEventType` enum in `types.ts`:

```typescript
// Source: New design for MUTATE-06 [ASSUMED]
enum GSDEventType {
  // ... existing types ...
  StateMutation = 'state_mutation',
  ConfigMutation = 'config_mutation',
  FrontmatterMutation = 'frontmatter_mutation',
  GitCommit = 'git_commit',
  TemplateFill = 'template_fill',
}

// Event interfaces
interface GSDStateMutationEvent extends GSDEventBase {
  type: GSDEventType.StateMutation;
  command: string;  // 'state.update', 'state.begin-phase', etc.
  fields: string[]; // which fields were updated
  success: boolean;
}

interface GSDConfigMutationEvent extends GSDEventBase {
  type: GSDEventType.ConfigMutation;
  command: string;
  key: string;
  success: boolean;
}

interface GSDFrontmatterMutationEvent extends GSDEventBase {
  type: GSDEventType.FrontmatterMutation;
  command: string;
  file: string;
  fields: string[];
  success: boolean;
}

interface GSDGitCommitEvent extends GSDEventBase {
  type: GSDEventType.GitCommit;
  hash: string | null;
  committed: boolean;
  reason: string;
}

interface GSDTemplateFillEvent extends GSDEventBase {
  type: GSDEventType.TemplateFill;
  templateType: string;
  path: string;
  created: boolean;
}
```

**Event emission approach:** Since `QueryHandler` takes `(args, projectDir)` and the registry dispatches uniformly, mutation event emission should be handled through one of:
1. A module-level event emitter set via `setEventStream(stream)` -- mutation modules import and call it
2. A wrapper in the registry that emits events after successful dispatch of mutation commands
3. A post-dispatch hook in `QueryRegistry.dispatch()` for known mutation commands

Option 2 (registry wrapper) is recommended as it keeps handlers pure and centralizes event emission logic. [ASSUMED]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.1 (sdk workspace) |
| Config file | `sdk/vitest.config.ts` |
| Quick run command | `cd sdk && npx vitest run --project unit` |
| Full suite command | `cd sdk && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MUTATE-01 | STATE.md field updates, begin-phase, advance-plan | unit | `cd sdk && npx vitest run src/query/state-mutation.test.ts -x` | Wave 0 |
| MUTATE-02 | frontmatter set/merge/validate round-trip | unit | `cd sdk && npx vitest run src/query/frontmatter-mutation.test.ts -x` | Wave 0 |
| MUTATE-03 | config-set with schema validation, config-new-project | unit | `cd sdk && npx vitest run src/query/config-mutation.test.ts -x` | Wave 0 |
| MUTATE-04 | git commit creation, check-commit | unit | `cd sdk && npx vitest run src/query/commit.test.ts -x` | Wave 0 |
| MUTATE-05 | template fill for summary/plan/verification | unit | `cd sdk && npx vitest run src/query/template.test.ts -x` | Wave 0 |
| MUTATE-06 | typed event emission on all mutations | unit | Part of each mutation test file + dedicated event test | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd sdk && npx vitest run --project unit`
- **Per wave merge:** `cd sdk && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `sdk/src/query/state-mutation.test.ts` -- covers MUTATE-01
- [ ] `sdk/src/query/frontmatter-mutation.test.ts` -- covers MUTATE-02
- [ ] `sdk/src/query/config-mutation.test.ts` -- covers MUTATE-03
- [ ] `sdk/src/query/commit.test.ts` -- covers MUTATE-04
- [ ] `sdk/src/query/template.test.ts` -- covers MUTATE-05
- [ ] No framework install needed -- Vitest already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | validateFieldName (regex injection prevention), isValidConfigKey (allowlist), null byte rejection in file paths |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Regex injection via field names | Tampering | `validateFieldName` rejects special chars (port from security.cjs) [VERIFIED: security.cjs lines 383-394] |
| Path traversal via frontmatter file path | Tampering | Null byte rejection + isAbsolute check (already in frontmatterGet) [VERIFIED: frontmatter.ts] |
| Prompt injection via commit messages | Tampering | `sanitizeForPrompt` strips invisible chars and injection markers (port from security.cjs) [VERIFIED: commands.cjs line 259] |
| Config key injection | Tampering | `VALID_CONFIG_KEYS` allowlist + `isValidConfigKey` validation [VERIFIED: config.cjs lines 14-53] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Event emission should use registry wrapper pattern rather than changing QueryHandler signature | Event Types for MUTATE-06 | LOW -- alternative approaches (module-level emitter, handler parameter) achieve same result with minor refactoring |
| A2 | New event type names (StateMutation, ConfigMutation, etc.) | Event Types for MUTATE-06 | LOW -- naming is flexible; behavior is what matters |
| A3 | Mutation handlers should be in separate files from read handlers (state-mutation.ts vs state.ts) | Architecture Patterns | LOW -- could be combined in same file but separation is cleaner for code review |

## Open Questions

1. **Event stream injection into mutation handlers**
   - What we know: `QueryHandler` signature is `(args, projectDir) => Promise<QueryResult>`. Event stream is a separate concern.
   - What's unclear: Best mechanism to pass event stream to mutation handlers without changing the handler type.
   - Recommendation: Use registry-level wrapper that emits events post-dispatch for mutation commands. Simple, centralized, no handler signature change.

2. **Deduplication of `getMilestoneInfo`/`extractCurrentMilestone`**
   - What we know: These exist in both `state.ts` (private) and `roadmap.ts` (exported). Phase 10 summary noted dedup recommended.
   - What's unclear: Whether Phase 11 should address this or defer.
   - Recommendation: Defer dedup -- Phase 11 can import from `roadmap.ts` (which exports them). Not in scope for MUTATE requirements.

3. **`normalizeMd` location**
   - What we know: Currently only in core.cjs (60 lines). Needed by all mutation modules that write markdown.
   - What's unclear: Whether to put it in `helpers.ts` or a new `markdown.ts` file.
   - Recommendation: Add to `helpers.ts` since it's a shared utility used by multiple mutation modules. Consistent with existing pattern of helpers.ts containing cross-cutting utilities.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/bin/lib/state.cjs` (1,353 lines) -- all STATE.md mutation functions [VERIFIED: codebase]
- `get-shit-done/bin/lib/frontmatter.cjs` (382 lines) -- frontmatter mutation functions [VERIFIED: codebase]
- `get-shit-done/bin/lib/config.cjs` (~470 lines) -- config mutation functions [VERIFIED: codebase]
- `get-shit-done/bin/lib/commands.cjs` (~1,014 lines) -- commit and check-commit functions [VERIFIED: codebase]
- `get-shit-done/bin/lib/template.cjs` (223 lines) -- template fill/select functions [VERIFIED: codebase]
- `get-shit-done/bin/lib/security.cjs` -- validateFieldName, sanitizeForPrompt [VERIFIED: codebase]
- `sdk/src/query/` -- Phase 10 read handlers (registry, helpers, state, frontmatter, config-query) [VERIFIED: codebase]
- `sdk/src/types.ts` -- GSDEventType enum, event interfaces [VERIFIED: codebase]
- `sdk/src/event-stream.ts` -- GSDEventStream.emitEvent() [VERIFIED: codebase]
- `sdk/src/errors.ts` -- GSDError, ErrorClassification [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Phase 10 RESEARCH.md and SUMMARY.md files -- established patterns and decisions [VERIFIED: codebase]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing SDK infrastructure
- Architecture: HIGH -- follows established patterns from Phase 9/10 with clear CJS behavioral specifications
- Pitfalls: HIGH -- documented from actual CJS bug fixes (regex lastIndex, lost updates, frontmatter drift)
- Event emission design: MEDIUM -- new pattern not yet validated in codebase

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain -- internal codebase migration)
