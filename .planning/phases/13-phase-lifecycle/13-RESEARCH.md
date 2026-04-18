# Phase 13: Phase Lifecycle - Research

**Researched:** 2026-04-08
**Domain:** Phase CRUD operations, ROADMAP.md/STATE.md manipulation, filesystem orchestration
**Confidence:** HIGH

## Summary

Phase 13 ports six phase lifecycle commands from `get-shit-done/bin/lib/phase.cjs` (add, insert, remove, complete) and related commands from `commands.cjs` (scaffold) and `milestone.cjs` (clear, archive) to native TypeScript SDK handlers. These are the most complex mutation operations in GSD because they coordinate writes across multiple files (ROADMAP.md, STATE.md, REQUIREMENTS.md) and the filesystem (phase directories, file renaming) atomically.

The CJS implementation is 944 lines in `phase.cjs` alone, plus additional logic in `commands.cjs` (scaffold) and `milestone.cjs` (phases clear). Each operation follows a read-modify-write pattern under a planning lock. The SDK already has all the prerequisite infrastructure: `readModifyWriteStateMd` for atomic STATE.md updates, `extractCurrentMilestone` and `getMilestonePhaseFilter` for milestone-scoped operations, and the registry pattern with event emission wiring.

**Primary recommendation:** Create a new `sdk/src/query/phase-lifecycle.ts` module with all six lifecycle handlers, reusing existing SDK helpers extensively. The most complex handler is `phaseComplete` (150+ lines in CJS) which touches ROADMAP.md, STATE.md, REQUIREMENTS.md, and emits events.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (infrastructure phase).

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | SDK can add a phase to the end of the current roadmap (phase add) | CJS `cmdPhaseAdd` at line 312-392 of phase.cjs; needs `extractCurrentMilestone`, `loadConfig`, slug generation, dir creation, ROADMAP.md append |
| LIFE-02 | SDK can insert a phase at a specific position with renumbering (phase insert) | CJS `cmdPhaseInsert` at line 394-492; decimal phase calculation, ROADMAP.md section insertion after target phase |
| LIFE-03 | SDK can remove a phase with renumbering (phase remove) | CJS `cmdPhaseRemove` at line 597-661; `renameDecimalPhases`/`renameIntegerPhases` for renumbering, `updateRoadmapAfterPhaseRemoval`, STATE.md total update |
| LIFE-04 | SDK can mark a phase complete and update all tracking artifacts (phase complete) | CJS `cmdPhaseComplete` at line 663-932; checkbox marking, progress table update, STATE.md field updates, REQUIREMENTS.md marking, next-phase detection, warnings |
| LIFE-05 | SDK can scaffold new phase directories with required files (phase scaffold) | CJS `cmdScaffold` at line 750-806 of commands.cjs; context/uat/verification/phase-dir templates |
| LIFE-06 | SDK can archive phase directories for milestone completion (phases clear, phases archive) | CJS `cmdPhasesClear` at line 250-277 of milestone.cjs; archive logic at line 210-227 of milestone.cjs (within `cmdMilestoneComplete`) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | native | Async file ops (mkdir, readFile, writeFile, rename, rm) | Already used by all SDK mutation handlers [VERIFIED: codebase] |
| `node:path` | native | Path manipulation | Standard across all SDK modules [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.2 | Unit test runner | All handler tests [VERIFIED: vitest.config.ts] |

**No new dependencies required.** This phase reuses existing SDK infrastructure exclusively.

## Architecture Patterns

### Recommended Project Structure
```
sdk/src/query/
  phase-lifecycle.ts          # All 6 lifecycle handlers (LIFE-01 through LIFE-06)
  phase-lifecycle.test.ts     # Unit tests with tmpdir fixtures
```

### Pattern 1: New File vs Extending Existing phase.ts

The existing `sdk/src/query/phase.ts` contains read-only query handlers (`findPhase`, `phasePlanIndex`). Following the pattern from Phase 11 where mutations went into `state-mutation.ts` separate from `state.ts`, lifecycle mutations should go into a new `phase-lifecycle.ts` file. [VERIFIED: codebase pattern]

### Pattern 2: Async readModifyWrite for ROADMAP.md

The CJS uses `withPlanningLock` (synchronous busy-wait lock at `.planning/.lock`) for ROADMAP.md writes. The SDK already has async `acquireStateLock`/`releaseStateLock` in `state-mutation.ts` for STATE.md. A similar `readModifyWriteRoadmapMd` helper should be created for ROADMAP.md atomicity. [VERIFIED: state-mutation.ts lines 184-209]

**Key difference from CJS:** CJS uses a single `.planning/.lock` file for ALL writes (ROADMAP, STATE, etc.). The SDK uses per-file locks (`.lock` suffix). For Phase 13 handlers that touch both ROADMAP.md and STATE.md, each file gets its own lock cycle -- this is safe because the operations are logically separable (ROADMAP update, then STATE update). [VERIFIED: CJS core.cjs line 599, SDK state-mutation.ts line 110]

### Pattern 3: Handler Signature

All handlers follow `QueryHandler` type: `(args: string[], projectDir: string) => Promise<QueryResult>`. [VERIFIED: codebase]

```typescript
// Source: sdk/src/query/utils.ts
export type QueryHandler = (args: string[], projectDir: string) => Promise<QueryResult>;
export interface QueryResult {
  data: unknown;
  text?: string;
}
```

### Pattern 4: Roadmap Manipulation Helpers (Must Port)

Several CJS helpers need porting for roadmap writes:

| Helper | Source | Purpose | SDK Status |
|--------|--------|---------|------------|
| `extractCurrentMilestone` | core.cjs:1123 | Scope roadmap content to current milestone | Already ported to `sdk/src/query/roadmap.ts` |
| `replaceInCurrentMilestone` | core.cjs:1197 | Replace regex only in current milestone section | NOT ported -- needs porting |
| `getMilestonePhaseFilter` | core.cjs:1430 | Filter dirs to current milestone | Already ported to `sdk/src/query/state.ts` |
| `findPhaseInternal` | core.cjs:1023 | Find phase dir with archive search | Partially ported as `findPhase` query handler; needs internal reuse |
| `getArchivedPhaseDirs` | core.cjs:1061 | List archived phase dirs | NOT ported -- needs porting for LIFE-06 |
| `renameDecimalPhases` | phase.cjs:499 | Renumber decimal phases after removal | NOT ported -- new for LIFE-03 |
| `renameIntegerPhases` | phase.cjs:531 | Renumber integer phases after removal | NOT ported -- new for LIFE-03 |
| `updateRoadmapAfterPhaseRemoval` | phase.cjs:569 | Remove phase section + renumber references | NOT ported -- new for LIFE-03 |
| `generateSlugInternal` | core.cjs | Generate kebab-case slug from description | Already ported as `generateSlug` in utils.ts |

### Pattern 5: Event Emission

Phase lifecycle commands are mutations and must be added to the `MUTATION_COMMANDS` set in `sdk/src/query/index.ts`. A new event type `GSDEventType.PhaseLifecycle` (or reuse existing types) should be emitted via the `buildMutationEvent` function. [VERIFIED: index.ts lines 61-70, 77-144]

### Anti-Patterns to Avoid
- **Synchronous file operations:** CJS uses `fs.readFileSync`/`fs.writeFileSync`. SDK must use `fs/promises` throughout. [VERIFIED: all SDK modules use async]
- **Single global lock:** CJS uses `.planning/.lock` for everything. SDK should use per-file locks or a dedicated roadmap lock.
- **Regex with `g` flag + `.test()` then `.replace()`:** CJS has this pattern in places. SDK must avoid it (lastIndex bug). Use `.replace()` directly or reset lastIndex. [VERIFIED: MEMORY.md gotcha]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STATE.md atomic writes | Custom lock + read + write | `readModifyWriteStateMd` from state-mutation.ts | Already handles lock, frontmatter sync, normalize |
| Milestone scoping | Custom roadmap parsing | `extractCurrentMilestone` from roadmap.ts | Already handles `<details>` blocks, version detection |
| Phase directory lookup | Custom dir scanning | `findPhase` handler or internal helper from phase.ts | Handles normalization, token matching, archive search |
| Slug generation | Custom string manipulation | `generateSlug` from utils.ts | Handles edge cases, matches CJS output |
| Phase comparison/sorting | Custom sort logic | `comparePhaseNum` from helpers.ts | Handles integers, decimals, letters, custom IDs |

## Common Pitfalls

### Pitfall 1: ROADMAP.md Has Shipped Milestones in `<details>` Blocks
**What goes wrong:** Regex matches phase headers inside shipped milestone `<details>` blocks, corrupting historical data.
**Why it happens:** ROADMAP.md wraps completed milestones in `<details>` tags. Phase patterns like `### Phase 1:` may appear in both current and historical sections.
**How to avoid:** Always use `extractCurrentMilestone()` before matching phase patterns. Use `replaceInCurrentMilestone()` for writes. [VERIFIED: core.cjs:1197]
**Warning signs:** Tests that hardcode ROADMAP.md without `<details>` blocks pass but production fails.

### Pitfall 2: Renumbering Requires Descending Order
**What goes wrong:** Renaming directories in ascending order causes conflicts (e.g., renaming dir 6 to 5 before renaming 7 to 6 creates a collision).
**Why it happens:** File system rename operations are not atomic across directories.
**How to avoid:** CJS sorts `toRename` in descending order (`b.oldInt - a.oldInt`). SDK must preserve this. [VERIFIED: phase.cjs lines 506, 542]
**Warning signs:** "EEXIST" or "ENOENT" errors during phase remove operations.

### Pitfall 3: Phase Complete Touches 3+ Files Atomically
**What goes wrong:** Crash between ROADMAP.md update and STATE.md update leaves inconsistent state.
**Why it happens:** `cmdPhaseComplete` updates ROADMAP.md (checkbox, table, plan counts), REQUIREMENTS.md (requirement checkboxes, traceability table), and STATE.md (current phase, status, progress, metrics).
**How to avoid:** Each file gets its own atomic read-modify-write cycle. The CJS v1.34.0 fixed a bug where STATE.md was read outside the lock. [VERIFIED: phase.cjs line 848 comment]
**Warning signs:** STATE.md showing wrong phase after completion.

### Pitfall 4: Backlog Phases (999.x) Must Be Excluded
**What goes wrong:** Phase add finds 999 as the max phase number and creates Phase 1000.
**Why it happens:** 999.x numbering is used for backlog items, outside the active sequence.
**How to avoid:** Skip phases >= 999 when calculating the next sequential number. [VERIFIED: phase.cjs line 350]
**Warning signs:** Unreasonably high phase numbers in output.

### Pitfall 5: `readSubdirectories` vs `readdir` Differences
**What goes wrong:** Reading directory entries without filtering for directories includes files.
**Why it happens:** CJS has a custom `readSubdirectories` helper. SDK must filter with `withFileTypes: true`.
**How to avoid:** Always use `readdir(dir, { withFileTypes: true })` and filter `.isDirectory()`. [VERIFIED: phase.cjs passim]

### Pitfall 6: Regex `g` Flag Between `.test()` and `.replace()`
**What goes wrong:** The `.test()` advances `lastIndex`, so the subsequent `.replace()` misses the match.
**Why it happens:** Global regex maintains state between calls.
**How to avoid:** Use `.replace()` directly without `.test()` gate, or create a fresh regex for each call. [VERIFIED: MEMORY.md, milestone.cjs line 44-48]

## Code Examples

### Handler Registration Pattern
```typescript
// Source: sdk/src/query/index.ts (existing pattern)
// Phase lifecycle handlers
registry.register('phase.add', phaseAdd);
registry.register('phase.insert', phaseInsert);
registry.register('phase.remove', phaseRemove);
registry.register('phase.complete', phaseComplete);
registry.register('phase.scaffold', phaseScaffold);
registry.register('phases.clear', phasesClear);
registry.register('phases.archive', phasesArchive);
```

### Atomic ROADMAP.md Write Pattern
```typescript
// New helper needed — similar to readModifyWriteStateMd
async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>
): Promise<string> {
  const roadmapPath = planningPaths(projectDir).roadmap;
  const lockPath = roadmapPath + '.lock';
  // Acquire lock (reuse acquireStateLock pattern with different path)
  // ... lock acquisition ...
  try {
    const content = await readFile(roadmapPath, 'utf-8');
    const modified = await modifier(content);
    await writeFile(roadmapPath, modified, 'utf-8');
    return modified;
  } finally {
    // ... release lock ...
  }
}
```

### Phase Add Handler Structure
```typescript
// Source: adapted from phase.cjs cmdPhaseAdd lines 312-392
export const phaseAdd: QueryHandler = async (args, projectDir) => {
  const description = args[0];
  if (!description) {
    throw new GSDError('description required for phase add', ErrorClassification.Validation);
  }
  const config = JSON.parse(await readFile(planningPaths(projectDir).config, 'utf-8'));
  const slug = (await generateSlug([description], projectDir)).data as { slug: string };
  // Read ROADMAP.md, find max phase, create dir, update ROADMAP.md
  // Return { phase_number, padded, name, slug, directory, naming_mode }
};
```

### Phase Complete Handler — Key Sections
```typescript
// Source: adapted from phase.cjs cmdPhaseComplete lines 663-932
// 1. Verify phase exists (findPhase)
// 2. Check for verification warnings (UAT/VERIFICATION files)
// 3. Update ROADMAP.md: checkbox, progress table, plan count, plan checkboxes
// 4. Update REQUIREMENTS.md: requirement checkboxes, traceability table
// 5. Find next phase (filesystem + roadmap fallback)
// 6. Update STATE.md: current phase, status, progress, metrics
// 7. Return result with warnings
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts` |
| Full suite command | `npx vitest run --project unit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | phase.add creates dir + updates ROADMAP + STATE | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phaseAdd"` | Wave 0 |
| LIFE-02 | phase.insert creates decimal phase with renumbering | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phaseInsert"` | Wave 0 |
| LIFE-03 | phase.remove deletes + renumbers + updates ROADMAP/STATE | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phaseRemove"` | Wave 0 |
| LIFE-04 | phase.complete marks done + updates STATE/ROADMAP/REQ | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phaseComplete"` | Wave 0 |
| LIFE-05 | phase.scaffold creates dir with template files | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phaseScaffold"` | Wave 0 |
| LIFE-06 | phases.clear/archive moves completed dirs | unit | `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts -t "phasesClear"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit sdk/src/query/phase-lifecycle.test.ts`
- **Per wave merge:** `npx vitest run --project unit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `sdk/src/query/phase-lifecycle.test.ts` -- covers LIFE-01 through LIFE-06
- [ ] Test fixtures: tmpdir with `.planning/` structure including ROADMAP.md, STATE.md, config.json, REQUIREMENTS.md, and phase directories

## Security Domain

Not directly applicable -- phase lifecycle operations are local filesystem operations on `.planning/` artifacts with no network, authentication, or cryptographic concerns. Input validation (phase numbers, descriptions) prevents path traversal via `normalizePhaseName` which strips special characters. [VERIFIED: helpers.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new `readModifyWriteRoadmapMd` helper is needed for ROADMAP.md locking (separate from STATE.md lock) | Architecture Patterns | Low -- could alternatively reuse a generalized lock helper; the pattern is identical |
| A2 | All 6 lifecycle handlers fit in one `phase-lifecycle.ts` file | Architecture Patterns | Low -- if file exceeds ~600 lines, could split into `phase-lifecycle.ts` and `phase-lifecycle-helpers.ts` |
| A3 | `phases.archive` is a standalone handler separate from milestone completion | Phase Requirements | Medium -- CJS bundles archive into `cmdMilestoneComplete`; may need to extract as separate concern |

## Open Questions

1. **Should `phase.remove` update REQUIREMENTS.md?**
   - What we know: CJS `cmdPhaseRemove` does NOT update REQUIREMENTS.md (only ROADMAP.md and STATE.md)
   - What's unclear: If requirements are mapped to a removed phase, should their status be reset?
   - Recommendation: Match CJS behavior -- don't touch REQUIREMENTS.md on remove. Requirements are tracked separately.

2. **Event type for phase lifecycle mutations**
   - What we know: Existing `GSDEventType.PhaseComplete` exists for phase execution completion (different from lifecycle "mark complete")
   - What's unclear: Whether to reuse existing event types or create a new `PhaseLifecycle` event type
   - Recommendation: Create a new `GSDEventType.PhaseLifecycleMutation` or reuse `StateMutation` with a `command` field that includes the lifecycle operation name. Reusing `StateMutation` is simpler and consistent with how other mutations are emitted.

3. **Lock granularity for multi-file operations**
   - What we know: CJS uses a single `.planning/.lock` for all operations. SDK uses per-file locks.
   - What's unclear: Whether concurrent `phase.add` and `phase.complete` could conflict via ROADMAP.md
   - Recommendation: Use a roadmap-specific lock (`ROADMAP.md.lock`) for ROADMAP.md writes, and `STATE.md.lock` (existing) for STATE.md writes. Sequential lock acquisition (ROADMAP first, then STATE) prevents deadlocks.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/bin/lib/phase.cjs` lines 0-944 -- Full CJS implementation of phase add/insert/remove/complete
- `get-shit-done/bin/lib/commands.cjs` lines 750-806 -- CJS scaffold implementation
- `get-shit-done/bin/lib/milestone.cjs` lines 210-277 -- CJS phases clear and archive
- `sdk/src/query/state-mutation.ts` -- Existing SDK mutation pattern (readModifyWriteStateMd, lock helpers)
- `sdk/src/query/index.ts` -- Registry pattern, MUTATION_COMMANDS set, event emission wiring
- `sdk/src/query/helpers.ts` -- Shared utilities (normalizePhaseName, comparePhaseNum, planningPaths)
- `sdk/src/query/roadmap.ts` -- extractCurrentMilestone, getMilestoneInfo already ported

### Secondary (MEDIUM confidence)
- `sdk/src/query/state.ts` -- getMilestonePhaseFilter ported and available

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns established in prior phases
- Architecture: HIGH -- direct port of well-understood CJS code with established SDK patterns
- Pitfalls: HIGH -- identified from actual CJS bugs (v1.34.0 TOCTOU fix, regex lastIndex) and code review

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable -- internal SDK patterns unlikely to change)
