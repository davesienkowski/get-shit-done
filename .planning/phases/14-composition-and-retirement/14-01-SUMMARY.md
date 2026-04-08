---
phase: 14-composition-and-retirement
plan: 01
status: complete
started: 2026-04-08T10:30:00Z
completed: 2026-04-08T10:57:00Z
commits:
  - 08cddd2 feat(14-01): create init composition module with 13 handlers
  - 66dc130 feat(14-01): add golden fixtures, integration tests, and registry wiring for init handlers
requirements_covered: [COMP-01, MIGR-05]
---

# Plan 14-01 Summary: Init Composition Module

## What Was Done

Created the init composition layer in `sdk/src/query/init.ts` — 13 handlers that compose existing SDK atomic queries into the flat JSON bundles that CJS `gsd-tools init <command>` produces.

### Task 1: Init Handlers + Unit Tests

- **sdk/src/query/init.ts** (~600 lines): 13 exported handlers + `withProjectRoot` helper
- **sdk/src/query/init.test.ts** (22 tests): Full coverage of all handlers including edge cases
- Key challenge: CJS `loadConfig()` flattens nested keys (`config.branching_strategy`) while SDK preserves nesting (`config.git.branching_strategy`). Mapped all fields explicitly.

### Task 2: Golden Fixtures + Integration Tests

- Captured 5 golden fixtures from CJS for the most critical init commands
- Added 5 golden test blocks to `golden.integration.test.ts` comparing stable fields only
- Fixtures: init-execute-phase, init-plan-phase, init-quick, init-resume, init-verify-work

### Task 3: Registry Wiring

- Added 26 registrations to `sdk/src/query/index.ts` (13 dot-delimited + 13 space-delimited aliases)
- All registrations placed before the event emission wiring block

## Verification

- 22 unit tests passing
- 22 golden integration tests passing (including 5 new init tests)
- 1128 total SDK unit tests passing
- TypeScript compiles clean

## Must-Haves Satisfied

- SDK composes 13 simple/medium init commands from existing atomic queries
- Every init handler injects withProjectRoot metadata
- Init handler output matches CJS output shape (flat JSON, same field names)
- Golden tests validate CJS output parity for the 5 most critical init handlers
