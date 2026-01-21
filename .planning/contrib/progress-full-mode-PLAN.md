---
title: "Enhancement: /gsd:progress --full mode"
type: enhancement
status: draft
target: commands/gsd/progress.md
affects:
  - commands/gsd/progress.md
---

# Enhancement: `/gsd:progress --full` Mode

## Problem Statement

After working through multiple phases of a project, developers lose track of what was previously planned and decided. The current `/gsd:progress` command optimizes for "where am I now" but doesn't answer "what's the full picture of everything I planned?"

**Symptoms:**
- "What did I decide about auth back in phase 3?"
- "Which phase handled the API rate limiting?"
- "How many tasks are left across all remaining phases?"

**Current behavior:** Shows recent 2-3 summaries, current position, and next action.

**Gap:** No way to see full milestone tree with task-level detail and key decisions per phase.

## Why Not Enhance STATE.md Instead?

STATE.md was considered as an alternative location for this feature. Analysis showed it's the wrong approach:

**STATE.md design constraints (from template):**
> "Keep STATE.md under 100 lines. It's a DIGEST, not an archive."

**What STATE.md already does well:**
- Current position (phase/plan/status)
- Decisions table (phase → decision → rationale)
- Deferred issues and blockers
- Session continuity

**What STATE.md cannot do (by design):**
- Task-level detail per plan (would 3x file size)
- Full tree view of all phases/plans
- Plan descriptions/summaries

**Comparison:**

| Factor | STATE.md Enhancement | /gsd:progress --full |
|--------|---------------------|---------------------|
| Size constraint | Violates 100-150 line limit | No constraint (output only) |
| Maintenance | Must update file structure | Reads existing files |
| Purpose alignment | Breaks "digest" design | Fits "situational awareness" |
| Information source | Duplicates PLAN/SUMMARY data | Aggregates from source files |

**Conclusion:** STATE.md is working memory. The recall problem requires reference documentation. `/gsd:progress --full` generates reference on-demand without changing STATE.md's purpose.

## Proposed Solution

Add an optional `--full` flag to `/gsd:progress` that expands the output to show the complete milestone tree.

```bash
/gsd:progress          # Current behavior (quick orientation)
/gsd:progress --full   # Expanded tree view of entire milestone
```

## Implementation

### 1. Argument Parsing

Add to the command's process:

```xml
<step name="parse_args">
**Parse arguments:**

Check if `--full` flag is present.
Set `FULL_MODE=true` if flag provided, otherwise `FULL_MODE=false`.
</step>
```

### 2. Full Tree Generation (when --full)

After the existing `report` step, add conditional expansion:

```xml
<step name="full_tree" condition="FULL_MODE=true">
**Generate full milestone tree:**

For each phase in ROADMAP.md (current milestone only):
1. List all PLAN.md files in phase directory
2. For each plan, extract:
   - Plan name from filename
   - Status: DONE (has SUMMARY.md), CURRENT (next to execute), PLANNED (no summary)
   - Key decision (if any) from SUMMARY.md or STATE.md
3. Format as indented tree

**Output format:**

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
```

**Status indicators:**
- `✓` = complete (SUMMARY.md exists)
- `→` = current (next to execute)
- `○` = planned (PLAN.md exists, no SUMMARY.md)
- `(not yet planned)` = no PLAN.md files

**Key decisions:** Extract from SUMMARY.md frontmatter `key-decisions` field or from plan's major choices. Show max 1 per plan to keep output scannable.
</step>
```

### 3. Decision Extraction Logic

```xml
<step name="extract_decisions" condition="FULL_MODE=true">
**Extract key decisions for each completed plan:**

For each SUMMARY.md:
1. Parse frontmatter for `key-decisions` array
2. If present, take first decision (most important)
3. If absent, skip decision line for that plan

Only show decisions for completed plans (not planned ones).
</step>
```

### 4. Statistics Summary

At the end of the full tree, add aggregate stats:

```
## Summary
- **Phases:** 2 of 4 complete
- **Plans:** 8 of 12 complete
- **Decisions logged:** 5
```

## Example Output

### Standard mode (`/gsd:progress`)

```
# MyProject

**Progress:** [████████░░] 8/10 plans complete

## Recent Work
- [Phase 71, Plan 03]: Rate limiting with Redis sliding window
- [Phase 72, Plan 01]: Login form with validation

## Current Position
Phase 72 of 73: Frontend
Plan 02 of 03: Dashboard

## What's Next
**72-02: Dashboard** — Build main dashboard with activity feed

`/gsd:execute-plan .planning/phases/72-frontend/72-02-PLAN.md`
```

### Full mode (`/gsd:progress --full`)

Same as above, PLUS:

```
## Full Milestone Tree

Phase 70: Database Schema [DONE]
├─ 70-01: Core tables ✓
├─ 70-02: Indexes ✓
└─ 70-03: Migrations ✓

Phase 71: API Layer [DONE]
├─ 71-01: Auth endpoints ✓
│  └─ Decision: JWT with refresh rotation using jose library
├─ 71-02: User CRUD ✓
└─ 71-03: Rate limiting ✓
   └─ Decision: Redis sliding window, 100 req/min

Phase 72: Frontend [IN PROGRESS]
├─ 72-01: Login form ✓
├─ 72-02: Dashboard → CURRENT
└─ 72-03: Settings ○

Phase 73: Testing [PLANNED]
└─ (not yet planned)

## Summary
- **Phases:** 2 of 4 complete
- **Plans:** 8 of 12 complete
- **Decisions logged:** 2
```

## Alignment with GSD Philosophy

| Principle | How This Aligns |
|-----------|-----------------|
| Complexity in system, not workflow | One flag adds capability; parsing logic is hidden |
| Solo developer focus | Solves recall problem without dashboards or external tools |
| No new dependencies | Reads existing PLAN.md/SUMMARY.md files |
| Claude-readable | Output is markdown, can be piped or saved |
| Files remain source of truth | Aggregates from existing files, creates nothing new |
| Backwards compatible | Default behavior unchanged; --full is opt-in |

## Success Criteria

- [ ] `--full` flag recognized and parsed
- [ ] Tree shows all phases in current milestone
- [ ] Each phase shows all plans with correct status indicator
- [ ] Key decisions extracted from completed plan summaries
- [ ] Statistics summary accurate
- [ ] Default mode (no flag) unchanged
- [ ] Output renders correctly in terminal

## Future Considerations

- `--phase N` flag to show tree for specific phase only
- `--decisions` flag to show only plans with logged decisions
- JSON output mode for tooling integration
