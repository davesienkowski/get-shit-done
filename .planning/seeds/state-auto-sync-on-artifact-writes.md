---
title: State auto-sync on artifact writes from PBR
trigger_condition: When STATE.md staleness becomes a recurring user complaint
planted_date: 2026-04-10
planted_during: /gsd-explore — PBR hook architecture analysis (pass 4)
---

## Idea

Port PBR's `check-state-sync.js` PostToolUse hook: when a SUMMARY.md or VERIFICATION.md is written inside `.planning/phases/`, automatically update STATE.md (progress bar, plan count, status) and ROADMAP.md (phase status, completion date) to reflect the new state.

## Why This Matters

STATE.md frequently gets stale because the orchestrator forgets to update it, or context compaction loses the instruction. `/gsd-progress` shows yesterday's numbers. The statusline's task display is based on stale state. With auto-sync, every completed plan immediately shows up. The status line reflects reality.

## PBR Implementation Reference

- `plugins/pbr/scripts/check-state-sync.js` — PostToolUse on Write|Edit targeting .planning/phases/
- Triggers on: SUMMARY*.md writes, VERIFICATION.md writes
- Updates: ROADMAP.md Progress table (Plans Complete, Status, Completed date), STATE.md Current Position (Plan count, Status, Last activity, Progress bar)
- Guards: skips STATE.md/ROADMAP.md writes (prevents circular trigger), skips files outside .planning/phases/
- Uses atomic write (write-then-rename) for crash safety

## User-Visible Benefit

- `/gsd-progress` always shows accurate numbers
- Statusline stays current without orchestrator intervention
- Autonomous runs produce reliable state tracking throughout

## Adoption Notes

- Must prevent circular triggers (hook writes STATE.md → hook fires again on STATE.md write)
- STATE.md format must be parseable and updatable by regex (GSD's format may differ from PBR's)
- Consider: should this also update the SDK's event stream with a `StateMutation` event?
- Atomic writes (tmp + rename) are important for crash safety on Windows
- Config toggle: `hooks.state_auto_sync: true` (default on for new projects)
