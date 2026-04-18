---
title: Wire seeds, notes, and research questions into consumption workflows
date: 2026-04-09
priority: high
area: workflow/artifacts
---

## What

Add read steps to core GSD workflows so that seeds, notes, and research questions are automatically surfaced at the right moments — not just written and forgotten.

## Why

Currently, seeds, notes, and research questions are write-only artifacts. Only todos have a consumption path (via `discuss-phase.md` cross-referencing). Seeds have `trigger_condition` frontmatter specifically designed for matching, but no workflow checks triggers. Notes contain decision context that could inform discussion. Research questions are never fed to the researcher.

## Concrete Changes

### Seeds → plan-phase.md and research-phase.md

1. At the start of `plan-phase.md`, scan `.planning/seeds/*.md`
2. For each seed, compare `trigger_condition` against the current phase description/goal
3. Surface matching seeds to the user: "These seeds may be relevant to this phase"
4. If accepted, fold seed content into the planning context
5. Same pattern in `research-phase.md` — matching seeds become research inputs

### Notes → discuss-phase.md

1. At the start of `discuss-phase.md`, scan `.planning/notes/*.md`
2. Keyword-match note titles/content against the current phase topic
3. Surface relevant notes as prior context: "Previous exploration noted..."
4. This prevents re-discussing already-explored decisions

### Research Questions → research-phase.md

1. At the start of `research-phase.md`, read `.planning/research/questions.md`
2. Match open questions against the current phase domain
3. Fold relevant questions into the research brief as additional investigation targets
4. Mark questions as "addressed" (with date + phase reference) after research completes

## Success Criteria

- Seeds with matching trigger conditions are surfaced during planning (not silently ignored)
- Notes from prior explorations inform discussion (preventing redundant exploration)
- Open research questions are investigated when a relevant phase runs research
- No false-positive noise — matching is keyword/semantic, not "show everything"
