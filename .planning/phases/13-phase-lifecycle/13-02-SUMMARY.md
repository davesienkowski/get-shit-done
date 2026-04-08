---
phase: 13-phase-lifecycle
plan: 02
subsystem: sdk
tags: [typescript, phase-lifecycle, filesystem-rename, roadmap-mutation, state-mutation]

requires:
  - phase: 13-phase-lifecycle
    provides: replaceInCurrentMilestone, readModifyWriteRoadmapMd, findPhaseDir, assertNoNullBytes
  - phase: 11-state-mutations
    provides: acquireStateLock/releaseStateLock, stateReplaceField
provides:
  - phaseRemove handler for deleting phases with renumbering
  - renameDecimalPhases helper for sibling decimal renumbering
  - renameIntegerPhases helper for integer phase renumbering
  - updateRoadmapAfterPhaseRemoval helper for ROADMAP.md cleanup
affects: [13-03-PLAN, phase-lifecycle]

tech-stack:
  added: []
  patterns: [descending-order rename to avoid filesystem conflicts, per-file lock for STATE.md writes in lifecycle handlers]

key-files:
  created: []
  modified:
    - sdk/src/query/phase-lifecycle.ts
    - sdk/src/query/phase-lifecycle.test.ts

key-decisions:
  - "Used direct acquireStateLock/releaseStateLock + readFile/writeFile for STATE.md since readModifyWriteStateMd is module-private"
  - "Imported stateExtractField from helpers and stateReplaceField from state-mutation for Total Phases field updates"
  - "Renaming sorted DESCENDING per Pitfall 2 in RESEARCH.md to avoid filesystem rename conflicts"

patterns-established:
  - "Descending-order rename: always sort toRename arrays by b.oldInt - a.oldInt before filesystem renames"
  - "Dual-lock lifecycle pattern: ROADMAP.md lock via readModifyWriteRoadmapMd, then STATE.md lock separately"

requirements-completed: [LIFE-03]

duration: 4min
completed: 2026-04-08
---

# Phase 13 Plan 02: Phase Remove Handler Summary

**phaseRemove with descending-order renaming of decimal and integer phases, atomic ROADMAP.md section removal and renumbering, and STATE.md total_phases decrement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T09:17:50Z
- **Completed:** 2026-04-08T09:22:00Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 2

## Accomplishments

- Ported renameDecimalPhases from CJS with DESCENDING sort for conflict-free sibling renumbering
- Ported renameIntegerPhases from CJS handling letter suffixes (12A) and decimal subphases (6.1) with DESCENDING sort
- Ported updateRoadmapAfterPhaseRemoval with section removal, checkbox cleanup, table row cleanup, and integer phase renumbering loop (MAX_PHASE=99 descending)
- Implemented phaseRemove handler with force-flag guard for executed phases, directory deletion, renaming dispatch, ROADMAP.md and STATE.md updates

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `56070a5` (test)
2. **Task 1 GREEN: Implementation** - `6e4edc4` (feat)

## Files Created/Modified

- `sdk/src/query/phase-lifecycle.ts` - Added phaseRemove handler, renameDecimalPhases, renameIntegerPhases, updateRoadmapAfterPhaseRemoval helpers
- `sdk/src/query/phase-lifecycle.test.ts` - Added 8 unit tests for phaseRemove covering integer/decimal removal, force flag, ROADMAP renumbering, STATE.md decrement

## Decisions Made

- Used direct lock + read + write for STATE.md since readModifyWriteStateMd is not exported from state-mutation.ts (module-private function)
- Imported stateExtractField from helpers.ts and stateReplaceField from state-mutation.ts for the "Total Phases" field update pattern
- All rename operations sorted DESCENDING per Pitfall 2 in RESEARCH.md to prevent EEXIST/ENOENT filesystem conflicts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- phaseRemove exported and ready for handler registration in index.ts (Plan 03 or later)
- renameDecimalPhases and renameIntegerPhases are private helpers; if needed externally they can be exported
- Pre-existing test failures in milestone-runner.test.ts and registry.test.ts remain unrelated to this plan

## Self-Check: PASSED

- All files exist on disk
- All commit hashes verified in git log

---
*Phase: 13-phase-lifecycle*
*Completed: 2026-04-08*
