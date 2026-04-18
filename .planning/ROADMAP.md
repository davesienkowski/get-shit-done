# Roadmap: GSD SDK-First Migration

## Overview

Migrate all deterministic orchestration from gsd-tools.cjs (12K-line CJS monolith) into the TypeScript SDK (@gsd-build/sdk), retiring gsd-tools.cjs entirely. The migration proceeds in dependency order: foundation and test infrastructure first, then read-only queries, then mutations, then verification, then phase lifecycle, and finally composition patterns that replace compound commands and retire the legacy monolith. Each phase pairs native TypeScript rewrites with call-site migration -- no permanent wrappers.

## Milestones

- ✅ **v1.0 PBR Backport** - Phases 1-6 (shipped 2026-04-04)
- ✅ **v2.0 Thinking Partner** - Phases 7-8 (shipped 2026-04-04)
- ✅ **v3.0 SDK-First Migration** - Phases 9-14 (shipped 2026-04-08)
- 🟡 **v3.1 Upstream Landing** - Phase 15 (in flight — completes open PRs #2340–#2343)

## Phases

<details>
<summary>✅ v1.0 PBR Backport (Phases 1-6) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>✅ v2.0 Thinking Partner (Phases 7-8) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>✅ v3.0 SDK-First Migration (Phases 9-14) - SHIPPED 2026-04-08</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>🟡 v3.1 Upstream Landing (Phase 15) - IN FLIGHT</summary>

### Phase 15: Phase 3 PR Amendment Completion

Closes umbrella issue #2302 by folding every parity gap, fallback wiring, session-ID correlation, real-test replacement, and documentation restructure into the four already-open upstream PRs (#2340 docs/call-sites, #2341 parity harness + handlers, #2342 runners + universal fallback, #2343 deprecation header) rather than deferring to a follow-up Phase 3.5.

**Goals:**
- Universal CJS fallback for unregistered commands and opt-in for execution errors (`GSD_QUERY_FALLBACK` policy)
- Missing handlers ported (`state.signal-waiting`, `state.signal-resume`, `phase.list-plans`, `phase.list-artifacts`, `plan.task-structure`, `requirements.extract-from-plans`, `learnings.list/prune/delete`, `config-path`)
- Runner alignment (`preferNativeQuery: true` default in PhaseRunner/InitRunner/GSD)
- Real tests replacing stubs (`profile.test.ts`, `skills.test.ts`, `websearch.test.ts` + E2E + error classification)
- Documentation architecture (`sdk/README.md` + `sdk/docs/{PARITY,GOLDEN-TESTS,ARCHITECTURE}.md`; retire `sdk/HANDOVER-*.md`)
- Session ID threaded through `createRegistry()` and mutation events
- Agent determinism cleanup (no `cat STATE.md`, no `ls *PLAN.md`, no `grep <task`)

**Plans (one per upstream PR):**
- 15-01-PLAN — PR #2340 amendments (docs + call-sites + SDK README + HANDOVER consolidation)
- 15-02-PLAN — PR #2341 amendments (missing handlers + real tests + matrix fix)
- 15-03-PLAN — PR #2342 amendments (runner activation + universal fallback + session IDs + TS loadConfig port)
- 15-04-PLAN — PR #2343 verification (land as-is; no amendments)
- 15-05-PLAN — Master strategy: per-PR review + in-PR gap closure for #2302 (imported; coordinates 01–04)

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Foundation and Test Infrastructure | v3.0 | 3/3 | Complete | 2026-04-08 |
| 10. Read-Only Queries | v3.0 | 3/3 | Complete | 2026-04-08 |
| 11. State Mutations | v3.0 | 3/3 | Complete | 2026-04-08 |
| 12. Verification Suite | v3.0 | 3/3 | Complete | 2026-04-08 |
| 13. Phase Lifecycle | v3.0 | 3/3 | Complete | 2026-04-08 |
| 13.1. Upstream Reconciliation | v3.0 | 2/2 | Complete | 2026-04-08 |
| 14. Composition and Retirement | v3.0 | 4/4 | Complete | 2026-04-08 |
| 15. Phase 3 PR Amendment Completion | v3.1 | 0/5 | In Flight | — |
