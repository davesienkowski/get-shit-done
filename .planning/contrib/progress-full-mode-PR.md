## Summary

Add optional `--full` flag to `/gsd:progress` for complete milestone tree view with task-level detail and key decisions.

**Problem:** After working through multiple phases, developers lose track of what was planned and decided. Current `/gsd:progress` shows recent context but doesn't answer "what's the full picture?"

**Solution:** `--full` flag aggregates existing PLAN.md/SUMMARY.md files into a scannable tree:

```
Phase 71: API Layer [DONE]
├─ 71-01: Auth endpoints ✓
│  └─ Decision: JWT with refresh rotation
├─ 71-02: User CRUD ✓
└─ 71-03: Rate limiting ✓

Phase 72: Frontend [IN PROGRESS]
├─ 72-01: Login form ✓
├─ 72-02: Dashboard → CURRENT
└─ 72-03: Settings ○
```

**Key design decisions:**
- Default behavior unchanged — `--full` is opt-in expansion
- Reads existing files, creates nothing new
- Scoped to current milestone only
- Max 1 decision per plan keeps output scannable

**Notable:** This PR introduces the `arguments:` frontmatter pattern for command flags. If accepted, this pattern could be documented for other commands that need optional arguments.

## Test plan

- [ ] `/gsd:progress` without flag produces unchanged output
- [ ] `/gsd:progress --full` shows standard output PLUS full tree
- [ ] Tree correctly identifies: `✓` complete, `→` current, `○` planned
- [ ] Key decisions extracted from SUMMARY.md frontmatter
- [ ] Statistics accurate (phases, plans, decisions)
- [ ] Works on projects with no completed phases (shows all as planned)
- [ ] Works on projects with all phases complete
