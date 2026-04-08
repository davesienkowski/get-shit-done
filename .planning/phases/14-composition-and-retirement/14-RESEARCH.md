# Phase 14: Composition and Retirement - Research

**Researched:** 2026-04-08
**Domain:** SDK init composition, workflow migration, CJS retirement
**Confidence:** HIGH

## Summary

Phase 14 replaces all 16 compound `init` commands in `gsd-tools.cjs` with composable typed query chains in the SDK, migrates all workflow/agent/command markdown files from `node gsd-tools.cjs` to `gsd-sdk query`, and deprecates the CJS files. The init commands are the last major orchestration surface -- they compose multiple atomic queries (config, phase info, roadmap, file existence checks) into single JSON bundles consumed by workflows.

The codebase analysis reveals 321 `gsd-tools.cjs` references across 63 workflow files, 49 references across 11 agent files, and 28 references across 11 command files. These references invoke approximately 35 unique command+subcommand patterns. Most are already registered in the SDK query registry (55+ handlers from Phases 9-13), but several commands used in workflows are NOT yet in the SDK and need either migration or thin stubs.

The 16 init commands in `init.cjs` (1,537 lines) follow a consistent pattern: load config, call atomic queries (findPhase, getRoadmapPhase, loadConfig, resolveModel, etc.), compute derived values, attach common metadata via `withProjectRoot()`, and output flat JSON. The SDK already has native handlers for all the atomic building blocks -- the composition layer just needs to wire them together.

**Primary recommendation:** Build `sdk/src/query/init.ts` as a single module with 16 exported composition handlers, each calling existing SDK query functions directly (for reads) and `registry.dispatch()` (for mutations). Migrate workflows domain-by-domain, grouped by which init command they call. Implement staged execution as registry-level middleware wrapping `dispatch()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Init composition handlers live in a single new `sdk/src/query/init.ts` module (mirrors CJS lib/init.cjs)
- Hybrid call style: direct function calls for read-only queries (type-safe, no overhead), registry.dispatch() for mutations (gets event emission)
- Results are flat JSON matching CJS output exactly -- golden tests validate this shape, workflows parse these keys
- Always compute full bundle (no lazy loading) -- CJS returns everything, workflows may rely on any field
- Domain-by-domain sweep: group workflow files by which init command they call, migrate all callers of one init command together
- No CJS shim -- migrate everything now. For v4.0 features (intel, learnings, uat, security, profile), implement minimal SDK pass-through handlers or update workflows to not call them
- Golden tests updated per init command -- each composition handler gets its own golden test validating CJS output parity
- GSDTools bridge class deleted from SDK -- the bridge was the migration path; init.ts replaces it
- All workflows migrated to `gsd-sdk query`, CJS files marked deprecated (not deleted)
- Deletion deferred to cleanup after validation -- deprecate rather than delete for safety
- Installer (bin/install.js) updated to reference SDK paths
- Wrapper-count metric script should report 0 after migration
- Three stages: prepare (resolve context) -> execute (dispatch handler) -> finalize (write events/logs)
- Implementation as registry-level middleware wrapping dispatch() with pre/post hooks
- Dry-run mode integrated as stage gate: prepare runs, execute is skipped
- Dry-run for mutations: clone state in-memory, run mutation, diff original vs result, return diff without writing

### Claude's Discretion
- Workspace-aware state resolution (COMP-03) implementation details
- Ordering of domain-by-domain migration sweep
- Test structure for init composition handlers (unit vs integration split)
- Error handling strategy for init handlers when sub-queries fail

### Deferred Ideas (OUT OF SCOPE)
- Full v4.0 feature implementation (intel 21K lines, learnings, uat, security, profile) -- only thin stubs needed for Phase 14
- Final CJS file deletion -- deferred to post-validation cleanup
- Event stream bidirectional control flow (ADV-07) -- v4.0 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | SDK replaces 16 compound init commands with composable typed query chains | All 16 init functions mapped with exact composition logic and output shapes (see Init Command Inventory below) |
| COMP-02 | SDK implements staged execution pipeline (prepare/execute/finalize) wrapping registry dispatch | Registry middleware pattern documented; dispatch() already has event-wrapping precedent |
| COMP-03 | SDK supports workspace-aware state resolution as first-class typed contexts | CJS planningDir() uses GSD_WORKSTREAM/GSD_PROJECT env vars; SDK helpers.ts planningPaths() needs extension |
| COMP-04 | SDK supports dry-run mode for mutations (preview changes without writing) | Mutation handlers identified; dry-run as stage gate in pipeline middleware |
| MIGR-03 | All 65 workflow markdown files updated from `node gsd-tools.cjs` to `gsd-sdk query` calls | 63 workflow files + 11 agent files + 11 command files mapped with exact command patterns |
| MIGR-04 | gsd-tools.cjs fully retired -- removed from tree, GSDTools bridge class removed from SDK | GSDTools bridge class in sdk/src/gsd-tools.ts identified; registry fallback mechanism documented |
| MIGR-05 | All new SDK query functions have unit tests via Vitest | 16 init handlers + pipeline middleware + workspace resolution need tests |
| MIGR-06 | SDK passes CI on all platforms (Ubuntu, macOS, Windows x Node 22, 24) | CI config in test.yml documented; currently Ubuntu+macOS, no Windows runner |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | SDK source language | Already used; strict mode [VERIFIED: sdk/tsconfig.json] |
| Vitest | 3.1.1 | Test runner for SDK | Already configured with unit+integration projects [VERIFIED: sdk/vitest.config.ts] |
| Node.js | 22/24 | Runtime | CI matrix targets [VERIFIED: .github/workflows/test.yml] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | built-in | Async file operations | File existence checks, reading config/state |
| `node:path` | built-in | Path manipulation | Cross-platform path handling |
| `node:os` | built-in | Home directory, platform detection | Workspace paths, agent detection |
| `node:child_process` | built-in | Git operations | Only for `execSync` in workspace detection |

**No new dependencies required.** All composition logic uses existing SDK modules and Node.js built-ins. [VERIFIED: codebase analysis]

## Architecture Patterns

### Recommended Project Structure

```
sdk/src/query/
├── init.ts              # NEW: 16 composition handlers
├── init.test.ts         # NEW: Unit tests for composition handlers
├── pipeline.ts          # NEW: Staged execution middleware
├── pipeline.test.ts     # NEW: Pipeline tests
├── workspace.ts         # NEW: Workspace-aware state resolution
├── workspace.test.ts    # NEW: Workspace tests
├── index.ts             # MODIFY: Register init.* and pipeline
├── registry.ts          # MODIFY: Add middleware support for staged execution
├── helpers.ts           # MODIFY: Extend planningPaths for workspace awareness
└── [existing files]     # Unchanged
```

### Pattern 1: Init Composition Handler

**What:** Each init command becomes an exported async function that composes atomic SDK queries into the same flat JSON shape as CJS.
**When to use:** For every one of the 16 init subcommands.

```typescript
// sdk/src/query/init.ts
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadConfig } from '../config.js';
import { findPhase } from './phase.js';
import { roadmapGetPhase } from './roadmap.js';
import { resolveModel } from './config-query.js';
import { normalizePhaseName, planningPaths, toPosixPath } from './helpers.js';
import type { QueryResult } from './utils.js';

export async function initExecutePhase(
  args: string[], projectDir: string
): Promise<QueryResult> {
  const phase = args[0];
  if (!phase) return { data: null, error: 'phase required for init execute-phase' };

  // Direct function calls for read-only queries (no dispatch overhead)
  const configResult = await configGet([], projectDir);
  const config = configResult.data as Record<string, unknown>;
  const phaseResult = await findPhase([phase], projectDir);
  // ... compose flat JSON matching CJS output shape
  return { data: { /* ... */ } };
}
```

[VERIFIED: Pattern derived from CJS init.cjs lines 50-171 and SDK query handler pattern in index.ts]

### Pattern 2: withProjectRoot Injection

**What:** CJS `withProjectRoot()` injects `project_root`, `agents_installed`, `missing_agents`, and `response_language` into every init result. SDK must replicate this.
**When to use:** Every init composition handler must call this before returning.

```typescript
function withProjectRoot(projectDir: string, result: Record<string, unknown>): Record<string, unknown> {
  result.project_root = projectDir;
  const agentStatus = checkAgentsInstalled(projectDir);
  result.agents_installed = agentStatus.agents_installed;
  result.missing_agents = agentStatus.missing_agents;
  // response_language from config
  const config = loadConfigSync(projectDir);
  if (config.response_language) {
    result.response_language = config.response_language;
  }
  return result;
}
```

[VERIFIED: CJS init.cjs lines 32-48]

### Pattern 3: Staged Execution Middleware

**What:** Registry-level middleware wrapping `dispatch()` with prepare/execute/finalize stages.
**When to use:** All dispatched commands flow through the pipeline.

```typescript
// sdk/src/query/pipeline.ts
export interface PipelineStage {
  prepare(command: string, args: string[], projectDir: string): Promise<void>;
  finalize(command: string, args: string[], result: QueryResult): Promise<void>;
}

export function wrapWithPipeline(
  registry: QueryRegistry,
  stages: PipelineStage[],
  dryRun: boolean = false
): void {
  // Wrap every handler with pre/post hooks
  // In dry-run mode: prepare runs, execute is skipped for mutations
}
```

[ASSUMED: Design based on CONTEXT.md decision + existing event-wrapping pattern in index.ts lines 256-272]

### Anti-Patterns to Avoid
- **Shell-out in composition handlers:** Never call `execFile` or `spawnSync` to invoke gsd-tools.cjs from init handlers. Use direct function imports. [VERIFIED: CONTEXT.md hybrid call style decision]
- **Partial bundle computation:** Always compute the full init bundle. Workflows may access any field. [VERIFIED: CONTEXT.md decision]
- **Deep nesting in output:** Init results must be flat JSON matching CJS shape exactly. No restructuring. [VERIFIED: CONTEXT.md decision]

## Init Command Inventory

### Complete mapping of all 16 init commands

Each entry documents: CJS function name, what it composes, key output fields, and which SDK atomic queries it needs.

| # | Init Command | CJS Function | Lines | Key Compositions | SDK Queries Used |
|---|-------------|-------------|-------|-----------------|-----------------|
| 1 | execute-phase | cmdInitExecutePhase | 50-171 | config, findPhase, roadmapGetPhase, resolveModel x2, milestoneInfo, branch name computation, file existence | configGet, findPhase, roadmapGetPhase, resolveModel, generateSlug |
| 2 | plan-phase | cmdInitPlanPhase | 173-293 | config, findPhase, roadmapGetPhase, resolveModel x3, phase artifact discovery, file paths | configGet, findPhase, roadmapGetPhase, resolveModel |
| 3 | new-project | cmdInitNewProject | 296-398 | config, resolveModel x3, brownfield detection (code scan), API key detection, git state | configGet, resolveModel, custom file scanning |
| 4 | new-milestone | cmdInitNewMilestone | 401-446 | config, milestoneInfo, latest completed milestone, phase dir count, file paths | configGet, stateLoad (for milestone), custom milestone parsing |
| 5 | quick | cmdInitQuick | 448-504 | config, resolveModel x4, slug generation, quick task ID generation, branch name | configGet, resolveModel, generateSlug |
| 6 | resume | cmdInitResume | 506-536 | config, file existence checks, interrupted agent detection | configGet, custom file reads |
| 7 | verify-work | cmdInitVerifyWork | 538-586 | config, findPhase, roadmapGetPhase, resolveModel x2 | configGet, findPhase, roadmapGetPhase, resolveModel |
| 8 | phase-op | cmdInitPhaseOp | 588-697 | config, findPhase (with archived fallback), roadmapGetPhase, phase artifact discovery | configGet, findPhase, roadmapGetPhase |
| 9 | todos | cmdInitTodos | 699-756 | config, todo file scanning, area filtering | configGet, custom dir reading |
| 10 | milestone-op | cmdInitMilestoneOp | 758-817 | config, milestoneInfo, phase counting, archive scanning | configGet, stateLoad, custom dir scanning |
| 11 | map-codebase | cmdInitMapCodebase | 819-851 | config, resolveModel, existing map discovery | configGet, resolveModel |
| 12 | progress | cmdInitProgress | 1139-1283 | config, milestoneInfo, full phase analysis, roadmap parsing, paused state detection | configGet, stateLoad, roadmapAnalyze, custom phase scanning |
| 13 | manager | cmdInitManager | 854-1137 | config, milestoneInfo, full roadmap parsing, phase status computation, dependency graph, recommended actions, activity detection | configGet, stateLoad, roadmapAnalyze, custom complex logic |
| 14 | new-workspace | cmdInitNewWorkspace | 1311-1335 | child repo detection, git worktree availability | custom execSync calls |
| 15 | list-workspaces | cmdInitListWorkspaces | 1337-1381 | workspace directory scanning, manifest parsing | custom file scanning |
| 16 | remove-workspace | cmdInitRemoveWorkspace | 1383-1443 | workspace manifest parsing, dirty repo detection | custom file scanning, execSync for git status |

[VERIFIED: All line numbers and compositions confirmed from CJS init.cjs source code]

### Complexity Assessment

| Complexity | Commands | Reason |
|-----------|---------|--------|
| **Simple** (< 50 lines) | resume, verify-work, map-codebase, new-workspace, list-workspaces, remove-workspace | Few compositions, simple file checks |
| **Medium** (50-100 lines) | execute-phase, plan-phase, new-milestone, quick, phase-op, todos, milestone-op | Multiple queries + artifact discovery |
| **Complex** (100+ lines) | new-project, progress, manager | Code scanning, dependency graphs, recommended actions |

### Common Metadata Injected by withProjectRoot()

Every init handler result includes these fields (injected by `withProjectRoot()`):
- `project_root` -- absolute path to CWD
- `agents_installed` -- boolean, true if all expected agents are installed
- `missing_agents` -- array of agent names not found on disk
- `response_language` -- from config.response_language (optional)

[VERIFIED: CJS init.cjs lines 32-48, core.cjs lines 1274-1306]

## CJS to SDK Gap Analysis

### Commands Used in Workflows but NOT Yet in SDK Registry

| Command | Used In | Action Needed |
|---------|---------|---------------|
| `agent-skills <type>` | 19 workflow/agent files | New handler or workflow rewrite to use config directly |
| `roadmap update-plan-progress` | execute-plan.md, execute-phase.md, autonomous.md | New handler in roadmap.ts |
| `requirements mark-complete` | execute-plan.md, gsd-executor.md | New handler |
| `phases list` | audit-milestone.md, execute-plan.md | New handler (list format) |
| `summary-extract` | audit-milestone.md, complete-milestone.md | New handler |
| `history-digest` | gsd-planner.md | New handler or stub |
| `milestone complete` | complete-milestone.md | Likely covered by phase-lifecycle.ts or needs new |
| `todo match-phase` | discuss-phase.md, discuss-phase-assumptions.md | New handler |
| `learnings copy` | execute-phase.md | Thin stub (v4.0 feature) |
| `verify commits` | gsd-verifier.md | New handler |
| `verify schema-drift` | execute-phase.md | New handler |
| `uat render-checkpoint` | referenced in workflows | Thin stub (v4.0 feature) |
| `audit-uat` | audit-fix.md | Thin stub (v4.0 feature) |
| `stats json` | stats.md | New handler |
| `workstream *` | workstreams.md (6 subcommands) | Thin stubs or defer |
| `commit-to-subrepo` | execute-plan.md, gsd-executor.md | New handler |
| `phase next-decimal` | add-backlog.md command | New handler |
| `progress bar` | progress.md | New handler variant |
| `docs-init` | (reference only) | Skip if not actively called |
| `generate-claude-md` | (reference only) | Skip if not actively called |
| `state planned-phase` | autonomous.md | Check if alias for existing |
| `websearch` | gsd-phase-researcher.md, gsd-project-researcher.md | External tool, not query |
| `intel *` | intel.md, gsd-intel-updater.md | Thin stubs (v4.0 feature) |

[VERIFIED: Cross-referencing grep output of all gsd-tools.cjs invocations against SDK registry listing]

### Commands Already in SDK Registry (Confirmed)

All of these are already registered and working:
- `config-get`, `config-set`, `config-set-model-profile`, `config-new-project`, `config-ensure-section`
- `state.load`, `state.get`, `state.update`, `state.patch`, `state.begin-phase`, `state.advance-plan`, `state.record-metric`, `state.update-progress`, `state.add-decision`, `state.add-blocker`, `state.resolve-blocker`, `state.record-session`, `state-snapshot`
- `find-phase`, `phase-plan-index`, `phase.add`, `phase.insert`, `phase.remove`, `phase.complete`, `phase.scaffold`, `phases.clear`, `phases.archive`
- `roadmap.analyze`, `roadmap.get-phase`
- `resolve-model`, `generate-slug`, `current-timestamp`
- `frontmatter.get`, `frontmatter.set`, `frontmatter.merge`, `frontmatter.validate`
- `commit`, `check-commit`
- `template.fill`, `template.select`
- `verify.plan-structure`, `verify.phase-completeness`, `verify.artifacts`, `verify.key-links`
- `validate.consistency`, `validate.health`
- `progress`, `progress.json`

[VERIFIED: SDK registry listing from sdk/src/query/index.ts]

## Workflow Migration Analysis

### File Count by Directory

| Directory | Files with gsd-tools.cjs | Total References |
|-----------|-------------------------|-----------------|
| get-shit-done/workflows/ | 63 | ~321 |
| agents/ | 11 | ~49 |
| commands/gsd/ | 11 | ~28 |
| sdk/prompts/agents/ | 2 | ~2 |
| get-shit-done/references/ | 6 | ~35 |
| docs/ | ~15 | ~200 (documentation, lower priority) |

[VERIFIED: grep counts across the codebase]

### Migration Pattern: Init Commands

The vast majority of workflow files follow this bash pattern:

```bash
TOOLS="$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"
INIT=$(node "$TOOLS" init execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

This becomes:

```bash
INIT=$(gsd-sdk query init.execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

The `@file:` prefix handling should be preserved for backwards compatibility (large JSON results).

[VERIFIED: Pattern observed across 42+ init call sites in workflows]

### Migration Pattern: Non-Init Commands

Non-init commands in workflows follow two patterns:

**Pattern A -- JSON output (most common):**
```bash
RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
# becomes:
RESULT=$(gsd-sdk query roadmap.analyze)
```

**Pattern B -- Raw output with --raw flag:**
```bash
VALUE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.skip_discuss 2>/dev/null || echo "false")
# becomes:
VALUE=$(gsd-sdk query config-get workflow.skip_discuss --pick data 2>/dev/null || echo "false")
```

**Pattern C -- Fire-and-forget mutations:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state advance-plan
# becomes:
gsd-sdk query state.advance-plan
```

[VERIFIED: Pattern analysis from full workflow grep output]

### Recommended Domain Sweep Order

Based on dependency analysis and complexity:

| Wave | Init Command(s) | Workflow Files | Rationale |
|------|-----------------|---------------|-----------|
| 1 | phase-op | 15+ workflows | Most widely used; simple composition |
| 2 | execute-phase, plan-phase | execute-phase.md, execute-plan.md, plan-phase.md, ui-phase.md | Core execution loop |
| 3 | quick, resume, verify-work | quick.md, resume-project.md, verify-work.md | Mid-complexity |
| 4 | new-project, new-milestone, milestone-op | new-project.md, new-milestone.md, autonomous.md | Project lifecycle |
| 5 | manager, progress, todos | manager.md, progress.md, check-todos.md, add-todo.md | Dashboard/tracking |
| 6 | map-codebase, workspace commands | map-codebase.md, new-workspace.md, list-workspaces.md, remove-workspace.md | Workspace features |

[ASSUMED: Ordering recommendation based on dependency analysis and file counts]

## Staged Execution Pipeline Design

### Current Event Wrapping (Precedent)

The SDK registry already wraps mutation commands with event emission (index.ts lines 256-272):

```typescript
if (eventStream) {
  for (const cmd of MUTATION_COMMANDS) {
    const original = registry.getHandler(cmd);
    if (original) {
      registry.register(cmd, async (args, projectDir) => {
        const result = await original(args, projectDir);
        try {
          const event = buildMutationEvent(cmd, args, result);
          eventStream.emitEvent(event);
        } catch { /* fire-and-forget */ }
        return result;
      });
    }
  }
}
```

The staged pipeline extends this pattern by wrapping ALL commands (not just mutations) with prepare/finalize stages.

[VERIFIED: SDK index.ts event wrapping code]

### Pipeline Integration Point

The `dispatch()` method in `QueryRegistry` (registry.ts line 105) is the natural integration point:

```typescript
async dispatch(command: string, args: string[], projectDir: string): Promise<QueryResult> {
  // Existing: handler lookup -> execute -> return
  // New: prepare stages -> handler lookup -> execute (or skip if dry-run mutation) -> finalize stages
}
```

Options:
1. **Modify dispatch()** to accept a pipeline config -- adds complexity to the base class
2. **Create PipelinedRegistry** extending QueryRegistry -- cleaner separation but more classes
3. **Wrap registry externally** (like current event wrapping) -- consistent with existing pattern

Recommendation: Option 3 (external wrapping) -- consistent with the existing event emission pattern and keeps QueryRegistry simple. The pipeline middleware wraps `dispatch()` using the same handler-replacement technique.

[ASSUMED: Architecture recommendation; CONTEXT.md says "registry-level middleware"]

### Dry-Run Mode

For mutations, dry-run should:
1. Run prepare stages normally
2. For MUTATION_COMMANDS: clone relevant state files in-memory, run handler against cloned state, diff original vs result, return diff in QueryResult
3. For read-only commands: execute normally (reads are side-effect-free)

Implementation challenge: mutation handlers currently write directly to disk. Dry-run requires either:
- **Approach A:** Intercept file writes at the fs level (complex, fragile)
- **Approach B:** Pass a `dryRun` flag through to handlers, which return planned changes instead of writing (requires handler changes)
- **Approach C:** Snapshot files before mutation, run mutation, diff, then restore (destructive but simpler)

Recommendation: Approach B -- add optional `dryRun` to handler context, returning a `{ planned_changes: [...] }` result for mutations when set. Only needs implementation for mutation handlers that write files.

[ASSUMED: Implementation approach; CONTEXT.md specifies "clone state in-memory, run mutation, diff"]

## Workspace-Aware State Resolution (COMP-03)

### CJS Implementation

CJS `planningDir()` (core.cjs line 669) supports workspaces via environment variables:

```javascript
function planningDir(cwd, ws, project) {
  if (project === undefined) project = process.env.GSD_PROJECT || null;
  if (ws === undefined) ws = process.env.GSD_WORKSTREAM || null;
  // Reject path separators and traversal
  // Returns: .planning/ or .planning/workstreams/<ws>/ or .planning/projects/<project>/
}
```

### SDK Gap

Current SDK `planningPaths()` (helpers.ts line 313) always returns `.planning/` -- it does not support workstream/project scoping:

```typescript
export function planningPaths(projectDir: string): PlanningPaths {
  const base = join(projectDir, '.planning');
  // No workstream/project awareness
}
```

### Required Changes

1. Extend `planningPaths()` to accept optional workspace/project context
2. Create `WorkspaceContext` type with workstream and project fields
3. Pass workspace context through to query handlers that use `planningPaths()`
4. Read `GSD_WORKSTREAM` and `GSD_PROJECT` env vars as defaults

[VERIFIED: CJS core.cjs planningDir() implementation; SDK helpers.ts planningPaths()]

## GSDTools Bridge Class Removal

### Current Usage

`sdk/src/gsd-tools.ts` (304 lines) provides:
- `GSDTools` class with `exec()` and `execRaw()` methods
- Typed convenience methods: `stateLoad()`, `roadmapAnalyze()`, `phaseComplete()`, etc.
- `GSDToolsError` error class
- `resolveGsdToolsPath()` path resolution

### Registry Fallback

`QueryRegistry.dispatch()` (registry.ts line 107) falls back to `GSDTools.exec()` for unregistered commands:

```typescript
private async fallbackToGsdTools(command, args, projectDir) {
  const { GSDTools } = await import('../gsd-tools.js');
  const tools = new GSDTools({ projectDir });
  const result = await tools.exec(command, args);
  return { data: result };
}
```

**After Phase 14:** All commands will have native handlers, so the fallback path becomes dead code. The bridge class and fallback can be safely removed.

### Impact of Removal

1. `GSDToolsError` -- may need to be preserved or migrated to `GSDError` (sdk/src/types.ts)
2. Types `InitNewProjectInfo`, `PhaseOpInfo`, `PhasePlanIndex`, `RoadmapAnalysis` defined in types.ts are used by GSDTools convenience methods -- these types stay, only the bridge goes
3. `resolveGsdToolsPath()` -- only used by the bridge, can be deleted
4. Dynamic import in `fallbackToGsdTools()` -- removed from registry.ts

[VERIFIED: gsd-tools.ts source code, registry.ts fallback mechanism]

## Installer Impact

### bin/install.js References

`bin/install.js` has one reference to gsd-tools.cjs at line 5098, in a path prefix context for file references. The installer generates configuration for multiple runtimes (Claude Code, Codex, Copilot, Gemini, etc.) and references the gsd-tools.cjs path.

After migration, the installer needs to:
1. Replace `gsd-tools.cjs` path references with `gsd-sdk` binary path
2. Ensure `gsd-sdk` is available as a CLI command post-install
3. Update any runtime-specific configuration that references the CJS path

The `gsd-sdk` CLI is already defined in `sdk/src/cli.ts` and included in the SDK package.

[VERIFIED: bin/install.js grep, sdk/src/cli.ts]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase resolution with archived fallback | Custom phase finder | Existing `findPhase` + `roadmapGetPhase` handlers | CJS logic has edge cases for archived phases, project code prefixes |
| Model resolution with profile overrides | Custom model resolver | Existing `resolveModel` handler | 3-level merge (defaults -> profiles -> overrides) |
| Config loading with defaults | Custom config reader | Existing `configGet` / `loadConfig` | Schema validation, type coercion, path safety |
| ROADMAP parsing | Custom markdown parser | Existing `roadmapAnalyze` / `roadmapGetPhase` | Regex patterns for phase headers, checkbox states |
| Phase artifact scanning | Custom file scanner | Compose from `findPhase` result | Already returns plans, summaries, has_research, etc. |
| Slug generation | Custom slugify | Existing `generateSlug` handler | Edge cases with special characters, length limits |

[VERIFIED: All referenced handlers exist in SDK registry]

## Common Pitfalls

### Pitfall 1: Output Shape Mismatch
**What goes wrong:** SDK init handler returns JSON with different field names, types, or nesting than CJS.
**Why it happens:** CJS uses camelCase and flat structure; easy to accidentally restructure or rename.
**How to avoid:** Golden tests capturing CJS output run against SDK output for every init handler. Byte-for-byte JSON comparison.
**Warning signs:** Workflow breaks with "jq: field not found" or undefined variable in bash.

### Pitfall 2: Missing withProjectRoot() Fields
**What goes wrong:** Workflow expects `project_root`, `agents_installed`, or `response_language` but init handler doesn't inject them.
**Why it happens:** Easy to forget the common metadata injection since it's not part of the core logic.
**How to avoid:** Single `withProjectRoot()` utility function called by every init handler. Test that every init result contains these fields.
**Warning signs:** Agent spawning failures due to missing `agents_installed` flag.

### Pitfall 3: CJS Command Routing Differences
**What goes wrong:** CJS routes `node gsd-tools.cjs state advance-plan` differently than SDK routes `gsd-sdk query state.advance-plan`.
**Why it happens:** CJS uses space-delimited routing (`state advance-plan`), SDK uses dot-delimited (`state.advance-plan`). Both aliases exist but migration must be consistent.
**How to avoid:** SDK registry already registers both space-delimited and dot-delimited aliases. Workflow migration should use dot-delimited consistently.
**Warning signs:** "Unknown command" errors from SDK CLI.

### Pitfall 4: @file: Prefix Handling
**What goes wrong:** Large JSON results use `@file:` prefix (written to temp file). SDK must handle this identically.
**Why it happens:** CJS writes large results to temp files to avoid stdout buffer limits.
**How to avoid:** SDK CLI already handles this pattern. Ensure init handlers that produce large results (manager, progress) use the same threshold.
**Warning signs:** JSON parse errors on large phase lists.

### Pitfall 5: Regex Global Flag + Test/Replace
**What goes wrong:** CJS uses regex with `g` flag followed by `.test()` then `.exec()` without resetting `lastIndex`.
**Why it happens:** Known JavaScript pitfall with stateful regex.
**How to avoid:** SDK uses fresh regex per operation. When porting CJS patterns, never reuse a regex instance with `g` flag across test/exec calls.
**Warning signs:** Intermittent failures where some phases are skipped in manager/progress output.

### Pitfall 6: Windows Path Separators
**What goes wrong:** Path comparisons fail on Windows because `join()` produces backslashes.
**Why it happens:** CJS `toPosixPath()` normalizes to forward slashes for workflow consumption.
**How to avoid:** SDK `toPosixPath()` already exists in helpers.ts. Use it for all paths in init results. CI tests on Windows (currently only static analysis -- may need live test).
**Warning signs:** Path mismatch in golden tests when run on Windows.

### Pitfall 7: Workspace Env Var Side Effects
**What goes wrong:** Setting GSD_WORKSTREAM/GSD_PROJECT env vars in one handler leaks to subsequent handlers.
**Why it happens:** Environment variables are process-global.
**How to avoid:** Workspace context should be passed as a parameter, not read from env vars mid-execution. Env vars read once at entry point and threaded through.
**Warning signs:** Wrong phase directory resolved in multi-workspace scenarios.

## Code Examples

### Init Handler Template (Verified Pattern)

```typescript
// Source: Derived from CJS init.cjs pattern + SDK query handler pattern
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { QueryResult } from './utils.js';

export async function initPhaseOp(
  args: string[], projectDir: string
): Promise<QueryResult> {
  const phase = args[0];
  // Direct imports for read-only queries
  const { data: config } = await configGet([], projectDir);
  const { data: phaseInfo } = await findPhase([phase], projectDir);
  const { data: roadmapPhase } = await roadmapGetPhase([phase], projectDir);

  // Compose result matching CJS output shape exactly
  const result: Record<string, unknown> = {
    commit_docs: (config as Record<string, unknown>).commit_docs,
    phase_found: !!(phaseInfo as Record<string, unknown>)?.found,
    phase_dir: (phaseInfo as Record<string, unknown>)?.directory ?? null,
    // ... all other fields
  };

  return { data: withProjectRoot(projectDir, result) };
}
```

### Registry Registration

```typescript
// In sdk/src/query/index.ts, add after existing registrations:
import {
  initExecutePhase, initPlanPhase, initNewProject, initNewMilestone,
  initQuick, initResume, initVerifyWork, initPhaseOp,
  initTodos, initMilestoneOp, initMapCodebase, initProgress,
  initManager, initNewWorkspace, initListWorkspaces, initRemoveWorkspace,
} from './init.js';

// Register with both dot-delimited and space-delimited aliases
registry.register('init.execute-phase', initExecutePhase);
registry.register('init execute-phase', initExecutePhase);
// ... repeat for all 16
```

### Workflow Migration Example

```markdown
<!-- Before -->
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi

<!-- After -->
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.1 |
| Config file | sdk/vitest.config.ts |
| Quick run command | `cd sdk && npx vitest run --project unit` |
| Full suite command | `cd sdk && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | 16 init handlers produce CJS-matching output | unit + golden | `cd sdk && npx vitest run src/query/init.test.ts` | Wave 0 |
| COMP-02 | Pipeline middleware wraps dispatch with stages | unit | `cd sdk && npx vitest run src/query/pipeline.test.ts` | Wave 0 |
| COMP-03 | Workspace-aware planningPaths resolution | unit | `cd sdk && npx vitest run src/query/workspace.test.ts` | Wave 0 |
| COMP-04 | Dry-run skips mutation writes | unit | `cd sdk && npx vitest run src/query/pipeline.test.ts` | Wave 0 |
| MIGR-03 | Zero gsd-tools.cjs references in workflows | integration | `grep -r "gsd-tools.cjs" get-shit-done/workflows/ agents/ commands/` | Wave 0 |
| MIGR-04 | GSDTools bridge class removed | unit | `test ! -f sdk/src/gsd-tools.ts` | Wave 0 |
| MIGR-05 | All new handlers have tests | unit | `cd sdk && npx vitest run` | Wave 0 |
| MIGR-06 | CI passes cross-platform | integration | GitHub Actions matrix | Existing |

### Sampling Rate
- **Per task commit:** `cd sdk && npx vitest run --project unit`
- **Per wave merge:** `cd sdk && npx vitest run`
- **Phase gate:** Full suite green + zero grep hits for `gsd-tools.cjs` in workflows/agents/commands

### Wave 0 Gaps
- [ ] `sdk/src/query/init.test.ts` -- covers COMP-01
- [ ] `sdk/src/query/pipeline.test.ts` -- covers COMP-02, COMP-04
- [ ] `sdk/src/query/workspace.test.ts` -- covers COMP-03
- [ ] Golden test fixtures for all 16 init commands (capture current CJS output)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CJS shell-out via GSDTools bridge | Native TypeScript query handlers | Phase 9-13 (2026-04) | 55+ handlers now native |
| Space-delimited command routing | Dot-delimited with space aliases | Phase 9 | Both work, dot preferred |
| Manual event emission | Registry-level event wrapping | Phase 11 | Handlers stay pure |
| Per-handler fallback to CJS | No fallback after Phase 14 | Phase 14 (this phase) | Bridge can be removed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pipeline middleware uses external wrapping pattern (option 3) | Staged Execution Pipeline | Low -- CONTEXT.md confirms "registry-level middleware" |
| A2 | Dry-run uses handler-level flag (approach B) | Staged Execution Pipeline | Medium -- CONTEXT.md says "clone state in-memory" which could mean approach C |
| A3 | Domain sweep order (phase-op first) | Workflow Migration Analysis | Low -- ordering is Claude's discretion per CONTEXT.md |
| A4 | `@file:` prefix threshold preserved identically | Common Pitfalls | Low -- existing SDK CLI handles this |
| A5 | No Windows CI runner needed for MIGR-06 | CI considerations | Medium -- current CI has no Windows live runner; success criteria says "Windows" |

## Open Questions

1. **Windows CI Testing**
   - What we know: CI runs on Ubuntu and macOS. Windows coverage is static analysis only (hardcoded-paths.test.cjs).
   - What's unclear: MIGR-06 requires "SDK passes CI on all platforms (Ubuntu, macOS, Windows)". Is the existing static analysis sufficient?
   - Recommendation: The success criteria explicitly mentions Windows. Either add a Windows runner or document that Windows is covered by static analysis tests (existing pattern).

2. **v4.0 Feature Stubs Scope**
   - What we know: intel (21K lines), learnings, uat, security, profile are deferred to v4.0.
   - What's unclear: How many workflow files call these v4.0 commands? Do stubs need to return meaningful data?
   - Recommendation: Audit which workflows call v4.0 commands. For each, either create a no-op stub that returns `{ data: null }` or update the workflow to skip the call.

3. **`agent-skills` Command Migration**
   - What we know: 19 workflow/agent files call `gsd-tools.cjs agent-skills <type>`. This outputs raw text (not JSON) via `process.stdout.write()`.
   - What's unclear: Should this become an SDK query handler, or should it be a separate CLI subcommand?
   - Recommendation: Register as `agent-skills` query handler returning `{ data: skillsBlock }`. Workflow migration uses `--pick data` to get raw text.

4. **Wrapper Count Script**
   - What we know: CONTEXT.md mentions "wrapper-count metric script should report 0 after migration". No `scripts/wrapper-count.sh` exists.
   - What's unclear: Does this script need to be created, or is it a reference to a different mechanism?
   - Recommendation: Create a simple grep-based script that counts `gsd-tools.cjs` references in workflows/agents/commands. Run as CI check.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). Phase 14 is purely code/config changes using existing Node.js toolchain.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/bin/lib/init.cjs` -- all 16 init command implementations, 1537 lines
- `sdk/src/query/index.ts` -- SDK registry with 55+ handlers, factory function
- `sdk/src/query/registry.ts` -- QueryRegistry class with dispatch/fallback
- `sdk/src/gsd-tools.ts` -- GSDTools bridge class, 304 lines
- `sdk/src/query/helpers.ts` -- planningPaths, normalizePhaseName, toPosixPath
- `get-shit-done/bin/lib/core.cjs` -- planningDir, checkAgentsInstalled, shared utilities
- `.github/workflows/test.yml` -- CI configuration

### Secondary (MEDIUM confidence)
- Grep analysis of 63 workflow files, 11 agent files, 11 command files for gsd-tools.cjs usage patterns
- Command+subcommand extraction identifying ~35 unique command patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing tooling
- Architecture: HIGH - extends established patterns (query handlers, registry, event wrapping)
- Init command mapping: HIGH - all 16 functions read line-by-line from CJS source
- Migration scope: HIGH - comprehensive grep analysis with exact file and reference counts
- Pitfalls: HIGH - derived from actual codebase patterns and previous phase decisions

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain -- CJS codebase is frozen, only SDK evolves)
