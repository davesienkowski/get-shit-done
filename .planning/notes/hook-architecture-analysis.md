---
title: Hook architecture analysis — current state and SDK integration gaps
date: 2026-04-09
context: /gsd-explore session analyzing hooks ecosystem for GSD + SDK
---

## Current Hook Inventory

### Core Hooks (6 JS, always active)

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-statusline.js` | Notification | Shows model, task, directory, context bar; writes bridge file for context-monitor |
| `gsd-context-monitor.js` | PostToolUse | Reads statusline bridge file, injects WARNING/CRITICAL when context is low |
| `gsd-workflow-guard.js` | PreToolUse | Advisory when Write/Edit happens outside a GSD command (soft guard) |
| `gsd-read-guard.js` | PreToolUse | Advisory when Write/Edit targets existing file without prior Read |
| `gsd-prompt-guard.js` | PreToolUse | Scans .planning/ writes for prompt injection patterns |
| `gsd-check-update.js` | SessionStart | Background check for npm updates + stale hook detection |

### Community Hooks (3 bash, opt-in via `hooks.community: true`)

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-validate-commit.sh` | PreToolUse | Blocks non-Conventional-Commits format (exit 2) |
| `gsd-phase-boundary.sh` | PostToolUse | Reminds to update STATE.md when .planning/ files change |
| `gsd-session-state.sh` | SessionStart | Injects STATE.md head on session start |

## SDK Hook Surface (Current)

- **Config:** `HooksConfig` has only `context_warnings: boolean` — no typed surface for workflow_guard, community, read_guard, prompt_guard
- **Event stream:** `GSDEventStream` emits 15+ event types but has no hook integration
- **Phase runner:** `HumanGateCallbacks` for blocker decisions only — no pre/post step hooks
- **CLI:** `gsd-sdk` has `run`, `query`, `auto`, `init` — no hook-related subcommands

## Architecture Observations

1. **All hooks are standalone** — each does its own config loading, JSON parsing, file path resolution. No shared library.
2. **Hooks duplicate SDK logic** — config loading, phase state detection, session metadata are all reimplemented in plain CJS.
3. **No SDK → hook bridge** — the SDK has rich state (phase number, plan name, cost tracker, step type) that hooks can't access.
4. **Multi-runtime support works well** — stdin/stdout JSON protocol is runtime-agnostic (Claude Code, Gemini, OpenCode).
5. **Statusline → context-monitor bridge** is clever — uses temp file to pass metrics between hooks that fire on different events.

## Key Gap

The SDK owns the execution lifecycle (phase runner state machine, session runner, event stream) but hooks exist entirely outside it. There's no way for:
- A hook to know "which GSD step is running" (discuss vs. execute)
- The SDK to trigger hook-like behavior at step boundaries
- Hooks to consume SDK-computed state without re-deriving it from disk
