---
title: Cost-aware statusline and budget guardian hook
trigger_condition: When SDK cost bridge is implemented or when cost visibility becomes a user priority
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis (pass 2, pain points)
---

## Idea

Extend the existing statusline hook to show real-time spend (`$1.23 / $5.00`) and add a companion PostToolUse hook that injects agent-facing budget warnings at 80% and 95% thresholds — the same pattern as the existing context-monitor but for money instead of tokens.

## Why This Matters

Users running `/gsd-autonomous` across multiple phases have no real-time cost visibility. The SDK tracks cost internally (`CostTracker`, `CostUpdate` events) but this data is trapped in the event stream. The `session-report.md` workflow estimates token usage from git commits because exact data isn't available. Users get surprised by expensive autonomous runs.

## User-Visible Benefit

- Always know what you're spending — no surprises
- Agent self-regulates budget instead of burning through silently
- Statusline becomes a financial dashboard alongside the context bar

## Design Sketch

1. SDK writes cost bridge file to `$TMPDIR/gsd-cost-{session}.json` (same pattern as statusline → context-monitor bridge)
2. Statusline hook reads bridge, appends `$X.XX / $Y.YY` after context bar
3. Budget monitor hook reads bridge on PostToolUse, injects warnings:
   - 80%: "BUDGET WARNING: Wrap up current task"
   - 95%: "BUDGET CRITICAL: Stop and checkpoint"

## Adoption Notes

- Requires SDK to write the cost bridge file (new feature in session-runner or event stream)
- Must degrade gracefully when no bridge file exists (non-SDK sessions)
- Budget limit comes from `SessionOptions.maxBudgetUsd` — hook needs to read this from bridge
- Consider opt-out config: `hooks.budget_warnings: true` (default on)
