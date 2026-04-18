# Phase 12: Verification Suite - Research

**Researched:** 2026-04-08
**Domain:** Plan verification, phase completeness checking, artifact validation, consistency detection, health checks with repair
**Confidence:** HIGH

## Summary

Phase 12 ports all verification and validation logic from `verify.cjs` (1,032 lines, 11 exported functions) into native TypeScript handlers registered in the SDK query registry. The CJS module contains six primary command groups: plan-structure validation, phase-completeness checking, artifact existence verification, key-link integration point checking, cross-file consistency detection (ROADMAP/STATE/disk), and health checks with optional repair mode.

The existing SDK already has all prerequisite infrastructure: the query registry pattern (Phase 9), file reading and frontmatter parsing (Phase 10), state/config mutation with lockfile atomicity (Phase 11), and shared helpers (planningPaths, normalizePhaseName, escapeRegex, extractPhaseToken). The `parseMustHavesBlock` function from `frontmatter.cjs` must be ported to TypeScript as a new utility since it is used by both `verify artifacts` and `verify key-links` but has no SDK equivalent yet.

**Primary recommendation:** Create a new `sdk/src/query/verify.ts` module (plus `verify.test.ts`) containing all verification handlers, a `sdk/src/query/validate.ts` module (plus `validate.test.ts`) for consistency and health commands, and port `parseMustHavesBlock` into the existing frontmatter module. Register all handlers in `createRegistry()`. Follow the established TDD pattern from Phases 10-11.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-01 | SDK can validate plan structure against schema (verify plan-structure) | Port `cmdVerifyPlanStructure` — checks frontmatter fields, task XML elements, wave/depends_on consistency, autonomous/checkpoint consistency |
| VERIFY-02 | SDK can check phase completeness and artifact presence (verify phase-completeness) | Port `cmdVerifyPhaseCompleteness` — matches PLAN.md files to SUMMARY.md files, detects incomplete plans and orphan summaries |
| VERIFY-03 | SDK can verify artifact file existence and content (verify artifacts) | Port `cmdVerifyArtifacts` — reads `must_haves.artifacts` from frontmatter, checks file existence, min_lines, contains, exports |
| VERIFY-04 | SDK can verify key-link integration points (verify key-links) | Port `cmdVerifyKeyLinks` — reads `must_haves.key_links` from frontmatter, checks source/target files, pattern matching |
| VERIFY-05 | SDK can validate consistency between STATE.md, ROADMAP.md, and disk (validate consistency) | Port `cmdValidateConsistency` — roadmap/disk phase sync, sequential numbering, plan numbering, frontmatter completeness |
| VERIFY-06 | SDK can run health checks with optional repair mode (validate health --repair) | Port `cmdValidateHealth` — 10+ checks (planning dir, PROJECT.md, ROADMAP, STATE, config, phase naming, orphans, cross-validation), 3 repair actions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | Source language | Already configured in sdk/tsconfig.json [VERIFIED: codebase] |
| Vitest | 4.1.2 | Test runner | Root vitest.config.ts with unit/integration projects [VERIFIED: codebase] |
| node:fs/promises | N/A | Async file I/O | All SDK handlers use async readFile/readdir [VERIFIED: codebase pattern] |
| node:path | N/A | Path resolution | join, isAbsolute, resolve used throughout [VERIFIED: codebase pattern] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:os | N/A | Home directory check | Health check validates CWD is not home dir [VERIFIED: verify.cjs line 525] |
| node:child_process | N/A | Git operations | spawnSync for execGit (commit hash verification) [VERIFIED: verify.cjs] |

**No new dependencies needed.** All verification logic uses existing Node.js built-ins and SDK infrastructure.

## Architecture Patterns

### Recommended Project Structure

```
sdk/src/query/
  verify.ts              # Plan structure, phase completeness, artifacts, key-links, references, commits
  verify.test.ts         # Unit tests for verify handlers
  validate.ts            # Consistency checks, health checks with repair
  validate.test.ts       # Unit tests for validate handlers
  frontmatter.ts         # Add parseMustHavesBlock export (needed by verify)
  frontmatter.test.ts    # Add parseMustHavesBlock tests
  index.ts               # Register new handlers in createRegistry()
```

### Pattern 1: Query Handler Registration (established)
**What:** Each command is a `QueryHandler` function `(args: string[], projectDir: string) => Promise<QueryResult>` registered in `createRegistry()`.
**When to use:** All verify/validate commands.
**Example:**
```typescript
// Source: sdk/src/query/phase.ts (existing pattern)
export const verifyPlanStructure: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError('file path required', ErrorClassification.Validation);
  }
  // ... validation logic ...
  return { data: { valid, errors, warnings, task_count, tasks, frontmatter_fields } };
};
```

### Pattern 2: Error Classification (established)
**What:** Use `GSDError` with `ErrorClassification.Validation` for missing args, `ErrorClassification.Blocked` for missing phases/directories.
**When to use:** All input validation errors.

### Pattern 3: Temp Directory Tests (established)
**What:** Create temp directories with `mkdtemp`, write fixture files, run handlers, clean up.
**When to use:** All verification tests that need `.planning/` structure on disk.
**Example:**
```typescript
// Source: sdk/src/query/phase.test.ts (existing pattern)
let tmpDir: string;
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-verify-'));
  // write test fixtures
});
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
```

### Pattern 4: parseMustHavesBlock Port
**What:** Port the 3-level YAML must_haves parser from frontmatter.cjs to TypeScript.
**When to use:** Required by `verify artifacts` and `verify key-links` commands.
**Why separate from extractFrontmatter:** The must_haves block has a unique 3-level nesting structure (must_haves > artifacts/key_links > [{path, provides, ...}]) that the generic frontmatter parser handles as flat objects. The dedicated parser traverses indentation-based nesting to extract structured list items.

### Anti-Patterns to Avoid
- **Synchronous file I/O:** CJS uses `fs.readFileSync` everywhere. SDK must use `readFile` from `node:fs/promises`. [VERIFIED: all SDK handlers use async]
- **process.stderr.write for warnings:** CJS writes warnings to stderr. SDK should include warnings in the structured JSON response. [VERIFIED: SDK pattern returns `{ data: { ... warnings } }`]
- **Catching errors silently:** CJS uses many empty `catch {}` blocks. SDK should catch with specific error handling or at least propagate as structured warnings. [VERIFIED: CJS verify.cjs lines 431, 496, 516, etc.]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter parsing | Custom YAML parser | `extractFrontmatter()` from `sdk/src/query/frontmatter.ts` | Already ported and tested [VERIFIED: codebase] |
| Phase directory lookup | Manual fs.readdirSync + matching | `findPhase()` handler or `planningPaths()` helper | Already handles normalization, archived fallback [VERIFIED: phase.ts] |
| Phase name normalization | Manual string padding | `normalizePhaseName()` from helpers.ts | Handles project codes, letter suffixes, decimals [VERIFIED: helpers.ts] |
| Path comparison | Direct string equality | `phaseTokenMatches()` from helpers.ts | Handles padding, case, prefixes [VERIFIED: helpers.ts] |
| Config loading | Manual JSON.parse | Reuse pattern from `configGet` handler or direct `readFile` + `JSON.parse` | Consistent error handling [VERIFIED: config-query.ts] |
| Git operations | Manual child_process | Port `execGit` pattern (spawnSync with structured result) | Needed for commit hash verification only |

## Common Pitfalls

### Pitfall 1: Regex `g` Flag with `.test()` then `.replace()`
**What goes wrong:** The `g` flag maintains `lastIndex` state across calls. If you `.test()` then `.replace()` with the same regex, `.replace()` may skip the match.
**Why it happens:** Known JavaScript gotcha. Already documented in project memory.
**How to avoid:** Create separate regex instances for `.test()` and `.replace()`, or reset `lastIndex` between calls. [VERIFIED: Phase 11 decision log]
**Warning signs:** Intermittent test failures where patterns match sometimes but not others.

### Pitfall 2: parseMustHavesBlock Empty Parse
**What goes wrong:** The function parses YAML indentation-based nesting. Incorrect indentation detection produces 0 items from a non-empty block.
**Why it happens:** The CJS version has a specific diagnostic warning for this case (lines 288-295). It falls back to LLM-derived truths silently.
**How to avoid:** Port the diagnostic warning as a structured warning in the result. Test with real plan files from the project.
**Warning signs:** `items.length === 0` when `blockLines.length > 0`.

### Pitfall 3: Health Check Repair Side Effects
**What goes wrong:** `validate health --repair` writes files (config.json, STATE.md) and must handle missing directories, file permissions, concurrent access.
**Why it happens:** Repair mode is a mutation operation disguised as a query.
**How to avoid:** Use the lockfile atomicity pattern from Phase 11 for STATE.md writes. Create config.json atomically. Report all repair actions in the result.
**Warning signs:** Repairs succeed but file contents are corrupted.

### Pitfall 4: Cross-Platform Path Handling
**What goes wrong:** Path separators differ between Windows and POSIX. File existence checks fail on Windows when paths use forward slashes.
**Why it happens:** CJS uses `path.join()` which auto-normalizes, but the SDK uses `toPosixPath()` for output.
**How to avoid:** Use `join()` from `node:path` for file system operations, `toPosixPath()` only for output/display. [VERIFIED: helpers.ts pattern]
**Warning signs:** Tests pass on Linux CI but fail on Windows.

### Pitfall 5: Home Directory Guard in Health Check
**What goes wrong:** If CWD is the user's home directory, health check reads the wrong `.planning/` directory.
**Why it happens:** User runs command from wrong directory.
**How to avoid:** Port the `os.homedir()` guard from CJS (verify.cjs line 523-534). Return early with descriptive error. [VERIFIED: verify.cjs]
**Warning signs:** Health check reports "broken" when project is actually healthy.

## Code Examples

### Verify Plan Structure Handler
```typescript
// Port of cmdVerifyPlanStructure (verify.cjs lines 108-167)
export const verifyPlanStructure: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError('file path required', ErrorClassification.Validation);
  }

  const fullPath = isAbsolute(filePath) ? filePath : join(projectDir, filePath);
  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  const fm = extractFrontmatter(content);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse XML task elements
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks: Array<{ name: string; hasFiles: boolean; hasAction: boolean; hasVerify: boolean; hasDone: boolean }> = [];
  let taskMatch: RegExpExecArray | null;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    // ... check required elements ...
    tasks.push({ name: taskName, hasFiles: /<files>/.test(taskContent), hasAction: /<action>/.test(taskContent), hasVerify: /<verify>/.test(taskContent), hasDone: /<done>/.test(taskContent) });
  }

  return { data: { valid: errors.length === 0, errors, warnings, task_count: tasks.length, tasks, frontmatter_fields: Object.keys(fm) } };
};
```

### Registry Registration
```typescript
// In createRegistry() — sdk/src/query/index.ts
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts, verifyKeyLinks } from './verify.js';
import { validateConsistency, validateHealth } from './validate.js';

registry.register('verify.plan-structure', verifyPlanStructure);
registry.register('verify plan-structure', verifyPlanStructure);  // space alias for CJS compat
registry.register('verify.phase-completeness', verifyPhaseCompleteness);
registry.register('verify phase-completeness', verifyPhaseCompleteness);
registry.register('verify.artifacts', verifyArtifacts);
registry.register('verify artifacts', verifyArtifacts);
registry.register('verify.key-links', verifyKeyLinks);
registry.register('verify key-links', verifyKeyLinks);
registry.register('validate.consistency', validateConsistency);
registry.register('validate consistency', validateConsistency);
registry.register('validate.health', validateHealth);
registry.register('validate health', validateHealth);
```

## CJS Function Inventory

Complete mapping of verify.cjs exports to SDK handlers:

| CJS Function | CJS Command | SDK Handler Name | Requirement | Lines |
|---|---|---|---|---|
| `cmdVerifyPlanStructure` | `verify plan-structure <file>` | `verifyPlanStructure` | VERIFY-01 | 108-167 |
| `cmdVerifyPhaseCompleteness` | `verify phase-completeness <phase>` | `verifyPhaseCompleteness` | VERIFY-02 | 169-213 |
| `cmdVerifyArtifacts` | `verify artifacts <plan-file>` | `verifyArtifacts` | VERIFY-03 | 283-336 |
| `cmdVerifyKeyLinks` | `verify key-links <plan-file>` | `verifyKeyLinks` | VERIFY-04 | 338-396 |
| `cmdValidateConsistency` | `validate consistency` | `validateConsistency` | VERIFY-05 | 398-519 |
| `cmdValidateHealth` | `validate health [--repair]` | `validateHealth` | VERIFY-06 | 522-921 |
| `cmdVerifySummary` | `verify-summary <path>` | Out of scope (not in requirements) | -- | 12-106 |
| `cmdVerifyReferences` | `verify references <file>` | Out of scope (not in requirements) | -- | 216-259 |
| `cmdVerifyCommits` | `verify commits <hashes>` | Out of scope (not in requirements) | -- | 261-281 |
| `cmdValidateAgents` | `validate agents` | Out of scope (not in requirements) | -- | 928-940 |
| `cmdVerifySchemaDrift` | `verify schema-drift <phase>` | Out of scope (not in requirements) | -- | 944-1018 |

**Note:** Only the 6 functions mapping to VERIFY-01 through VERIFY-06 are in scope. The remaining 5 functions are not listed in the phase requirements and should not be ported.

## Shared Utility: parseMustHavesBlock

Required by VERIFY-03 and VERIFY-04. Must be ported from `frontmatter.cjs` (lines 195-295) to `sdk/src/query/frontmatter.ts`.

**Key behaviors to preserve:**
1. Extracts a named block (`artifacts` or `key_links`) from `must_haves` in frontmatter YAML
2. Handles 3-level nesting: `must_haves > blockName > [{key: value, ...}]`
3. Supports both simple string items (`- "some string"`) and structured objects (`- path: foo.ts`)
4. Supports nested arrays within items (`exports: [a, b]`)
5. Returns `[]` when block not found (not an error)
6. Emits diagnostic warning when block has content lines but parses to 0 items

## Validate Health Repair Actions

The `--repair` flag triggers file mutations. Three repair actions exist in CJS:

| Repair Key | Trigger | Action | Files Modified |
|---|---|---|---|
| `createConfig` / `resetConfig` | config.json missing or invalid JSON | Write defaults from `CONFIG_DEFAULTS` | `.planning/config.json` |
| `regenerateState` | STATE.md missing | Generate minimal STATE.md from ROADMAP.md milestone info | `.planning/STATE.md` |
| `addNyquistKey` | `workflow.nyquist_validation` absent in config | Add key with value `true` | `.planning/config.json` |

**Important:** Health repair is the only verification handler that performs mutations. It should be placed in `validate.ts` and added to the `MUTATION_COMMANDS` set for event emission.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| CJS verify.cjs with synchronous I/O | Async TypeScript handlers in SDK registry | Phase 12 (this phase) | Enables typed results, eliminates bridge overhead |
| parseMustHavesBlock in frontmatter.cjs only | Shared TypeScript utility in frontmatter.ts | Phase 12 (this phase) | Reusable for future must-haves consumers |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Health repair's `regenerateState` should use async writes rather than the CJS `writeStateMd` | Validate Health Repair Actions | Low -- existing lockfile pattern in state-mutation.ts handles this |
| A2 | Space-separated aliases (`verify plan-structure`) needed alongside dot-separated (`verify.plan-structure`) for backward compat | Registry Registration | Medium -- if workflows already use dot notation only, space aliases are unnecessary |
| A3 | The 5 out-of-scope verify commands (summary, references, commits, agents, schema-drift) will continue using CJS fallback via registry | CJS Function Inventory | Low -- fallback path already works |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --project unit -- verify` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-01 | Plan structure validation (frontmatter fields, task XML, wave/depends_on) | unit | `npx vitest run --project unit src/query/verify.test.ts` | Wave 0 |
| VERIFY-02 | Phase completeness (plan/summary matching) | unit | `npx vitest run --project unit src/query/verify.test.ts` | Wave 0 |
| VERIFY-03 | Artifact existence and content checks | unit | `npx vitest run --project unit src/query/verify.test.ts` | Wave 0 |
| VERIFY-04 | Key-link integration point verification | unit | `npx vitest run --project unit src/query/verify.test.ts` | Wave 0 |
| VERIFY-05 | Consistency between STATE.md, ROADMAP.md, disk | unit | `npx vitest run --project unit src/query/validate.test.ts` | Wave 0 |
| VERIFY-06 | Health checks with repair mode | unit | `npx vitest run --project unit src/query/validate.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit -- verify validate`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `sdk/src/query/verify.test.ts` -- covers VERIFY-01 through VERIFY-04
- [ ] `sdk/src/query/validate.test.ts` -- covers VERIFY-05 and VERIFY-06
- [ ] `sdk/src/query/frontmatter.test.ts` -- add parseMustHavesBlock tests

## Sources

### Primary (HIGH confidence)
- `get-shit-done/bin/lib/verify.cjs` -- full source of all 11 verification functions (1,032 lines)
- `get-shit-done/bin/lib/frontmatter.cjs` -- parseMustHavesBlock implementation (lines 195-295)
- `sdk/src/query/index.ts` -- registry factory pattern with event emission wiring
- `sdk/src/query/helpers.ts` -- shared utilities (planningPaths, normalizePhaseName, etc.)
- `sdk/src/query/phase.ts` -- findPhase handler pattern (async file I/O, error classification)
- `sdk/src/query/state-mutation.ts` -- lockfile atomicity pattern for mutations
- `sdk/src/golden/golden.integration.test.ts` -- golden file test pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/11-state-mutations/11-01-SUMMARY.md` -- established patterns for mutation handlers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing infrastructure [VERIFIED: codebase]
- Architecture: HIGH - following established Phase 10/11 patterns exactly [VERIFIED: codebase]
- Pitfalls: HIGH - all from direct CJS source analysis and project decision history [VERIFIED: codebase]

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable infrastructure, no external dependencies)
