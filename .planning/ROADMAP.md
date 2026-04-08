# Roadmap: GSD SDK-First Migration

## Overview

Migrate all deterministic orchestration from gsd-tools.cjs (12K-line CJS monolith) into the TypeScript SDK (@gsd-build/sdk), retiring gsd-tools.cjs entirely. The migration proceeds in dependency order: foundation and test infrastructure first, then read-only queries, then mutations, then verification, then phase lifecycle, and finally composition patterns that replace compound commands and retire the legacy monolith. Each phase pairs native TypeScript rewrites with call-site migration -- no permanent wrappers.

## Milestones

- ✅ **v1.0 PBR Backport** - Phases 1-6 (shipped 2026-04-04)
- ✅ **v2.0 Thinking Partner** - Phases 7-8 (shipped 2026-04-04)
- 🚧 **v3.0 SDK-First Migration** - Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 PBR Backport (Phases 1-6) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>✅ v2.0 Thinking Partner (Phases 7-8) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

### 🚧 v3.0 SDK-First Migration (In Progress)

**Milestone Goal:** Replace gsd-tools.cjs with typed TypeScript SDK, retiring the CJS monolith entirely.

- [ ] **Phase 9: Foundation and Test Infrastructure** - Error classification, query registry, CLI extension, utilities, golden file test harness
- [x] **Phase 10: Read-Only Queries** - Config, state, phase finder, roadmap, progress, and frontmatter read operations (completed 2026-04-08)
- [ ] **Phase 11: State Mutations** - State updates, frontmatter writes, config writes, git commits, template fills, event emission
- [ ] **Phase 12: Verification Suite** - Plan structure validation, phase completeness, artifact checks, key-link verification, consistency and health checks
- [ ] **Phase 13: Phase Lifecycle** - Phase add, insert, remove, complete, scaffold, and archive operations
- [ ] **Phase 14: Composition and Retirement** - Composable init chains, staged execution, workspace contexts, dry-run mode, workflow migration, gsd-tools.cjs deletion

## Phase Details

### Phase 9: Foundation and Test Infrastructure
**Goal**: SDK has a working query CLI with error classification, registry routing, and golden file test infrastructure that validates output compatibility
**Depends on**: Nothing (first phase of milestone)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, MIGR-01, MIGR-02
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query generate-slug "My Phase"` returns a JSON result with a kebab-case slug
  2. SDK errors carry a classification enum (validation/execution/blocked/interruption) and map to semantic exit codes (0/1/10/11)
  3. Running `gsd-sdk query` with an unknown command falls back to gsd-tools.cjs and returns the same output
  4. Golden file test suite exists and can compare SDK query output against captured gsd-tools.cjs output for any migrated command
  5. A wrapper-count metric script reports how many gsd-tools.cjs bridge calls remain in the SDK
**Plans:** 3 plans
Plans:
- [x] 09-01-PLAN.md — Error classification system and utility query handlers
- [x] 09-02-PLAN.md — Query registry, CLI subcommand routing, and --pick extraction
- [x] 09-03-PLAN.md — Golden file test harness and wrapper-count metric script

### Phase 10: Read-Only Queries
**Goal**: SDK can read and parse all .planning/ state artifacts -- config, STATE.md, phase directories, ROADMAP.md, progress, and frontmatter -- returning typed JSON
**Depends on**: Phase 9
**Requirements**: QUERY-01, QUERY-02, QUERY-03, QUERY-04, QUERY-05, QUERY-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query state.load` returns the same structured JSON that `node gsd-tools.cjs state json` returns, validated by golden file tests
  2. Running `gsd-sdk query config.get model_profile` returns the correct config value with `--pick` field extraction
  3. Running `gsd-sdk query phase.find 9` locates the phase directory on disk and returns its path and metadata
  4. Running `gsd-sdk query roadmap.analyze` returns phase list with disk status correlation matching gsd-tools.cjs output
  5. Running `gsd-sdk query frontmatter.get <path>` returns parsed YAML frontmatter from any .planning artifact
**Plans:** 3/3 plans complete
Plans:
- [x] 10-01-PLAN.md — Shared helpers, frontmatter parser, and config query handlers
- [x] 10-02-PLAN.md — State query handlers and phase finding
- [x] 10-03-PLAN.md — Roadmap analysis, progress rendering, and golden file tests

### Phase 11: State Mutations
**Goal**: SDK can write to all .planning/ state artifacts -- updating STATE.md fields, writing frontmatter, setting config values, creating git commits, filling templates -- with typed event emission on every mutation
**Depends on**: Phase 10
**Requirements**: MUTATE-01, MUTATE-02, MUTATE-03, MUTATE-04, MUTATE-05, MUTATE-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query state.update current_phase 10` atomically updates STATE.md and the change is reflected in subsequent `state.load` calls
  2. Running `gsd-sdk query frontmatter.set <path> status complete` writes valid YAML frontmatter that round-trips through `frontmatter.get`
  3. Running `gsd-sdk query config.set model_profile quality` validates the value against the config schema before writing
  4. Running `gsd-sdk query commit "phase 10 complete"` creates a git commit for .planning/ artifacts identical to gsd-tools.cjs behavior
  5. Every state-mutating query emits a typed event through the SDK event stream that a WebSocket listener can observe
**Plans:** 1/3 plans executed
Plans:
- [x] 11-01-PLAN.md — STATE.md mutations and frontmatter write handlers
- [ ] 11-02-PLAN.md — Config mutation handlers and git commit handlers
- [ ] 11-03-PLAN.md — Template fill/select, mutation event types, event emission wiring, golden tests

### Phase 12: Verification Suite
**Goal**: SDK can validate plan structure, check phase completeness, verify artifact existence, validate key-link integration points, and run health checks with optional repair -- replacing verify.cjs entirely
**Depends on**: Phase 11
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05, VERIFY-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query verify.plan-structure <plan-path>` returns the same validation results as `node gsd-tools.cjs verify plan-structure`
  2. Running `gsd-sdk query verify.phase-completeness 9` checks for required artifacts (PLAN.md, SUMMARY.md) and reports missing items
  3. Running `gsd-sdk query verify.key-links <plan-path>` validates integration points referenced in plan must-haves
  4. Running `gsd-sdk query validate.consistency` detects drift between STATE.md, ROADMAP.md, and phase directories on disk
  5. Running `gsd-sdk query validate.health --repair` fixes recoverable inconsistencies and reports what was repaired
**Plans**: TBD

### Phase 13: Phase Lifecycle
**Goal**: SDK can manage the full phase lifecycle -- adding, inserting, removing, completing, scaffolding, and archiving phases -- with all tracking artifacts updated atomically
**Depends on**: Phase 12
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query phase.add "New Phase"` creates a phase directory, updates ROADMAP.md, and updates STATE.md in one operation
  2. Running `gsd-sdk query phase.insert 10 "Urgent Fix"` inserts a decimal phase (10.1), renumbers as needed, and updates all references
  3. Running `gsd-sdk query phase.complete 9` marks the phase done in ROADMAP.md, updates progress in STATE.md, and emits a PhaseComplete event
  4. Running `gsd-sdk query phase.scaffold 14` creates the phase directory with PLAN.md, SUMMARY.md templates pre-filled with phase metadata
  5. Running `gsd-sdk query phases.archive` moves completed phase directories to archive and cleans up for milestone completion
**Plans**: TBD

### Phase 14: Composition and Retirement
**Goal**: SDK replaces all 16 compound init commands with composable typed query chains, implements staged execution, and gsd-tools.cjs is fully deleted from the tree with all 65 workflows migrated to `gsd-sdk query`
**Depends on**: Phase 13
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, MIGR-03, MIGR-04, MIGR-05, MIGR-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd-sdk query init.execute-phase 9` returns the same JSON bundle as `node gsd-tools.cjs init execute-phase 9`, composed from atomic query functions with zero shell-out overhead
  2. All 65 workflow markdown files call `gsd-sdk query` instead of `node gsd-tools.cjs` -- zero instances of the old invocation pattern remain
  3. gsd-tools.cjs, the GSDTools bridge class, and all lib/*.cjs files are deleted from the repository
  4. Running any existing GSD command (`/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-next`, etc.) works correctly end-to-end using only the SDK
  5. SDK CI passes on all platforms (Ubuntu, macOS, Windows) with Node 22 and 24
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Foundation and Test Infrastructure | v3.0 | 0/3 | Not started | - |
| 10. Read-Only Queries | v3.0 | 3/3 | Complete    | 2026-04-08 |
| 11. State Mutations | v3.0 | 1/3 | In Progress|  |
| 12. Verification Suite | v3.0 | 0/0 | Not started | - |
| 13. Phase Lifecycle | v3.0 | 0/0 | Not started | - |
| 14. Composition and Retirement | v3.0 | 0/0 | Not started | - |
