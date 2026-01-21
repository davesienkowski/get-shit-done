# GSD Enhancement Analysis

Analysis of proposed enhancements for get-shit-done, aligned with project philosophy.

---

## Context: GSD Core Philosophy

From README:
> "Solves context rot — the quality degradation that happens as Claude fills its context window."

> "The complexity is in the system, not in your workflow. Behind the scenes: context engineering, XML prompt formatting, subagent orchestration, state management. What you see: a few commands that just work."

Key principles from `references/principles.md`:
- **Scope control**: Quality degrades above 50% context. Aggressive atomicity.
- **Anti-enterprise**: No documentation for documentation's sake
- **Ship fast**: No enterprise process, no approval gates

---

## Enhancement 1: Large Output Handling

**Plan file:** [large-output-handling-PLAN.md](large-output-handling-PLAN.md)

### What It Does

Persists verification outputs (build logs, test results) to disk instead of inline in SUMMARY.md. Adds structured `outputs:` frontmatter for tracking.

### Honest Context Savings

| Project Type | 10-Summary Read | Change |
|--------------|-----------------|--------|
| Well-disciplined (like GSD) | 8,000 tokens | +500 (overhead) |
| Moderate inline output | 15,000 tokens | -6,000 (40% savings) |
| Verbose/failing builds | 25,000 tokens | -16,000 (64% savings) |

**Reality:** GSD's own summaries are already lean (~800 tokens). This enhancement:
- Codifies implicit discipline as explicit guidance
- Adds structured outputs tracking in frontmatter
- Provides debugging access without re-running
- Prevents worst-case bloat from failing builds

### GSD Alignment

| Principle | Alignment |
|-----------|-----------|
| Context engineering | ✅ Prevents bloat, structured tracking |
| Anti-enterprise | ✅ No new commands, invisible to user |
| Scope control | ✅ Defensive measure for edge cases |

### Verdict

**Defensive enhancement**, not dramatic optimization. Worth doing for best-practice codification and edge-case protection.

---

## Enhancement 2: Scope Enforcement

**Plan file:** [scope-enforcement-PLAN.md](scope-enforcement-PLAN.md)

### What It Does

PreToolUse hook that checks if file edits match plan's `files_modified` declaration. Prevents scope creep during parallel execution.

### Value Proposition

| Mode | Behavior | Use Case |
|------|----------|----------|
| `off` | No checking | Exploratory work |
| `warn` | Log but allow | Visibility without disruption |
| `block` | Prevent edit | Strict parallel execution |

**Key benefit:** Prevents merge conflicts in Wave-based parallel execution where undeclared file edits cause conflicts between concurrent plans.

### GSD Alignment

| Principle | Alignment |
|-----------|-----------|
| Parallel execution | ✅ Enforces plan file boundaries |
| Scope control | ✅ Prevents scope creep |
| Anti-enterprise | ⚠️ Adds config options (but optional) |

### Verdict

**High value for parallel execution.** Optional/opt-in maintains simplicity.

---

## New Claude Code Features to Leverage

From official [GitHub Releases](https://github.com/anthropics/claude-code/releases):

| Feature | Version | GSD Opportunity |
|---------|---------|-----------------|
| SessionStart hook | v2.0+ | Auto-load STATE.md on session start |
| SubagentStop hook | v2.1+ | Track subagent completion in orchestrator |
| PermissionRequest hook | v2.0+ | Auto-approve in yolo mode |
| LSP tool | v2.0.74 | Smarter dependency detection |
| Large output persistence | v2.1.2 | Reference outputs without context cost |
| Context window percentage | v2.1.6 | Real-time context monitoring |

### Waiting on Claude Code

| Enhancement | Blocked By | Issue |
|-------------|------------|-------|
| Nested agent spawning | [#4182](https://github.com/anthropics/claude-code/issues/4182) |
| maxParallelAgents config | [#15487](https://github.com/anthropics/claude-code/issues/15487) |
| MCP servers for subagents | [#16177](https://github.com/anthropics/claude-code/issues/16177) |
| fork_context for full history | [#16153](https://github.com/anthropics/claude-code/issues/16153) |

---

## Summary

| Enhancement | Files Modified | Complexity | Impact |
|-------------|----------------|------------|--------|
| Large Output Handling | 2 | Low | Defensive/codification |
| Scope Enforcement | 5 | Medium | High for parallel execution |

Both enhancements:
- Are backwards compatible
- Have graceful degradation (opt-in features)
- Follow GSD conventions
- Can be submitted as independent PRs

---

## Execution

```bash
# Large Output Handling
git checkout -b feature/large-output-handling
/gsd:execute-plan .planning/contrib/large-output-handling-PLAN.md

# Scope Enforcement
git checkout -b feature/scope-enforcement
/gsd:execute-plan .planning/contrib/scope-enforcement-PLAN.md
```
