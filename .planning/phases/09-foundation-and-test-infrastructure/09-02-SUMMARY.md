---
phase: 09-foundation-and-test-infrastructure
plan: 02
subsystem: infra
tags: [typescript, sdk, cli, registry, query]

# Dependency graph
requires:
  - phase: 09-01
    provides: "ErrorClassification enum, GSDError class, exitCodeFor function, QueryResult/QueryHandler types, generateSlug and currentTimestamp handlers"
provides:
  - "QueryRegistry class with register, has, dispatch, and GSDTools fallback"
  - "extractField function ported from gsd-tools.cjs for --pick field extraction"
  - "createRegistry factory wiring generate-slug and current-timestamp handlers"
  - "gsd-sdk query <command> CLI subcommand with --pick and error classification"
affects: [09-03-PLAN, phase-10, phase-11, phase-12, phase-13, phase-14]

# Tech tracking
tech-stack:
  added: []
  patterns: [flat-map-registry, dynamic-import-fallback, pick-field-extraction]

key-files:
  created:
    - sdk/src/query/registry.ts
    - sdk/src/query/registry.test.ts
    - sdk/src/query/index.ts
  modified:
    - sdk/src/cli.ts
    - sdk/src/cli.test.ts

key-decisions:
  - "Dynamic import for GSDTools fallback to avoid loading bridge unless needed"
  - "extractField ported verbatim from gsd-tools.cjs for exact behavioral parity"

patterns-established:
  - "Registry pattern: flat Map<string, QueryHandler> with fallback to GSDTools for unregistered commands"
  - "CLI query routing: dynamic import of registry and errors, --pick extracted before dispatch"

requirements-completed: [FOUND-03, FOUND-04, FOUND-05]

# Metrics
duration: 3min
completed: 2026-04-08
---

# Phase 09 Plan 02: Query Registry and CLI Subcommand Summary

**QueryRegistry with flat Map routing, extractField for --pick, and gsd-sdk query CLI subcommand with GSDTools fallback and error classification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T04:22:06Z
- **Completed:** 2026-04-08T04:24:37Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2

## Accomplishments
- QueryRegistry class with register/has/dispatch and dynamic GSDTools fallback for unregistered commands
- extractField ported from gsd-tools.cjs supporting dot notation, bracket indexing, and negative indices
- createRegistry factory wiring generate-slug and current-timestamp handlers from Plan 01
- CLI query subcommand with --pick field extraction and GSDError-to-exit-code mapping
- 23 new tests (18 registry + 5 CLI) all passing, 87 total across all related suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Query registry (RED)** - `cb175c8` (test)
2. **Task 1: Query registry (GREEN)** - `f954f6f` (feat)
3. **Task 2: CLI query subcommand** - `e51e87b` (feat)

_TDD Task 1 has separate test and implementation commits._

## Files Created/Modified
- `sdk/src/query/registry.ts` - QueryRegistry class, extractField function
- `sdk/src/query/registry.test.ts` - 18 unit tests for registry and extractField
- `sdk/src/query/index.ts` - createRegistry factory, re-exports
- `sdk/src/cli.ts` - Added query subcommand with --pick and error classification
- `sdk/src/cli.test.ts` - 5 new tests for query parsing and USAGE content

## Decisions Made
- Dynamic import for GSDTools fallback: avoids loading the bridge module unless an unregistered command is dispatched
- extractField ported verbatim from gsd-tools.cjs lines 365-382 to ensure exact behavioral parity with --pick

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting issue in fallback test**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `vi.mock` with `mockExec` variable caused ReferenceError due to Vitest's mock hoisting
- **Fix:** Changed to `vi.doMock` with dynamic re-import pattern for proper mock scoping
- **Files modified:** sdk/src/query/registry.test.ts
- **Verification:** All 18 registry tests pass
- **Committed in:** f954f6f (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only fix for mock scoping. No code scope change.

## Issues Encountered
None beyond the mock hoisting fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Registry ready for golden file test harness (Plan 03) to validate output parity
- CLI query path ready for Phase 10+ command migrations
- All 87 tests passing across errors, utils, registry, and CLI suites

## Self-Check: PASSED

- All 5 files exist on disk (3 created, 2 modified)
- All 3 commit hashes found in git log

---
*Phase: 09-foundation-and-test-infrastructure*
*Completed: 2026-04-08*
