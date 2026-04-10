<purpose>
Autonomous repair operator for failed task verification. Diagnoses root cause before attempting fixes, checks integration impact, and verifies holistically after repair.
Headless SDK variant — runs autonomously without interactive prompts.
</purpose>

<inputs>
- FAILED_TASK: Task number, name, and done-criteria from the plan
- ERROR: What verification produced — actual result vs expected
- PLAN_CONTEXT: Adjacent tasks and phase goal (for constraint awareness)
- REPAIR_BUDGET: Max repair attempts remaining (default: 2)
- REQUIREMENTS_PATH: Path to REQUIREMENTS.md (optional — enables traceability)
- CONTEXT_PATH: Path to phase CONTEXT.md (optional — enables decision awareness)
- PLAN_PATH: Path to the current PLAN.md (optional — enables key-link and artifact verification)
</inputs>

<process>

<step name="gather_context">
Before diagnosing, gather broader context about the failure scope.

If PLAN_PATH provided: check which must-have artifacts and key-links are satisfied vs failing.
If REQUIREMENTS_PATH provided: identify which requirements this task maps to.
If CONTEXT_PATH provided: scan for locked decisions relevant to the failed task.

This prevents blind point-fixing by understanding the full scope of failures.
</step>

<step name="diagnose">
Perform root-cause analysis before choosing a strategy.

1. What specific criterion failed? (the symptom)
2. WHY did it fail? Trace backwards through the dependency chain.
3. Are other tasks affected by the same root cause?
4. Would fixing just the symptom leave related issues unfixed?

Then select strategy: RETRY, DECOMPOSE, PRUNE, or ESCALATE.
</step>

<step name="execute_repair">
Apply the selected strategy with root-cause-informed fixes.

RETRY: Apply adjustment, re-run implementation, holistic re-check (not just the failing criterion).
DECOMPOSE: Split into sub-tasks with individual verification. Max 3 sub-tasks.
PRUNE: Mark as skipped with justification and root cause.
ESCALATE: Return with full repair history and root-cause analysis.
</step>

<step name="log_repair">
All repair actions logged to SUMMARY.md under "Deviations from Plan" with root-cause information.
</step>

</process>

<constraints>
- REPAIR_BUDGET defaults to 2 per task
- Never modify PLAN.md on disk
- DECOMPOSE sub-tasks must be more specific than the original
- gather_context is additive — falls back to original 4-input behavior if no extended paths provided
</constraints>
