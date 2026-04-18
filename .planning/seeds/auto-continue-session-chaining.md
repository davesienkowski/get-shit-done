---
title: Auto-continue session chaining from PBR
trigger_condition: When autonomous multi-phase runs need reliability improvements
planted_date: 2026-04-10
planted_during: /gsd-explore — PBR hook architecture analysis (pass 4)
---

## Idea

Port PBR's `auto-continue.js` Stop hook pattern: when a session ends, read a `.planning/.auto-next` signal file containing the next command to run. Signal file is one-shot (read-then-delete to prevent infinite loops). Includes a `session_phase_limit` (default: 3) that forces a pause after N phases to prevent context degradation.

## Why This Matters

Today `/gsd-autonomous` tries to do everything in one session. Context degrades around phase 5 of 8. Quality drops, steps get skipped, the agent loses track of must-haves. With auto-continue, each session handles 2-3 phases cleanly, then chains to the next session with fresh context. The user fires the command once and walks away.

## PBR Implementation Reference

- `plugins/pbr/scripts/auto-continue.js` — Stop hook, reads signal file, chains sessions
- `plugins/pbr/scripts/session-tracker.js` — Counts phases per session, resets on SessionStart
- Hard stops: milestone complete, `human_needed` flag, execution errors, gap closure 3+ times
- Config: `features.auto_continue: true`, `session_phase_limit: 3`

## User-Visible Benefit

- Autonomous runs survive context exhaustion — sessions rotate cleanly
- Quality stays high across all phases (fresh context per rotation)
- "Fire and forget" actually works for multi-hour milestone runs

## Adoption Notes

- Requires Stop hook support in GSD's installer (currently only SessionStart, Pre/PostToolUse, Notification)
- Signal file must be one-shot to prevent infinite restart loops
- Phase limit needs the session-tracker pattern (counter file in .planning/)
- Must respect hard-stop conditions (errors, human_needed, milestone complete)
- Consider: should the signal file contain just a command string, or structured JSON with phase number + options?
