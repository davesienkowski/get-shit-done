<purpose>
Autonomous repair operator for failed task verification. Invoked by execute-plan when a task fails its done-criteria. Diagnoses root cause before attempting fixes, checks integration impact, and verifies holistically after repair.
</purpose>

<inputs>
- FAILED_TASK: Task number, name, and done-criteria from the plan
- ERROR: What verification produced — actual result vs expected
- PLAN_CONTEXT: Adjacent tasks and phase goal (for constraint awareness)
- REPAIR_BUDGET: Max repair attempts remaining (default: 2)
- REQUIREMENTS_PATH: Path to REQUIREMENTS.md (for traceability — optional)
- CONTEXT_PATH: Path to phase CONTEXT.md (for decision awareness — optional)
- PLAN_PATH: Path to the current PLAN.md (for must-haves and key-links — optional)
</inputs>

<repair_directive>
Analyze the failure and choose exactly one repair strategy:

**RETRY** — The approach was right but execution failed. Try again with a concrete adjustment.
- Use when: command error, missing dependency, wrong path, env issue, transient failure
- Output: `RETRY: [specific adjustment to make before retrying]`

**DECOMPOSE** — The task is too coarse. Break it into smaller verifiable sub-steps.
- Use when: done-criteria covers multiple concerns, implementation gaps are structural
- Output: `DECOMPOSE: [sub-task 1] | [sub-task 2] | ...` (max 3 sub-tasks)
- Sub-tasks must each have a single verifiable outcome

**PRUNE** — The task is infeasible given current constraints. Skip with justification.
- Use when: prerequisite missing and not fixable here, out of scope, contradicts an earlier decision
- Output: `PRUNE: [one-sentence justification]`

**ESCALATE** — Repair budget exhausted, or this is an architectural decision (Rule 4).
- Use when: RETRY failed more than once with different approaches, or fix requires structural change
- Output: `ESCALATE: [what was tried] | [root cause identified] | [what decision is needed]`
</repair_directive>

<process>

<step name="gather_context">
Before diagnosing, gather broader context about the failure scope. This prevents blind point-fixing.

**1. Check key-links and artifacts (if PLAN_PATH provided):**
```bash
# Check which must-have artifacts are satisfied
gsd-sdk query verify.artifacts "${PLAN_PATH}" 2>/dev/null || true

# Check which key-links (imports, wiring, integration points) are satisfied
gsd-sdk query verify.key-links "${PLAN_PATH}" 2>/dev/null || true
```

Parse results to understand: Is this failure isolated, or are multiple must-haves/key-links failing? If multiple are failing from the same root (e.g., a module wasn't exported), that's the real fix target.

**2. Check requirements traceability (if REQUIREMENTS_PATH provided):**
Read the plan's `requirements:` frontmatter to understand which requirements this task maps to. A fix that satisfies the done-criterion but breaks a requirement is not a fix.

**3. Check decisions (if CONTEXT_PATH provided):**
Scan CONTEXT.md for locked decisions relevant to the failed task. A fix that contradicts a user decision is worse than the original failure.

**If no extended context paths are provided:** Proceed with the original 4 inputs only (backwards compatible).
</step>

<step name="diagnose">
Using the gathered context, perform root-cause analysis before choosing a strategy.

**Root-cause reasoning (MANDATORY before selecting strategy):**
1. What specific criterion failed? (the symptom)
2. WHY did it fail? Trace backwards:
   - Is a file missing? → Was it never created, or created in the wrong location?
   - Is an import missing? → Was the module never exported, or is the path wrong?
   - Is a function missing? → Was it defined but not wired, or never implemented?
3. Are other tasks in this plan affected by the same root cause? Check adjacent tasks from PLAN_CONTEXT.
4. Would fixing just the symptom leave related issues unfixed?

**Then select strategy:**
1. Is this a transient/environmental issue? → RETRY (with root-cause-informed adjustment)
2. Is the task verifiably too broad? → DECOMPOSE
3. Is a prerequisite genuinely missing and unfixable in scope? → PRUNE
4. Has RETRY already been attempted with this task? Check REPAIR_BUDGET. If 0 → ESCALATE (include root-cause in escalation)

**Log the root cause** in all cases — even for RETRY. This information flows to SUMMARY.md for cross-phase learning.
</step>

<step name="execute_retry">
If RETRY:
1. Apply the specific adjustment stated in the directive, informed by root-cause analysis
2. Re-run the task implementation
3. **Holistic re-check** — don't just re-verify the single failing criterion:
   a. Re-run the original failing verification
   b. If key-links were checked in gather_context, re-run `verify.key-links` to ensure the fix didn't break other wiring
   c. Spot-check adjacent task outputs if the root cause could have affected them
4. If all checks pass → continue normally, log `[Node Repair - RETRY] Task [X]: [root cause] → [adjustment made]`
5. If fails again → decrement REPAIR_BUDGET, re-invoke node-repair with updated context (include what was tried)
</step>

<step name="execute_decompose">
If DECOMPOSE:
1. Replace the failed task inline with the sub-tasks (do not modify PLAN.md on disk)
2. Execute sub-tasks sequentially, each with its own verification
3. If all sub-tasks pass → treat original task as succeeded, log `[Node Repair - DECOMPOSE] Task [X] → [N] sub-tasks`
4. If a sub-task fails → re-invoke node-repair for that sub-task (REPAIR_BUDGET applies per sub-task)
</step>

<step name="execute_prune">
If PRUNE:
1. Mark task as skipped with justification
2. Log to SUMMARY "Issues Encountered": `[Node Repair - PRUNE] Task [X]: [justification]`
3. Continue to next task
</step>

<step name="execute_escalate">
If ESCALATE:
1. Surface to user via verification_failure_gate with full repair history
2. Present: what was tried (each RETRY/DECOMPOSE attempt), what the blocker is, options available
3. Wait for user direction before continuing
</step>

</process>

<logging>
All repair actions must appear in SUMMARY.md under "## Deviations from Plan":

| Type | Format |
|------|--------|
| RETRY success | `[Node Repair - RETRY] Task X: root cause: [cause] → fix: [adjustment] — resolved` |
| RETRY fail → ESCALATE | `[Node Repair - RETRY] Task X: root cause: [cause] → [N] attempts exhausted — escalated to user` |
| DECOMPOSE | `[Node Repair - DECOMPOSE] Task X: root cause: [cause] → split into [N] sub-tasks — all passed` |
| PRUNE | `[Node Repair - PRUNE] Task X skipped: [justification] (root cause: [cause])` |

Root-cause logging enables cross-phase learning. If the same root cause recurs across phases (e.g., "barrel exports not updated"), it signals a planner gap worth addressing upstream.
</logging>

<constraints>
- REPAIR_BUDGET defaults to 2 per task. Configurable via config.json `workflow.node_repair_budget`.
- Never modify PLAN.md on disk — decomposed sub-tasks are in-memory only.
- DECOMPOSE sub-tasks must be more specific than the original, not synonymous rewrites.
- If config.json `workflow.node_repair` is `false`, skip directly to verification_failure_gate (user retains original behavior).
- gather_context is additive — if extended context paths (REQUIREMENTS_PATH, CONTEXT_PATH, PLAN_PATH) are not provided, repair falls back to original 4-input behavior. No existing workflows break.
- Holistic re-check should be lightweight (tool calls, not full verification) to stay within token budget.
</constraints>
