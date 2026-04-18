---
phase: 09-foundation-and-test-infrastructure
plan: 03
subsystem: infra
tags: [typescript, sdk, golden-files, integration-testing, migration-metrics]

# Dependency graph
requires:
  - phase: 09-02
    provides: "QueryRegistry with createRegistry factory, generate-slug and current-timestamp handlers"
provides:
  - "captureGsdToolsOutput helper for golden file comparison via execFile"
  - "resolveGsdToolsPath for consistent gsd-tools.cjs path resolution"
  - "6 golden file integration tests validating SDK vs gsd-tools.cjs output parity"
  - "Golden fixture files for generate-slug and current-timestamp"
  - "wrapper-count.cjs metric script reporting bridge call counts"
affects: [phase-10, phase-11, phase-12, phase-13, phase-14]

# Tech tracking
tech-stack:
  added: []
  patterns: [golden-file-testing, execfile-subprocess-capture, bridge-call-counting]

key-files:
  created:
    - sdk/src/golden/capture.ts
    - sdk/src/golden/golden.integration.test.ts
    - sdk/src/golden/fixtures/generate-slug.golden.json
    - sdk/src/golden/fixtures/current-timestamp.golden.json
    - scripts/wrapper-count.cjs
  modified: []

key-decisions:
  - "Used ../../../ path depth for capture.ts since it's one level deeper than gsd-tools.ts"
  - "Wrapper-count detects GSDTools references in comments too, acceptable for tracking purposes"

patterns-established:
  - "Golden file testing: shell out to gsd-tools.cjs via execFile, compare parsed JSON against SDK dispatch output"
  - "Structure-only golden files: for time-varying outputs, validate format not exact values"
  - "Bridge call metric: count this.exec( and this.execRaw( patterns in non-test TS files"

requirements-completed: [MIGR-01, MIGR-02]

# Metrics
duration: 3min
completed: 2026-04-08
---

# Phase 09 Plan 03: Golden File Tests and Wrapper-Count Metric Summary

**Golden file integration tests comparing SDK query output against gsd-tools.cjs, plus wrapper-count metric script reporting 12 bridge calls baseline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T04:26:19Z
- **Completed:** 2026-04-08T04:29:17Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Golden file test harness with captureGsdToolsOutput helper using execFile for safe subprocess invocation
- 6 integration tests: 3 for generate-slug (exact match, fixture match, multi-word) and 3 for current-timestamp (full/date/filename format parity)
- Wrapper-count metric script establishing baseline: 12 bridge calls in gsd-tools.ts, 5 files referencing GSDTools
- Golden fixture files for generate-slug (exact JSON) and current-timestamp (structure-only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Golden file capture and tests (RED)** - `98c1062` (test)
2. **Task 1: Golden file capture and tests (GREEN)** - `b1fa8d6` (feat)
3. **Task 2: Wrapper-count metric script** - `2ddb7f9` (feat)

_TDD Task 1 has separate test and implementation commits._

## Files Created/Modified
- `sdk/src/golden/capture.ts` - captureGsdToolsOutput and resolveGsdToolsPath helpers
- `sdk/src/golden/golden.integration.test.ts` - 6 integration tests for SDK vs gsd-tools.cjs parity
- `sdk/src/golden/fixtures/generate-slug.golden.json` - Reference output for generate-slug
- `sdk/src/golden/fixtures/current-timestamp.golden.json` - Structure-only reference for current-timestamp
- `scripts/wrapper-count.cjs` - Bridge call counting metric script

## Decisions Made
- Used `../../../` relative path in capture.ts (one level deeper than gsd-tools.ts which uses `../../`)
- Wrapper-count regex matches GSDTools references in comments too -- acceptable for tracking migration scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed gsd-tools.cjs path resolution depth**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Plan specified `../../get-shit-done/bin/gsd-tools.cjs` matching gsd-tools.ts, but capture.ts is one directory deeper in `golden/`
- **Fix:** Changed to `../../../get-shit-done/bin/gsd-tools.cjs` for correct resolution from `sdk/src/golden/`
- **Files modified:** sdk/src/golden/capture.ts
- **Verification:** All 6 integration tests pass
- **Committed in:** b1fa8d6 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Path depth fix required for correct file resolution. No scope change.

## Issues Encountered
None beyond the path resolution fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Golden file test harness ready for Phase 10+ to add tests for each migrated command
- Wrapper-count baseline (12 calls) established for tracking migration progress
- All Phase 09 foundation infrastructure complete: error taxonomy, query registry, CLI subcommand, golden tests, and metrics

## Self-Check: PASSED

- All 5 created files exist on disk
- All 3 commit hashes found in git log

---
*Phase: 09-foundation-and-test-infrastructure*
*Completed: 2026-04-08*
