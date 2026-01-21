# Implementation Plan: Git Worktree Integration

## Overview

Add `/gsd:worktree` command family for isolated parallel work contexts without compromising GSD's single-focus philosophy.

## File Structure

```
commands/gsd/
├── worktree.md              # Main command (subcommand router)
└── (existing commands)

get-shit-done/
├── workflows/
│   └── worktree.md          # Workflow logic
└── references/
    └── worktree-guide.md    # User-facing documentation
```

## Implementation

### Phase 1: Core Command

**File:** `commands/gsd/worktree.md`

```markdown
---
description: Manage parallel work contexts using git worktrees
arguments:
  action: create | list | remove
  branch: Branch name (for create/remove)
  from: Base branch for create (optional, default: current branch)
---

# /gsd:worktree

<context>
@~/.claude/get-shit-done/workflows/worktree.md
</context>

<objective>
Manage git worktrees for isolated GSD contexts.

Each worktree is an independent GSD instance — same repository, separate `.planning/` directory, zero coordination overhead.
</objective>

<instructions>
## Action: create

1. Validate branch name (no spaces, valid git ref)
2. Determine worktree path: `../{repo-name}-{branch-sanitized}`
3. Execute: `git worktree add <path> -b <branch> <from>`
4. Report new worktree location
5. Ask: Initialize GSD in new worktree? (for fresh milestones)

## Action: list

1. Execute: `git worktree list --porcelain`
2. For each worktree, check for `.planning/` existence
3. If `.planning/STATE.md` exists, extract current phase
4. Display formatted table:
   ```
   Path                        Branch              GSD Status
   ../myproject                main                Phase 3/5 (executing)
   ../myproject-hotfix         hotfix/auth         Phase 1/1 (planned)
   ../myproject-spike          spike/new-api       No GSD init
   ```

## Action: remove

1. Validate worktree exists
2. Check for uncommitted changes (warn if present)
3. Check for unmerged commits (warn if present)
4. Execute: `git worktree remove <path>`
5. Optionally prune: `git worktree prune`

## Safety Rules

- Never remove the main worktree
- Warn (don't block) on uncommitted work
- Suggest merge before remove if branch has unmerged commits
</instructions>
```

### Phase 2: Workflow Logic

**File:** `get-shit-done/workflows/worktree.md`

```markdown
# Worktree Workflow

<workflow>
## Create Worktree

<step name="validate_branch">
Ensure branch name is valid git ref.
Replace spaces/special chars with hyphens.
Check branch doesn't already exist (unless --from specifies it).
</step>

<step name="determine_path">
Default path pattern: `../{repo-name}-{branch-sanitized}`

Examples:
- Branch `hotfix/auth-bug` → `../myproject-hotfix-auth-bug`
- Branch `feature/user-dashboard` → `../myproject-feature-user-dashboard`
- Branch `spike/redis` → `../myproject-spike-redis`
</step>

<step name="create_worktree">
```bash
# If creating new branch from base
git worktree add <path> -b <branch> <from>

# If checking out existing branch
git worktree add <path> <branch>
```
</step>

<step name="report_and_offer_init">
Report:
```
Created worktree at: ../myproject-hotfix-auth-bug
Branch: hotfix/auth-bug
Base: main

To work in this context:
  cd ../myproject-hotfix-auth-bug
  claude  # Start fresh Claude session

Initialize GSD in new worktree? (y/n)
```

If yes: Guide through minimal `/gsd:new-project` or copy relevant context.
</step>

## List Worktrees

<step name="gather_worktree_info">
```bash
git worktree list --porcelain
```

Parse output for: path, branch, commit hash
</step>

<step name="check_gsd_status">
For each worktree path:
1. Check if `.planning/` exists
2. If exists, read `.planning/STATE.md` for phase info
3. Categorize: "executing", "planned", "complete", "no GSD"
</step>

<step name="format_output">
Table format with alignment.
Highlight current worktree with `→` marker.
</step>

## Remove Worktree

<step name="safety_checks">
1. `git status` in worktree — uncommitted changes?
2. `git log <branch> --not main` — unmerged commits?
3. Is this the main worktree? (reject if so)
</step>

<step name="execute_removal">
```bash
git worktree remove <path>
git worktree prune  # Clean stale refs
```
</step>
</workflow>
```

### Phase 3: Reference Documentation

**File:** `get-shit-done/references/worktree-guide.md`

```markdown
# Worktree Guide

Git worktrees provide isolated working directories sharing a single repository. GSD leverages this for parallel work contexts without coordination overhead.

## When to Use Worktrees

**Good candidates:**
- Urgent hotfix while mid-milestone on feature
- PR review/testing without losing your context
- Experimental spike you might discard
- Long-running feature while handling small fixes

**Not needed for:**
- Sequential work (standard GSD flow)
- Quick branch switches with no planning
- Collaborative work (GSD is solo-focused)

## Quick Reference

```bash
# Create worktree for hotfix
/gsd:worktree create hotfix/critical-bug --from main

# See all worktrees
/gsd:worktree list

# Clean up after merge
/gsd:worktree remove hotfix/critical-bug
```

## Mental Model

```
myproject/                    # Main worktree
├── .git/                     # Shared repository
├── .planning/                # Main GSD context
│   ├── STATE.md
│   └── phases/
└── src/

myproject-hotfix/             # Hotfix worktree
├── .planning/                # Independent GSD context
│   ├── STATE.md              # Different state
│   └── phases/               # Different phases
└── src/                      # Same code, different branch
```

Each worktree is a complete, independent GSD instance. No synchronization, no tracking, no overhead.

## Workflow Example

```bash
# You're working on Phase 3 of a feature
/gsd:progress
# → Phase 3: User Dashboard (executing)

# Urgent bug report comes in
/gsd:worktree create hotfix/login-crash --from main
```

### Option A: Same Session (Quick Fixes)

```bash
# Stay in same Claude session, just change directory
cd ../myproject-hotfix-login-crash

# GSD commands now operate on this worktree's .planning/
/gsd:new-project   # Creates .planning/ here
/gsd:create-roadmap
/gsd:plan-phase 1
/gsd:execute-phase 1

# Merge and return
git checkout main && git merge hotfix/login-crash
cd ../myproject
/gsd:worktree remove hotfix/login-crash
/gsd:progress  # Back to Phase 3
```

### Option B: New Session (Substantial Work)

```bash
# For longer parallel work, start fresh Claude session
cd ../myproject-hotfix-login-crash
claude  # Fresh 200k token context

# Full GSD workflow with clean context...
```

**When to use which:**
- **Same session:** Quick fixes, <30 min work, simple hotfixes
- **New session:** Multi-phase work, complex debugging, when you want full context isolation

The new session approach maximizes context quality (GSD's core value), but isn't technically required.

## Tips

1. **Name worktrees by purpose:** `hotfix-*`, `spike-*`, `pr-review-*`
2. **Keep worktrees short-lived:** Create, complete, remove
3. **One focus per worktree:** Don't try to share planning between them
4. **Match session to scope:** Quick fix = same session; substantial work = new session
```

## Integration Points (Future)

### `/gsd:progress` Enhancement

Add optional worktree context awareness:

```markdown
<!-- In progress.md, add to context section -->

## Worktree Awareness

If in a non-main worktree, display:
```
## Context
Worktree: ../myproject-hotfix (hotfix/auth-bug)
Main repo: ../myproject

## Current Milestone
...
```
```

### `/gsd:pause-work` Enhancement

Include worktree info in handoff:

```yaml
# In HANDOVER.md
session:
  worktree: ../myproject-hotfix
  branch: hotfix/auth-bug
  main_repo: ../myproject
```

## Testing Checklist

- [ ] `create` with new branch from current
- [ ] `create` with new branch from specified base
- [ ] `create` with existing remote branch
- [ ] `list` with no worktrees (just main)
- [ ] `list` with multiple worktrees, mixed GSD status
- [ ] `remove` clean worktree
- [ ] `remove` with uncommitted changes (warning)
- [ ] `remove` with unmerged commits (warning)
- [ ] `remove` main worktree (rejected)
- [ ] GSD commands work independently in each worktree

## Scope Boundaries

**In scope:**
- Thin wrapper around `git worktree` commands
- GSD status detection in worktrees
- User-friendly output formatting

**Out of scope:**
- Worktree synchronization
- Cross-worktree planning
- Automatic context switching
- Worktree templates/presets

Keep it simple. Git worktrees are the feature; GSD just makes them discoverable.
