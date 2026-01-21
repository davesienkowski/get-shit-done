# Feature Proposal: Git Worktree Integration

## Problem Statement

GSD's `.planning/` directory is repository-scoped, not branch-scoped. When users need parallel work contexts (urgent hotfix during feature development, PR review while milestone continues), they face friction:

1. Branch switching leaves stale planning artifacts
2. Manual cleanup is tedious and error-prone
3. Risk of mixing contexts (wrong PLAN.md for wrong branch)

The maintainer correctly identified that GSD represents "current project context, not a multi-track workspace." This proposal preserves that principle while providing an escape hatch for legitimate parallel work needs.

## Solution: Worktree-Aware GSD

Git worktrees create independent working directories sharing a single `.git` repository. Each worktree:
- Has its own `.planning/` directory (naturally isolated)
- Maintains its own focused GSD context
- Requires no tracking or coordination overhead

**Key insight:** Worktrees don't make GSD multi-track — they create multiple independent single-track contexts.

## Philosophy Alignment

| GSD Principle | Worktree Alignment |
|---------------|-------------------|
| Solo developer focus | One person, multiple independent contexts |
| No enterprise complexity | Native git feature, thin wrapper |
| Sequential milestone model | Each worktree maintains own sequence |
| Context isolation | Separate `.planning/` per worktree (new session optional) |
| Ship fast | Hotfix ships while feature continues |
| Anti-enterprise | Directory switching, not coordination |

## Proposed Commands

### Primary Commands

```
/gsd:worktree create <branch> [--from <base>]
```
Create a worktree for parallel work. Optionally specify base branch.

```
/gsd:worktree list
```
Show active worktrees with GSD status (has .planning?, current phase?).

```
/gsd:worktree remove <branch>
```
Clean up completed worktree after merging.

### Integration Points

**`/gsd:progress`** — Show worktree context awareness:
```
## Current Context
Worktree: ../myproject-hotfix (branch: hotfix/auth-fix)
Main repo: ../myproject (branch: main)

## Milestone: v1.0 Hotfix
...
```

**`/gsd:pause-work`** — Include worktree location in handoff:
```yaml
worktree: ../myproject-hotfix
branch: hotfix/auth-fix
main_repo: ../myproject
```

## Use Cases

### 1. Urgent Hotfix Mid-Milestone

```bash
# Working on Phase 3 of feature milestone
/gsd:worktree create hotfix/critical-bug --from main

# Option A: Same session (quick fixes)
cd ../myproject-hotfix-critical-bug
# GSD commands now operate on this worktree's .planning/
# Fix, commit, merge, return

# Option B: New session (substantial work)
cd ../myproject-hotfix-critical-bug && claude
# Fresh 200k context for complex debugging
```

### 2. PR Review Without Context Loss

```bash
/gsd:worktree create pr-review/feature-x --from origin/feature-x

# Review, test, provide feedback
# Remove worktree when done
/gsd:worktree remove pr-review/feature-x
```

### 3. Experimental Spike

```bash
/gsd:worktree create spike/new-approach

# Explore without polluting main planning
# Keep if successful, discard if not
```

## What This Is NOT

- **Not multi-project tracking** — No central registry of worktrees
- **Not coordination tooling** — No sync between worktrees
- **Not enterprise parallel development** — Solo developer focus preserved
- **Not required** — Purely opt-in for users who need it

## Implementation Scope

### Minimal Viable Feature
1. `/gsd:worktree create` — Create worktree with optional GSD init
2. `/gsd:worktree list` — Show worktrees with basic status
3. `/gsd:worktree remove` — Clean removal with safety checks

### Future Enhancements (Optional)
- Worktree context in `/gsd:progress` output
- Worktree awareness in `/gsd:pause-work` handoffs
- Quick-switch helper between worktrees

## Naming Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| `/gsd:worktree` | Git-native terminology | Requires git knowledge |
| `/gsd:parallel` | Intent-clear | Suggests multi-tracking |
| `/gsd:context` | GSD-native feel | Too generic |
| `/gsd:workspace` | Familiar concept | Conflicts with IDE terms |

**Recommendation:** `/gsd:worktree` — honest about what it is, no false abstractions.

## Success Criteria

1. User can create isolated work context in <30 seconds
2. Zero impact on users who don't use the feature
3. No new tracking files or coordination overhead
4. Each worktree functions as independent GSD instance
