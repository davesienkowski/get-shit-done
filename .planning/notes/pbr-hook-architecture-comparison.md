---
title: PBR hook architecture comparison — 55 hooks vs GSD's 9
date: 2026-04-10
context: /gsd-explore session analyzing PBR fork hook system at D:/Repos/pbr-from-gsd/
---

## Scale Comparison

| Dimension | GSD | PBR |
|-----------|-----|-----|
| Hook scripts | 9 | 55 |
| Event types used | 4 | 14 |
| Process model | Per-hook spawn | Dispatch + HTTP server |
| Config surface | `context_warnings` only | 15+ toggles |
| Logging | None | JSONL event log |
| Session awareness | None | Session tracker + phase counter |
| Auto-continuation | None | Stop hook + signal file |

## Event Types

| Event | GSD | PBR | Notes |
|-------|-----|-----|-------|
| SessionStart | check-update, session-state (community) | progress-tracker | PBR also resets compaction + session counters |
| InstructionsLoaded | - | instructions-loaded | Detects CLAUDE.md reloads |
| PreToolUse (Read) | - | block-skill-self-read | Saves ~13k tokens by blocking redundant reads |
| PreToolUse (Write/Edit) | workflow-guard, read-guard, prompt-guard | 6-check dispatcher | PBR blocks; GSD only advises |
| PreToolUse (Bash) | validate-commit (community) | 2-check dispatcher | PBR adds dangerous-command blocking |
| PreToolUse (Task) | - | validate-task | Validates subagent spawn parameters |
| PreToolUse (Skill) | - | validate-skill-args | Validates skill invocation |
| PreToolUse (EnterPlanMode) | - | intercept-plan-mode | Compatibility check |
| PostToolUse (Write/Edit) | phase-boundary (community) | 5-check dispatcher | PBR auto-syncs state, validates plans |
| PostToolUse (Bash) | - | post-bash-triage | **Local LLM** triages test failures |
| PostToolUse (Read) | - | track-context-budget | Context budget estimation |
| PostToolUse (Task) | - | check-subagent-output | Validates agent output quality |
| PostToolUse (Write/Edit/Bash/Task) | context-monitor | context-bridge | Similar: both track context usage |
| PostToolUseFailure | - | log-tool-failure | Logs failures for debugging |
| PreCompact | - | context-budget-check | Preserves state before compaction |
| Stop | - | auto-continue | Session chaining with phase limit |
| SubagentStart | - | log-subagent-start | Tracks agent lifecycle |
| SubagentStop | - | log-subagent + event-handler | Auto-queues verification after executor |
| TaskCompleted | - | task-completed | Processes task completion signals |
| ConfigChange | - | check-config-change | Validates configuration changes |
| SessionEnd | - | session-cleanup | Cleanup on session end |
| WorktreeCreate | - | worktree-create | Initializes .planning/ in worktrees |
| WorktreeRemove | - | worktree-remove | Cleans up worktree state |
| Notification (statusline) | statusline | status-line | Similar functionality |

## Architectural Patterns Worth Porting

### 1. Dispatcher Pattern (Highest ROI)
PBR's `pre-write-dispatch.js` runs 6 checks in 1 process. GSD spawns 3 processes for Write/Edit. Direct port saves ~200ms per Write/Edit call on Windows.

### 2. Auto-Continue (Highest User Impact)
PBR's Stop hook chains sessions together with a phase limit. Solves the "autonomous runs degrade after phase 5" problem that GSD users experience.

### 3. State Auto-Sync (Most Visible)
PBR's `check-state-sync.js` keeps STATE.md and ROADMAP.md current automatically. GSD's state goes stale when the orchestrator forgets to update it.

### 4. Dangerous Command Guard (Cheapest Safety Win)
PBR blocks `rm -rf .planning/`, `git reset --hard`, `git push --force main`. GSD has zero protection. Port cost is minimal; risk mitigation is maximal.

### 5. Hook Server (Ambitious But Transformative)
PBR's persistent HTTP server eliminates all process spawn overhead. Hook execution drops from ~100ms to ~5ms. JSONL event log enables debugging. In-memory cache eliminates repeated config reads. This is the most complex port but the largest performance win.

### 6. Subagent Lifecycle Tracking
PBR tracks SubagentStart/Stop to auto-trigger verification and count phases per session. GSD's SDK event stream already has the events — just needs hook-level integration.

## Patterns NOT Worth Porting

- **block-skill-self-read**: GSD doesn't use the `.active-skill` convention
- **enforce-pbr-workflow**: GSD has workflow-guard already (weaker but present)
- **validate-plugin-structure**: GSD doesn't have a plugin system
- **branding-audit**: PBR-specific naming enforcement
- **check-cross-plugin-sync**: Multi-plugin concern, N/A for GSD
- **Local LLM integration** (post-bash-triage): Interesting but complex, and depends on local model availability

## Key Insight

PBR's hook system is a full **behavioral layer** — it enforces workflow, tracks state, chains sessions, and auto-triggers verification. GSD's hooks are **monitoring and advisory only** — they show information and suggest actions but never enforce or automate. The gap between these two approaches is the primary source of GSD's "the agent drifted off course" and "state got stale" user complaints.
