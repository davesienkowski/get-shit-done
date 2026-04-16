# Handover: Query layer + golden parity (next session)

Use this document at the start of a new session so work continues in context without re-deriving history.

## Goal for the next session

1. **Resume golden parity work** — extend or tighten `sdk/src/golden/golden.integration.test.ts` so SDK `createRegistry()` behavior matches `get-shit-done/bin/gsd-tools.cjs` for the commands that matter for Phase 3, using `captureGsdToolsOutput()` as the reference.
2. **One-pass review** of the query registry for **gaps** (commands still CJS-only, mismatched shapes, missing tests, docs drift).

## Repo / branch

- **Workspace:** `D:\Repos\get-shit-done` (GSD PBR backport initiative).
- **Current feature branch (last verified):** `feat/sdk-phase3-query-layer`.
- **Upstream:** PRs target `gsd-build/get-shit-done` — confirm merge state before assuming anything is on `main`.

## Query layer — what is already done

Native TypeScript handlers live under `sdk/src/query/`. `createRegistry()` in `sdk/src/query/index.ts` wires **all** of the following (plus existing handlers from earlier work):


| Area                                                                             | Notes                                                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **State (extended)**                                                             | `state.signal-waiting`, `state.signal-resume`, `state.validate`, `state.sync`, `state.prune` — ported from `get-shit-done/bin/lib/state.cjs`, registered with dotted and `state …` space aliases. |
| **detect-custom-files**                                                          | Port of installer manifest scan (`gsd-tools` `detect-custom-files --config-dir`).                                                                                                                 |
| **docs-init**                                                                    | Full port of `docs.cjs` `cmdDocsInit` in `sdk/src/query/docs-init.ts` (not the old minimal stub).                                                                                                 |
| **skill-manifest**, **audit-open**, **learnings** (list/query/copy/prune/delete) | Registered as in prior work.                                                                                                                                                                      |
| **intel.update**                                                                 | Intentional **stub** (matches CJS): returns `spawn_agent` message — not a full intel refresh.                                                                                                     |


`QUERY_MUTATION_COMMANDS` includes writes for the new state commands where appropriate; `**state.validate`** is read-only (not in the mutation set).

## Explicitly **not** in the SDK query registry (by product decision)

Do **not** implement unless requirements change:

- `**graphify`** — Depends on external `graphify` CLI / Python stack; not migrated to the query layer.
- `**from-gsd2` / `gsd2-import`** — Legacy migration helper; not needed in the registry yet.

Parity exception categories and the CJS↔SDK matrix are documented in `sdk/src/query/QUERY-HANDLERS.md` (sections **Golden parity: coverage and exceptions** and **CJS command surface vs SDK registry**).

## Files to know


| Path                                        | Role                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `sdk/src/query/index.ts`                    | Registry factory, `QUERY_MUTATION_COMMANDS`, imports.      |
| `sdk/src/query/state-mutation.ts`           | State mutations + signal / validate / sync / prune.        |
| `sdk/src/query/detect-custom-files.ts`      | Custom file detection vs manifest.                         |
| `sdk/src/query/docs-init.ts`                | Docs workflow init payload.                                |
| `sdk/src/query/registry.ts`                 | Dispatch, `GSDError` on unknown command.                   |
| `sdk/src/golden/golden.integration.test.ts` | Golden tests vs `gsd-tools.cjs`.                           |
| `sdk/src/golden/capture.ts`                 | Spawns `get-shit-done/bin/gsd-tools.cjs`, parses JSON.     |
| `sdk/src/query/QUERY-HANDLERS.md`           | Intended registry documentation (may need sync with code). |


## Golden parity — how it works today

- Tests call `**captureGsdToolsOutput(command, args, cwd)`** and compare to `**registry.dispatch(command, args, projectDir)`** (or compare stable fields / fixtures under `sdk/src/golden/fixtures/*.golden.json`).
- `**PROJECT_DIR**` in tests is the **SDK package dir** (`sdk/`); `**REPO_ROOT`** is the **repo root** (where `.planning/` lives) — important for commands that read project state.
- Integration tests require Node to execute `gsd-tools.cjs` successfully (Windows: ensure `USERPROFILE` / paths if tests touch `homedir()` — see existing `skills.test.ts` patterns if applicable).

## Suggested next-session checklist

### Review (gaps)

- Diff `gsd-tools.cjs` `switch (command)` cases against `createRegistry()` registrations — confirm no remaining **required** commands are missing (excluding graphify / from-gsd2). **Note:** top-level CLI `**scaffold`** is not a separate registry name; use `**phase.scaffold`** / `**phase scaffold**` (documented in `QUERY-HANDLERS.md`).
- Confirm `**QUERY-HANDLERS.md**` and `**docs/CLI-TOOLS.md**` (if present) list new commands and mutation semantics.
- `**skill-manifest --write**` and conditional mutation events: `QUERY_MUTATION_COMMANDS` does not list `skill-manifest` (writes only with `--write`); follow-up left optional — documented in `QUERY-HANDLERS.md`.
- `**intel.update**` remains a stub by design; documented + golden test when intel is disabled.

### Golden parity

- Add golden tests for **high-value** newly registered commands where JSON shape must match CJS (`state.validate`, `state.sync --verify`, `detect-custom-files` with temp `--config-dir`, `docs-init` with agent fields omitted, `intel.update` stub).
- For mutations, use **temp dirs** or dedicated fixture phases (existing pattern in `golden.integration.test.ts` for `frontmatter.validate`).
- Run `npm run build` in `sdk/` and `npx vitest run --project integration` — passed (Vitest `integration` project, 120s timeout).

### Fix shipped with this checklist (parity)

- `**stateExtractField`** (`sdk/src/query/helpers.ts` + `get-shit-done/bin/lib/state.cjs`): use horizontal whitespace only after `Field:` so YAML `progress:` blocks are not read as body `**Progress:`** values (fixes `state sync` dry-run alignment with real STATE.md layouts).

## Commands (quick verification)

```bash
cd sdk
npm run build
npx vitest run src/query/registry.test.ts src/query/stubs.test.ts --project unit
npx vitest run src/golden/golden.integration.test.ts --project integration
```

(Adjust `--project` names to match `sdk/vitest.config.ts` / root `vitest.config.ts`.)

## Success criteria (for the “query + golden” milestone)

- Registry covers all **agreed** GSD query commands; graphify and from-gsd2 remain **out of scope** unless explicitly re-opened.
- Golden tests cover critical commands with **documented** exceptions (stubs, intentional subset comparisons).
- Docs and `QUERY-HANDLERS.md` reflect the registry and any intentional differences from CJS.

---

*Generated for session handoff. Update this file when major registry or golden parity milestones change.*