---
title: Add dangerous command blocking hook
date: 2026-04-10
priority: high
---

## Task

Port PBR's `check-dangerous-commands.js` to GSD as a PreToolUse hook on Bash commands. This blocks destructive shell operations that could destroy `.planning/` or repository integrity.

## Commands to Block (exit 2)

- `rm -rf .planning` (or any rm targeting .planning/)
- `git reset --hard`
- `git push --force` to main/master
- `git clean -fd` / `-fxd` (removes untracked files including .planning/)

## Commands to Warn (advisory, exit 0)

- `git checkout -- .` (discards all unstaged changes)
- `git push --force` to non-main branches (warn, don't block)
- Large `rm -rf` on project directories

## PBR Reference

- `plugins/pbr/scripts/check-dangerous-commands.js` — full implementation with BLOCK_PATTERNS and WARN_PATTERNS arrays
- Called by `pre-bash-dispatch.js` as the first check (safety-critical → runs before format checks)

## Why High Priority

GSD currently has **zero** protection against destructive Bash commands. The agent can destroy the entire `.planning/` directory with a single command. The cost of not having this is catastrophic; the cost of having it is zero for normal operations.

## Files to Create/Modify

1. Create `hooks/gsd-dangerous-command-guard.js` with block/warn pattern matching
2. Register in `bin/install.js` as PreToolUse hook on Bash tool
3. Add to `scripts/build-hooks.js` HOOKS_TO_COPY list
4. Add test in `tests/` for pattern matching
5. Consider: integrate into existing `gsd-validate-commit.sh` or keep separate (PBR keeps them separate, dispatches from `pre-bash-dispatch.js`)
