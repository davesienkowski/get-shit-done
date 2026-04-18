---
title: Session metrics collector for cross-session learning
trigger_condition: When session telemetry infrastructure is needed for optimization or reporting
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis (pass 3, new capabilities)
---

## Idea

A PostToolUse + Stop hook pair that writes session telemetry to `.planning/.metrics/session-{id}.json`, then a SessionStart hook that injects a one-line summary from the previous session. This lets the agent adapt its approach based on history.

## Why This Matters

Each GSD session is amnesic about *how* previous sessions went. The agent knows *what* was done (from SUMMARY.md) but not *how well* — retries, cost, timing, failure patterns. The `session-report.md` workflow guesses from git commits. Real telemetry enables data-driven optimization.

## User-Visible Benefit

- Agent learns from its own patterns (expensive research → suggest disabling, commit retries → double-check format)
- Session reports become accurate (real data, not estimates)
- Users can see trends: "cost per phase is decreasing" or "research step takes 60% of time"

## Design Sketch

PostToolUse hook: increment counters in temp file
- Tool call counts by type (Read, Write, Edit, Bash, Agent)
- Retry detection (same tool + same file within 30s)

Stop hook: finalize and write `.planning/.metrics/session-{timestamp}.json`
- Total tool calls, retries, cost (from bridge), duration, step timing

SessionStart hook: read latest metrics file, inject one-liner:
- "Last session: 45 calls, 2 retries, $3.12, 42min. Research: 60% of time."

## Adoption Notes

- Metrics files should be .gitignored (ephemeral telemetry, not project state)
- Keep format simple — flat JSON, no nested structures
- Cap metrics directory size (delete files older than 30 days)
- Consider aggregation: `.planning/.metrics/summary.json` with rolling averages
- Privacy: never include file contents or prompts in metrics, only counts and timing
