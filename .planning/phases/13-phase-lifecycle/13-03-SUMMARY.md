---
phase: 13-phase-lifecycle
plan: 03
subsystem: sdk
tags: [typescript, phase-lifecycle, roadmap-mutation, state-mutation, requirements-mutation, registry]

requires:
  - phase: 13-phase-lifecycle
    provides: replaceInCurrentMilestone, readModifyWriteRoadmapMd, phaseAdd, phaseInsert, phaseScaffold, phaseRemove
  - phase: 11-state-mutations
    provides: acquireStateLock/releaseStateLock, stateReplaceField
  - phase: 10-read-only-queries
    provides: extractCurrentMilestone, getMilestonePhaseFilter, comparePhaseNum, findPhase
provides:
  - phaseComplete handler for marking phases done across ROADMAP/REQUIREMENTS/STATE
  - phasesClear handler for bulk phase directory deletion with backlog preservation
  - phasesArchive handler for milestone phase archiving
  - updatePerformanceMetricsSection helper for velocity table updates
  - All 7 lifecycle handlers registered in query registry with mutation event emission
affects: [phase-lifecycle, query-registry, milestone-completion]

tech-stack:
  added: []
  patterns: [frontmatter/body split for STATE.md field replacement, per-file atomic locks for multi-file mutations]

key-files:
  created: []
  modified:
    - sdk/src/query/phase-lifecycle.ts
    - sdk/src/query/phase-lifecycle.test.ts
    - sdk/src/query/index.ts

key-decisions:
  - "Reimplemented stateReplaceFieldWithFallback inline since state-mutation.ts keeps it module-private"
  - "Split STATE.md into frontmatter and body before field replacements to prevent regex matching YAML keys (Pattern 11 from Phase 11)"
  - "Used getMilestonePhaseFilter for both next-phase detection and phasesArchive to scope operations to current milestone"

patterns-established:
  - "Frontmatter/body split: strip frontmatter before applying stateReplaceField to body, update frontmatter fields separately, then reassemble"
  - "Multi-file atomic updates: ROADMAP lock cycle first, then REQUIREMENTS write, then STATE lock cycle (T-13-09)"

requirements-completed: [LIFE-04, LIFE-06]

duration: 6min
completed: 2026-04-08
---

# Phase 13 Plan 03: Phase Complete, Clear, Archive Summary

**phaseComplete handler marking phases done across ROADMAP.md/REQUIREMENTS.md/STATE.md with per-file atomic locks, plus phasesClear and phasesArchive for milestone cleanup, all 7 lifecycle handlers registered in query registry**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-08T09:22:52Z
- **Completed:** 2026-04-08T09:28:25Z
- **Tasks:** 2 (Task 1: TDD RED+GREEN, Task 2: registry wiring)
- **Files modified:** 3

## Accomplishments

- Ported phaseComplete from CJS (270 lines) — the most complex lifecycle handler touching ROADMAP.md (checkbox marking, progress table, plan count, plan checkboxes), REQUIREMENTS.md (requirement checkboxes, traceability table), and STATE.md (current phase, status, completed phases, percent, performance metrics)
- Ported phasesClear with --confirm safety guard and 999.x backlog preservation
- Ported phasesArchive with milestone-scoped directory archiving to milestones/{version}-phases/
- Ported updatePerformanceMetricsSection for velocity counter and by-phase table upsert
- Registered all 7 lifecycle handlers (phaseAdd, phaseInsert, phaseRemove, phaseComplete, phaseScaffold, phasesClear, phasesArchive) in query registry with both dot and space aliases (14 total registrations)
- Added lifecycle commands to MUTATION_COMMANDS set with phase./phases. prefix handling in buildMutationEvent

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `9f3a4b6` (test)
2. **Task 1 GREEN: Implementation** - `ce6fccd` (feat)
3. **Task 2: Registry wiring** - `92c2e24` (feat)

## Files Created/Modified

- `sdk/src/query/phase-lifecycle.ts` - Added phaseComplete, phasesClear, phasesArchive handlers plus stateReplaceFieldWithFallback and updatePerformanceMetricsSection helpers
- `sdk/src/query/phase-lifecycle.test.ts` - Added 14 tests: 8 phaseComplete, 3 phasesClear, 1 phasesArchive, 2 registry integration
- `sdk/src/query/index.ts` - Imported and registered all 7 lifecycle handlers with dot/space aliases, added to MUTATION_COMMANDS, added phase prefix to buildMutationEvent

## Decisions Made

- Reimplemented stateReplaceFieldWithFallback inline (8 lines) since state-mutation.ts exports stateReplaceField but not the fallback variant
- Split STATE.md into frontmatter and body before applying field replacements to prevent `^Status:` regex from matching YAML `status:` key in frontmatter (discovered during test; follows Pattern 11 from Phase 11 decisions)
- Used getMilestonePhaseFilter (async) for both next-phase filesystem scan and phasesArchive to correctly scope to current milestone

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stateReplaceField matching frontmatter instead of body**
- **Found during:** Task 1 GREEN (phaseComplete STATE.md update)
- **Issue:** `stateReplaceField` with `^Status:` regex and `m` flag matched the YAML frontmatter `status: executing` line before the markdown body `Status: Executing Phase 10`, leaving body field unchanged
- **Fix:** Split STATE.md into frontmatter and body, apply field replacements only to body, update frontmatter fields separately, then reassemble
- **Files modified:** sdk/src/query/phase-lifecycle.ts
- **Verification:** All 39 tests pass including STATE.md field update assertions
- **Committed in:** ce6fccd (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness. The CJS version avoids this because readModifyWriteStateMd strips frontmatter before the modifier runs.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 LIFE requirements delivered (LIFE-01 through LIFE-06) across Plans 01-03
- All 7 lifecycle handlers registered and dispatching via `gsd-sdk query`
- Pre-existing test failures in milestone-runner.test.ts and registry.test.ts remain unrelated to this phase
- Phase 13 is complete — ready for Phase 13.1 (Upstream Reconciliation) or Phase 14

## Self-Check: PASSED

- All files exist on disk
- All commit hashes verified in git log

---
*Phase: 13-phase-lifecycle*
*Completed: 2026-04-08*
