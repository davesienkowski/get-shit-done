# Context Validation Strengthening - Handover

## Investigation Summary

Investigated whether GSD accesses Claude Code's context percentage at runtime.

**Finding: GSD does NOT read context percentage at runtime.**

All context percentages in GSD documentation are design-time heuristics, not runtime measurements. GSD relies on architectural constraints (small plans, subagents, `/clear`) rather than monitoring.

## Claude Code Context Access (Official Sources)

| Mechanism | Purpose | Accessible to Prompts? |
|-----------|---------|------------------------|
| Status line | Display context % in terminal | ❌ Display only |
| `/cost` command | Session totals | ❌ User command |
| Token Count API | Pre-count before sending | ❌ External API |

**Key limitation**: No API access to current context state during ongoing sessions. Status line data is for user visibility, not prompt consumption.

## Current Plan-Time Validation

GSD has guidelines but no computed enforcement:

| Guideline | Location | Enforcement |
|-----------|----------|-------------|
| 2-3 tasks max | plan-phase.md:425 | Guidance only |
| ~50% context target | scope-estimation.md:20 | Guidance only |
| Split signals (>3 tasks, >5 files) | scope-estimation.md:64-77 | Guidance only |
| File count → context tables | scope-estimation.md:189-194 | Reference only |

**Gap**: `estimate_scope` step says "verify each plan fits context budget" but doesn't actually compute or enforce.

## Design Direction Agreed

**Principle**: "Complexity in the system, not your workflow"

User should NOT see:
- Context percentage estimates
- Validation warnings
- Budget calculations

Claude should:
- Silently enforce rules
- Automatically split when needed
- Just produce correctly-sized plans

## Proposed Changes

Strengthen `group_into_plans` step in `plan-phase.md` with mandatory constraints:

```xml
**Mandatory constraints (enforce silently):**

- >3 tasks in a plan → split automatically
- >5 files in any single task → split that task into separate plan
- TDD candidate mixed with other work → extract to dedicated plan
- Multiple subsystems → one plan per subsystem

Do not ask. Do not warn. Just split.

**Internal budget check:**

Before finalizing any plan, mentally estimate:
- Simple tasks: ~15% each
- Business logic: ~25% each
- Complex/TDD: ~40% each

If sum exceeds 50%: split. Don't mention the calculation.
```

## Open Questions

1. Should the `estimated_context` field be added to plan frontmatter (invisible to user, but trackable)?
2. Are there other enforcement points beyond `group_into_plans`?
3. Should this extend to `execute-plan.md` (e.g., mid-execution awareness)?
4. How to handle edge cases where splitting isn't obvious?

## Files Referenced

- `get-shit-done/workflows/plan-phase.md` - Main planning workflow
- `get-shit-done/references/scope-estimation.md` - Context budget guidance
- `get-shit-done/templates/phase-prompt.md` - Plan template
- `commands/gsd/plan-phase.md` - Command definition

## Next Steps

1. Decide on final enforcement rules
2. Draft specific edits to plan-phase.md
3. Consider if any changes needed to scope-estimation.md
4. Test with real planning scenarios
