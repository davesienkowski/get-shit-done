---
title: Hook-SDK bridge CLI command
trigger_condition: When simplifying hooks or adding new hooks that need project state
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis
---

## Idea

Add a `gsd-sdk hook-context` CLI subcommand that outputs pre-computed project state as JSON, so Claude Code hooks can consume rich SDK-derived data without reimplementing config loading, phase state detection, and session metadata parsing.

## Example Output

```json
{
  "config": { "model_profile": "balanced", "hooks": { "community": true, "workflow_guard": false } },
  "phase": { "number": "03", "name": "API endpoints", "step": "execute", "has_plans": true },
  "milestone": { "name": "v1.0", "phases_complete": 2, "phases_total": 8 },
  "session": { "cost_usd": 1.23, "turns": 15 }
}
```

## Why This Matters

All 6 JS hooks currently duplicate config loading (~15 lines each), phase detection, and file path resolution. A single SDK call replaces all of that with typed, validated data. This:
- Reduces hook complexity from ~100 lines to ~30 lines
- Eliminates config-parsing bugs across hooks (DRY)
- Gives hooks access to state they can't derive today (active phase step, cumulative cost)
- Makes it trivial to write new hooks

## Adoption Notes

- Must be **fast** (<200ms) — hooks run on every tool call. Cache aggressively.
- Should work without a running SDK session (read from disk state)
- Consider a temp-file bridge pattern (like statusline → context-monitor) for hot-path hooks
- Don't break standalone hook operation — hooks should gracefully degrade if `gsd-sdk` isn't available
- Could eventually replace the statusline bridge file with a richer SDK-computed bridge
