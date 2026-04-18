---
title: Hook dispatcher architecture from PBR
trigger_condition: When hook count grows beyond 6 or when Windows performance is a concern
planted_date: 2026-04-10
planted_during: /gsd-explore — PBR hook architecture analysis (pass 4)
---

## Idea

Consolidate GSD's per-check hook scripts into dispatcher scripts that read stdin once and run multiple checks sequentially with short-circuit behavior. Port PBR's `pre-write-dispatch.js` (6 checks in 1 process) and `pre-bash-dispatch.js` (2 checks in 1 process) pattern.

## Why This Matters

GSD spawns 3 separate processes for a single Write/Edit call (workflow-guard, read-guard, prompt-guard). On Windows, each process spawn costs ~100ms. PBR does the same work in 1 process. Over a 50-turn session with ~150 tool calls, GSD's hook overhead adds ~14 seconds of wall-clock time that PBR avoids.

## PBR Implementation Reference

- `plugins/pbr/scripts/pre-write-dispatch.js` — 6 checks: enforce-workflow, agent-state-write, skill-workflow, summary-gate, phase-boundary, doc-sprawl
- `plugins/pbr/scripts/pre-bash-dispatch.js` — 2 checks: dangerous-commands, validate-commit
- `plugins/pbr/scripts/post-write-dispatch.js` — 5 checks: plan-format, state-write, roadmap-sync, state-sync, quality
- Pattern: each check module exports a function `(data) => null | { output, exitCode }`. First non-null result short-circuits.

## User-Visible Benefit

- Faster tool execution (fewer process spawns per tool call)
- Adding new checks doesn't add new process overhead
- Short-circuit means safety checks run before style checks

## Adoption Notes

- Refactor existing hooks into check modules that export `checkFoo(data) => null | result`
- Create `gsd-pre-write-dispatch.js` and `gsd-pre-bash-dispatch.js` dispatchers
- Maintain backward compatibility: individual hooks still work for users who customize
- Document the dispatch order and rationale (PBR has excellent docs for this)
- Consider: the PBR hook-server pattern (persistent HTTP process) goes further but is more complex
