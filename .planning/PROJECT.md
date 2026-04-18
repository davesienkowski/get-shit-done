# GSD Enhancement Initiative — PBR Backport

## What This Is

An initiative to enhance the Get Shit Done (GSD) framework by porting the best innovations discovered while building Plan-Build-Run (PBR), a fork of GSD. This is a brownfield enhancement of the existing GSD codebase at `D:\Repos\get-shit-done`, with PRs targeting the upstream repo `gsd-build/get-shit-done`.

## Core Value

Systematically improve GSD's workflow quality, power-user configuration, and developer experience by adopting battle-tested patterns from PBR — without breaking existing GSD workflows or philosophy.

## Requirements

### Validated

- Existing GSD command system (60+ commands) -- existing
- Existing agent system (22 specialized agents) -- existing + gsd-intel-updater
- Existing workflow orchestration (discuss, plan, execute, verify) -- existing
- Existing state management (.planning/ directory) -- existing
- Existing codebase mapping (parallel mapper agents) -- existing
- Existing hook system (8 hooks) -- existing
- Existing CLI tooling (gsd-tools.cjs) -- existing
- Multi-runtime support (Claude Code, OpenCode, Gemini, Copilot, etc.) -- existing
- Shared reference docs (anti-patterns, context-budget, gate-prompts, revision-loop, domain-probes, agent-contracts) -- v1.0
- Model profile system (quality/balanced/budget/adaptive + per-agent overrides) -- v1.0
- Execution context profiles (dev/research/review) -- v1.0
- Advanced config.json schema (depth, context_window_tokens, features.*) -- v1.0
- /gsd-explore (Socratic ideation with output routing) -- v1.0
- /gsd-undo (safe git revert by phase/plan) -- v1.0
- /gsd-import (external plan/PRD import with conflict detection) -- v1.0
- /gsd-intel (persistent queryable codebase intelligence) -- v1.0
- /gsd-scan (rapid codebase assessment) -- v1.0
- Enhanced /gsd-next (hard stops, consecutive-call guard) -- v1.0
- Wave execution feature flag (workflow.wave_execution) -- v1.0
- Gates taxonomy reference doc -- v1.0
- Phase manifest tracking (.phase-manifest.json) -- v1.0
- Thinking model reference docs (5 docs) -- v1.0
- Few-shot calibration examples (plan-checker, verifier) -- v1.0
- Learnings system (LEARNINGS.md write/read) -- v1.0
- Status line in stage banners -- v1.0
- Intel auto-refresh in execute-phase and map-codebase -- v1.0

- `gsd-sdk query` CLI with typed state queries — v3.0
- Error classification taxonomy (validation, execution, blocked, interruption) — v3.0
- Exit code semantics (0/1/10/11 mapping for CLI vs library usage) — v3.0
- All read-only queries migrated to TypeScript SDK — v3.0
- All state mutations migrated to TypeScript SDK — v3.0
- Verification suite (plan validation, completeness, key-links, health checks) — v3.0
- Full phase lifecycle management (add, insert, remove, complete, scaffold, archive) — v3.0
- Init composition handlers replacing 16 compound CJS commands — v3.0
- Staged execution pipeline (prepare/execute/finalize) — v3.0
- 79 workflow files migrated from `node gsd-tools.cjs` to `gsd-sdk query` — v3.0
- GSDTools bridge retired, CJS files deprecated — v3.0
- Upstream v1.34.0 reconciliation (67 new CJS handlers mirrored in SDK) — v3.0
- 1201 unit tests + 22 golden integration tests — v3.0

### Active

(Next milestone — see ROADMAP.md)

## Current State

**v3.0 SDK-First Migration** — SHIPPED 2026-04-08

Migrated all deterministic orchestration from gsd-tools.cjs (12K-line CJS monolith) into the TypeScript SDK (@gsd-build/sdk). 7 phases, 21 plans, 40 requirements, 1201 tests.

**Next milestone:** Not yet planned. Run `/gsd-new-milestone` to start.

### Out of Scope

- PBR branding/naming — GSD keeps its identity
- Web dashboard — too large for this initiative, separate effort
- HTTP-based hook server — adopt patterns not infrastructure
- dev-sync agent — PBR-specific for cross-plugin sync
- Reducing agent count — GSD's specialization is an advantage
- Session tracker/telemetry — separate initiative
- CJS file deletion — deprecated in v3.0, final deletion deferred to cleanup validation

## Context

- **Source material**: PBR plugin at `D:\Repos\plan-build-run\plugins\pbr` (v2.22.0)
- **Target**: GSD upstream at `D:\Repos\get-shit-done`
- **Git workflow**: PRs push to `myfork` (davesienkowski/get-shit-done), target `origin/main`
- **Commit format**: `type(scope): description` per GSD-STYLE.md
- **No co-author tags** on any commits
- **Context window**: 1M tokens (Opus 4.6)
- **Model profile**: Quality tier throughout
- GSD is a Claude Code plugin with agents, commands, skills, workflows, hooks, templates, and references
- PBR evolved significantly beyond the original fork — v2.22.0 has 46 skills, 18 agents, 71 commands, 17 gate modules, 31 reference docs
- Key PBR innovations: shared refs system, intel persistence, session auditing, model profiles, wave execution, gates, anti-pattern framework

## Constraints

- **Backwards compatibility**: All existing GSD commands must continue working
- **Architecture**: Follow existing GSD patterns (commands→workflows→agents, state in .planning/)
- **Naming**: Use `gsd-` prefix for agents, `/gsd:` prefix for commands
- **Style**: Follow GSD-STYLE.md commit format and code conventions
- **No co-author**: Never add co-author tags to commits
- **PR-ready**: Each milestone should produce PR-ready work for upstream review

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Port patterns not code | PBR uses different naming/structure; adapt to GSD conventions | Good |
| Shared refs before skills | Foundation enables consistent skill behavior | Good |
| Standard granularity | 5-8 phases per milestone balances thoroughness with velocity | Good |
| Quality model profile | 1M context + Opus enables deeper analysis | Good |
| Skip dashboard | Too large; better as separate initiative | Good |
| Merge continue into next | Avoid command duplication; next already had 8-route table | Good |
| Deprecate plan-phase --prd | /gsd-import --prd provides better conflict detection | Good |
| Disable worktrees on Windows | Windows creates worktree branches from wrong base commit | Good |
| Intel disabled by default | Opt-in prevents unwanted token spend on codebase scans | Good |
| Hybrid init call style | Direct imports for reads, registry.dispatch() for mutations | Good |
| Deprecate not delete CJS | Safety — validate SDK parity before permanent removal | Good |
| Full v4.0 implementations | Implemented intel/learnings/uat/profile as real handlers, not stubs | Good |
| No CJS shim | Migrated everything now including new v1.34.0 handlers | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? - Move to Out of Scope with reason
2. Requirements validated? - Move to Validated with phase reference
3. New requirements emerged? - Add to Active
4. Decisions to log? - Add to Key Decisions
5. "What This Is" still accurate? - Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after v3.0 SDK-First Migration milestone shipped*
