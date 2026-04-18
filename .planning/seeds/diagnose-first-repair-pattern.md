---
title: Diagnose-first repair pattern
trigger_condition: When node-repair rework begins or repair loop improvements are planned
planted_date: 2026-04-09
planted_during: Post-SDK-migration exploration — agent precision improvements
---

## Idea

Replace the current node-repair "retry and hope" pattern with a diagnose-first approach modeled on the existing `diagnose-issues` workflow. Instead of immediately point-fixing a failing done-criterion, spend the first repair attempt on root-cause analysis, then apply a targeted fix informed by that diagnosis.

## Why This Matters

The current repair flow picks one of RETRY/DECOMPOSE/PRUNE/ESCALATE and applies it to the specific failure. But integration-level failures (missing imports, unwired modules, incomplete config) are almost never isolated — they're symptoms of a broader gap. Patching the symptom wastes a repair attempt and often introduces new issues.

The `diagnose-issues` workflow already demonstrates the right pattern:
1. Spawn debugger agents per gap for root-cause analysis
2. Collect root causes
3. Feed them to `plan-phase --gaps` for targeted fixes

This pattern should be folded into node-repair itself, not just available as a separate manual workflow.

## Design Sketch

```
Task fails verification
  ↓
Budget >= 2?
  YES → Attempt 1: Diagnose (run verify key-links, check integration points, identify root cause)
       Attempt 2: Targeted fix based on diagnosis
  NO  → Attempt 1: Best-effort fix (current behavior)
       Budget 0 → ESCALATE with diagnosis context attached
```

## Adoption Notes

- High priority — directly addresses the "attempts a fix but makes it worse" pattern
- The diagnose step should be lightweight (tool calls, not a full agent spawn) to stay within token budget
- Should work well even under `yolo` mode since diagnosis is automated, not interactive
- Consider whether diagnosis results should be persisted (e.g., in SUMMARY.md) for learning across phases
