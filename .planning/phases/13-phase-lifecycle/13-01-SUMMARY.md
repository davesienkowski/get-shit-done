---
phase: 13-phase-lifecycle
plan: 01
subsystem: sdk
tags: [typescript, phase-lifecycle, roadmap-mutation, lockfile, scaffold]

requires:
  - phase: 11-state-mutations
    provides: acquireStateLock/releaseStateLock, readModifyWriteStateMd pattern
  - phase: 10-read-only-queries
    provides: extractCurrentMilestone, roadmap.ts helpers, phase.ts findPhase
provides:
  - phaseAdd handler for appending sequential/custom phases
  - phaseInsert handler for decimal phase insertion
  - phaseScaffold handler for context/uat/verification/phase-dir templates
  - replaceInCurrentMilestone helper for milestone-scoped ROADMAP.md writes
  - readModifyWriteRoadmapMd helper for atomic ROADMAP.md mutations
affects: [13-02-PLAN, 13-03-PLAN, phase-lifecycle]

tech-stack:
  added: []
  patterns: [readModifyWriteRoadmapMd atomic writes, per-file lockfile pattern for ROADMAP.md]

key-files:
  created:
    - sdk/src/query/phase-lifecycle.ts
    - sdk/src/query/phase-lifecycle.test.ts
  modified: []

key-decisions:
  - "Inline generateSlugInternal rather than importing generateSlug handler to avoid unnecessary QueryResult unwrapping"
  - "Used acquireStateLock/releaseStateLock with ROADMAP.md path for per-file locking (not shared .planning/.lock)"
  - "findPhaseDir as private helper rather than importing findPhase handler to avoid circular dependency"

patterns-established:
  - "readModifyWriteRoadmapMd: atomic ROADMAP.md writes with lockfile, matching readModifyWriteStateMd pattern"
  - "Null byte validation on all path-related args via assertNoNullBytes helper"

requirements-completed: [LIFE-01, LIFE-02, LIFE-05]

duration: 4min
completed: 2026-04-08
---

# Phase 13 Plan 01: Phase Lifecycle Foundation Summary

**Phase add/insert/scaffold handlers with atomic ROADMAP.md writes and milestone-scoped replacement helpers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T09:12:02Z
- **Completed:** 2026-04-08T09:15:49Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 2

## Accomplishments

- Ported phaseAdd from CJS with sequential/custom numbering, backlog (999.x) exclusion, and ROADMAP.md insertion before last separator
- Ported phaseInsert with decimal phase calculation scanning both directories AND ROADMAP.md to avoid collisions
- Ported phaseScaffold supporting 4 template types (context, uat, verification, phase-dir) with idempotency checks
- Created replaceInCurrentMilestone helper that scopes regex replacements to content after last </details> block
- Created readModifyWriteRoadmapMd helper with per-file lockfile atomicity for safe concurrent access

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `80e91bd` (test)
2. **Task 1 GREEN: Implementation** - `1cac251` (feat)

## Files Created/Modified

- `sdk/src/query/phase-lifecycle.ts` - Phase lifecycle handlers (phaseAdd, phaseInsert, phaseScaffold) and shared helpers (replaceInCurrentMilestone, readModifyWriteRoadmapMd)
- `sdk/src/query/phase-lifecycle.test.ts` - 19 unit tests covering all handlers and helpers with tmpdir fixtures

## Decisions Made

- Inlined generateSlugInternal rather than calling the generateSlug query handler, avoiding QueryResult unwrapping overhead
- Used acquireStateLock/releaseStateLock from state-mutation.ts with ROADMAP.md path for per-file locking, following SDK convention over CJS single-lock pattern
- Created findPhaseDir as a private helper to avoid importing the findPhase query handler directly, keeping module boundaries clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- replaceInCurrentMilestone and readModifyWriteRoadmapMd exported and ready for Plan 02 (phaseRemove) and Plan 03 (phaseComplete)
- Handler registration in index.ts deferred to Plan 02/03 when all lifecycle handlers are complete
- Pre-existing test failures in milestone-runner.test.ts and registry.test.ts are unrelated to this plan

## Self-Check: PASSED

- All files exist on disk
- All commit hashes verified in git log

---
*Phase: 13-phase-lifecycle*
*Completed: 2026-04-08*
