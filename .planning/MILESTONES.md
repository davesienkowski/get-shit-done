# Milestones

## v3.0 SDK-First Migration (Shipped: 2026-04-08)

**Phases completed:** 7 phases (9-14, including 13.1), 21 plans

**Key accomplishments:**

1. Built query CLI with error classification, registry routing, and golden test infrastructure (Phase 9)
2. Migrated all read-only queries — config, state, phases, roadmap, progress, frontmatter (Phase 10)
3. Implemented all state mutations with typed event emission (Phase 11)
4. Built complete verification suite — plan validation, completeness, key-links, health checks (Phase 12)
5. Created full phase lifecycle management — add, insert, remove, complete, scaffold, archive (Phase 13)
6. Reconciled SDK with upstream v1.34.0 CJS changes (Phase 13.1)
7. Composed init chains, migrated all 79 workflows, retired GSDTools bridge (Phase 14)

**Test suite:** 1201 unit tests, 22 golden integration tests, 8 integration tests — all passing

**Requirements:** 40/40 satisfied | **Audit:** PASSED

---

## v2.0 Thinking Partner and Cross-Project Learnings (Shipped: 2026-04-04)

**Phases completed:** 2 phases, 6 plans, 1 tasks

**Key accomplishments:**

- YAML frontmatter template (cross_project, phase, key_insights, patterns) and GLOBAL_LEARNINGS_ENABLED auto-copy block added to gsd-executor.md learnings_write

---

## v1.0 PBR Backport (Shipped: 2026-04-04)

**Phases completed:** 6 phases, 20 plans, 23 tasks

**Key accomplishments:**

- 1. [Rule 2 - Missing Documentation] Added NOTE about PLAN COMPLETE marker detection
- Wired 7 @-references (5 thinking model docs + 2 few-shot examples) into 6 GSD agent files at their primary decision points
- Intel CLI module (intel.cjs) ported from PBR with inverted defaults (disabled by default) and intel.enabled config key added

---
