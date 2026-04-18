---
title: Wire existing GSD tools into node-repair workflow
date: 2026-04-09
priority: high
area: workflow/repair
---

## What

Enhance `node-repair.md` and the execution workflow to leverage existing GSD tools and agents during repair, replacing the current "point-fix and retry" pattern with informed, root-cause-aware repair.

## Why

Node repair currently receives minimal context (4 inputs) and picks a strategy without understanding the broader impact of failures. Meanwhile, GSD already has `verify key-links`, `verify artifacts`, `gsd-debugger`, `gsd-integration-checker`, and the `diagnose-issues` workflow — none of which are wired into the repair loop.

## Concrete Changes

1. **Enrich repair context**: Before attempting a fix, have node-repair run `gsd-tools verify key-links` and `gsd-tools verify artifacts` on the current plan to understand the full scope of failures (not just the single done-criterion that triggered repair)

2. **Expand context engine manifest for repair**: Add a repair-specific context profile (or augment Execute) that loads REQUIREMENTS.md and CONTEXT.md — giving repair visibility into cross-phase dependencies and requirement traceability

3. **Optional debugger-first diagnosis**: When `node_repair_budget >= 2`, spend the first attempt on diagnosis (root-cause analysis using debugger patterns) rather than immediately retrying. This makes the second attempt far more likely to succeed.

4. **Holistic re-check after fix**: After applying a repair, run a broader check (not just re-verify the single failing criterion) to catch cascading issues before they propagate to the next phase

5. **Integration awareness**: If the failing task involves cross-module wiring (imports, exports, API contracts), invoke integration-checker patterns to validate the fix doesn't break other consumers

## Success Criteria

- Repair attempts address root causes, not just symptoms
- A budget of 2 is sufficient for most integration-level failures (because attempt 1 diagnoses, attempt 2 fixes precisely)
- No regression in repair speed for simple failures (syntax errors, missing files)
