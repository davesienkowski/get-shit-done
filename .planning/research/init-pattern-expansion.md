# Init Pattern Expansion Research

**Date:** 2026-04-07
**Purpose:** Audit all GSD workflows and agents to identify which use `gsd-tools init` vs manual file reads, and where init expansion would save the most tokens/complexity.

---

## Summary of Findings

- **Total workflow files:** 65
- **Workflows using `init`:** 37 (57%)
- **Workflows NOT using `init`:** 28 (43%)
- **Agent files:** 24 (none use `init` directly; all receive context via `<files_to_read>` from workflow prompts)

### Available Init Commands (from gsd-tools.cjs)

| Init Command | Workflows Using It |
|---|---|
| `init execute-phase <phase>` | execute-phase, execute-plan, complete-milestone |
| `init plan-phase <phase>` | plan-phase, ui-phase |
| `init new-project` | new-project |
| `init new-milestone` | new-milestone |
| `init verify-work <phase>` | verify-work |
| `init phase-op <phase>` | discuss-phase, discuss-phase-assumptions, add-tests, code-review, code-review-fix, insert-phase, remove-phase, research-phase, review, secure-phase, ship, ui-review, validate-phase, verify-phase, add-phase (passes `"0"`) |
| `init milestone-op` | audit-milestone, autonomous |
| `init map-codebase` | map-codebase, scan |
| `init quick <desc>` | quick |
| `init resume` | resume-project |
| `init todos` | add-todo, check-todos |
| `init progress` | progress, milestone-summary |
| `init manager` | manager |
| `init new-workspace` | new-workspace |
| `init list-workspaces` | list-workspaces |
| `init remove-workspace <name>` | remove-workspace |

---

## Workflow-by-Workflow Analysis

### LEGEND

- **Status:** `init` = uses init command, `manual` = reads files manually, `none` = no planning file reads needed, `partial` = uses init but also does manual reads
- **Priority:** P1 (high value) = complex workflow with many manual reads; P2 = moderate; P3 = low/not worth it

---

### A. Workflows Already Using Init (37 workflows)

| # | Workflow | Init Command | Also Has Manual Reads? | Notes |
|---|----------|-------------|----------------------|-------|
| 1 | execute-phase.md | `init execute-phase` | Yes (STATE.md in `<required_reading>`) | Init provides most data; STATE.md read is for "load project context" but init already returns `state_exists` |
| 2 | plan-phase.md | `init plan-phase` | No | Clean init usage, all context from JSON |
| 3 | new-project.md | `init new-project` | Yes (PROJECT.md read later at step 14 for research) | Late-stage PROJECT.md read is for content generation, not context loading |
| 4 | new-milestone.md | `init new-milestone` (step 7) | Yes (PROJECT.md, MILESTONES.md, STATE.md at step 1, before init) | **Partial** — Step 1 reads extract structured data (last milestone name/version/features, project goal, blockers) used to drive interactive goal-gathering. "Goal-gathering needs raw content" was wrong — these are structured field extractions. Safest fix: add `init new-milestone-context` at Step 1 returning conversation fields; keep Step 7 call for post-mutation research/roadmap fields. (See §F edge case 1.) |
| 5 | verify-work.md | `init verify-work` | No | Clean init usage |
| 6 | map-codebase.md | `init map-codebase` | No | Clean init usage |
| 7 | execute-plan.md | `init execute-phase` | Yes (STATE.md, config.json in `<required_reading>`) | Init provides the same data; required_reading is redundant |
| 8 | discuss-phase.md | `init phase-op` | Yes (config.json for vendor_philosophy) | Minor -- single config value read |
| 9 | discuss-phase-assumptions.md | `init phase-op` | Yes (config.json vendor_philosophy, ROADMAP.md) | Similar to discuss-phase |
| 10 | autonomous.md | `init milestone-op` + `init phase-op` (per phase) | Yes (re-reads ROADMAP.md and STATE.md between phases; PROJECT.md and REQUIREMENTS.md in smart_discuss sub-step) | Re-reads of ROADMAP.md and STATE.md between phases are LEGITIMATE (state mutates after each phase completion). However, PROJECT.md and REQUIREMENTS.md reads inside the smart_discuss sub-step are FALSE intentionals — these files don't change between phases and should be loaded once upfront. STATE.md and prior CONTEXT.md reads inside the smart_discuss loop are LEGITIMATE (evolving state). (See §F edge case 2 and `review-and-risks.md` §1.6.) |
| 11 | add-phase.md | `init phase-op "0"` | No | Clean |
| 12 | add-tests.md | `init phase-op` | No | Clean |
| 13 | add-todo.md | `init todos` | No | Clean |
| 14 | audit-milestone.md | `init milestone-op` | No | Clean |
| 15 | check-todos.md | `init todos` | No | Clean |
| 16 | code-review.md | `init phase-op` | No | Clean |
| 17 | code-review-fix.md | `init phase-op` | No | Clean |
| 18 | complete-milestone.md | `init execute-phase "1"` (for model) | Yes (ROADMAP.md, REQUIREMENTS.md, PROJECT.md in required_reading) | **Partial** -- uses init only for model resolution; most data from manual reads. Candidate for its own init. |
| 19 | insert-phase.md | `init phase-op` | No | Clean |
| 20 | list-workspaces.md | `init list-workspaces` | No | Clean |
| 21 | manager.md | `init manager` | Yes (STATE.md blockers section on "View details") | Minor conditional read |
| 22 | milestone-summary.md | `init progress` | Yes (STATE.md for started_at, ROADMAP.md for milestone name) | **Partial** -- init provides phase metadata but workflow still reads STATE.md and ROADMAP.md |
| 23 | new-workspace.md | `init new-workspace` | No | Clean |
| 24 | progress.md | `init progress` | Yes (ROADMAP.md for next phase, MILESTONES.md for last completed) | **Partial** -- init provides progress data but workflow reads more for presentation |
| 25 | quick.md | `init quick` | Yes (STATE.md for quick tasks completed section) | Minor late-stage read |
| 26 | remove-phase.md | `init phase-op` | Yes (STATE.md and ROADMAP.md for parsing current position) | **Partial** |
| 27 | remove-workspace.md | `init remove-workspace` | No | Clean |
| 28 | research-phase.md | `init phase-op` | No | Clean |
| 29 | resume-project.md | `init resume` | Yes (PROJECT.md, STATE.md in `load_state`, ROADMAP.md) | **Partial** — The `load_state` step extracts structured fields (Current Position, Progress, Decisions, Blockers) and renders a formatted box — not raw content display. Expand `init resume` to return these fields. Exception: the `reconstruction` block (when STATE.md is missing) stays manual. (See §F edge case 3.) |
| 30 | review.md | `init phase-op` | No | Clean |
| 31 | scan.md | `init map-codebase` (with fallback `|| echo "{}"`) | No | Clean |
| 32 | secure-phase.md | `init phase-op` | No | Clean |
| 33 | ship.md | `init phase-op` | Yes (ROADMAP.md for phase goal, VERIFICATION.md for status) | **Partial** -- reads specific fields not in phase-op |
| 34 | ui-phase.md | `init plan-phase` | No | Clean |
| 35 | ui-review.md | `init phase-op` | No | Clean |
| 36 | validate-phase.md | `init phase-op` | No | Clean |
| 37 | verify-phase.md | `init phase-op` | No | Clean |

### B. Workflows NOT Using Init (28 workflows)

| # | Workflow | Manual Reads | Data Needed | Could Use Init? | Priority | Proposed Init |
|---|----------|-------------|-------------|----------------|----------|---------------|
| 1 | **transition.md** | STATE.md, PROJECT.md, ROADMAP.md, config.json, phase PLAN.md/SUMMARY.md | Current phase, completion status, next phase name/goal, requirement evolution, config for mode (yolo/interactive) | Yes | **P1** | `init transition <phase>` |
| 2 | **next.md** | STATE.md, ROADMAP.md (via `state json`) | Current phase, plan progress, status, next action routing | **Partial** -- already uses `state json` CLI | P3 | Could use `init next` but `state json` mostly covers it |
| 3 | **session-report.md** | STATE.md, ROADMAP.md | Milestone, phase, progress, blockers, decisions | Yes | **P2** | `init session-report` |
| 4 | **pause-work.md** | Active phase files, STATE.md (via `current-timestamp`) | Phase/plan/task position, completed work, decisions | Partially -- very dynamic content from current session | P3 | Not ideal -- needs live session context that init can't pre-compute |
| 5 | **diagnose-issues.md** | Phase UAT.md gaps section, STATE.md | Gaps YAML, test details, phase dir | Partially -- gaps are complex YAML | P3 | Orchestrated by verify-work which already provides phase context |
| 6 | **discovery-phase.md** | None directly (called by plan-phase) | Phase dir context (passed from caller) | No | N/A | Internal sub-workflow, context passed from plan-phase |
| 7 | **discuss-phase-power.md** | PROJECT.md, REQUIREMENTS.md, STATE.md, ROADMAP.md, prior CONTEXT.md | Phase goal, gray areas, project context | Yes | **P2** | "Gets context from caller" was wrong — caller only provides phase directory metadata. This workflow independently reads PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files as data-point reads (not raw content display). Replace with expanded `init phase-op` passthrough + `list-artifacts --type context`. (See §F edge case 5 and `review-and-risks.md` §1.5.) |
| 8 | **do.md** | `state load` CLI command | Whether .planning/ exists | Already uses `state load` | N/A | Already covered by `state load` |
| 9 | **explore.md** | None (conversational) | No planning file reads | No | N/A | None needed |
| 10 | **fast.md** | STATE.md (optional, only for logging) | Quick Tasks Completed section | No | N/A | Too simple, <=3 file edits |
| 11 | **forensics.md** | STATE.md, ROADMAP.md, config.json, phase artifacts | Current state, phase status, artifacts inventory | Yes | **P2** | `init forensics` |
| 12 | **health.md** | None (delegates to `validate health` CLI) | None -- all via CLI | No | N/A | Already uses CLI |
| 13 | **help.md** | None (static reference) | None | No | N/A | None needed |
| 14 | **import.md** | ROADMAP.md, PROJECT.md, REQUIREMENTS.md, all CONTEXT.md files | Phase structure, constraints, requirements, locked decisions | Yes | **P2** | `init import` |
| 15 | **inbox.md** | GitHub templates (.github/), CONTRIBUTING.md | Template fields, contribution rules | No | N/A | Reads GitHub config, not .planning/ |
| 16 | **list-phase-assumptions.md** | ROADMAP.md (via grep) | Phase description, goal, scope | Yes | **P2** | Could use `init phase-op` (already exists) |
| 17 | **node-repair.md** | None (receives context via parameters) | Failed task context from caller | No | N/A | Internal sub-workflow |
| 18 | **note.md** | None (file I/O only) | None from .planning/ | No | N/A | None needed |
| 19 | **plan-milestone-gaps.md** | MILESTONE-AUDIT.md, REQUIREMENTS.md, ROADMAP.md | Gaps, requirement priorities, phase numbering | Yes | **P2** | `init milestone-gaps` |
| 20 | **plant-seed.md** | STATE.md (for current milestone/phase context) | Current position for `planted_during` field | Minimal | P3 | Minor -- could use `state json` |
| 21 | **pr-branch.md** | None from .planning/ (git-only) | Git branch/commit info | No | N/A | None needed |
| 22 | **profile-user.md** | None from .planning/ | Session JSONL files | No | N/A | Uses profile-specific CLI commands |
| 23 | **settings.md** | config.json (via `state load` + direct read) | Config values | **Partial** -- uses `state load` + manual read | P3 | Already has structured access |
| 24 | **stats.md** | None (delegates to `stats json` CLI) | None -- all via CLI | No | N/A | Already uses CLI |
| 25 | **update.md** | None from .planning/ | Version info from filesystem | No | N/A | None needed |
| 26 | **undo.md** | ROADMAP.md, .phase-manifest.json | Phase dependencies, commit history | Partially | P3 | Lightweight -- git-focused |
| 27 | **cleanup.md** | MILESTONES.md, milestones/ dir, phases/ dir | Milestone versions, phase membership | Yes | **P2** | `init cleanup` |
| 28 | **analyze-dependencies.md** | ROADMAP.md | All phases with scope, files, dependencies | Yes | **P2** | Could use `roadmap analyze` (already exists as CLI) |
| 29 | **audit-uat.md** | None (delegates to `audit-uat` CLI) | None -- all via CLI | No | N/A | Already uses CLI |
| 30 | **docs-update.md** | None (uses `docs-init` CLI) | None -- all via CLI | No | N/A | Already has its own init (`docs-init`) |

---

## C. Agent Analysis

Agents receive context via `<files_to_read>` blocks embedded in the workflow's Task() prompt. They never call `gsd-tools init` directly. This is by design:

- Agents are spawned by workflows, which have already loaded init context
- Workflows pass file paths in `<files_to_read>` so agents read what they need
- Agents are domain-focused (plan, execute, verify) -- init context would be workflow-level overhead

**Key agents and their file reads:**

| Agent | Files Read | Source of Context |
|---|---|---|
| gsd-executor | PLAN.md, STATE.md, CLAUDE.md | `<files_to_read>` from execute-phase workflow |
| gsd-planner | ROADMAP.md, STATE.md, CONTEXT.md, RESEARCH.md, REQUIREMENTS.md | `<files_to_read>` from plan-phase workflow |
| gsd-verifier | PLAN.md, SUMMARY.md, REQUIREMENTS.md | `<files_to_read>` from execute-phase workflow |
| gsd-plan-checker | PLAN.md, PROJECT.md | `<files_to_read>` from plan-phase workflow |
| gsd-phase-researcher | PROJECT.md, ROADMAP.md, config.json | `<files_to_read>` from plan-phase workflow |
| gsd-roadmapper | PROJECT.md, REQUIREMENTS.md, config.json, MILESTONES.md | `<files_to_read>` from new-project/new-milestone |
| gsd-assumptions-analyzer | ROADMAP.md, prior CONTEXT.md | `<files_to_read>` from discuss-phase workflow |
| gsd-debugger | UAT.md, STATE.md | `<files_to_read>` from diagnose-issues/verify-work |
| gsd-codebase-mapper | (explores codebase directly) | `<files_to_read>` from map-codebase workflow |
| gsd-intel-updater | SUMMARY.md, STATE.md, REQUIREMENTS.md | `<files_to_read>` from execute-phase workflow |

**Agent init opportunity:** None recommended. Agents are leaf nodes in the spawn chain -- their context is curated by the orchestrating workflow. Adding init calls to agents would add unnecessary overhead and coupling. The current `<files_to_read>` pattern is clean and explicit.

---

## D. Priority-Ranked Opportunities

### Tier 1: High Value (P1 -- would save significant tokens and complexity)

#### 1. `transition.md` -> new `init transition <phase>`

**Current state:** Reads STATE.md, PROJECT.md, ROADMAP.md, config.json, and phase plan/summary files manually. This is an internal workflow called frequently (after every phase execution in auto-advance mode).

**Data needed:**
- Current phase number, name, directory
- Whether all plans have matching summaries (completion check)
- Next phase number, name, goal
- Whether this is the last phase in the milestone
- Config mode (yolo/interactive)
- Outstanding verification/UAT items
- Workstream mode detection

**Proposed JSON return:**
```json
{
  "current_phase": 3,
  "current_phase_name": "auth",
  "current_phase_dir": ".planning/phases/03-auth",
  "plan_count": 3,
  "summary_count": 3,
  "all_complete": true,
  "outstanding_items": ["03-UAT.md"],
  "next_phase": 4,
  "next_phase_name": "dashboard",
  "next_phase_goal": "Build user dashboard",
  "next_phase_has_context": true,
  "is_last_phase": false,
  "mode": "interactive",
  "milestone_version": "v1.0",
  "workstream_mode": false,
  "commit_docs": true
}
```

**Token savings:** Eliminates 3-4 file reads (STATE.md, ROADMAP.md, config.json, plus ls commands). This workflow runs in every phase cycle, so savings compound.

**Note:** `gsd-tools phase complete` already handles the actual ROADMAP/STATE update. This init would replace the pre-transition context gathering, not the mutation.

---

### Tier 2: Moderate Value (P2 -- meaningful savings)

#### 2. `complete-milestone.md` -> new `init complete-milestone <version>`

**Current state:** Uses `init execute-phase "1"` only for model resolution. Reads ROADMAP.md, REQUIREMENTS.md, PROJECT.md manually via `<required_reading>`. Also calls `roadmap analyze` CLI.

**Data needed:**
- Milestone version, name
- All phase completion status (plan/summary counts per phase)
- Requirements completion stats (total vs checked-off)
- Model profiles for any spawned agents
- Git tag existence
- Milestone archive paths

**Proposed JSON return:**
```json
{
  "milestone_version": "1.0",
  "milestone_name": "MVP",
  "phases_total": 5,
  "phases_complete": 5,
  "all_phases_complete": true,
  "requirements_total": 20,
  "requirements_complete": 18,
  "requirements_incomplete": ["AUTH-03", "DASH-05"],
  "has_audit": true,
  "has_git_tag": false,
  "archive_paths": {...},
  "executor_model": "claude-sonnet-4-6",
  "commit_docs": true
}
```

#### 3. `session-report.md` -> new `init session-report`

**Current state:** Reads STATE.md and ROADMAP.md manually for milestone/phase/progress context.

**Data needed:**
- Current milestone, phase, progress percentage
- Active blockers, recent decisions
- Milestone name and goals

**Proposed JSON return:**
```json
{
  "milestone_version": "1.0",
  "milestone_name": "MVP",
  "current_phase": 3,
  "current_phase_name": "auth",
  "progress_percent": 60,
  "blockers": [...],
  "decisions": [...],
  "reports_dir": ".planning/reports",
  "existing_reports": [...]
}
```

#### 4. `forensics.md` -> new `init forensics`

**Current state:** Reads STATE.md, ROADMAP.md, config.json, and inventories all phase artifacts manually.

**Data needed:**
- Current phase/milestone state
- Phase artifact inventory (which phases have PLAN/SUMMARY/VERIFICATION)
- Config values
- Worktree state

**Proposed JSON return:**
```json
{
  "current_phase": 3,
  "milestone_version": "1.0",
  "phase_artifacts": {
    "01-foundation": {"plans": 2, "summaries": 2, "verification": true, "context": true},
    "02-auth": {"plans": 3, "summaries": 2, "verification": false, "context": true},
    ...
  },
  "has_worktrees": false,
  "config": {...},
  "reports_dir": ".planning/forensics"
}
```

#### 5. `import.md` -> new `init import`

**Current state:** Reads ROADMAP.md, PROJECT.md, REQUIREMENTS.md, and all CONTEXT.md files for conflict detection.

**Data needed:**
- Phase structure from ROADMAP
- Project constraints from PROJECT.md
- Existing requirements for overlap detection
- Locked decisions from CONTEXT.md files

**Proposed JSON return:**
```json
{
  "phases": [{"number": 1, "name": "foundation", "slug": "foundation", "depends_on": []}],
  "project_constraints": ["React + TypeScript", "No SSR"],
  "requirements": [{"id": "AUTH-01", "text": "...", "status": "complete"}],
  "locked_decisions": [{"phase": 2, "decision": "Use JWT, not sessions"}],
  "next_plan_number": "03-02",
  "checker_model": "claude-sonnet-4-6"
}
```

#### 6. `list-phase-assumptions.md` -> use existing `init phase-op`

**Current state:** Reads ROADMAP.md via grep. Could use the existing `init phase-op` which already provides phase number, name, dir, and roadmap existence.

**Change needed:** Add `phase_goal` to `phase-op` init output (if not already there), then update this workflow to use it.

#### 7. `plan-milestone-gaps.md` -> new `init milestone-gaps`

**Current state:** Reads MILESTONE-AUDIT.md, REQUIREMENTS.md, ROADMAP.md. Also queries for highest phase number.

**Data needed:**
- Gaps from MILESTONE-AUDIT.md (parsed YAML)
- Requirement priorities
- Highest existing phase number
- Audit file path

#### 8. `cleanup.md` -> new `init cleanup`

**Current state:** Reads MILESTONES.md, lists milestones/ and phases/ directories.

**Data needed:**
- Completed milestone versions
- Existing phase archive dirs
- Phase directories still in phases/
- Milestone-to-phase mapping

#### 9. `milestone-summary.md` (improvement) -> expand `init progress`

**Current state:** Already uses `init progress` but also manually reads STATE.md and ROADMAP.md.

**Change needed:** Expand `init progress` to include `started_at`, `milestone_name`, and artifact inventory per phase.

#### 10. `analyze-dependencies.md` -> already has `roadmap analyze` CLI

**Current state:** Reads ROADMAP.md and analyzes phases. The `roadmap analyze` CLI command already exists.

**Change needed:** Add dependency/file-domain analysis to `roadmap analyze` or create `init analyze-dependencies`.

---

### Tier 3: Low Value / Not Worth It (P3)

| Workflow | Why Not Worth It |
|---|---|
| `next.md` | Already uses `state json` CLI -- very lean |
| `pause-work.md` | Needs live session context, not static planning data |
| `discuss-phase-power.md` | Called by discuss-phase which already has init |
| `plant-seed.md` | Only reads STATE.md for one field (planted_during) |
| `settings.md` | Already uses `state load` + manual config read -- config is the product |
| `undo.md` | Git-focused, minimal .planning/ reads |
| `fast.md` | Optional STATE.md append, too simple |

### N/A: No Init Needed

| Workflow | Reason |
|---|---|
| `explore.md` | Conversational, no planning file reads |
| `help.md` | Static reference output |
| `note.md` | Direct file I/O, no planning context needed |
| `pr-branch.md` | Git operations only |
| `profile-user.md` | Uses profile-specific CLI commands |
| `update.md` | Reads filesystem version info, not .planning/ |
| `node-repair.md` | Internal, receives context via parameters |
| `discovery-phase.md` | Internal sub-workflow, context from caller |
| `do.md` | Already uses `state load` CLI |
| `health.md` | Delegates to `validate health` CLI |
| `stats.md` | Delegates to `stats json` CLI |
| `audit-uat.md` | Delegates to `audit-uat` CLI |
| `docs-update.md` | Has its own `docs-init` CLI |
| `inbox.md` | Reads GitHub templates, not .planning/ |
| `diagnose-issues.md` | Orchestrated by verify-work, receives context |

---

## E. Workflows with Partial Init (already use init but still have manual reads)

These are existing workflows where manual reads could potentially be eliminated by expanding the init return:

| Workflow | Init Used | Manual Reads Still Present | Fix |
|---|---|---|---|
| new-milestone.md | `init new-milestone` (step 7) | PROJECT.md, MILESTONES.md, STATE.md (step 1), PROJECT.md again (step 9) | **Correction:** Init should be called at step 1, not step 7. Steps 1-6 need *structured data* (last milestone name/version/features, project goal, blockers) — not full file content. `init new-milestone` should return this upfront so the workflow can drive the interactive goal-gathering session without any file reads. The only true "content display" exception is `resume-project.md`. Move init to step 1 and expand its return to include `last_milestone`, `project_goal`, `current_blockers`. |
| execute-phase.md | `init execute-phase` | STATE.md in `<required_reading>` | Remove `<required_reading>` STATE.md -- init already provides state data |
| execute-plan.md | `init execute-phase` | STATE.md, config.json in `<required_reading>` | Same as above |
| complete-milestone.md | `init execute-phase "1"` | ROADMAP.md, REQUIREMENTS.md, PROJECT.md | Create `init complete-milestone` (see Tier 2) |
| milestone-summary.md | `init progress` | STATE.md, ROADMAP.md | Expand `init progress` return (see Tier 2) |
| progress.md | `init progress` | ROADMAP.md, MILESTONES.md | Expand `init progress` to include next phase and milestone info |
| remove-phase.md | `init phase-op` | STATE.md, ROADMAP.md | Add `current_position` and `all_phases` to `phase-op` return |
| ship.md | `init phase-op` | ROADMAP.md (phase goal), VERIFICATION.md | Add `phase_goal` and `verification_status` to `phase-op` return |
| resume-project.md | `init resume` | PROJECT.md, STATE.md (in `load_state`), ROADMAP.md | **CORRECTED** — "Later reads are for deep review" was wrong. The `load_state` step extracts structured fields and renders a formatted box — not raw content display. Expand `init resume` to return these fields. The `offer_options` CONTEXT.md existence check should also move to init. Exception: the `reconstruction` block (when STATE.md is missing) stays manual. |
| discuss-phase.md | `init phase-op` | config.json (vendor_philosophy) | Add `vendor_philosophy` to `phase-op` return |
| discuss-phase-assumptions.md | `init phase-op` | config.json, ROADMAP.md | Same as discuss-phase |
| manager.md | `init manager` | STATE.md (blockers section) | Minor -- conditional read on user action |
| quick.md | `init quick` | STATE.md (quick tasks section) | Minor -- late-stage read for logging |
| autonomous.md | `init milestone-op` + `init phase-op` | ROADMAP.md, STATE.md (re-reads between phases) | Necessary -- state changes between phases |

---

## F. Recommendations

### Implementation Order

1. **`init transition`** (P1) -- highest frequency, compounding savings in auto-advance chains
2. **Expand `init phase-op`** -- add `phase_goal`, `verification_status`, `vendor_philosophy` to cover ship.md, discuss-phase.md, list-phase-assumptions.md
3. **`init complete-milestone`** (P2) -- complex workflow with many reads
4. **Expand `init progress`** -- add `started_at`, `milestone_name`, `next_phase_info` to cover milestone-summary.md and progress.md
5. **`init import`** (P2) -- complex conflict detection needs pre-computed data
6. **`init forensics`** (P2) -- phase artifact inventory is expensive to gather manually
7. **`init cleanup`** (P2) -- milestone/phase directory inventory
8. **`init session-report`** (P2) -- straightforward context bundle
9. **`init milestone-gaps`** (P2) -- audit gap parsing

### Edge Cases and Considerations

> ✓ **Corrections applied (2026-04-07):** The edge cases below were revised after critical review. All corrections are now reflected in Sections A, B, and E above. See `review-and-risks.md` for full backward-compatibility risk analysis of proposed new commands.

1. **new-milestone.md step 1 reads** — ~~Intentionally before init.~~ **CORRECTED:** Step 1 extracts structured data points (last milestone name/version/features, project goal, blockers) to drive interactive goal-gathering. "Interactive" is not a valid excuse for manual file reads — init should return these upfront. Move `init new-milestone` to Step 1. However, the Step 7 `init new-milestone` call may still be needed (or a second call) for post-mutation fields (after Step 6 phases clear + STATE.md updates). Safest: add a lightweight `init new-milestone-context` at Step 1 for conversation fields; keep Step 7 call for research/roadmap fields.

2. **autonomous.md re-reads between phases** — CONFIRMED LEGITIMATE. State mutation occurs after each phase (executor writes STATE.md, new phases may be inserted). Pre-computed data from init would be stale. Exception stands. However: `PROJECT.md` and `REQUIREMENTS.md` reads within `smart_discuss` sub-step are FALSE intentionals — these files don't change between phases and should be loaded once upfront.

3. **resume-project.md `load_state` reads** — ~~Content review.~~ **CORRECTED:** The `load_state` step extracts structured fields (Current Position, Progress, Decisions, Blockers) and renders a formatted box — the user never sees raw file content. Expand `init resume` to cover these. The one genuine exception is the `reconstruction` block (when STATE.md is missing) — that stays manual.

4. **pause-work.md** — CONFIRMED LEGITIMATE. Requires live session memory (current task, decisions made this session). No file contains this data — it lives in the agent's context window.

5. **discuss-phase-power.md** — ~~Gets context from discuss-phase caller.~~ **CORRECTED:** Independently reads PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files. Caller only provides phase directory metadata. These are data-point reads, not raw content display. Replace with expanded `init phase-op` passthrough + `list-artifacts --type context`.

6. **Agent `<files_to_read>`** — CONFIRMED CORRECT. Agents need raw file content (plan tasks, verification criteria), not metadata. Init provides metadata; agents need content.

6. **`docs-init`** already exists as a separate CLI command (not under `init` switch). Consider whether future inits should follow the same pattern or stay under `init`.

---

## G. Estimated Token Savings

| Change | Estimated Savings Per Invocation | Frequency |
|---|---|---|
| `init transition` | 3,000-5,000 tokens (3-4 file reads eliminated) | Every phase completion |
| Expand `init phase-op` | 500-1,500 tokens per workflow using it | Very high (15+ workflows) |
| `init complete-milestone` | 4,000-6,000 tokens (3+ file reads) | Once per milestone |
| Expand `init progress` | 1,000-2,000 tokens | Moderate frequency |
| `init import` | 3,000-5,000 tokens (4+ file reads) | Low frequency |
| `init forensics` | 2,000-4,000 tokens (3+ reads + ls commands) | Low frequency |
| Remove redundant `<required_reading>` in execute-phase/execute-plan | 1,000-2,000 tokens | Every execution |

**Highest ROI:** `init transition` + expanding `init phase-op` -- these are the highest-frequency workflows.
