# Decision Logic & Routing Pattern Audit

**Date:** 2026-04-07
**Scope:** All agents (24), workflows (66), and commands (66) in the GSD framework
**Purpose:** Identify deterministic decision logic currently performed by AI agents that could be offloaded to `gsd-tools.cjs` queries

---

## 1. Executive Summary

GSD's AI agents currently make **dozens of deterministic decisions per workflow invocation** by reading files, checking existence, parsing config values, and applying if/else routing rules. These decisions consume tokens, introduce inconsistency risk (agents may misread state), and slow down workflows.

**Key findings:**

- **10 distinct decision pattern categories** identified across 50+ files
- **~45 individual config-get calls** scattered across workflows, each requiring the AI to parse the result and branch
- **8 routing patterns** in `next.md` and `progress.md` alone that are pure state-machine logic
- **The `autonomous.md` workflow** makes **15+ deterministic decisions** (has_context? skip_discuss? has_ui? ui_phase enabled? code_review enabled? etc.)
- **Config gate pattern** (check `workflow.X`, branch on true/false) appears in **14 workflows** with identical boilerplate
- **Phase readiness checks** are duplicated across `next.md`, `progress.md`, `autonomous.md`, `execute-phase.md`, and `resume-project.md`

**Estimated savings:** Consolidating these into gsd-tools queries would eliminate ~30-50% of orchestrator-level token usage in multi-step workflows, reduce decision inconsistency, and make the framework more testable.

---

## 2. Decision Pattern Catalog

### Pattern 1: Next-Action Routing (State Machine)

**Frequency:** 3 files (`next.md`, `progress.md`, `resume-project.md`)

**What the AI does:** Reads STATE.md, ROADMAP.md, checks for CONTEXT.md, RESEARCH.md, PLAN.md, SUMMARY.md, UAT.md, VERIFICATION.md, HANDOFF.json, `.continue-here.md`, then applies a routing table to determine the next command.

**From `next.md` (lines 93-127):**
```
Route 1: No phases exist yet → /gsd-discuss-phase
Route 2: Phase exists but has no CONTEXT.md or RESEARCH.md → /gsd-discuss-phase
Route 3: Phase has context but no plans → /gsd-plan-phase
Route 4: Phase has plans but incomplete summaries → /gsd-execute-phase
Route 5: All plans have summaries → /gsd-verify-work
Route 6: Phase complete, next phase exists → /gsd-discuss-phase <next>
Route 7: All phases complete → /gsd-complete-milestone
Route 8: Paused → /gsd-resume-work
```

**From `progress.md` (lines 196-370):**
Same routing but with additional UAT gap checking (Routes A-F plus milestone completion routes C/D).

**Inputs:** `has_context`, `has_research`, `has_plans`, `plan_count`, `summary_count`, `has_verification`, `uat_status`, `paused_at`, phase completion state

**Why it's deterministic:** Every route is a pure function of file existence and frontmatter values. No judgment needed.

---

### Pattern 2: Config Gate Checks

**Frequency:** 14+ workflows, ~45 individual `config-get` calls

**What the AI does:** Calls `gsd-tools config-get workflow.X`, parses the result, then either skips a step or proceeds. Every call follows the identical pattern:

```bash
VALUE=$(node gsd-tools.cjs config-get workflow.X 2>/dev/null || echo "default")
# If VALUE is "false": skip step
# If VALUE is "true" (or absent): proceed
```

**Affected config keys and their consuming workflows:**

| Config Key | Workflows | Default |
|-----------|-----------|---------|
| `workflow.code_review` | `code-review.md`, `code-review-fix.md`, `execute-phase.md`, `autonomous.md`, `quick.md` | `true` |
| `workflow.ui_phase` | `autonomous.md`, `plan-phase.md`, `ui-phase.md`, `verify-work.md` | `true` |
| `workflow.ui_review` | `autonomous.md` | `true` |
| `workflow.ui_safety_gate` | `plan-phase.md` | `true` |
| `workflow.skip_discuss` | `autonomous.md` | `false` |
| `workflow.discuss_mode` | `discuss-phase.md`, `progress.md`, `plan-phase.md` | `discuss` |
| `workflow.use_worktrees` | `execute-phase.md`, `quick.md`, `diagnose-issues.md` | `true` |
| `workflow.auto_advance` | `executor.md`, `execute-phase.md`, `discuss-phase.md`, `discuss-phase-assumptions.md` | `false` |
| `workflow._auto_chain_active` | `executor.md`, `execute-phase.md`, `plan-phase.md`, `discuss-phase.md`, `discuss-phase-assumptions.md` | `false` |
| `workflow.security_enforcement` | `plan-phase.md`, `execute-phase.md`, `secure-phase.md`, `verify-work.md` | `true` |
| `workflow.security_asvs_level` | `plan-phase.md` | `1` |
| `workflow.security_block_on` | `plan-phase.md` | `high` |
| `workflow.nyquist_validation` | `audit-milestone.md`, `validate-phase.md` | `true` |
| `workflow.code_review_depth` | `code-review.md` | `standard` |
| `workflow.max_discuss_passes` | `discuss-phase.md` | `3` |
| `workflow.node_repair` | `execute-plan.md` | `true` |
| `workflow.research_before_questions` | `discuss-phase.md` | `false` |
| `workflow.text_mode` | `plan-phase.md`, `discuss-phase.md` | `false` |
| `context_window` | `plan-phase.md`, `execute-phase.md` | `200000` |

**Why it's deterministic:** Boolean/enum config lookups with default fallbacks. Pure data retrieval.

---

### Pattern 3: Phase Readiness / Prerequisite Validation

**Frequency:** 8+ workflows

**What the AI does:** Checks multiple conditions to determine if a phase can proceed:
1. Does the phase directory exist?
2. Does it have CONTEXT.md?
3. Does it have RESEARCH.md?
4. Does it have PLAN.md files?
5. Do all plans have SUMMARY.md files?
6. Does VERIFICATION.md exist with status?
7. Are there UAT gaps?
8. Are dependencies (prior phases) satisfied?

**Files:**
- `execute-phase.md` (lines 95-97): `phase_found`, `plan_count`, `state_exists`
- `plan-phase.md` (lines 44, 56-61): `planning_exists`, `phase_found`, `has_research`, `has_plans`
- `autonomous.md` (lines 169-276): `has_context`, `has_plans` checked per-phase
- `verify-work.md` (lines 42-86): Check active UAT sessions, phase args
- `discuss-phase.md` (lines 150-263): `phase_found`, `has_context`, `has_plans`, checkpoint files
- `ship.md` (lines 39-71): verification status, clean tree, correct branch, remote, gh CLI
- `transition.md` (lines 53-68): PLAN vs SUMMARY count match

**Why it's deterministic:** File existence + frontmatter parsing. The init commands already compute most of this, but each workflow re-interprets and branches on the results.

---

### Pattern 4: Conditional Agent Spawning

**Frequency:** 6+ workflows

**What the AI does:** Decides whether to spawn optional agents based on config and state:

**Research agent spawning (`plan-phase.md`, lines 247-281):**
- If `has_research` is true AND no `--research` flag: skip
- If `--skip-research`: skip
- If `--gaps` or `--reviews`: skip
- Otherwise: ask user or auto-decide based on `--auto` flag

**Verifier spawning (`execute-phase.md`, lines 953-998):**
- Always spawned (not optional per config currently)

**Code reviewer spawning (`execute-phase.md`, lines 743-773; `autonomous.md`, lines 363-377):**
- Check `workflow.code_review` config
- If `false`: skip
- If `true`: spawn, then check result for findings

**UI researcher/auditor spawning (`autonomous.md`, lines 278-315; `plan-phase.md`, lines 398-466):**
- Check `workflow.ui_phase` config
- Check if phase has frontend indicators (grep for UI/frontend/component keywords)
- Check if UI-SPEC already exists
- Multi-condition gate before spawning

**Security auditor (`plan-phase.md`, lines 372-395; `execute-phase.md`, lines 690-709):**
- Check `workflow.security_enforcement`
- If `false`: skip

**Why most of it is deterministic:** The spawn decision is a function of (config value, file existence, CLI flags). The only non-deterministic part is "does this phase have frontend indicators?" which uses a keyword grep.

---

### Pattern 5: Safety Gate Checks

**Frequency:** 4 workflows

**What the AI does:** Checks for blocking conditions before proceeding.

**From `next.md` (lines 37-91):**
1. Gate 1: `.planning/.continue-here.md` exists?
2. Gate 2: STATE.md `status: error` or `status: failed`?
3. Gate 3: VERIFICATION.md has FAIL items without overrides?
4. Consecutive-call guard: `.planning/.next-call-count` >= 6?

**From `execute-phase.md` (lines 118-139):**
- `.continue-here.md` in phase dir with blocking anti-patterns?

**From `discuss-phase.md` (lines 178-200):**
- Same `.continue-here.md` blocking anti-pattern check

**From `transition.md` (lines 77-99):**
- Outstanding UAT/VERIFICATION items (non-blocking warning)

**Why it's deterministic:** File existence, frontmatter value checks, counting rows in tables.

---

### Pattern 6: Completion Criteria Evaluation

**Frequency:** 5+ workflows

**What the AI does:** Determines if a phase, plan, or milestone is "done."

**Phase completion (`transition.md`, lines 53-68):**
```
Count PLAN files → Count SUMMARY files → If counts match: complete
```

**Milestone readiness (`complete-milestone.md`, lines 40-62):**
- Check all phases have `disk_status === 'complete'` via `roadmap analyze`
- Count requirements checked vs total
- Check for audit file existence and status

**Plan completion (`execute-phase.md`, lines 222-228):**
- Plans where `has_summary: true` are complete
- Filter for `--gaps-only`, `WAVE_FILTER`

**UAT completion (`verify-work.md`):**
- All test items have `result` != `pending`

**Wave completion (`execute-phase.md`, lines 226-228):**
- Wave safety check: any incomplete plans in lower waves?

**Why it's deterministic:** Counting files and checking frontmatter status values.

---

### Pattern 7: Output Format Selection

**Frequency:** 3+ workflows

**What the AI does:** Checks `text_mode` config or `--text` flag to decide between AskUserQuestion (TUI menu) and plain-text numbered lists.

**Files:**
- `discuss-phase.md` (lines 120-131): Full text_mode handling
- `plan-phase.md` (lines 50, 207-219): TEXT_MODE from flag or config
- `execute-phase.md` (line 944): TEXT_MODE for schema drift options

**The pattern:**
```
TEXT_MODE = (--text in args) OR (workflow.text_mode from config)
If TEXT_MODE: plain-text numbered list
Else: AskUserQuestion
```

**Why it's deterministic:** Single boolean from two sources.

---

### Pattern 8: Frontend Phase Detection

**Frequency:** 4 workflows

**What the AI does:** Greps the ROADMAP phase description for UI/frontend keywords to decide whether to trigger UI-specific workflows.

**Files:**
- `autonomous.md` (lines 282-287): `grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget"`
- `plan-phase.md` (lines 410-413): Same grep pattern
- `progress.md` (lines 232-236): `grep -qi "UI hint.*yes"`
- `execute-phase.md` (line 698): Check for SECURITY.md existence after execution

**Why it's deterministic:** Regex match against known text. Could be a `gsd-tools detect-phase-type <N>` returning `{type: "frontend", indicators: ["UI", "component"]}`.

---

### Pattern 9: Auto-Advance / Chain Detection

**Frequency:** 7 workflows, 1 agent

**What the AI does:** Two config reads, then boolean OR:
```bash
AUTO_CHAIN=$(config-get workflow._auto_chain_active || "false")
AUTO_CFG=$(config-get workflow.auto_advance || "false")
# Auto mode = AUTO_CHAIN === "true" || AUTO_CFG === "true"
```

**Files:**
- `executor.md` (lines 224-228)
- `execute-phase.md` (lines 630-634, 1193-1194)
- `plan-phase.md` (lines 429, 945-946)
- `discuss-phase.md` (lines 1104-1105)
- `discuss-phase-assumptions.md` (lines 627-628)

**Why it's deterministic:** Two boolean reads + OR. Repeated verbatim in 7 places.

---

### Pattern 10: Verification Status Routing

**Frequency:** 3 workflows

**What the AI does:** Reads VERIFICATION.md status field and routes to different actions:

**From `execute-phase.md` (lines 992-998):**
```
passed → update_roadmap
human_needed → present items for human testing
gaps_found → offer /gsd-plan-phase --gaps
```

**From `autonomous.md` (lines 384-472):**
Same three-way branch plus gap closure retry loop.

**From `progress.md` (lines 302-350):**
UAT status routing (diagnosed → Route E, partial → Route E.2).

**Why it's deterministic:** Single frontmatter field parsed into one of 3-4 enum values.

---

## 3. Proposed New gsd-tools Commands

### 3.1 `gsd-tools route next-action`

**Replaces:** Routing logic in `next.md`, `progress.md`, `resume-project.md`

```bash
gsd-tools route next-action
```

**Returns:**
```json
{
  "command": "/gsd-execute-phase",
  "args": "3",
  "reason": "Phase 3 has 2 plans with no summaries",
  "current_phase": 3,
  "phase_name": "Core Features",
  "gates": {
    "continue_here": false,
    "error_state": false,
    "unresolved_verification": false,
    "consecutive_calls": 2
  },
  "context": {
    "has_context": true,
    "has_research": true,
    "has_plans": true,
    "plan_count": 2,
    "summary_count": 0,
    "has_verification": false,
    "paused_at": null,
    "uat_gaps": 0
  }
}
```

**Impact:** Eliminates ~50 lines of routing logic from `next.md`, ~100 lines from `progress.md`. Makes routing testable and consistent.

---

### 3.2 `gsd-tools check gates <workflow>`

**Replaces:** Safety gate checks in `next.md`, `execute-phase.md`, `discuss-phase.md`

```bash
gsd-tools check gates execute-phase --phase 3
```

**Returns:**
```json
{
  "passed": false,
  "blockers": [
    {
      "gate": "continue_here",
      "file": ".planning/phases/03-core/.continue-here.md",
      "severity": "blocking",
      "anti_patterns": ["scope_creep"]
    }
  ],
  "warnings": [
    {
      "gate": "verification_debt",
      "phase": 2,
      "items": 3
    }
  ]
}
```

---

### 3.3 `gsd-tools check config-gates <workflow>`

**Replaces:** The 45+ `config-get` calls scattered across workflows

```bash
gsd-tools check config-gates plan-phase --phase 3
```

**Returns:**
```json
{
  "research_enabled": true,
  "plan_checker_enabled": true,
  "nyquist_validation": true,
  "security_enforcement": true,
  "security_asvs_level": 1,
  "security_block_on": "high",
  "ui_phase": true,
  "ui_safety_gate": true,
  "text_mode": false,
  "auto_advance": false,
  "auto_chain_active": false,
  "code_review": true,
  "code_review_depth": "standard",
  "context_window": 200000,
  "discuss_mode": "discuss",
  "use_worktrees": true
}
```

**Impact:** Replaces 5-10 individual `config-get` calls per workflow with a single call. All config values pre-loaded. Agent never needs to make individual queries.

---

### 3.4 `gsd-tools check phase-ready <phase>`

**Replaces:** Phase readiness checks in `execute-phase.md`, `plan-phase.md`, `autonomous.md`

```bash
gsd-tools check phase-ready 3
```

**Returns:**
```json
{
  "ready": true,
  "phase": 3,
  "phase_name": "Core Features",
  "phase_dir": ".planning/phases/03-core-features",
  "has_context": true,
  "has_research": true,
  "has_plans": true,
  "plan_count": 2,
  "incomplete_plans": 2,
  "has_verification": false,
  "has_ui_spec": false,
  "has_ui_indicators": true,
  "dependencies_met": true,
  "blockers": [],
  "next_step": "execute"
}
```

**Note:** The `next_step` field encodes the routing logic: `"discuss"` if no context, `"plan"` if no plans, `"execute"` if incomplete plans, `"verify"` if all plans done, `"complete"` if verified.

---

### 3.5 `gsd-tools check auto-mode`

**Replaces:** The duplicated auto-advance detection in 7 files

**SDK (supported today):** `gsd-sdk query check auto-mode` — no `gsd-tools.cjs` mirror yet.

```bash
gsd-sdk query check auto-mode
# Or a single field for shell:
gsd-sdk query check auto-mode --pick active
```

**Returns:**
```json
{
  "active": true,
  "source": "auto_chain",
  "auto_chain_active": true,
  "auto_advance": false
}
```

`source` is `none` | `auto_advance` | `auto_chain` | `both`. `active` is true when `workflow.auto_advance` **or** `workflow._auto_chain_active` is true (checkpoint / auto-advance gates in `execute-phase.md`).

---

### 3.6 `gsd-tools detect phase-type <phase>`

**Replaces:** Frontend indicator grep in 4 workflows

```bash
gsd-tools detect phase-type 5
```

**Returns:**
```json
{
  "phase": 5,
  "has_frontend": true,
  "frontend_indicators": ["UI", "component", "dashboard"],
  "has_schema": true,
  "schema_orm": "prisma",
  "schema_files": ["prisma/schema.prisma"],
  "push_command": "npx prisma db push",
  "has_api": false,
  "has_infra": false
}
```

**Impact:** Eliminates fragile grep patterns and makes phase type detection consistent across all workflows.

---

### 3.7 `gsd-tools check completion <scope>`

**Replaces:** Completion criteria checks in `transition.md`, `complete-milestone.md`, `execute-phase.md`

```bash
gsd-tools check completion phase 3
gsd-tools check completion milestone v1.0
```

**Phase returns:**
```json
{
  "complete": false,
  "plans_total": 3,
  "plans_with_summaries": 2,
  "missing_summaries": ["03-03-PLAN.md"],
  "verification_status": null,
  "uat_status": null,
  "debt": {
    "uat_gaps": 0,
    "verification_failures": 0,
    "human_needed": 0
  }
}
```

**Milestone returns:**
```json
{
  "complete": true,
  "phases_total": 5,
  "phases_complete": 5,
  "requirements_total": 12,
  "requirements_checked": 12,
  "unchecked_requirements": [],
  "has_audit": true,
  "audit_status": "passed",
  "progress_percent": 100
}
```

---

### 3.8 `gsd-tools check verification-status <phase>`

**Replaces:** VERIFICATION.md status parsing in `execute-phase.md`, `autonomous.md`, `progress.md`

```bash
gsd-tools check verification-status 3
```

**Returns:**
```json
{
  "status": "gaps_found",
  "score": "8/10",
  "gaps": [
    {"item": "Error handling for invalid tokens", "type": "truth"}
  ],
  "human_items": [],
  "deferred": [
    {"item": "Performance benchmarks", "addressed_by_phase": 7}
  ]
}
```

---

### 3.9 `gsd-tools check ship-ready <phase>`

**Replaces:** Preflight checks in `ship.md` (lines 39-71)

```bash
gsd-tools check ship-ready 3
```

**Returns:**
```json
{
  "ready": true,
  "verification_passed": true,
  "clean_tree": true,
  "on_feature_branch": true,
  "current_branch": "feat/phase-3",
  "base_branch": "main",
  "remote_configured": true,
  "gh_available": true,
  "gh_authenticated": true,
  "blockers": []
}
```

---

### 3.10 `gsd-tools route workflow-steps <workflow> --phase <N>`

**Replaces:** Multi-step conditional orchestration in `autonomous.md`, `plan-phase.md`

```bash
gsd-tools route workflow-steps autonomous --phase 3
```

**Returns:**
```json
{
  "phase": 3,
  "steps": [
    {"step": "discuss", "action": "skip", "reason": "CONTEXT.md exists"},
    {"step": "ui_spec", "action": "skip", "reason": "no frontend indicators"},
    {"step": "plan", "action": "run", "command": "gsd:plan-phase 3"},
    {"step": "execute", "action": "run", "command": "gsd:execute-phase 3 --no-transition"},
    {"step": "code_review", "action": "run", "reason": "workflow.code_review=true"},
    {"step": "verify", "action": "pending"},
    {"step": "ui_review", "action": "skip", "reason": "no UI-SPEC"}
  ]
}
```

---

## 4. Overlap with Existing gsd-tools Commands

Several existing commands **already compute** the data needed for these decisions but don't package it as a routing/gating result:

| Existing Command | What it already does | Gap |
|-----------------|---------------------|-----|
| `init phase-op <N>` | Returns `has_context`, `has_research`, `has_plans`, `has_verification` | Missing: `next_step` routing, `has_ui_indicators`, `dependencies_met` |
| `init execute-phase <N>` | Returns `phase_found`, `plan_count`, `incomplete_count` | Missing: gate checks, auto-mode detection, config gates |
| `init plan-phase <N>` | Returns `research_enabled`, `plan_checker_enabled`, etc. | Missing: aggregated config gate result, UI detection |
| `roadmap analyze` | Returns all phases with disk_status | Missing: per-phase readiness routing |
| `validate health` | Checks .planning/ integrity | Missing: per-workflow prerequisite validation |
| `validate consistency` | Phase numbering sync | Missing: semantic readiness (has context? plans?) |
| `phase-plan-index <N>` | Plans with wave grouping and has_summary | Missing: completion state, wave safety check |
| `verify phase-completeness <N>` | Checks all plans have summaries | Missing: integrated with verification and UAT status |
| `config-get workflow.X` | Returns single config value | Missing: batch retrieval, workflow-scoped defaults |
| `audit-uat` | Scans all phases for unresolved items | Missing: per-phase summary for routing |

**Key gap:** The `init` commands are closest to what's needed but they return raw data, not routing decisions. Workflows then duplicate the same if/else logic to interpret the raw data.

---

## 5. Priority Ranking

### Tier 1: Highest Impact (eliminate most duplicated logic)

1. **`route next-action`** — Consolidates the most complex routing logic (8 routes, 3 workflows). Single call replaces 50+ lines per workflow.

2. **`check config-gates <workflow>`** — Eliminates 45+ individual `config-get` calls. Each workflow gets all relevant config in one call.

3. **`check phase-ready <phase>`** — Consolidates phase readiness checks from 5+ workflows into one query with a `next_step` field.

### Tier 2: High Impact (eliminate repeated patterns)

4. **`check auto-mode`** — **Implemented in SDK** (`check.auto-mode`); eliminates verbatim duplication of paired `config-get` calls; workflows use `gsd-sdk query check auto-mode --pick active` (see `execute-phase.md`, `discuss-phase.md`, `plan-phase.md`).

5. **`detect phase-type <phase>`** — Replaces fragile grep-based UI detection with structured detection. Extensible to schema/API/infra types.

6. **`check completion <scope>`** — Consolidates completion checks across phase and milestone levels.

### Tier 3: Medium Impact (improve specific workflows)

7. **`check gates <workflow>`** — Safety gate consolidation. Currently only 3-4 workflows but critical for consistency.

8. **`check verification-status <phase>`** — Replaces VERIFICATION.md grep/parse in 3 workflows.

9. **`check ship-ready <phase>`** — Consolidates 5 preflight checks in `ship.md`.

### ❌ Do Not Implement

10. **`route workflow-steps <workflow>`** — ~~Tier 4 future.~~ **DO NOT IMPLEMENT.** Architecturally unsound: encodes dynamic orchestration logic that depends on mid-workflow state mutations. A step plan pre-computed at workflow start is wrong the moment any earlier step writes files that influence subsequent steps (e.g., smart_discuss writes CONTEXT.md which changes whether the plan step is needed). Creates false confidence in pre-computed routing while silently producing wrong decisions. The `check config-gates` command provides the underlying config data; workflows apply it step-by-step. See `review-and-risks.md` §3.6 for full analysis.

---

## 6. Anti-Patterns: Decisions That SHOULD Stay with the AI

Not all decision logic should be moved to gsd-tools. The following require AI judgment and should remain in the agent/workflow layer:

### 6.1 Gray Area Identification (`discuss-phase.md`)
Identifying what questions to ask the user about a phase's implementation requires understanding the domain, reading the phase goal, and generating phase-specific (not generic) decision points. This is inherently creative.

### 6.2 Intent Classification (`do.md`)
Matching freeform user text to the right GSD command requires natural language understanding. The routing table is deterministic, but the intent extraction is not.

### 6.3 Error Recovery Decisions (`executor.md`)
When a task fails, deciding whether to retry, debug, skip, or ask the user requires understanding the error context and the task's importance. The `authentication_gates` pattern (recognizing auth errors vs bugs) is borderline — the pattern matching could be offloaded, but the recovery strategy requires judgment.

### 6.4 Plan Quality Assessment (`plan-checker.md`)
Evaluating whether a PLAN.md is well-structured, complete, and achievable requires reading and understanding the plan content. The structural checks (frontmatter validation, required sections) are already in gsd-tools, but semantic quality is AI territory.

### 6.5 Scope Creep Detection (`discuss-phase.md`)
Determining whether a user's suggestion is "clarifying ambiguity" vs "scope creep" requires understanding the phase boundary and the suggestion's intent.

### 6.6 Commit Message Generation (`executor.md`)
Choosing between `feat`, `fix`, `test`, `refactor`, `chore` based on what was actually done in a task requires understanding the changes.

### 6.7 Ambiguity Resolution (`do.md`, `discuss-phase.md`)
When user input could match multiple routes or when a question has no clear answer, the AI's judgment is needed to pick the best interpretation or ask a clarifying question.

### 6.8 Cross-Phase Context Synthesis (`autonomous.md` smart_discuss)
Reading prior CONTEXT.md files to avoid re-asking already-decided questions requires understanding the semantic content of those decisions, not just their existence.

### 6.9 PRD Parsing (`plan-phase.md` step 3.5)
Extracting requirements, user stories, and acceptance criteria from an arbitrary PRD document requires natural language understanding.

### 6.10 Research Assessment
Deciding whether existing RESEARCH.md is sufficient or whether to re-research requires understanding the research content relative to the current phase goals.

---

## Appendix: File-by-File Decision Inventory

### Workflows with highest decision density:

| File | Decision Points | Deterministic | AI-Required |
|------|----------------|---------------|-------------|
| `autonomous.md` | 15+ | 13 | 2 (smart_discuss quality, gap assessment) |
| `execute-phase.md` | 12+ | 10 | 2 (error handling, checkpoint type) |
| `plan-phase.md` | 10+ | 8 | 2 (research relevance, plan quality) |
| `progress.md` | 8+ | 8 | 0 |
| `next.md` | 8+ | 8 | 0 |
| `discuss-phase.md` | 7+ | 4 | 3 (gray areas, scope creep, follow-ups) |
| `resume-project.md` | 6+ | 6 | 0 |
| `quick.md` | 6+ | 5 | 1 (task classification) |
| `complete-milestone.md` | 5+ | 5 | 0 |
| `ship.md` | 5+ | 5 | 0 |
| `transition.md` | 4+ | 4 | 0 |
| `code-review.md` | 4+ | 4 | 0 |
| `verify-work.md` | 4+ | 3 | 1 (test extraction) |
| `code-review-fix.md` | 3+ | 3 | 0 |

### Agents with decision logic:

| File | Decision Points | Deterministic | AI-Required |
|------|----------------|---------------|-------------|
| `gsd-executor.md` | 5 | 3 (auto-mode, checkpoint type, TDD detection) | 2 (error recovery, commit type) |
| `gsd-planner.md` | 4 | 2 (has_context, has_research) | 2 (plan structure, wave assignment) |
| `gsd-verifier.md` | 5 | 3 (override lookup, deferred matching, status calc) | 2 (gap assessment, truth evaluation) |
| `gsd-ui-auditor.md` | 3 | 2 (UI-SPEC exists, components.json exists) | 1 (visual quality) |

---

*End of audit. This document is research only -- no source files were modified.*
