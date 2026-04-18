# Quick Task 260416-nw9: SDK Phase 3 — Tier 2 + Tier 3 Decision-Routing Handlers

**Date:** 2026-04-16
**Branch:** feat/sdk-phase3-query-layer
**Commits:** 678cec6, c48063e, 4c1c1af, 2e9f884, e917eba

## What was built

Five new SDK query handlers completing the decision-routing audit Tier 2 and Tier 3 backlog:

### Tier 2 (completed)
- `detect.phase-type` / `detect phase-type <N>` — structured UI/schema/API/infra detection replacing fragile grep patterns in 4 workflows
- `check.completion` / `check completion phase|milestone <id>` — plan/summary count rollup and debt metrics for phase and milestone scopes

### Tier 3 (completed)
- `check.gates` / `check gates <workflow> [--phase N]` — safety gate consolidation: `.continue-here.md`, STATE error/failed, VERIFICATION.md FAIL rows
- `check.verification-status` / `check verification-status <N>` — VERIFICATION.md structured parser returning score, gaps, human_items, deferred
- `check.ship-ready` / `check ship-ready <N>` — git/gh preflight: clean tree, feature branch, remote, gh availability, verification pass

### Supporting changes
- `normalize-query-command.ts` — `'detect'` added to `MERGE_FIRST_WITH_SUBCOMMAND`
- `index.ts` — 10 new registry entries (5 dotted + 5 space-delimited aliases)
- `golden-policy.ts` — 6 new `NO_CJS_SUBPROCESS_REASON` entries
- `QUERY-HANDLERS.md` — Tier 2 rows completed, Tier 3 section added
- `HANDOVER-QUERY-LAYER.md` — tier status and resume checkpoint updated

## Test results
63 test files, 1309 tests passing (36 new tests across 5 new handler test files).

## Status
All Tiers 1–3 of the decision-routing audit are now complete in the SDK registry.
