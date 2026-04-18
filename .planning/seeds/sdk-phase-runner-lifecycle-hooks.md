---
title: SDK PhaseRunner lifecycle hooks
trigger_condition: After core SDK phase runner is stable and tested — not during active development
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis
---

## Idea

Add `beforeStep` / `afterStep` hook points on the PhaseRunner state machine, allowing SDK consumers to observe and intercept the phase lifecycle (discuss → research → plan → plan-check → execute → verify → advance) without modifying core orchestration code.

## API Sketch

```typescript
interface PhaseRunnerHooks {
  beforeStep?: (step: PhaseStepType, phaseNumber: string, phaseOp: PhaseOpInfo) => Promise<'continue' | 'skip' | 'stop'>;
  afterStep?: (step: PhaseStepType, phaseNumber: string, result: PhaseStepResult) => Promise<void>;
}

// Usage
const runner = new PhaseRunner({ ...deps, hooks: myHooks });
```

## Use Cases

- **Custom validation before execution:** "Are all env vars set?" "Is the build passing?"
- **Step-boundary snapshots:** Capture cost/duration/state for debugging and analytics
- **Early abort:** Stop if external conditions change (CI failure, budget exhaustion, user signal)
- **Plugin extensibility:** Third-party tools can observe lifecycle without forking GSD

## Why This Matters

The PhaseRunner already emits events (PhaseStart, PhaseComplete) but these are fire-and-forget. Hooks give consumers **control** — they can abort, skip, or log. This is the difference between observability and extensibility.

## Adoption Notes

- Start with `beforeStep` / `afterStep` only — don't add tool-level hooks yet (premature)
- Hooks should be optional (default: no-op) and async (consumers may need I/O)
- Integrate with existing `HumanGateCallbacks` — hooks fire first, then gates
- Aligns with planted seed `sdk-hook-extensibility.md` — this is the concrete first step
- Consider whether hooks should see/modify the `SessionOptions` (e.g., override model per-step)
