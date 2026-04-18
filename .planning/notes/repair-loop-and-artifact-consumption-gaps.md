---
title: Repair loop & artifact consumption gap analysis
date: 2026-04-09
context: Post-SDK-migration exploration — identifying highest-leverage improvements for agent precision
---

## Summary

Two systemic issues were identified through Socratic exploration and parallel research (3 agents):

1. **The repair loop is starved, isolated, and under-equipped**
2. **Seeds, notes, and research questions are write-only artifacts**

Both issues share a root cause: existing capabilities are available but not wired into the workflows that need them.

---

## Issue 1: Repair Loop Gaps

### Context Engine Starves Executors

The `PHASE_FILE_MANIFEST` for `PhaseType.Execute` loads only `STATE.md` and `config.json`. No ROADMAP, REQUIREMENTS, or CONTEXT. During repair, the executor has zero visibility into cross-phase dependencies, requirement traceability, or broader project context. It's fixing blind.

### Node Repair Is Isolated and Surface-Level

Repair lives in `node-repair.md` — separate from the executor — and receives only four inputs: the failed task, the error, adjacent task context, and the repair budget. It does NOT re-read PLAN.md, must-haves, SUMMARY.md, or RESEARCH.md. It picks one strategy (RETRY, DECOMPOSE, PRUNE, ESCALATE) with no holistic re-check. Purely scoped to the single failing done-criterion.

### Powerful Tools Exist But Aren't Wired In

| Available But Unused During Repair | What It Does |
|---|---|
| `gsd-tools verify key-links` | Checks imports, wiring, integration points |
| `gsd-tools verify artifacts` | Validates must-have files exist and aren't stubs |
| `gsd-integration-checker` agent | Verifies cross-phase exports→imports, APIs→consumers |
| `gsd-debugger` agent | Scientific root-cause analysis with hypothesis testing |
| `diagnose-issues` workflow | Spawns parallel debuggers per gap, then feeds to planner |
| `gsd-nyquist-auditor` | Checks test coverage of fixes |
| REQUIREMENTS.md traceability | Maps tasks to requirements for impact analysis |

### The Pattern Today

```
Task fails → node-repair gets minimal context → point-fix → retry → hope
```

### The Pattern It Could Be

```
Task fails → diagnose root cause → check integration impact → targeted fix → verify holistically → retry
```

The `diagnose-issues` workflow already demonstrates this pattern. It just isn't composed into the normal repair loop.

---

## Issue 2: Write-Only Artifacts

| Artifact | Written By | Consumed By |
|---|---|---|
| Todos | explore, note, add-todo | discuss-phase (cross-references), planner (candidates) |
| Seeds | explore, plant-seed | **Nothing** — no workflow reads `.planning/seeds/` |
| Notes | explore, note | **Nothing** — no workflow reads `.planning/notes/` |
| Research questions | explore | **Nothing** — no workflow reads `research/questions.md` |

Seeds have `trigger_condition` frontmatter designed for matching, but no workflow checks triggers against the current phase. Notes contain decision context that could inform discussion. Research questions are never fed to the researcher agent.

### Proposed Consumption Points

- **Seeds** → `plan-phase.md` and `research-phase.md` should scan `.planning/seeds/` and match `trigger_condition` against the current phase description
- **Notes** → `discuss-phase.md` should load relevant notes (keyword match on phase topic) as prior context
- **Research questions** → `research-phase.md` should read `research/questions.md` and fold relevant open questions into the research brief

---

## Impact

Both issues compound under aggressive settings (`yolo` mode, `auto_advance: true`, `node_repair_budget: 2`). The repair loop's limited budget gets wasted on surface-level patches, and exploration artifacts that could have informed better planning are never seen.

## Config Settings That Amplify These Issues

- `node_repair_budget: 2` — only 2 repair attempts before giving up
- `mode: "yolo"` — no human checkpoints to catch bad repairs
- `auto_advance: true` — phases chain without pausing on partial gaps
- `granularity: "standard"` — moderate task sizes harder to verify fully
