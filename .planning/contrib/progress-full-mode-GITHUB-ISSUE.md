<!--
GitHub Issue - Copy everything below this line
Title: feat: Add --full flag to /gsd:progress for complete milestone tree view
Labels: enhancement
-->

## Problem

After working through multiple phases, it's difficult to recall what was previously planned and decided. `/gsd:progress` shows recent work and current position, but doesn't answer:

- "What did I decide about auth back in phase 3?"
- "Which phase handled rate limiting?"
- "How many tasks remain across all phases?"

## Why Not STATE.md?

Considered enhancing STATE.md instead, but it's the wrong fit:

| Factor | STATE.md | /gsd:progress --full |
|--------|----------|---------------------|
| Size constraint | Violates 100-line limit | No constraint (output only) |
| Purpose | Working memory (digest) | Reference/recall |
| Data source | Would duplicate | Aggregates existing files |

`/gsd:progress` is already the "situational awareness" command — extending it keeps one entry point.

## Proposal

Add optional `--full` flag:

```bash
/gsd:progress          # Current behavior (quick orientation)
/gsd:progress --full   # Full milestone tree with all phases/plans
```

## Example Output

```
## Full Milestone Tree

Phase 70: Database Schema [DONE]
├─ 70-01: Core tables ✓
├─ 70-02: Indexes ✓
└─ 70-03: Migrations ✓

Phase 71: API Layer [DONE]
├─ 71-01: Auth endpoints ✓
│  └─ Decision: JWT with refresh rotation
├─ 71-02: User CRUD ✓
└─ 71-03: Rate limiting ✓

Phase 72: Frontend [IN PROGRESS]
├─ 72-01: Login form ✓
├─ 72-02: Dashboard → CURRENT
└─ 72-03: Settings ○

Phase 73: Testing [PLANNED]
└─ (not yet planned)

## Milestone Summary
- Phases: 2 of 4 complete
- Plans: 8 of 12 complete
- Decisions logged: 2
```

**Status indicators:** `✓` done | `→` current | `○` planned

## GSD Philosophy Alignment

| Principle | How This Aligns |
|-----------|-----------------|
| Solo developer focus | Solves recall without dashboards |
| Complexity hidden | One flag adds capability |
| Files as source of truth | Aggregates existing PLAN/SUMMARY files |
| No new dependencies | Pure file reading |
| Backwards compatible | Default unchanged |

## Implementation Notes

- Key decisions extracted from SUMMARY.md frontmatter `key-decisions` field
- Tree scoped to current milestone only
- Statistics aggregated from PLAN.md/SUMMARY.md file counts
- Introduces `arguments:` frontmatter pattern for command flags
