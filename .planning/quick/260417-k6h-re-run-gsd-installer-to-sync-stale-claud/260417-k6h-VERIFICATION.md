# Quick task 260417-k6h — verification

**Date:** 2026-04-17 (re-checked while closing the plan)

## Reference counts (installed `.claude/`)

| Check | Count |
|-------|-------|
| `gsd-tools.cjs` in `.claude/get-shit-done/workflows/` | 10 |
| `gsd-tools.cjs` in `.claude/agents/gsd-*.md` | 6 |
| `gsd-sdk query` in `.claude/get-shit-done/workflows/` | 339 |
| `gsd-sdk query` in `.claude/agents/gsd-*.md` | 60 |

These **match** the source baselines recorded in `pre-install-baseline.txt` (same `gsd-tools.cjs` / `gsd-sdk query` totals for `get-shit-done/workflows/` and `agents/`). The harness is aligned with migrated content.

## Plan `diff -rq` criteria

Full tree `diff -rq get-shit-done/workflows/ .claude/get-shit-done/workflows/` is **not** expected to be empty on `--local --claude` installs: the installer rewrites `@~/.claude/...` references to absolute project paths, so files differ from checkout **only** in path form, not in migration semantics.

Same for `agents/gsd-*.md` vs `.claude/agents/gsd-*.md`.

## Smoke-test (human)

Open any installed workflow under `.claude/get-shit-done/workflows/` in the editor and confirm it uses `gsd-sdk query` for orchestration (not direct `gsd-tools.cjs` except where source still references it in legitimate contexts). Representative file: `plan-phase.md`.

**status:** passed (automated counts); path-rewrite caveat documented in SUMMARY.
