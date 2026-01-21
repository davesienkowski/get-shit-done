# GitHub Issue: `/gsd:progress --full` mode

**Title:** Add `--full` flag to `/gsd:progress` for complete milestone tree view

---

## Problem

After working through multiple phases, it's hard to recall what was previously planned and decided. `/gsd:progress` shows recent work and current position, but doesn't answer:

- "What did I decide about auth back in phase 3?"
- "Which phase handled rate limiting?"
- "How many tasks remain across all phases?"

## Why Not STATE.md?

Considered enhancing STATE.md instead, but it's the wrong fit:

- **Size constraint:** STATE.md is designed to stay under 100-150 lines ("digest, not archive")
- **Purpose mismatch:** STATE.md = working memory; this problem = reference/recall
- **Would duplicate data:** Plan/summary info already exists in source files

`/gsd:progress` is already the "situational awareness" command — extending it with `--full` keeps one entry point for "where am I / what's the picture."

## Proposal

Add optional `--full` flag:

```bash
/gsd:progress          # Current behavior (quick orientation)
/gsd:progress --full   # Full milestone tree with all phases/plans
```

## Example Output (--full)

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

## Summary
- Phases: 2 of 4 complete
- Plans: 8 of 12 complete
```

**Status indicators:** `✓` done, `→` current, `○` planned

## Why This Fits GSD

- One flag, zero new dependencies
- Reads existing PLAN.md/SUMMARY.md files
- Default behavior unchanged
- Solves recall without dashboards or external tools

## Implementation Notes

- Extract key decisions from SUMMARY.md frontmatter
- Tree scoped to current milestone only
- Statistics aggregated from file counts

---

**Full spec:** `.planning/contrib/progress-full-mode-PLAN.md`
