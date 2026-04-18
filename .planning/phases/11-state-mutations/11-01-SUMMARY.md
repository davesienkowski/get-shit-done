---
phase: 11-state-mutations
plan: 01
subsystem: sdk
tags: [typescript, state-mutation, lockfile, frontmatter, query-handler]

requires:
  - phase: 10-read-only-queries
    provides: "Query handler pattern, registry, helpers, frontmatter parser, state reader"
provides:
  - "10 STATE.md mutation handlers (update, patch, begin-phase, advance-plan, record-metric, update-progress, add-decision, add-blocker, resolve-blocker, record-session)"
  - "3 frontmatter mutation handlers (set, merge, validate)"
  - "normalizeMd, reconstructFrontmatter, spliceFrontmatter utilities"
  - "Lockfile-based atomicity for STATE.md writes"
affects: [12-verification, 13-config-commit-template]

tech-stack:
  added: []
  patterns: ["lockfile atomicity with O_EXCL", "readModifyWriteStateMd with frontmatter sync", "stateReplaceField with separate regex instances"]

key-files:
  created:
    - sdk/src/query/state-mutation.ts
    - sdk/src/query/state-mutation.test.ts
    - sdk/src/query/frontmatter-mutation.ts
    - sdk/src/query/frontmatter-mutation.test.ts
  modified:
    - sdk/src/query/helpers.ts
    - sdk/src/query/helpers.test.ts
    - sdk/src/query/state.ts
    - sdk/src/query/index.ts

key-decisions:
  - "Strip frontmatter before modifier in readModifyWriteStateMd to prevent regex matching YAML keys instead of body fields"
  - "Use separate regex instances (no g flag) for .test() and .replace() in stateReplaceField to avoid lastIndex persistence"

patterns-established:
  - "readModifyWriteStateMd: lock -> read -> strip frontmatter -> modify body -> sync frontmatter -> normalize -> write -> unlock"
  - "stateReplaceField: bold pattern first, plain pattern second, null if neither matches"
  - "Section mutation: regex match section header + body, transform body, replace in content"

requirements-completed: [MUTATE-01, MUTATE-02]

duration: 25min
completed: 2026-04-08
---

# Phase 11 Plan 01: State Mutations Summary

**10 STATE.md mutation handlers and 3 frontmatter mutation handlers with lockfile atomicity, porting all write operations from state.cjs and frontmatter.cjs to typed TypeScript**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-08T06:31:46Z
- **Completed:** 2026-04-08T06:57:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Ported all 10 STATE.md mutation commands (stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan, stateRecordMetric, stateUpdateProgress, stateAddDecision, stateAddBlocker, stateResolveBlocker, stateRecordSession) as typed QueryHandlers
- Ported frontmatter write utilities (reconstructFrontmatter, spliceFrontmatter) and 3 mutation handlers (frontmatterSet, frontmatterMerge, frontmatterValidate) with FRONTMATTER_SCHEMAS
- Implemented lockfile-based atomicity (acquireStateLock/releaseStateLock) with O_EXCL, 10 retries, stale lock cleanup, and readModifyWriteStateMd that strips frontmatter before modification
- All 13 handlers registered in createRegistry(); 46 new tests pass, 944 total tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared helpers + frontmatter mutation handlers** - `d6a5eea` (feat) — normalizeMd, reconstructFrontmatter, spliceFrontmatter, frontmatterSet/Merge/Validate
2. **Task 2: STATE.md mutation handlers** - `10abfe6` (test), `5350bb4` (feat) — all 10 state handlers with lockfile atomicity, registered in index.ts

## Files Created/Modified

- `sdk/src/query/state-mutation.ts` - 10 STATE.md mutation handlers with lockfile atomicity
- `sdk/src/query/state-mutation.test.ts` - 23 tests for state mutation handlers
- `sdk/src/query/frontmatter-mutation.ts` - reconstructFrontmatter, spliceFrontmatter, frontmatterSet/Merge/Validate
- `sdk/src/query/frontmatter-mutation.test.ts` - 21 tests for frontmatter mutation handlers
- `sdk/src/query/helpers.ts` - normalizeMd utility added
- `sdk/src/query/helpers.test.ts` - normalizeMd tests added
- `sdk/src/query/state.ts` - buildStateFrontmatter and getMilestonePhaseFilter exported
- `sdk/src/query/index.ts` - 13 new handler registrations (3 frontmatter + 10 state)

## Decisions Made

- Strip frontmatter before passing to modifier in readModifyWriteStateMd: prevents regex `^Status:` from matching the YAML frontmatter `status: executing` instead of the body `Status: Executing Phase 10`
- Use separate regex instances (no g flag) for stateReplaceField: avoids lastIndex persistence between .test() and .replace() calls (documented gotcha in MEMORY.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readModifyWriteStateMd frontmatter contamination**
- **Found during:** Task 2 (state mutation tests)
- **Issue:** statePatch and stateAddDecision tests failed because regex patterns matched YAML frontmatter keys before body fields, and syncStateFrontmatter then overwrote the change
- **Fix:** Strip frontmatter from content before passing to modifier function; syncStateFrontmatter rebuilds it from modified body + disk
- **Files modified:** sdk/src/query/state-mutation.ts
- **Verification:** All 23 state mutation tests pass

**2. [Rule 1 - Bug] stateAddDecision test overly broad assertion**
- **Found during:** Task 2 (state mutation tests)
- **Issue:** Test asserted `content.not.toContain('None yet.')` but other sections (Pending Todos, Blockers) still contained this placeholder
- **Fix:** Changed assertion to check only the Decisions section via regex match
- **Files modified:** sdk/src/query/state-mutation.test.ts
- **Verification:** Test passes correctly

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All STATE.md mutation handlers ready for call-site migration from gsd-tools.cjs
- Frontmatter write handlers ready for template and verification phases
- Lockfile atomicity pattern established for any future concurrent-write scenarios
- Phase 12 (verification handlers) can build on the same readModifyWriteStateMd pattern

---
*Phase: 11-state-mutations*
*Completed: 2026-04-08*
