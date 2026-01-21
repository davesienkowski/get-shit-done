# GitHub Issue: Worktree Integration Discussion

**Title:** `discussion: Git worktrees as escape hatch for parallel contexts — does this fit GSD?`

**Labels:** `discussion`, `question`

---

## Context

Issue #54 raised a real pain point: when users need parallel work contexts (urgent hotfix during feature development), GSD's repo-scoped `.planning/` creates friction. The maintainer correctly noted:

> "GSD represents current project context, not a multi-track workspace."

I've been thinking about whether git worktrees could address this *without* violating that principle, and wanted to get your perspective before investing in implementation.

## The Idea

Git worktrees create independent working directories sharing a single `.git` repository. Each worktree naturally gets its own `.planning/` directory — no GSD changes required for basic isolation.

The question is: **would thin wrapper commands fit GSD's philosophy, or does this cross the line into "multi-track workspace" territory?**

```bash
# Hypothetical commands
/gsd:worktree create hotfix/critical-bug --from main
/gsd:worktree list    # Show worktrees with GSD status
/gsd:worktree remove hotfix/critical-bug
```

## Why It Might Fit

| Argument | Reasoning |
|----------|-----------|
| Each worktree is still single-focus | You're not tracking multiple things in one context — you have multiple independent GSD instances |
| Native git feature | Thin wrapper, not a new system |
| Purely opt-in | Zero impact on users who don't need it |
| Solves real friction | Issue #54, manual cleanup is tedious |

## Why It Might Not Fit

| Concern | Reasoning |
|---------|-----------|
| Scope expansion | GSD's power is simplicity; more commands = more surface area |
| Philosophy drift | Even "escape hatch" normalizes parallel work |
| Maintenance burden | More code to maintain, even if minimal |
| Message dilution | "Focus on one thing" is clearer than "focus on one thing per worktree" |

## What I'm NOT Proposing

- ❌ Cross-worktree coordination or sync
- ❌ Central worktree registry or tracking
- ❌ Making this part of standard workflow
- ❌ Any changes to existing commands

## Questions for Maintainer

1. **Does "current project context" mean "one context per repository" or "one context per working directory"?** Worktrees blur this distinction.

2. **Is "escape hatch for edge cases" acceptable, or does GSD intentionally not support parallel work?** Maybe the friction is a feature, not a bug — forcing focus.

3. **If this fits conceptually, is it worth the maintenance cost?** Even ~100 lines of markdown is more surface area.

## If The Answer Is Yes

I've drafted a minimal implementation plan:
- 3 commands (`create`, `list`, `remove`)
- Wrapper around native `git worktree`
- Optional GSD status display in `list`
- No tracking, no coordination, no sync

Happy to submit a PR if this aligns with your vision.

## If The Answer Is No

Totally understand. The current guidance ("GSD is single-context, use separate repos for parallel work") is clear and defensible. Sometimes the right answer is "that's not what this tool does."

---

*Related: #54*
