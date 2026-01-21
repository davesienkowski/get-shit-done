# Contribution Plans

Standalone feature plans for submission as PRs to [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done).

## Plans

### 1. Large Output Handling
**File:** [large-output-handling-PLAN.md](large-output-handling-PLAN.md)
**Branch:** `feature/large-output-handling`

Reduces SUMMARY.md context bloat by persisting verification outputs to disk. Leverages Claude Code v2.1.2's large output persistence pattern.

**Changes:**
- `get-shit-done/templates/summary.md` — Add verification frontmatter schema
- `get-shit-done/workflows/execute-plan.md` — Save outputs to disk
- `get-shit-done/templates/config.md` — Output retention settings

**Impact:** ~70% reduction in summary read cost (1000 tokens → 300 tokens)

---

### 2. Scope Enforcement
**File:** [scope-enforcement-PLAN.md](scope-enforcement-PLAN.md)
**Branch:** `feature/scope-enforcement`

PreToolUse hook that enforces plan file boundaries during execution. Prevents scope creep in parallel execution where undeclared file edits cause merge conflicts.

**Changes:**
- `get-shit-done/templates/hooks/scope-check.py` — Hook script
- `get-shit-done/templates/hooks/scope-check.md` — Setup documentation
- `get-shit-done/templates/config.md` — scope_enforcement config
- `get-shit-done/workflows/execute-plan.md` — Set env var for hook
- `get-shit-done/references/scope-enforcement.md` — Philosophy docs

**Impact:** Zero-conflict parallel execution when plans declare accurate file boundaries

---

## Execution

Each plan is independent. Execute with:

```bash
# Create feature branch
git checkout -b feature/large-output-handling

# Execute plan
/gsd:execute-plan .planning/contrib/large-output-handling-PLAN.md

# Push and create PR
git push -u origin feature/large-output-handling
gh pr create --title "feat: large output handling for SUMMARY.md"
```

## Dependencies

Neither plan depends on the other. Can be submitted as separate PRs in any order.

Both plans:
- Are backwards compatible
- Have graceful degradation (features are opt-in)
- Follow GSD conventions
