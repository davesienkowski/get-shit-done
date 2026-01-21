# Issue #69: Next Steps Guidance Dropped After Plan Completion

**Affected Version:** v1.4.26 (regression since v1.4.10 when orchestrator pattern was introduced)

**Fix Branch:** `fix/issue-69-restore-next-steps-guidance`

---

## Problem Statement

After the orchestrator pattern was introduced in commit `8ed6a8f`, users no longer see explicit "what to do next" instructions with file paths after plan execution. Users must now run `/gsd:progress` to discover the next action.

**User report:** "Current version dropped the commands what to do next - why?"

## Root Cause Analysis

### The Regression

Commit `8ed6a8f` (Jan 13, 2026) converted `/gsd:execute-plan` from direct execution to an orchestrator pattern for ~80% context reduction.

**Before (direct execution):**
```markdown
<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md   ← Full 1800 lines loaded
</execution_context>

<process>
5. Follow execute-plan.md workflow:
   - Execute tasks
   - Create SUMMARY.md
   - offer_next step executed directly   ← User sees next command with path
</process>
```

The main Claude instance loaded the full workflow including the detailed `offer_next` step (lines 1609-1807), which determines and displays:
- Next plan with exact path: `/gsd:execute-plan .planning/phases/XX-name/{phase}-{next-plan}-PLAN.md`
- Next phase command: `/gsd:plan-phase {N+1}`
- Milestone completion: `/gsd:complete-milestone`

**After (orchestrator pattern):**
```markdown
<execution_context>
@~/.claude/get-shit-done/templates/subagent-task-prompt.md  ← Only 96 lines
</execution_context>

<process>
6. Handle subagent return
7. Report completion
   - Show SUMMARY path
   - Show commits from subagent return
   - Offer next steps   ← Vague, no implementation details
</process>
```

### The Gap

1. **Subagent** loads full workflow and executes `offer_next` internally
2. **Subagent completion format** only returns:
   - Plan name, task count, SUMMARY path, commits
   - **No next steps information**
3. **Orchestrator** told to "Offer next steps" but has no logic to do so
4. **Result:** User sees completion message but no actionable next command

## The Fix

### Approach

Update the subagent completion format to include next steps determination, then have the orchestrator display it. This keeps the logic in one place (the subagent already runs `offer_next` from the workflow).

### Files Changed

#### 1. `get-shit-done/templates/subagent-task-prompt.md`

Added `## Next Up` section to completion format:

```markdown
<completion_format>
When plan completes successfully, return:

## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
...

## Next Up

Determine next action by checking phase directory:
1. Count *-PLAN.md files and *-SUMMARY.md files in current phase
2. If more plans remain (summaries < plans): show next unexecuted plan
3. If phase complete: check ROADMAP.md for next phase or milestone completion

Format based on situation:

**If more plans in phase:**
**{phase}-{next-plan}: [Plan Name]** — [objective summary]
`/gsd:execute-plan {full-path-to-next-PLAN.md}`

**If phase complete, more phases remain:**
✓ Phase {N} complete
**Phase {N+1}: [Name]** — [goal from ROADMAP]
`/gsd:plan-phase {N+1}`

**If milestone complete:**
🎉 Milestone complete — all {N} phases finished
`/gsd:complete-milestone`

Always include: `<sub>/clear first → fresh context window</sub>`
</completion_format>
```

Updated success criteria:
```markdown
- [ ] Next steps determined and included in return
```

#### 2. `commands/gsd/execute-plan.md`

Updated orchestrator step 7 to display next steps:

```markdown
7. **Report completion with next steps**
   Parse subagent return and display:

   ✓ Plan {phase}-{plan} complete

   **Summary:** {SUMMARY path from return}

   **Commits:**
   {commits list from return}

   ---

   ## ▶ Next Up

   {Next Up section from subagent return — includes command with full path}

   ---

   The subagent determines and returns the next action (next plan, next phase,
   or milestone complete) with the exact command to run.
```

Updated success criteria:
```markdown
- [ ] Next steps displayed with exact command and file path
```

## GSD Philosophy Alignment

| Principle | How Fix Aligns |
|-----------|----------------|
| Solo developer model | Removes friction — user sees next step immediately without extra commands |
| Claude automates | Subagent determines next action automatically |
| No ceremony | Just surfaces information that should have been there |
| Single-track execution | Guides user to exact next command with full path |

## Testing

After this fix, plan completion should display:

```
✓ Plan 01-01 complete

**Summary:** .planning/phases/01-foundation/01-01-SUMMARY.md

**Commits:**
- abc123f: feat(01-01): create user model
- def456g: feat(01-01): add validation

---

## ▶ Next Up

**01-02: Database Schema** — Create Prisma schema with User and Session models

`/gsd:execute-plan .planning/phases/01-foundation/01-02-PLAN.md`

<sub>/clear first → fresh context window</sub>

---
```

## Branch

```
fix/issue-69-restore-next-steps-guidance
```

## Commit

```
d321a15 fix(execute-plan): restore next steps guidance after plan completion
```
