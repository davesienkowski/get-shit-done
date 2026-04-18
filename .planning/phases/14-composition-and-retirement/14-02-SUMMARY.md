---
phase: 14-composition-and-retirement
plan: 02
status: complete
started: 2026-04-08T11:00:00Z
completed: 2026-04-08T14:40:00Z
commits:
  - c8b6b1e feat(14-02): complex init handlers, pipeline middleware, workspace resolution
requirements_covered: [COMP-01, COMP-02, COMP-03, COMP-04, MIGR-05]
---

# Plan 14-02 Summary: Complex Init, Pipeline, Workspace

## What Was Done

### Task 1: Complex init handlers + pipeline middleware

**sdk/src/query/init-complex.ts** (3 complex handlers):
- `initNewProject`: Code scanning (depth-limited), package file detection, API key detection from env vars and ~/.gsd/ files, brownfield detection
- `initProgress`: Phase scan with plan/summary counting, paused state detection, ROADMAP-only phase merging, milestone info
- `initManager`: Full ROADMAP.md parsing, disk status computation, dependency graph, sliding-window discuss gate, recommended actions with independence filtering

**sdk/src/query/pipeline.ts** (staged execution middleware):
- `wrapWithPipeline` with prepare/execute/finalize stages
- Dry-run: copies `.planning/` to temp dir, runs mutation against clone, diffs before/after content per file, returns structured diff without touching real project
- Temp dir always cleaned in `finally` block (T-14-06)

### Task 2: Workspace resolution + registry wiring

**sdk/src/query/workspace.ts**:
- `resolveWorkspaceContext()`: reads GSD_WORKSTREAM/GSD_PROJECT env vars
- `workspacePlanningPaths()`: scopes paths to workstream/project subdirectory
- Validation rejects empty, path-separator, and `..` names (T-14-05)

**sdk/src/query/index.ts**: 6 new registrations (3 dot + 3 space-delimited aliases)

## Verification

- 39 new tests (13 init-complex, 11 pipeline, 15 workspace)
- 1167 total SDK unit tests passing
- TypeScript compiles clean

## Must-Haves Satisfied

- 3 complex init handlers implemented and tested
- Pipeline middleware with full in-memory clone+diff dry-run working
- Workspace-aware state resolution validates inputs and scopes paths
- All 16 init handlers registered in registry
