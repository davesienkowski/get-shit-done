---
phase: 14-composition-and-retirement
plan: 03
status: complete
started: 2026-04-08T14:40:00Z
completed: 2026-04-08T14:50:00Z
commits:
  - 4018fee feat(14-03): stub handlers for 25+ gap commands + workflow migration from gsd-tools.cjs
requirements_covered: [MIGR-03, MIGR-05]
---

# Plan 14-03 Summary: Stubs + Workflow Migration

## What Was Done

### Task 1: Stub handlers

**sdk/src/query/stubs.ts** (~370 lines, 30+ exported handlers):

Functional stubs (minimal real implementations):
- `agentSkills` — scans skill directories, returns list
- `roadmapUpdatePlanProgress` — toggles plan checkboxes in ROADMAP.md
- `requirementsMarkComplete` — marks REQ-IDs complete in REQUIREMENTS.md
- `statePlannedPhase` — updates STATE.md with planning record
- `verifySchemaDrift` — checks plan frontmatter required fields
- `todoMatchPhase` — scans .planning/todos/ by phase
- `milestoneComplete` — wraps phasesArchive
- `summaryExtract` — parses sections from SUMMARY.md files
- `historyDigest` — scans all phase SUMMARYs for history
- `statsJson` — counts phases/plans, computes progress metrics
- `commitToSubrepo` — git operations with path traversal check (T-14-10)
- `progressBar` — text progress bar from roadmap analysis
- Workstream stubs: `workstreamList/Create/Set/Status/Complete/Progress`
- `docsInit` — documentation workflow context

v4.0 stubs (graceful deferral):
- `learningsCopy`, `uatRenderCheckpoint`, `auditUat`
- Intel family: `intelDiff/Snapshot/Validate/Status/Query/ExtractExports/PatchMeta`
- Profile family: `generateClaudeProfile/DevPreferences`, `writeProfile`, `profileQuestionnaire/Sample`, `scanSessions`
- `generateClaudeMd`

All registered with both dot-delimited and space-delimited aliases.

### Task 2: Workflow migration

79 markdown files migrated from `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"` to `gsd-sdk query`.
Domain+subcommand patterns converted to dot notation (e.g. `state begin-phase` → `state.begin-phase`).
Zero CJS invocations remain in workflows/agents/commands/references.

## Verification

- 30 stub tests passing
- 1197 total SDK unit tests passing
- Zero `node.*gsd-tools.cjs` references in active markdown files
- TypeScript compiles clean

## Must-Haves Satisfied

- Zero instances of `node.*gsd-tools.cjs` in workflow/agent/command/reference files
- Stub handlers exist for all gap commands
- All stubs registered and returning valid QueryResult
- Stubs have unit tests
