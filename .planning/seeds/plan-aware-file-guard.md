---
title: Plan-aware file guard for cross-plan conflict prevention
trigger_condition: When SDK plan execution is stable and wave-parallel execution is in use
planted_date: 2026-04-09
planted_during: /gsd-explore — hooks architecture analysis (pass 3, new capabilities)
---

## Idea

A PreToolUse hook that checks Write/Edit targets against the active plan's `files_modified` frontmatter list. When the agent touches a file not in the plan, the hook injects an advisory — catching cross-plan conflicts *before* they happen instead of during expensive verification.

## Why This Matters

Plans declare `files_modified` in YAML frontmatter, but nothing enforces this at runtime. When wave-parallel execution runs multiple plans concurrently, one plan can accidentally modify files owned by another plan in a different wave. Verification catches this after the damage, costing a full verify + gap closure cycle ($5-10).

## User-Visible Benefit

- Plans become contracts — what they say they'll touch is what they touch
- Wave-parallel execution is safer (no cross-plan file conflicts)
- Fewer surprise verification failures

## Design Sketch

PreToolUse hook on Write/Edit:
1. Read active plan ID from bridge file or `.planning/STATE.md`
2. Parse plan's frontmatter for `files_modified` list
3. If target file not in list: advisory "This file isn't in the plan's files_modified. Update frontmatter or reconsider."
4. If no active plan detected: skip (not in execution mode)

## Adoption Notes

- Needs a way to know "which plan is currently executing" — SDK bridge file or STATE.md convention
- Must be fast — plan frontmatter should be cached per session, not re-parsed per tool call
- Advisory only — never block (agent may legitimately need to touch unlisted files)
- Consider: also warn when plan *doesn't* touch a file it declared in files_modified (at end of execution)
