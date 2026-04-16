# Handover: SDK query layer (registry, CLI, parity docs)

Paste this document (or `@sdk/HANDOVER-QUERY-LAYER.md`) at the start of a new session so work continues without re-deriving scope.

## Parent tracking

- **Issue:** [gsd-build/get-shit-done#2302](https://github.com/gsd-build/get-shit-done/issues/2302) — Phase 3 SDK query parity, registry, docs (umbrella #2007).
- **Workspace:** `D:\Repos\get-shit-done` (PBR backport). **Upstream:** `gsd-build/get-shit-done`. Confirm branch with `git branch` (typical: `feat/sdk-phase3-query-layer`).

### Scope anchors (do not confuse issues)

| Role | GitHub | Notes |
|------|--------|--------|
| **Product / requirements anchor** | [#2007](https://github.com/gsd-build/get-shit-done/issues/2007) | Problem statement, user stories, and target architecture for the SDK-first migration. **Do not** treat its original acceptance-checklist boxes as proof of what is merged upstream; work was split into phased PRs after maintainer review. |
| **Phase 3 execution scope** | [#2302](https://github.com/gsd-build/get-shit-done/issues/2302) **+ this handover** | What this branch is actually doing now: registry/CLI parity, docs, harness gaps, runner alignment follow-ups as listed below. |
| **Patch mine (if local tree is short)** | [PR #2008](https://github.com/gsd-build/get-shit-done/pull/2008) and matching branches | Large pre-phasing PR; cherry-pick or compare when something looks missing vs that line of work. |

---

## What was delivered (this line of work)

### 1. Parity documentation (`QUERY-HANDLERS.md`)

- **`## Golden parity: coverage and exceptions`** — How `golden.integration.test.ts` compares SDK vs `gsd-tools.cjs` (full `toEqual`, subset, normalized `docs-init`, stubs, time-dependent fields, etc.).
- **`## CJS command surface vs SDK registry`** — Naming aliases, CLI-only rows, SDK-only rows, and a **top-level `gsd-tools` command → SDK** matrix.
- **`docs/CLI-TOOLS.md`** — Short “Parity & registry” pointer into those sections.
- **`HANDOVER-GOLDEN-PARITY.md`** — One paragraph linking to the same sections.

### 2. `gsd-sdk query` tokenization (`normalizeQueryCommand`)

- **Problem:** `gsd-sdk query` used only argv[0] as the registry key, so `query state json` dispatched `state` (unregistered) instead of `state.json`.
- **Fix:** `sdk/src/query/normalize-query-command.ts` merges the same **command + subcommand** patterns as `gsd-tools` `runCommand()` (e.g. `state json` → `state.json`, `init execute-phase 9` → `init.execute-phase`, `scaffold …` → `phase.scaffold`, `progress bar` → `progress.bar`). Wired in `sdk/src/cli.ts` before `registry.dispatch()`.
- **Tests:** `sdk/src/query/normalize-query-command.test.ts`.

### 3. `phase add-batch` in the registry

- **Implementation:** `phaseAddBatch` in `sdk/src/query/phase-lifecycle.ts` — port of `cmdPhaseAddBatch` from `get-shit-done/bin/lib/phase.cjs` (batch append under one roadmap lock; sequential or `phase_naming: custom`).
- **Registration:** `phase.add-batch` and `phase add-batch` in `sdk/src/query/index.ts`; listed in **`QUERY_MUTATION_COMMANDS`** (dotted + space forms).
- **Tests:** `describe('phaseAddBatch')` in `sdk/src/query/phase-lifecycle.test.ts`.
- **Docs:** `QUERY-HANDLERS.md` updated — `phase add-batch` is **registered**; CLI-only table no longer lists it.

---

## Query surface completeness (snapshot)

| Status | Surface |
|--------|---------|
| **Registered** | Essentially all `gsd-tools.cjs` `runCommand` surfaces, including **`phase.add-batch`**. |
| **CLI-only (by design)** | **`graphify`**, **`from-gsd2`** — not in `createRegistry()`; documented in `QUERY-HANDLERS.md`. |
| **SDK-only extra** | **`phases.archive`** — no `gsd-tools phases archive` subcommand (CJS has `list` / `clear` only). |

**Programmatic API:** `createRegistry()` / `registry.dispatch('dotted.name', args, projectDir)`.

**CLI:** `gsd-sdk query …` — apply **`normalizeQueryCommand`** semantics (or pass dotted names explicitly).

**Still not unified:** `GSDTools` (`sdk/src/gsd-tools.ts`) shells out to `gsd-tools.cjs` for plan/session flows; migrating callers to the registry is separate #2302 / runner work.

---

## Canonical files

| Path | Role |
|------|------|
| `sdk/src/query/index.ts` | `createRegistry()`, `QUERY_MUTATION_COMMANDS`, handler wiring. |
| `sdk/src/query/normalize-query-command.ts` | CLI argv → registry command string. |
| `sdk/src/cli.ts` | `gsd-sdk query` path (uses `normalizeQueryCommand`). |
| `sdk/src/query/QUERY-HANDLERS.md` | Registry contracts, parity tiers, CJS matrix, mutation notes. |
| `sdk/src/golden/golden.integration.test.ts` | Golden parity vs `captureGsdToolsOutput()`. |
| `docs/CLI-TOOLS.md` | User-facing CLI; links to parity sections. |

Related handovers: **`HANDOVER-GOLDEN-PARITY.md`**, **`HANDOVER-PARITY-DOCS.md`** (older parity-doc brief; content largely folded into `QUERY-HANDLERS.md`).

---

## Suggested next session

1. **Golden test for `phase.add-batch`** — Optional cross-check vs `captureGsdToolsOutput('phase', ['add-batch', …])` in a temp project (or document as test gap if too heavy).
2. **Re-export `normalizeQueryCommand`** from `sdk/src/query/index.ts` (or package root) if external integrators need the same argv rules as `gsd-sdk query`.
3. **Issue #2302 follow-ups** — Runner alignment (`GSDTools` → registry where appropriate); keep **`graphify` / `from-gsd2`** out of scope unless product reopens.
4. **Drift check** — When adding CJS commands, update `QUERY-HANDLERS.md` matrix and golden docs in the same PR.

---

## Verification commands

```bash
cd sdk
npm run build
npx vitest run src/query/normalize-query-command.test.ts src/query/phase-lifecycle.test.ts src/query/registry.test.ts --project unit
npx vitest run src/golden/golden.integration.test.ts --project integration
```

(Adjust `--project` to match `sdk/vitest.config.ts`.)

---

## Success criteria (query-layer slice)

- [x] Parity expectations and CJS↔SDK matrix documented in one place (`QUERY-HANDLERS.md`).
- [x] `gsd-sdk query` understands two-token command patterns like `gsd-tools`.
- [x] `phase add-batch` implemented and registered; **only** intentional CLI-only gaps remain (**graphify**, **from-gsd2**).

---

*Created/updated for query-layer handoff. Revise when registry surface or golden coverage changes materially.*
