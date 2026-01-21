# Subagent Plan Approval: Implementation Exploration

## GSD Philosophy Check

> "The complexity is in the system, not in your workflow."
> "A few commands that just work."
> "I trust the workflow. It just does a good job."

Any solution must:
- **Not add visible complexity** - no new commands, minimal config
- **Be training wheels** - for building trust, then removed
- **Leverage existing infrastructure** - modes, checkpoints, gates

## Goal

Allow users to review execution approach before subagent begins work. Use cases:

- New users building confidence in the system
- High-stakes projects where errors carry consequences
- Debugging sessions requiring visibility into agent reasoning

## Reframe: Do We Even Need Subagent-Level Approval?

**What already exists:**
1. User runs `/gsd:plan-phase` → creates PLAN.md (visible, reviewable)
2. User runs `/gsd:execute-plan` → subagent executes the plan
3. Interactive mode already gates at checkpoints during execution

**The gap:** Between steps 1 and 2, user can read the plan. But they don't see *how the subagent interprets it* before execution starts.

**But wait:** The plan IS the interpretation. PLAN.md contains:
- Exact tasks with verification criteria
- Context files to read
- Deviation rules
- Checkpoint locations

If the plan is clear, the subagent follows it. If the user doesn't trust the plan, they should fix the plan, not add an approval layer.

**Possible reframe:** The feature request might actually be about:
1. **Pre-execution summary** - "Here's what I'm about to do" (1 paragraph)
2. **Not** deep strategy analysis (expensive, complex)

## Constraint

No native spawn parameter exists. Implementation uses prompt engineering or workflow gates.

---

## The GSD-Aligned Approach: Orchestrator Gate (No Subagent Changes)

**Insight:** The approval doesn't need to happen *inside* the subagent. It can happen *before* the subagent spawns, at the orchestrator level.

**How it works:**

1. User has `mode: interactive` (or new `mode: guided`)
2. `/gsd:execute-plan` runs
3. Orchestrator reads PLAN.md, generates 1-paragraph summary:
   ```
   ════════════════════════════════════════
   READY TO EXECUTE: 02-01 User Authentication
   ════════════════════════════════════════

   3 tasks: Create auth middleware, implement JWT signing, add login endpoint
   Files: src/middleware/auth.ts, src/lib/jwt.ts, src/routes/login.ts
   Checkpoints: 1 (verify middleware works)

   Proceed? (y/n)
   ════════════════════════════════════════
   ```
4. User confirms → orchestrator spawns subagent
5. Subagent executes normally (no prompt changes)

**Why this is GSD-aligned:**

- **No new commands** - existing mode system controls it
- **No subagent complexity** - subagent prompts unchanged
- **Orchestrator handles it** - complexity stays in the system
- **Cheap** - just reads PLAN.md, no extra spawns
- **Training wheels** - switch to `mode: yolo` when ready

**Implementation:**

Add to `execute-plan.md` workflow, in `identify_plan` step:

```xml
<if mode="interactive" OR="guided">
Present pre-execution summary:
- Parse PLAN.md frontmatter (tasks count, checkpoints)
- List files likely to be created/modified (from task descriptions)
- Show checkpoint count
- Wait for confirmation
</if>

<if mode="yolo">
Skip summary, spawn immediately
</if>
```

**Config (optional):**
```json
{
  "mode": "interactive",
  "gates": {
    "pre_execute_summary": true
  }
}
```

Or just make it default behavior for `interactive` mode. No config needed.

---

## Comparison: Subagent Approaches vs Orchestrator Gate

| Aspect | Subagent Approaches | Orchestrator Gate |
|--------|---------------------|-------------------|
| Extra spawns | 1-2 | 0 |
| Subagent prompt changes | Yes | No |
| New commands | Maybe | No |
| Config complexity | Medium | None (mode-based) |
| Token cost | Higher | Minimal |
| GSD philosophy | Adds visible complexity | Invisible to user |

**Recommendation:** Orchestrator Gate is the GSD way.

---

## When Subagent-Level Approval WOULD Matter

The orchestrator gate shows *what's in the plan*. It doesn't show *how the agent will interpret ambiguity*.

Subagent-level approval would matter if:
- Plans are intentionally vague (but GSD plans shouldn't be)
- Agent might deviate significantly (but deviation rules handle this)
- User wants to see agent's "thinking" (but that's debugging, not approval)

For GSD's spec-driven approach, if the plan is good, execution is predictable. The plan IS the approval.

---

## Reframe: This Is About Accessibility, Not Approval

The feature request might not be about trust or oversight. It's about **user experience for new users**.

**The real gap:**
- PLAN.md exists and is readable
- But new users don't know where it is
- Or that it's human-readable
- Or feel comfortable navigating `.planning/phases/XX-name/`
- Being told "go read the file" feels like homework

**What feels friendlier:**
- Claude presents a summary in chat before execution
- User sees what's happening without leaving the conversation
- Same information, but delivered conversationally

**This isn't approval - it's onboarding UX.**

The summary isn't asking permission. It's saying "here's what we're doing" in a friendly way that helps new users understand the system.

```
════════════════════════════════════════
EXECUTING: 02-01 User Authentication
════════════════════════════════════════

Building: JWT auth with refresh tokens
Tasks: 3 (create middleware, implement signing, add login endpoint)
Files: src/middleware/auth.ts, src/lib/jwt.ts, src/routes/login.ts

Full plan: .planning/phases/02-auth/02-01-PLAN.md
════════════════════════════════════════

Starting execution...
```

No confirmation needed. Just visibility. User learns:
1. What's being built (summary)
2. Where to find full details (file path)
3. That plans are human-readable files they can review

**After a few executions:** User understands the system, knows where plans live, trusts the workflow. The summary becomes unnecessary noise → switch to YOLO.

---

## Implementation: Friendly Summary (Not Approval Gate)

**In interactive mode:** Show summary, brief pause, then execute. No y/n prompt.

**In YOLO mode:** Execute immediately, no summary.

**First-run enhancement:** Maybe show summary for first 3 executions regardless of mode, then respect mode setting.

This is onboarding, not oversight. It builds understanding, then gets out of the way.

---

## Archived: Subagent Approaches (For Reference)

The following approaches were explored but are more complex than needed:

## Approach 1: Two-Phase Spawning

**How it works:**
1. Spawn "analysis" subagent → returns execution strategy
2. Orchestrator presents strategy to user
3. User approves/modifies
4. Spawn "execution" subagent with approved strategy

**Pros:**
- Clean separation of concerns
- User sees full strategy before any execution

**Cons:**
- Double API calls per plan
- Context duplication (both agents read same plan)
- Increased latency
- Higher token cost

**Verdict:** Works but expensive. Explore alternatives.

---

## Approach 2: Early Return with Resume

**How it works:**
1. Spawn subagent with modified prompt:
   ```
   "Read plan. Create execution strategy. Return strategy immediately.
   DO NOT execute. You will be resumed after approval."
   ```
2. Orchestrator receives strategy, presents to user
3. On approval, resume same agent using Task tool's `resume` parameter
4. Resumed agent continues with execution

**Pros:**
- Single agent, single context load
- Resume preserves agent's understanding of the plan
- No re-reading of plan files

**Cons:**
- Depends on resume working reliably across approval wait
- Agent state must persist through user think-time
- Resume parameter behavior needs verification

**Open questions:**
- How long can an agent be "paused" before resume fails?
- Does resume preserve full context or just conversation?

---

## Approach 3: Inline Strategy Gate (Single Agent)

**How it works:**
1. Spawn subagent with gate instruction in prompt:
   ```
   "Before executing, output your execution strategy in a structured format:

   === EXECUTION STRATEGY ===
   [strategy details]
   === END STRATEGY ===

   Then STOP and wait. The orchestrator will inject approval signal.
   Continue execution only after receiving: APPROVED_PROCEED"
   ```
2. Orchestrator parses agent output, extracts strategy
3. Presents to user
4. Sends follow-up message to agent: "APPROVED_PROCEED" or modifications

**Pros:**
- Single agent spawn
- No context duplication
- Natural conversation flow

**Cons:**
- Requires orchestrator to maintain agent session
- Agent is "waiting" (consuming resources?)
- Blocking agent mid-execution is unusual pattern

**Open questions:**
- Can Task tool handle multi-turn interaction with a spawned agent?
- Or does Task tool expect single prompt → single response?

---

## Approach 4: Config-Driven Checkpoint Injection

**How it works:**
1. Add config option: `"require_plan_approval": true`
2. When spawning subagent, inject synthetic checkpoint at start:
   ```
   "This plan has a mandatory approval checkpoint.

   BEFORE any task execution:
   1. Analyze all tasks in the plan
   2. Create execution strategy
   3. Return with checkpoint format (see checkpoint-return.md)
   4. Type: checkpoint:plan-approval

   Orchestrator will spawn continuation agent after approval."
   ```
3. Subagent returns with structured checkpoint (like existing checkpoint:human-verify)
4. Orchestrator presents to user
5. On approval, spawns fresh continuation agent with "Tasks 1-N approved, execute"

**Pros:**
- Uses existing checkpoint infrastructure
- Familiar pattern (checkpoints already work this way)
- No new Task tool behavior needed
- Fresh execution agent gets clean context

**Cons:**
- Still two spawns (analysis agent + execution agent)
- But: analysis agent is lightweight (just reads plan, returns strategy)
- Execution agent doesn't re-analyze, just executes

**Optimization:** Analysis agent prompt explicitly says "DO NOT read context files, DO NOT explore codebase. Only read PLAN.md and return strategy." This keeps first spawn cheap.

---

## Approach 5: Orchestrator-Side Analysis (No Subagent for Strategy)

**How it works:**
1. Orchestrator (main context) reads the plan itself
2. Orchestrator generates execution strategy
3. Presents to user for approval
4. On approval, spawns subagent with approved strategy embedded

**Pros:**
- Single subagent spawn
- No subagent context for analysis phase
- Orchestrator already has project context

**Cons:**
- Uses main context tokens for analysis
- Orchestrator may not have fresh perspective
- Strategy generation in main context may be lower quality than dedicated agent

**When this makes sense:**
- Small plans (2-3 tasks)
- Orchestrator already loaded relevant context
- User just wants sanity check, not deep analysis

---

## Approach 6: Hybrid - Conditional Based on Plan Complexity

**How it works:**
1. Orchestrator reads plan, counts tasks, checks for complexity signals
2. Simple plans (≤3 tasks, no checkpoints): Orchestrator generates strategy
3. Complex plans (>3 tasks, has checkpoints, references many files): Spawn analysis agent

**Decision tree:**
```
Plan complexity?
├── Simple (≤3 tasks, ≤5 context files)
│   └── Orchestrator analyzes → user approves → spawn executor
└── Complex (>3 tasks OR >5 context files OR has architectural decisions)
    └── Spawn lightweight analyzer → user approves → spawn executor
```

**Pros:**
- Optimizes for common case (most plans are simple)
- Only pays double-spawn cost when needed
- Keeps main context clean for complex plans

**Cons:**
- More complex routing logic
- Complexity heuristics may misfire

---

## Implementation Recommendation

**Use the Orchestrator Gate approach:**

1. Modify `execute-plan.md` workflow's `identify_plan` step
2. In `interactive` mode: show pre-execution summary, wait for confirmation
3. In `yolo` mode: spawn immediately (current behavior)

No new commands. No subagent changes. No config bloat.

**The insight:** GSD's spec-driven approach means the plan IS the strategy. If users want approval, they're really asking for a confirmation gate before the subagent spawns—not a deep analysis of what the subagent "plans to do."

---

## Next Steps

1. Add pre-execution summary to `execute-plan.md` for interactive mode
2. Consider if a `guided` mode variant makes sense (more gates than interactive)
3. Update docs to clarify that PLAN.md visibility = execution strategy visibility

---

## Summary

| Approach | Aligns with GSD? | Recommendation |
|----------|------------------|----------------|
| Subagent prompt changes | No - adds complexity | Archive |
| Extra analyzer spawns | No - expensive, visible | Archive |
| Approval gate (y/n) | No - suggests system needs babysitting | Skip |
| Friendly summary (no prompt) | Yes - onboarding UX | **Implement** |

**The insight:** This isn't about trust or approval. It's about helping new users understand what GSD is doing. Present the plan summary in chat, show where the file lives, then execute. No confirmation needed.

**Implementation:**
1. `interactive` mode: Show brief summary before execution (no y/n)
2. `yolo` mode: Execute immediately, no summary
3. Summary includes path to PLAN.md so users learn where artifacts live

**Result:** New users feel guided. Experienced users switch to YOLO. No gates, no approval, just good UX.
