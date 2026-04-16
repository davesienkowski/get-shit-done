# Handover: Query layer + golden parity (next session)

Use this document at the start of a new session so work continues in context without re-deriving history.

**Related:** `HANDOVER-PARITY-DOCS.md` (#2291 scope); **`sdk/src/query/QUERY-HANDLERS.md`** (golden matrix, CJS↔SDK routing).

---

## Goal for the next session (primary)

**Port or normalize remaining read-only query handlers** so their JSON matches `get-shit-done/bin/gsd-tools.cjs`, then add **strict subprocess golden rows** (`captureGsdToolsOutput` + `registry.dispatch` with `toEqual` on `sdkResult.data`), updating `read-only-golden-rows.ts` and keeping **`golden-policy.ts`** complete.

**Do not “green the suite” by deleting or shrinking golden tests.** If a handler cannot match CJS byte-for-byte without product decisions, use **documented normalization** in the test (same approach as `docs-init` omitting agent-install fields) or **fix the TypeScript handler**—same trade-off as `scan-sessions` / `workstream.status` (see below).

---

## Repo / branch

- **Workspace:** `D:\Repos\get-shit-done` (GSD PBR backport initiative).
- **Feature branch:** `feat/sdk-phase3-query-layer` (confirm against `origin` before merging).
- **Upstream PRs:** `gsd-build/get-shit-done`.

---

## Golden parity architecture (current)

| Piece | Role |
| ----- | ---- |
| `sdk/src/golden/registry-canonical-commands.ts` | One canonical dispatch string per unique handler (`pickCanonicalCommandName`). |
| `sdk/src/golden/golden-integration-covered.ts` | Canonicals exercised by **`golden.integration.test.ts`** (subset/full/shape tests). |
| `sdk/src/golden/read-only-golden-rows.ts` | **Strict** `JsonParityRow[]` for `read-only-parity.integration.test.ts` (`toEqual` on parsed CJS JSON vs `sdkResult.data`). |
| `sdk/src/golden/read-only-parity.integration.test.ts` | Rows from `READ_ONLY_JSON_PARITY_ROWS` + **`config-path`** (plain stdout vs `{ path }`, `path.normalize`) + **`verify.commits`**. |
| `sdk/src/golden/capture.ts` | `captureGsdToolsOutput` (JSON stdout); **`captureGsdToolsStdout`** (raw stdout, e.g. `config-path`). |
| `sdk/src/golden/golden-policy.ts` | `GOLDEN_PARITY_INTEGRATION_COVERED` = integration covered ∪ `readOnlyGoldenCanonicals()`; everything else gets `GOLDEN_PARITY_EXCEPTIONS` (mutations vs `READ_HANDLER_ONLY_REASON` for read-only not yet in subprocess matrix). |
| `sdk/src/golden/golden-policy.test.ts` | Calls `verifyGoldenPolicyComplete()` so every canonical is covered or excepted. |

**Invariant:** Every canonical from `getCanonicalRegistryCommands()` is either in `GOLDEN_PARITY_INTEGRATION_COVERED` or has an exception string—**never** leave orphans by removing tests.

---

## Reference pattern: porting like `scan-sessions` and `workstream.status`

These were fixed by **aligning the TypeScript handler with the CJS implementation**, then adding a row to `READ_ONLY_JSON_PARITY_ROWS`.

1. **Find the CJS source of truth**  
   - `scan-sessions`: `get-shit-done/bin/lib/profile-pipeline.cjs` → `cmdScanSessions`  
   - `workstream status`: `get-shit-done/bin/lib/workstream.cjs` → `cmdWorkstreamStatus`  
   - `gsd-tools.cjs` `runCommand` switch shows the top-level command and argv.

2. **Implement or adjust the SDK module**  
   - Example: `sdk/src/query/profile-scan-sessions.ts` mirrors the project-array build from `cmdScanSessions`; `scanSessions` in `profile.ts` parses `--path` / `--verbose`, throws when no sessions root (same error text as CJS), returns `{ data: projects }` where `projects` matches CJS JSON array.

3. **Add a parity row** in `read-only-golden-rows.ts` with `canonical`, `sdkArgs`, `cjs`, `cjsArgs` (must match what `execFile(node, [gsdToolsPath, command, ...args])` expects).

4. **Run**  
   `cd sdk && npm run build && npx vitest run src/golden/read-only-parity.integration.test.ts src/golden/golden-policy.test.ts --project integration --project unit`

5. **Policy**  
   `readOnlyGoldenCanonicals()` picks up new canonicals automatically; no manual duplicate if the canonical is already in the JSON row list.

**When not to copy line-for-line:** subprocess-only concerns (e.g. `agents_installed` / `missing_agents` differing from in-process `~` resolution). Then **normalize in the test** (see `golden.integration.test.ts` `docs-init`: sort `existing_docs`, omit install fields)—**document in QUERY-HANDLERS.md**, do not delete the assertion.

---

## Backlog: read-only handlers still deferred (high value)

These are typical **next targets**; confirm against `GOLDEN_PARITY_EXCEPTIONS` / `READ_HANDLER_ONLY_REASON` in `golden-policy.ts` for the live list.

| Area | CJS reference (start here) | SDK file(s) | Notes |
| ---- | -------------------------- | ----------- | ----- |
| **`stats` / `stats.json`** | `bin/lib/commands.cjs` `cmdStats` | `sdk/src/query/progress.ts` `statsJson` | SDK currently returns a **small aggregate**; CJS JSON path returns **milestone, phases table, git counts, requirements, last_activity**, etc. Needs full port or shared helper extracted from CJS logic. |
| **`state.json` / `state.load`** | `bin/lib/state.cjs` `cmdStateJson` | `sdk/src/query/state.ts` `stateLoad` | Compare outputs on real `STATE.md`; align field-by-field. |
| **`state-snapshot`** | `state.cjs` snapshot path | `state.ts` `stateSnapshot` | Same as above—structured snapshot must match. |
| **`state.get`** | `cmdStateGet` | `state.ts` `stateGet` | Full document vs section; match CJS. |
| **`todo.match-phase`** | `commands.cjs` `cmdTodoMatchPhase` | `progress.ts` `todoMatchPhase` | CJS returns `{ phase, matches, todo_count }` with scoring; SDK shape differed in probes—port scoring + output shape. |
| **`verify.key-links` / `verify.references`** | `bin/lib/verify.cjs` | `sdk/src/query/verify.ts` | Detail strings (e.g. regex error text) may differ—align messages with CJS or document one intentional difference. |
| **`verify.schema-drift`** | `verify.cjs` | `verify.ts` | Output object shape differed (`valid` vs `drift_detected`)—align naming and fields with CJS. |
| **`summary.extract` / `history.digest`** | `commands.cjs` | `sdk/src/query/summary.ts` | Shape differs from CJS—port or subset-test with explicit field list. |
| **`init.*` composition** (beyond rows already in `golden.integration.test.ts`) | `bin/lib/init.cjs` various `cmdInit*` | `sdk/src/query/init.ts`, `init-complex.ts` | Many payloads include `project_title`, `agents_installed`, timestamps—**subprocess vs in-process** may differ; prefer **stable-field golden** or **omit list** in test, not dropping coverage. |
| **`audit-open` / `audit-uat`** | `bin/lib/audit.cjs`, `uat.cjs` | `audit-open.ts`, `uat.ts` | Use `--json` where applicable; align summary shapes. |
| **`skill-manifest`** (read path) | `init.cjs` `cmdSkillManifest` | `skill-manifest.ts` | Ordering or extra keys—normalize sort in test if fs order differs. |
| **`validate.agents`** | `validate.cjs` / agents path | `validate.ts` | Compare to CJS after fixing env-specific fields if any. |
| **`uat.render-checkpoint`** | `uat.cjs` | `uat.ts` | Requires a valid UAT fixture path; fix template or use repo fixture. |
| **`intel.extract-exports`** | `intel.cjs` | `intel.ts` | Compare export list to CJS for a fixed file path. |
| **`extract.messages` / `profile-sample`** | `profile-pipeline.cjs` | `profile.ts` | CJS writes temp JSONL files and uses streaming; SDK uses simplified in-memory paths—**large port** or **explicit documented exception** with unit tests; do not silently drop golden intent. |

**Mutations** (`QUERY_MUTATION_COMMANDS`): subprocess golden is optional; prefer temp dirs / `--dry-run` patterns already in `golden.integration.test.ts`. Policy already uses `MUTATION_DEFERRED_REASON`.

---

## Explicitly **not** in the SDK registry (product decision)

- **`graphify`**, **`from-gsd2` / `gsd2-import`** — CLI-only; no registry handler.

---

## Files to know (updated)

| Path | Role |
| ---- | ---- |
| `sdk/src/query/index.ts` | `createRegistry()`, `QUERY_MUTATION_COMMANDS`. |
| `sdk/src/golden/golden-policy.ts` | Coverage set + exceptions; `verifyGoldenPolicyComplete()`. |
| `sdk/src/golden/read-only-golden-rows.ts` | Strict read-only JSON matrix. |
| `sdk/src/golden/read-only-parity.integration.test.ts` | Subprocess + dispatch parity tests. |
| `sdk/src/golden/capture.ts` | `captureGsdToolsOutput`, `captureGsdToolsStdout`. |
| `get-shit-done/bin/gsd-tools.cjs` | `runCommand` — argv routing. |
| `get-shit-done/bin/lib/*.cjs` | Per-command implementations. |

---

## Commands (verification)

```bash
cd sdk
npm run build
npm run test:unit
npm run test:integration
```

Focused:

```bash
npx vitest run src/golden/read-only-parity.integration.test.ts src/golden/golden.integration.test.ts --project integration
npx vitest run src/golden/golden-policy.test.ts --project unit
```

---

## Success criteria (extend, not replace)

- **No regression:** `golden-policy.test.ts` / `verifyGoldenPolicyComplete()` stays green.
- **Expand `READ_ONLY_JSON_PARITY_ROWS`** as handlers are aligned—**row count should go up**, not down.
- **`QUERY-HANDLERS.md`** updated when assertion style changes (full `toEqual` vs normalized subset).

---

*Update this file when registry or golden milestones change.*
