# Critical Review: Research Doc Findings and Backward Compatibility Risks

**Date:** 2026-04-07
**Reviewer:** Research review pass
**Source documents:**
- `init-pattern-expansion.md`
- `inline-computation-audit.md`
- `decision-routing-audit.md`

---

## Part 1: False "Intentional" Flags Found

### 1.1 `new-milestone.md` Step 1 Manual Reads — FALSE INTENTIONAL

**File:** `init-pattern-expansion.md`, section E (partial init workflows), row `new-milestone.md`

**Original assessment (line 383):**
> "Correction: Init should be called at step 1, not step 7. Steps 1-6 need structured data... `init new-milestone` should return this upfront so the workflow can drive the interactive goal-gathering session without any file reads."

This was the example used to establish the corrected principle in the review request — acknowledged as a false intentional in the original docs themselves. Confirmed: Step 1 of `new-milestone.md` reads `PROJECT.md`, `MILESTONES.md`, and `STATE.md` to extract structured fields (`last milestone name/version/features`, `project goal`, `current blockers`) and uses them to drive a goal-gathering conversation. This is not displaying raw file content to the user. Init can and should return these structured fields upfront.

The research doc self-corrected on this point (line 383), but **section F, edge case 1** (line 416) then contradicts this correction:
> "new-milestone.md step 1 reads are intentionally before init — the workflow gathers milestone goals from the user interactively using PROJECT.md content before needing init context for research. This is correct and should not change."

**This is the false intentional.** Section F.1 is inconsistent with the section E correction on the same file. The section E note is correct; section F.1 is wrong.

**Corrected assessment:** `init new-milestone` should be moved to Step 1 and expanded to return `last_milestone_version`, `last_milestone_name`, `last_milestone_features`, `project_goal`, `pending_todos`, `current_blockers`. The interactive conversation extracts structured data points — exactly what init is for.

---

### 1.2 `autonomous.md` Re-reads Between Phases — LEGITIMATE (Confirmed)

**File:** `init-pattern-expansion.md`, section E, row `autonomous.md`

**Original assessment (line 396):**
> "Necessary — state changes between phases"

**Verification against actual `autonomous.md`:**

Reading `autonomous.md` lines 813-831 (iterate step), the workflow does:
1. `roadmap analyze` — re-reads ROADMAP.md after each phase to catch **dynamically inserted phases** (decimal phases like 5.1)
2. `cat .planning/STATE.md` — re-reads STATE.md to check for **new blockers** that emerged during phase execution

Both of these reads occur AFTER state mutation (phase completion, potential phase insertion). The data they seek cannot have been pre-computed at workflow start because:
- A phase insertion (e.g., `/gsd-insert-phase`) could have fired mid-run
- Blockers are written to STATE.md by the executor agent that just ran

**Corrected assessment:** CONFIRMED LEGITIMATE. This is a genuine state-change-between-reads pattern. Moving to a single init would get stale data. This is a correct exception.

---

### 1.3 `resume-project.md` Deep File Reads — FALSE INTENTIONAL (Partial)

**File:** `init-pattern-expansion.md`, section E, row `resume-project.md` (line 391), and section F, edge case 3 (line 422)

**Original assessment:**
> "Later reads are for deep review — intentional, not replaceable by init"
> "resume-project.md deep reads of PROJECT.md and ROADMAP.md are for content review (showing the user what their project is about), not for extracting structured fields. Init can't replace this."

**Verification against actual `resume-project.md`:**

Reading `resume-project.md` step `load_state` (lines 34-60):

```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

The workflow then extracts **specific structured fields** from each:

- From STATE.md: `Current Position`, `Progress`, `Recent Decisions`, `Pending Todos`, `Blockers/Concerns`, `Session Continuity`
- From PROJECT.md: `What This Is`, `Requirements`, `Key Decisions`, `Constraints`

This is field extraction, not raw content display. The user never sees the raw file text — the workflow renders a formatted status box with the extracted values. The `init resume` command already exists and returns some of this, but `load_state` is doing a manual read of the full files to supplement it.

However, there is a `present_status` step (lines 114-153) that shows a formatted summary box — and a `route_to_workflow` step (lines 227-268) that shows command templates. Neither of these displays the raw file content verbatim.

The step `offer_options` (lines 194-225) does a real-time filesystem check:
```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null || true
```
This is a conditional check mid-workflow to determine whether to suggest `discuss-phase` or `plan-phase`. This could be part of `init resume` as a `has_context_for_current_phase` field.

**Corrected assessment:** The `load_state` reads of STATE.md and PROJECT.md are FIELD EXTRACTION and could be folded into `init resume` expansion. The original "content review" justification does not hold. Expand `init resume` to return all fields currently extracted manually. The `offer_options` CONTEXT.md check should also be part of init.

**One genuine exception within this workflow:** The `reconstruction` block (lines 288-306) that handles missing STATE.md by reading ROADMAP.md, scanning SUMMARY.md files, and counting todos. This is a recovery path for a broken state and involves genuine multi-file aggregation with judgment. This stays manual.

---

### 1.4 `pause-work.md` Dynamic Context — LEGITIMATE (Confirmed)

**File:** `init-pattern-expansion.md`, section B, row 4 (line 96)

**Original assessment:**
> "Partially — very dynamic content from current session. Not ideal — needs live session context that init can't pre-compute."

**Verification against actual `pause-work.md`:**

`pause-work.md` step `detect` (lines 11-33) uses:
```bash
ls -lt .planning/phases/*/PLAN.md 2>/dev/null
ls -lt .planning/spikes/*/SPIKE.md 2>/dev/null
ls .planning/deliberations/*.md 2>/dev/null
```

Step `gather` (lines 36-58) asks the AI to:
- Determine which plan and task is currently in-progress
- Extract decisions made in the current session
- Identify blockers encountered during this session
- Scan for placeholder content in SUMMARY.md files

None of this is pre-computable. The "current task" is determined by the agent's active session memory, not by any file state. The `ls -lt` sorts by modification time to find the most recently touched file — this approximates what's active, but the actual "what task am I on" comes from session context.

**Corrected assessment:** CONFIRMED LEGITIMATE. `pause-work.md` is gathering live session state, not structured planning data. The `ls -lt` patterns could be replaced with a `planning-counts` command, but the core data (current task, decisions made this session) is not file-based.

---

### 1.5 `discuss-phase-power.md` File Reads — FALSE INTENTIONAL

**File:** `init-pattern-expansion.md`, section B, row 7 (line 99)

**Original assessment:**
> "Gets context from discuss-phase caller"

**Verification against actual `discuss-phase-power.md`:**

Looking at `discuss-phase-power.md` step `analyze` (lines 17-29):
> "1. Load prior context (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)"

This workflow **independently reads** PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files. The trigger says "The caller (discuss-phase.md) has already validated the phase and provided `phase_dir`, `padded_phase`, `phase_number`, `phase_name`, `phase_slug`" — but these are just phase directory fields, not project-level context.

The "gets context from discuss-phase caller" assessment is wrong: the caller provides `init phase-op` fields (phase paths and metadata), but power mode then reads project context independently.

**Corrected assessment:** `discuss-phase-power.md` performs manual reads of PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files. These are data point reads (extracting vision, principles, prior decisions) — not raw content display. The caller's `init phase-op` output should be passed through, and a `list-artifacts --type context` call should replace the manual CONTEXT.md discovery. This is a false "caller provides it" justification.

---

### 1.6 `autonomous.md` Smart Discuss Sub-step 1 File Reads

**File:** Not flagged in any of the three research docs.

**Finding:** `autonomous.md` smart_discuss step (lines 528-568) reads:
```bash
cat .planning/PROJECT.md
cat .planning/REQUIREMENTS.md
cat .planning/STATE.md
```
and then:
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

These reads happen inside the phase loop, once per phase. The `init phase-op` already called earlier in step 3a returns `phase_dir`, `has_context`, etc. — but not project-level context or prior decisions.

For the `PROJECT.md`/`REQUIREMENTS.md`/`STATE.md` reads: these extract structured data (principles, requirements, decisions) — not raw content display. An expanded `init phase-op` or a new `init smart-discuss` could pre-load them. However, unlike the other cases, the smart_discuss reads happen inside a loop where the `STATE.md` content evolves between iterations (decisions are added after each phase). So `STATE.md` specifically has the same justification as the autonomous.md re-read: it changes between loop iterations.

**Corrected assessment:** `PROJECT.md` and `REQUIREMENTS.md` reads in smart_discuss are false intentionals — they don't change between phases and should be loaded once at init time or passed from the outer workflow context. `STATE.md` reads inside the loop are legitimate (evolving state). The `find` for prior CONTEXT.md files is legitimate within the loop (new context files are created per phase). This is a **mixed case**: two false intentionals (PROJECT.md, REQUIREMENTS.md) and two legitimate reads (STATE.md, prior contexts).

---

## Part 2: Confirmed Legitimate Exceptions

These cases were flagged as intentional or not worth fixing, and the corrected principle confirms they are genuinely correct exceptions:

### 2.1 `autonomous.md` ROADMAP/STATE Re-reads Between Phases
**Why legitimate:** State mutation occurs between iterations (phase completion, potential phase insertions). Pre-computed data from init would be stale. This is a textbook state-change-between-reads exception.

### 2.2 `pause-work.md` Context Gathering
**Why legitimate:** Requires live session memory (current task, decisions made this session). No file contains "what I was working on right now." The `ls -lt` approximations are the best available signal. Core data is not file-based.

### 2.3 `resume-project.md` Reconstruction Path
**Why legitimate:** The reconstruction block (when STATE.md is missing) requires judgment: reading ROADMAP.md to determine current position, scanning SUMMARYs for decisions, reconstructing from scattered artifacts. This is recovery mode — init assumes STATE.md exists.

### 2.4 Agent `<files_to_read>` Pattern
**Why legitimate:** Agents are leaf nodes in the spawn chain. They need actual file content (plan tasks, verification criteria, research findings), not metadata. Init provides structured metadata; agents need raw content to do work.

### 2.5 `new-project.md` Late PROJECT.md Read (Step 14)
**Status from research doc (line 53):** "Late-stage PROJECT.md read is for content generation, not context loading."
**Confirmed legitimate:** At step 14, the workflow uses PROJECT.md content to generate research prompts that embed the actual project description text. This requires the raw text content, not structured fields.

---

## Part 3: Backward Compatibility Risks

### 3.1 `route next-action` (decision-routing-audit.md §3.1)

**Risk Level: LOW**

`next.md` currently uses `state json` + manual reads of STATE.md and ROADMAP.md. The proposed `route next-action` command would return a pre-computed routing decision.

**What could break:**
- The `state json` call in `next.md` (line 17) also feeds the `progress` display (phase, plan_of, plans_total, progress, status). If `route next-action` replaces `state json`, the progress display fields must be included in the response or separately queried.
- `next.md` has a consecutive-call guard that reads/writes `.planning/.next-call-count`. This guard logic must remain in the workflow (not be moved to gsd-tools) because it controls whether to prompt the user before continuing — that's UI behavior, not data retrieval.
- The safety gates in `next.md` (Gate 1-3 plus consecutive guard) involve user-facing stop messages. If `route next-action` bundles gate results, the workflow must still own the "print error and exit" behavior. The gates command returns data; the workflow decides how to display/act.

**No sequential dependency risk:** All reads in `next.md` happen at the top of the workflow. No conditional logic between reads that would break bundling.

**Mitigation:** `route next-action` should include `gates` and `context` fields (as shown in the research doc design), and also include `display_context` fields (phase, plan_of, plans_total, progress, status) to preserve the progress display. The consecutive-call guard stays in the workflow.

**Command naming conflict:** None. No existing command named `route next-action`.

---

### 3.2 `check config-gates <workflow>` (decision-routing-audit.md §3.3)

**Risk Level: MEDIUM**

This is the most complex backward compatibility challenge. It proposes bundling 5-10 individual `config-get` calls per workflow into a single batch call.

**Specific sequential dependency risk in `autonomous.md`:**

Reading `autonomous.md` lines 185-295 carefully:

```
Step 3a: has_context check → if false → check SKIP_DISCUSS config
         If SKIP_DISCUSS false AND INTERACTIVE not set → smart_discuss
         After discuss → verify has_context again → init phase-op re-called
Step 3a.5: roadmap section read → grep for UI keywords → check UI_PHASE_CFG
Step 3b: plan (unconditional)
Step 3c: execute (unconditional)
Step 3c.5: check CODE_REVIEW_ENABLED config → if true: run review
Step 3d.5: check UI_REVIEW_CFG config → if true AND UI-SPEC exists: run UI review
```

The config reads are NOT sequentially dependent on each other — `SKIP_DISCUSS`, `UI_PHASE_CFG`, `CODE_REVIEW_ENABLED`, and `UI_REVIEW_CFG` are all read independently and each gates a different step. Bundling all four into a single `check config-gates autonomous` call at workflow start is safe: all four values are known, and the workflow applies them conditionally.

**However:** There is a subtle interaction in `autonomous.md` step 3a regarding `SKIP_DISCUSS`. When `has_context` is false AND `SKIP_DISCUSS` is false, the workflow runs smart_discuss. After smart_discuss, it re-calls `init phase-op` to verify `has_context`. If `check config-gates` were to include `has_context` (which belongs to `check phase-ready`), the workflow would have stale `has_context` data after smart_discuss writes the CONTEXT.md file. This is not a `check config-gates` problem per se (config values don't change mid-run), but it illustrates why config gate results and phase state results must remain separate commands.

**Specific risk in `execute-phase.md` initialize step (lines 76-115):**

The workflow does:
```bash
USE_WORKTREES=$(config-get workflow.use_worktrees)   # line 79
CONTEXT_WINDOW=$(config-get context_window)           # line 87
```
These are followed by conditional logic using each value. Both are independent reads with no dependency between them. A single `check config-gates execute-phase --phase N` call returning all relevant config values at once would work — but the return object must include `use_worktrees` and `context_window` as top-level fields, not nested under a `workflow.` prefix, because workflows reference them as flat variables.

**State mutation between reads risk:** None. Config values don't change during workflow execution (they are set by the user before running GSD).

**Agent prompt size risk:** The `check config-gates` result is small JSON (10-15 fields, all scalar). No size issue.

**`@file:` risk:** Config values are small. The `@file:` threshold is only hit for large return objects. A config-gates result will never exceed it.

**Naming conflict:** No existing `check` subcommand group in gsd-tools. The `check` namespace would be new. Verify the switch statement in gsd-tools.cjs handles unknown subcommands gracefully (likely falls through to "unknown command" error, so no conflict — just a new case needed).

**Mitigation:** Return all config values as a flat object matching the variable names used in workflows (e.g., `use_worktrees` not `workflow.use_worktrees`). Add workflow-specific variants (`check config-gates execute-phase`, `check config-gates autonomous`, etc.) only if the field sets differ significantly. Otherwise a generic `check config-gates` returning ALL workflow config is simpler and equally safe.

---

### 3.3 `check phase-ready <phase>` (decision-routing-audit.md §3.4)

**Risk Level: MEDIUM**

Several workflows call `init phase-op <N>` and then interpret `has_context`, `has_plans`, etc. The proposed `check phase-ready` would return a `next_step` routing field.

**Partial init calls risk in `autonomous.md`:**

`autonomous.md` calls `init phase-op ${PHASE_NUM}` THREE times within the phase loop:
- Line 172: Step 3a — gets `has_context`
- Line 273: Step 3a — re-verifies `has_context` after smart_discuss
- Line 393: Step 3d — gets `phase_dir` after execution (when not in scope)

The second and third calls are NOT equivalent to `check phase-ready` — they're re-reads after state mutation. If `check phase-ready` were implemented and replaced the first call only, this is safe. But if someone attempts to replace the third call (step 3d re-fetch of `phase_dir`) with a stale pre-computed `check phase-ready` result, the `phase_dir` value would still be correct (phase directories don't move), but `has_context` could be stale (just written by smart_discuss). The `next_step` field could be wrong (no longer "discuss" after CONTEXT.md was just written).

**Concrete breakage scenario:** If a workflow caches the `check phase-ready` result at start and then applies `next_step === "discuss"` logic after smart_discuss has run, it would wrongly re-run discuss. This is avoided by only caching immutable fields (phase_dir, phase_name) from the first call, and re-reading `has_context` via a separate command after mutations.

**Mitigation:** `check phase-ready` should be an additive response over `init phase-op` — never a replacement. The `next_step` field is a convenience, not a contract. Workflows that call `init phase-op` multiple times must continue to do so; `check phase-ready` is for workflows that call it once at start.

**Naming conflict:** No existing `check phase-ready` command.

---

### 3.4 Adding Fields to Existing `init` Returns

**Risk Level: LOW (additive changes)**

Several proposals expand existing init commands:
- `init phase-op` — add `phase_goal`, `verification_status`, `vendor_philosophy`
- `init progress` — add `started_at`, `milestone_name`, `next_phase_info`
- `init resume` — add `last_milestone_version`, `project_goal`, `pending_todos`, `current_blockers`

**Additive changes are safe.** Workflows that parse JSON from init commands extract named fields and ignore unknown ones. Adding new fields does not break existing callers.

**One exception to watch:** The `@file:` threshold. `init resume` currently returns a manageable JSON object. If it grows to include full text extracts from PROJECT.md (e.g., a `project_goal` that is multiple paragraphs), the total output might cross the `@file:` threshold that triggers file-based delivery. All callers of `init resume` already handle `@file:` responses (line 26 of resume-project.md: `if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi`), so this is not a breaking change, but it adds a filesystem I/O step where there was none before.

**Mitigation:** For any expanded init that might grow large, either (a) truncate long text fields to first 500 chars, or (b) keep structured metadata only (no raw file content) in init returns. The principle "init returns metadata, agents get content" should hold.

---

### 3.5 `detect phase-type <phase>` (decision-routing-audit.md §3.6)

**Risk Level: LOW**

Proposes replacing grep-based UI detection in 4 workflows:
```bash
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|..." > /dev/null 2>&1
HAS_UI=$?  # 0 = found
```

**Behavioral change risk:** The grep in `autonomous.md` (line 284) uses `$HAS_UI` where `0` means "found" (grep exit code). This inverted boolean is a common shell error source. A `detect phase-type` returning `has_frontend: true/false` is clearer and safer.

**The UI keyword list is the behavioral contract.** If `detect phase-type` uses a different keyword set than the current greps, some phases would be detected differently. The research doc lists the keywords from `autonomous.md` (line 282): `UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget`. The implementation must match exactly.

**Mitigation:** Implement `detect phase-type` with the exact keyword list currently used in greps. Document the list as a tested contract. Any future changes to the keywords are a behavioral change and should be versioned.

---

### 3.6 `route workflow-steps <workflow>` (decision-routing-audit.md §3.10 — Tier 4)

**Risk Level: HIGH — Do not implement as described**

This proposal would encode full workflow orchestration logic inside gsd-tools. It returns a `steps` array where each step has `action: "skip" | "run" | "pending"` and a reason.

**Fundamental architectural problem:** Workflows encode not just conditional logic but *inter-step state*. Step 3a.5 (UI-SPEC generation) in autonomous.md only runs if `has_context` is TRUE (set by step 3a) AND `HAS_UI` is TRUE AND no UI-SPEC exists. The "skip" or "run" decision for step 3a.5 depends on the RESULT of step 3a. gsd-tools cannot pre-compute this because:

1. Step 3a may run smart_discuss (which takes 10-30 seconds and writes files)
2. The result of smart_discuss determines whether CONTEXT.md now exists
3. CONTEXT.md existence is not knowable at workflow start for phases that need discuss

A pre-computed `route workflow-steps` result would be wrong for any step that depends on earlier step outputs.

**State mutation between reads:** This proposal would require gsd-tools to answer "should step 3c.5 run?" — but 3c.5 (code review) depends on 3c (execute-phase) having produced a REVIEW.md, which didn't exist when `route workflow-steps` was called. The computed `action` would be wrong.

**Mitigation:** Do not implement `route workflow-steps`. It conflates deterministic config gates (which gsd-tools can handle) with dynamic step orchestration (which requires live state). The `check config-gates` command provides the underlying data; workflows apply it step-by-step.

---

### 3.7 `phase-artifact-counts <phase>` (inline-computation-audit.md §3, Priority 1)

**Risk Level: LOW**

Replaces `ls | wc -l` patterns in 10+ workflows.

**Exit code behavior:** Workflows currently use `(ls ... 2>/dev/null || true) | wc -l` which returns `0` on no matches (not an error). `phase-artifact-counts` must return `0` for missing artifact types, not omit the field, not error. Callers assume all fields are present.

**Naming:** No conflicts with existing gsd-tools commands.

**Mitigation:** Return all artifact types in every response with `0` as the default. Never return a sparse object.

---

### 3.8 `check gates <workflow>` (decision-routing-audit.md §3.2)

**Risk Level: MEDIUM**

Proposes consolidating safety gates (`.continue-here.md` check, STATE.md error status, VERIFICATION.md FAIL items).

**Sequential dependency in `next.md`:**
The current gates are pure existence/value checks with no dependency between them. Gate 1 checks `.continue-here.md`. Gate 2 checks STATE.md status. Gate 3 checks VERIFICATION.md. They are independent. Bundling is safe.

**Behavioral change risk — Gate 3 (VERIFICATION.md FAIL items):**
The current `next.md` gate checks "FAIL items that don't have overrides." The override concept requires reading two sections of VERIFICATION.md (failures table + overrides table) and comparing them. This is more complex than a single field read. If `check gates` implements this logic, it must faithfully reproduce the override logic. Any simplification breaks the semantic: a phase with FAILs and matching overrides would wrongly be reported as blocked.

**Mitigation:** Implement Gate 3 with full override-aware logic. Provide the raw FAIL count and override count separately in the response so the calling workflow can verify the logic if needed.

---

### 3.9 `check auto-mode` (decision-routing-audit.md §3.5)

**Risk Level: LOW**

Replaces verbatim two-line pattern in 7 files:
```bash
AUTO_CHAIN=$(config-get workflow._auto_chain_active || "false")
AUTO_CFG=$(config-get workflow.auto_advance || "false")
```

**No sequential dependency.** Both reads are always together, result is always `AUTO_CHAIN || AUTO_CFG`. Pure consolidation.

**Important detail in `execute-phase.md`:** Lines 109-115 show that execute-phase WRITES `workflow._auto_chain_active = false` before reading config (to clear stale chain flags from interrupted runs). This write-then-read sequence must be preserved: `check auto-mode` must be called AFTER the stale-flag cleanup block, not at workflow start before it. If a workflow pre-calls `check auto-mode` before the cleanup block runs, it would get the stale `_auto_chain_active = true` value and wrongly activate auto mode.

**Mitigation:** Document in the command that `workflow._auto_chain_active` reflects the value AT THE TIME OF THE CALL. Any cleanup of stale flags must happen before this command is called.

---

### 3.10 `list-artifacts [--type TYPE] [--phase N]` (inline-computation-audit.md §3, Priority 1)

**Risk Level: LOW**

Replaces `find .planning/phases -name "*-TYPE.md"` patterns.

**Path format matters:** Callers expect paths like `.planning/phases/03-auth/03-CONTEXT.md`. Return paths must be relative to the project root (same as `find` output), not absolute. Breaking path format breaks all callers.

**Sort order matters:** The inline `find ... | sort` in most workflows sorts alphabetically. `list-artifacts` must return paths in the same sort order.

**Mitigation:** Return relative paths, sorted alphabetically.

---

### 3.11 `git phase-diff-base` and `git commit-stats` (inline-computation-audit.md §3, Priority 2)

**Risk Level: LOW-MEDIUM**

These propose wrapping git operations that compute diff bases and commit statistics.

**`git phase-diff-base` risk:** The inline pattern in `quick.md` (lines 677-681) does non-trivial git logic:
```bash
QUICK_COMMITS=$(git log --oneline --grep="${quick_id}")
DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)^
git rev-parse "${DIFF_BASE}" >/dev/null 2>&1 || DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)
```
This has a fallback: if the `^` parent doesn't resolve (first commit), use the commit itself. If gsd-tools implements this without the fallback, `git rev-parse` would fail on the first commit in a new repo, breaking the command. The fallback logic must be preserved.

**`git commit-stats` risk:** Lower risk. Wrapping `git log --oneline --grep` is straightforward. Main concern is grep pattern escaping — special characters in phase names could break the grep. The implementation must quote/escape the pattern.

---

## Part 4: Safe to Implement

These changes have no meaningful breakage risk:

1. **`check auto-mode`** — Trivial consolidation of a verbatim 2-line pattern. No dependencies. Implement after `execute-phase`'s stale-flag cleanup block.

2. **`phase-artifact-counts <phase>`** — Replaces `ls | wc -l`. Pure data retrieval. No sequential dependencies. Low risk.

3. **`planning-counts`** — New command counting seeds, notes, debug sessions, todos. No existing callers to break. New consumers opt in.

4. **Expand `init progress` with `started_at`, `milestone_name`** — Additive. Existing callers unaffected.

5. **Expand `init phase-op` with `phase_goal`, `vendor_philosophy`** — Additive. 15+ workflows use `init phase-op`; all parse JSON and ignore unknown fields.

6. **`summary-extract --flat` flag** — Enhancement to existing command. Adds new flag; existing callers using no flag or other flags are unaffected.

7. **`roadmap get-phase` with `has_ui` parsed field** — Enhancement. Returns new field in existing JSON response. Additive.

8. **`detect phase-type <phase>`** — New command. No existing callers. Low risk, provided keyword list matches existing greps exactly.

9. **`init transition <phase>`** — New command. `transition.md` has no existing init call to displace. No backward compatibility concern.

10. **`init session-report`** — New command. `session-report.md` has no init call today.

11. **`init forensics`** — New command. `forensics.md` has no init call today.

12. **`init cleanup`** — New command. `cleanup.md` has no init call today.

13. **`list-artifacts [--type TYPE]`** — New command. Existing `find` patterns replaced; the command must match path format and sort order.

14. **Adopt `frontmatter get` for Pattern 1/5/7 inline extractions** — Not a gsd-tools change; adoption of existing command in workflows. Zero risk to gsd-tools.cjs.

---

## Part 5: Requires Care

These changes are safe but need specific implementation order or guard conditions:

1. **`check config-gates <workflow>`**
   - Must return flat variable names (e.g., `use_worktrees`, not `workflow.use_worktrees`)
   - Must not include phase-state fields (`has_context`, `has_plans`) — those change mid-run
   - Must be called AFTER any stale-flag cleanup in execute-phase (line 109-115)
   - Implement as new command only; do NOT modify existing `config-get` behavior

2. **`check phase-ready <phase>`**
   - Must be additive over `init phase-op`, not a replacement
   - `next_step` field is a convenience hint, not a contract
   - Workflows that call `init phase-op` multiple times (autonomous.md calls it 3x per phase) must continue doing so — `check phase-ready` is only for single-call workflows
   - Calling workflows must not cache `has_context` from this call across state-mutating steps

3. **`route next-action`**
   - Must include display context fields (`plan_of`, `plans_total`, `progress`, `status`) to avoid breaking `next.md`'s progress display
   - The consecutive-call guard (`.next-call-count` file) must remain in the workflow, not move to gsd-tools
   - The gate messages (user-facing stop text) stay in the workflow; `route next-action` only returns data

4. **`check gates <workflow>`**
   - Gate 3 (VERIFICATION.md FAIL items) must implement the full override-aware logic
   - Return both `fail_count` and `override_count` separately for auditability
   - The user-facing stop messages stay in the workflow

5. **`init new-milestone` expansion and timing change**
   - Current: called at Step 7 (after PROJECT.md update, research decision)
   - Proposed: move to Step 1 (before any file reads)
   - The Step 6 `phases clear` command and STATE.md update happen between the old init position and Step 1. Moving init earlier means these mutations haven't happened yet. Init must be designed to work on pre-mutation state (it should read current state, not the post-cleanup state)
   - After the Step 6 mutations, `init new-milestone` may need to be re-called (or a separate call made) to get the updated `current_milestone` and `phase_dir_count` fields for Step 7.5 reset-phase safety logic.
   - Safest approach: keep Step 7's `init new-milestone` call for its research/roadmap fields, AND add a lightweight new `init new-milestone-context` at Step 1 for the conversation-driving fields.

6. **`git phase-diff-base`**
   - Must implement the `^` parent fallback for first-commit scenarios
   - Must test with empty phase (no commits yet) — return `null` diff_base, not error

7. **`init resume` expansion**
   - Adding large text fields (full project_goal text) risks crossing `@file:` threshold
   - Keep text fields truncated or structured (first sentence only, not full paragraphs)
   - All callers already handle `@file:` response, so not a breaking change — but adds filesystem I/O

---

## Part 6: Do Not Implement

1. **`route workflow-steps <workflow>` (Tier 4)** — Encodes dynamic orchestration logic that depends on mid-workflow state mutations. A pre-computed step plan is wrong the moment any step writes files that influence subsequent steps. The `autonomous.md` discuss→plan→execute chain is inherently sequential and state-dependent. This would create false confidence in pre-computed routing while silently breaking phases where earlier steps produce unexpected output.

2. **`check config-gates` as a REPLACEMENT for individual `config-get` calls** — It must be ADDITIVE. Removing the ability to call `config-get workflow.X` individually would break any workflow or external tool that uses single-key queries. The existing `config-get` API must remain.

3. **Moving `autonomous.md`'s inter-phase STATE.md and ROADMAP re-reads to init** — These re-reads happen after phase completion (state mutation). They are there specifically because state changes. Moving them to the top of the workflow would eliminate the only mechanism that catches dynamically-inserted phases and mid-run blockers.

4. **Replacing `resume-project.md` `reconstruction` path reads with init** — The reconstruction path is error recovery for a broken state (missing STATE.md). Init assumes STATE.md exists. This path should remain manual with full file access.

5. **Replacing `pause-work.md`'s session-context gathering with init** — The "current task, current decision, current blocker" data is live session memory, not persisted file state. No init command can pre-compute what the agent was working on in its current context window.

---

## Summary: Correctness Issues Found in Research Docs

| Doc | Section | Issue |
|-----|---------|-------|
| `init-pattern-expansion.md` | Section F, edge case 1 (line 416) | Contradicts section E correction for `new-milestone.md`. Section F.1 is wrong — the interactive justification does not hold. |
| `init-pattern-expansion.md` | Section E, `resume-project.md` row (line 391) | "Content review" justification for `load_state` step is wrong — it extracts structured fields, not raw content. `present_status` renders a formatted box. |
| `init-pattern-expansion.md` | Section B, row 7 (line 99) | `discuss-phase-power.md` "gets context from caller" is wrong — it independently reads PROJECT.md, REQUIREMENTS.md, STATE.md. |
| `decision-routing-audit.md` | Section 3.10 (Tier 4) | `route workflow-steps` is architecturally unsound — pre-computes orchestration decisions that depend on mid-workflow state mutations. |
| All three docs | (omission) | `autonomous.md` smart_discuss sub-step 1 reads of PROJECT.md and REQUIREMENTS.md were not audited. These are false intentionals (the docs treated all of autonomous.md's reads as "necessary" due to the legitimate state-change pattern). |
