---
phase: 12-verification-suite
plan: 01
subsystem: testing
tags: [vitest, verification, frontmatter, plan-structure, phase-completeness, artifacts]

# Dependency graph
requires:
  - phase: 10-read-only-queries
    provides: frontmatter.ts extractFrontmatter, helpers.ts planningPaths/normalizePhaseName/phaseTokenMatches
provides:
  - verifyPlanStructure handler (plan validation with 8 required fields, task XML, wave/checkpoint checks)
  - verifyPhaseCompleteness handler (plan/summary matching, incomplete/orphan detection)
  - verifyArtifacts handler (file existence, min_lines, contains, exports checks)
  - parseMustHavesBlock utility (3-level YAML nesting parser for must_haves blocks)
affects: [12-02-PLAN, 12-03-PLAN, verify-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-warnings-in-result, must-haves-block-parser]

key-files:
  created:
    - sdk/src/query/verify.ts
    - sdk/src/query/verify.test.ts
  modified:
    - sdk/src/query/frontmatter.ts
    - sdk/src/query/frontmatter.test.ts
    - sdk/src/query/index.ts

key-decisions:
  - "parseMustHavesBlock returns {items, warnings} instead of CJS bare array -- structured warnings replace stderr.write"
  - "Null byte rejection on all file path args (T-12-01 threat mitigation)"

patterns-established:
  - "Verification handler pattern: read file, parse frontmatter, validate structure, return typed JSON with errors/warnings arrays"
  - "parseMustHavesBlock shared utility for 3-level YAML nesting used by artifacts and key-links handlers"

requirements-completed: [VERIFY-01, VERIFY-02, VERIFY-03]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 12 Plan 01: Verification Handlers Summary

**Three verification handlers (plan-structure, phase-completeness, artifacts) ported from verify.cjs to TypeScript SDK with parseMustHavesBlock utility**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T08:04:57Z
- **Completed:** 2026-04-08T08:09:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Ported parseMustHavesBlock from frontmatter.cjs to TypeScript with structured {items, warnings} return type
- Ported verifyPlanStructure checking 8 required frontmatter fields, task XML elements, wave/depends_on and checkpoint/autonomous consistency
- Ported verifyPhaseCompleteness matching PLAN files to SUMMARY files with incomplete/orphan detection
- Ported verifyArtifacts checking file existence, min_lines, contains, and exports from must_haves.artifacts
- Registered all 3 handlers in query registry with both dot and space aliases for CJS compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Port parseMustHavesBlock and verifyPlanStructure** - `fc4154e` (feat)
2. **Task 2: Add verifyPhaseCompleteness and verifyArtifacts** - `87a0bed` (feat)
3. **Registry wiring** - `b082c43` (chore)

## Files Created/Modified

- `sdk/src/query/verify.ts` - Three verification handlers: verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts
- `sdk/src/query/verify.test.ts` - 21 unit tests covering all handlers and edge cases
- `sdk/src/query/frontmatter.ts` - Added parseMustHavesBlock export with MustHavesBlockResult type
- `sdk/src/query/frontmatter.test.ts` - Added 7 tests for parseMustHavesBlock
- `sdk/src/query/index.ts` - Registered verify handlers in createRegistry with dot and space aliases

## Decisions Made

- parseMustHavesBlock returns `{items, warnings}` instead of CJS bare array -- structured warnings replace process.stderr.write for SDK pattern consistency
- Null byte rejection on all file path arguments (T-12-01 threat mitigation), matching existing frontmatterGet pattern
- Non-greedy regex `[\s\S]*?` for task XML parsing (T-12-03 backtracking mitigation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- verify.ts module ready for VERIFY-04 (key-links handler) in plan 12-02
- parseMustHavesBlock utility available for key-links parsing
- All 1024 unit tests green

---
*Phase: 12-verification-suite*
*Completed: 2026-04-08*
