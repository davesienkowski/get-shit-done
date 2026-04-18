---
title: Auto-checkpoint on session end
trigger_condition: When Stop hook support is stable and HANDOFF.json format is finalized
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis (pass 2, pain points)
---

## Idea

Add a `Stop` hook that automatically writes a lightweight `HANDOFF.json` when a Claude Code session ends — regardless of whether the user explicitly ran `/gsd-pause-work`. Ensures `/gsd-resume-work` always has state to read, even after context exhaustion or AFK timeouts.

## Why This Matters

Today, handoff files are only created when the user explicitly runs `/gsd-pause-work`. If context runs out mid-execution (common in autonomous mode), the context-monitor hook tells the agent to inform the user — but if the user is AFK, no handoff gets written. The agent just stops. Next session starts cold with no record of what was happening.

## User-Visible Benefit

- "Where were we?" always has an answer
- No more lost context from unexpected session ends
- `/gsd-resume-work` works reliably even after crashes

## Design Sketch

Stop hook fires on session end:
1. Check if `.planning/STATE.md` exists (GSD project active)
2. Write `.planning/HANDOFF.json` with: last active phase, uncommitted file count, cost spent, timestamp
3. Never block — fire-and-forget, silent on errors
4. Don't overwrite a richer handoff from `/gsd-pause-work` if it's recent (< 5 min old)

## Adoption Notes

- Stop hooks have limited execution time — keep it fast (< 500ms)
- Must not depend on SDK being available (read STATE.md directly)
- Consider writing to a temp location first, then atomic rename
- Pair with enhanced SessionStart hook that detects HANDOFF.json and suggests `/gsd-resume-work`
