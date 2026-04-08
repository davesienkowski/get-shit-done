---
phase: 11-state-mutations
plan: 03
subsystem: sdk
tags: [typescript, template, event-emission, mutation-events, query-handler, golden-tests]

requires:
  - phase: 11-state-mutations
    provides: "Plan 01 state/frontmatter mutation handlers, Plan 02 config/commit handlers — all registered in createRegistry"
provides:
  - "templateFill and templateSelect handlers for summary/plan/verification templates"
  - "5 mutation event types (StateMutation, ConfigMutation, FrontmatterMutation, GitCommit, TemplateFill) in GSDEventType enum"
  - "Event emission wiring for all 20 mutation commands via MUTATION_COMMANDS set in createRegistry"
  - "getHandler method on QueryRegistry for handler wrapping"
  - "3 golden integration tests for mutation command output compatibility"
affects: [12-verification]

tech-stack:
  added: []
  patterns: ["MUTATION_COMMANDS set with handler wrapping for cross-cutting event emission", "buildMutationEvent factory dispatching by command prefix", "fire-and-forget event emission (T-11-12)"]

key-files:
  created:
    - sdk/src/query/template.ts
    - sdk/src/query/template.test.ts
  modified:
    - sdk/src/types.ts
    - sdk/src/query/index.ts
    - sdk/src/query/registry.ts
    - sdk/src/golden/golden.integration.test.ts

key-decisions:
  - "Event emission wired as registry-level handler wrapping rather than per-handler code — keeps handlers pure and event concern orthogonal"
  - "templateSelect uses phase directory scanning (plan/summary file presence) rather than CJS content analysis heuristic — cleaner API for SDK consumers"
  - "Path traversal protection via resolve+relative check on templateFill output path (T-11-10 mitigation)"

patterns-established:
  - "MUTATION_COMMANDS set: enumerate mutation commands, wrap each handler to emit typed events after success"
  - "buildMutationEvent: factory function dispatching by command prefix to create correct event interface"
  - "createRegistry(eventStream?): optional parameter keeps event emission opt-in, non-breaking"

requirements-completed: [MUTATE-05, MUTATE-06]

duration: 18min
completed: 2026-04-08
---

# Phase 11 Plan 03: Template Handlers and Mutation Event Emission Summary

**templateFill/templateSelect handlers, 5 mutation event types in GSDEventType, event emission wiring for all 20 mutation commands via MUTATION_COMMANDS set, and 3 golden integration tests validating mutation output compatibility**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-08T07:13:52Z
- **Completed:** 2026-04-08T07:31:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Ported templateFill (summary/plan/verification file creation with auto-generated frontmatter) and templateSelect (heuristic template type selection based on phase directory state)
- Added 5 mutation event types to GSDEventType enum with corresponding event interfaces (GSDStateMutationEvent, GSDConfigMutationEvent, GSDFrontmatterMutationEvent, GSDGitCommitEvent, GSDTemplateFillEvent) in discriminated union
- Wired event emission for all 20 mutation commands via MUTATION_COMMANDS set and handler wrapping in createRegistry, with optional GSDEventStream parameter
- Added getHandler method to QueryRegistry enabling handler introspection and wrapping
- Added 3 golden integration tests comparing mutation command output shapes (frontmatter.validate, template select, config-set) against gsd-tools.cjs
- All 12 new unit tests and 3 new integration tests pass; 996 unit tests + 14 golden tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Template handlers + mutation event types + event emission wiring** - `8f116c5` (test), `62cb0a6` (feat) -- templateFill, templateSelect, 5 event types, MUTATION_COMMANDS, createRegistry event wiring
2. **Task 2: Golden integration tests for mutation commands** - `0df1ec6` (feat) -- frontmatter.validate, template select, config-set golden tests

## Files Created/Modified

- `sdk/src/query/template.ts` - templateFill and templateSelect handlers with path traversal protection
- `sdk/src/query/template.test.ts` - 12 unit tests for template handlers and event emission wiring
- `sdk/src/types.ts` - 5 mutation event types and interfaces added to GSDEventType enum and GSDEvent union
- `sdk/src/query/index.ts` - MUTATION_COMMANDS set, buildMutationEvent factory, createRegistry event emission wiring, template handler registration
- `sdk/src/query/registry.ts` - getHandler method added for handler introspection
- `sdk/src/golden/golden.integration.test.ts` - 3 new golden tests for mutation command output compatibility

## Decisions Made

- Event emission wired as registry-level handler wrapping (MUTATION_COMMANDS set + getHandler + re-register wrapped handler) rather than embedding event emission in each handler — keeps handlers pure and testable, event concern is orthogonal
- templateSelect uses phase directory scanning (checking for PLAN/SUMMARY file pairs) rather than CJS content analysis heuristic — cleaner API that answers "what should I create next?" without requiring a specific file path
- Path traversal protection on templateFill using resolve+relative check — mitigates T-11-10 (untrusted output path escaping .planning/)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 MUTATE requirements satisfied: STATE.md mutations (01,02), frontmatter writes (02), config writes (03,04), git commits (04), template fills (05), and mutation event emission (06)
- Phase 11 complete: 25 mutation handlers registered in createRegistry with typed event emission
- Phase 12 (verification handlers) can proceed independently

## Self-Check: PASSED

All 6 files verified present. All 3 commit hashes verified in git log.
