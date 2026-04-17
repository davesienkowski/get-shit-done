# Quick task 260417-k6h — SUMMARY

**Objective:** Re-run `node bin/install.js --local --claude` so `.claude/get-shit-done/` and `.claude/agents/` match migrated repo sources (SDK query instead of direct `gsd-tools.cjs` in harness paths).

## Installer command

```bash
node bin/install.js --local --claude
```

No `--yes` / non-interactive flag was required (installer completed without blocking prompts on Windows). Help output does not list a `--yes` flag.

## Pre/post reference counts

| Metric | Pre (installed) | Post (installed) | Source (baseline) |
|--------|-----------------|------------------|---------------------|
| `gsd-tools.cjs` in workflows | 285 | 10 | 10 |
| `gsd-tools.cjs` in `gsd-*.md` agents | 49 | 6 | 6 |
| `gsd-sdk query` in workflows | 0 | 339 | 339 |
| `gsd-sdk query` in agents | 0 | 60 | 60 |

Source: `pre-install-baseline.txt` and `install-run.log` (post-install section).

## Surprises / caveats

1. **Byte identity vs repo:** `plan-phase.md` and other files are **not** byte-identical between `get-shit-done/workflows/` and `.claude/get-shit-done/workflows/` after `--local` install — the installer rewrites `@~/.claude/...` references to absolute project paths (e.g. `@D:/Repos/get-shit-done/.claude/...`). Same class of drift for `agents/gsd-planner.md` vs `.claude/agents/gsd-planner.md`. Functionally the harness is synced to the migrated content; path form differs from checkout.
2. **Git:** `.claude/` is listed in `.gitignore`, so harness changes do not appear in `git status`. A `chore(installer): …` commit of `.claude/` would require an intentional policy change or `git add -f`.
3. **`gsd-sdk query init.resume`:** May still report `agents_installed: false` / `missing_agents` — that reflects SDK detection, not necessarily a failed install under `.claude/agents/`.

## Artifacts

| File | Role |
|------|------|
| `pre-install-baseline.txt` | Task 1 evidence |
| `install-run.log` | Installer stdout + post-install grep/fc |

## Git commit

`commit_docs` remains false for normal `gsd-sdk query commit`; artifacts were committed manually with `git add -f` (`.planning/` is gitignored). **Commit:** `4261df4` — `docs(quick-260417-k6h): record Claude harness re-sync quick task`

## Human gate (Task 3)

Completed by re-invoking `/gsd-quick` with `@260417-k6h-PLAN.md` as the continuation signal after prior session rate limit.
