# Handover: Query layer + golden parity (next session)

Use this document at the start of a new session so work continues in context without re-deriving history.

**Related:** `HANDOVER-PARITY-DOCS.md` (#2291 scope); **`sdk/src/query/QUERY-HANDLERS.md`** (golden matrix, CJS↔SDK routing).

---

## Goal for the next session (primary)

**Port or normalize the next batch of read-only query handlers** (see **§ Next batch — summary / audit / skill / validate / UAT / intel / profile / init**) so JSON matches `get-shit-done/bin/gsd-tools.cjs`, then add **strict subprocess golden rows** or **documented normalization blocks** in `read-only-parity.integration.test.ts`, updating `read-only-golden-rows.ts` / `readOnlyGoldenCanonicals()` and keeping **`golden-policy.ts`** complete.

**Do not “green the suite” by deleting or shrinking golden tests.** If a handler cannot match CJS byte-for-byte without product decisions, use **documented normalization** in the test (same approach as `docs-init` omitting agent-install fields, or **`state.json` / `state.load` stripping `last_updated`**) or **fix the TypeScript handler**—same trade-off as `scan-sessions` / `workstream.status` / `stats.json` (see below).

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

## Completed in this line of work (batch: query parity + goldens)

Aligned SDK handlers with **`gsd-tools.cjs`** and expanded subprocess coverage (commit series on `feat/sdk-phase3-query-layer`):

| Canonical / area | CJS | SDK | Golden notes |
| ---------------- | --- | --- | ------------ |
| `stats` / `stats.json` | `commands.cjs` `cmdStats` | `progress.ts` `statsJson` | Strict row; full stats object (phases table, git, requirements, etc.). |
| `todo.match-phase` | `cmdTodoMatchPhase` | `progress.ts` `todoMatchPhase` | Strict row. |
| `verify.key-links` | `verify.cjs` `cmdVerifyKeyLinks` | `validate.ts` `verifyKeyLinks` | Strict row; regex errors match `new RegExp` + `Invalid regex pattern`. |
| `verify.references` | `cmdVerifyReferences` | `verify.ts` `verifyReferences` | Added `total` field (parity). |
| `verify.schema-drift` | `cmdVerifySchemaDrift` | `verify.ts` + `schema-detect.ts` | Strict row; ports `schema-detect.cjs` logic. |
| `state-snapshot` | `cmdStateSnapshot` | `state.ts` `stateSnapshot` | Strict row; `progress_percent` NaN fix. |
| `state.json` / `state.load` | `cmdStateJson` | `state.ts` `stateLoad` | Dedicated test: **`last_updated` stripped** on both sides (`read-only-parity.integration.test.ts`); policy canonical **`state.json`**. |

**Cherry-pick order** (if splitting PRs): `fix state-snapshot` → `schema-detect + verify` → `validate key-links` → `progress stats/todo` → `stubs` → `golden rows`.

---

## Next batch — summary / audit / skill / validate / UAT / intel / profile / init

**Same workflow as above:** read `gsd-tools.cjs` `runCommand` for argv → implement/adjust `sdk/src/query/*.ts` → add `READ_ONLY_JSON_PARITY_ROWS` and/or a **named `describe` block** with documented omissions → `npm run build` → `read-only-parity.integration.test.ts` + `golden-policy.test.ts`.

| Priority | Command (CLI) | `gsd-tools.cjs` case / args | CJS implementation | SDK module | Notes |
| -------- | ------------- | -------------------------- | -------------------- | ---------- | ----- |
| 1 | `summary-extract <path>` `[--fields a,b]` | `summary-extract` | `commands.cjs` `cmdSummaryExtract` (~L425) | `summary.ts` `summaryExtract` | Pick a **stable repo path** (e.g. an existing `*-SUMMARY.md` under `.planning/phases/`). |
| 2 | `history-digest` | `history-digest` | `commands.cjs` `cmdHistoryDigest` (~L133) | `summary.ts` `historyDigest` | Output is aggregate over repo; may be large—confirm shape vs CJS first. |
| 3 | `audit-open` | `audit-open` `[--json]` | `audit.cjs` `auditOpenArtifacts` + optional `formatAuditReport` | `audit-open.ts` | For JSON parity use subprocess with `--json`; align object keys with `audit.cjs`. |
| 4 | `audit-uat` | `audit-uat` | `uat.cjs` `cmdAuditUat` | `uat.ts` `auditUat` | Same: match summary JSON shape. |
| 5 | `skill-manifest` | `skill-manifest` + args | `init.cjs` `cmdSkillManifest` (~L1829) | `skill-manifest.ts` | If key order unstable, **sort keys in test** (document in QUERY-HANDLERS). |
| 6 | `validate agents` | `validate` + `agents` | `verify.cjs` `cmdValidateAgents` (~L997) | `validate.ts` `validateAgents` | May need **normalization** for `agents_dir`, env (`GSD_AGENTS_DIR`), or omit env-specific fields in test. |
| 7 | `uat render-checkpoint --file <path>` | `uat` subcommand | `uat.cjs` `cmdRenderCheckpoint` | `uat.ts` `uatRenderCheckpoint` | Needs **real UAT fixture** under `.planning/phases/.../*-UAT.md` or small test fixture path. |
| 8 | `intel extract-exports <file>` | `intel` `extract-exports` | `intel.cjs` `intelExtractExports` (~L502) | `intel.ts` `intelExtractExports` | Use a **fixed SDK source file** (e.g. `sdk/src/query/utils.ts`) so list is stable. |
| 9 | `extract-messages` | `extract-messages` + project/session flags | `profile-pipeline.cjs` | `profile.ts` `extractMessages` | **Heavy** vs CJS (temp JSONL, streaming); consider **documented exception** + strong unit tests if full parity is prohibitive. |
| 10 | `profile-sample` | `profile-sample` | `profile-pipeline.cjs` | `profile.ts` `profileSample` | Same class as extract-messages. |
| 11 | **`init.*` read-only JSON** | various | `init.cjs` / `init-complex` | `init.ts`, `init-complex.ts` | Extend **`golden.integration.test.ts`** patterns: stable fields only, omit timestamps/agent lists if needed—**do not remove coverage**. |

**Suggested order:** (1)–(2) summary/history (single-file / whole-repo), (8) intel extract-exports (narrow), (3)–(4) audit, (5)–(6) skill-manifest / validate.agents, (7) UAT checkpoint, (9)–(10) profile pipeline, (11) init last (widest surface).

**Mutations** (`QUERY_MUTATION_COMMANDS`): subprocess golden remains optional; policy uses `MUTATION_DEFERRED_REASON`.

---

## Backlog: other read-only handlers (lower priority or follow-ups)

Confirm against `GOLDEN_PARITY_EXCEPTIONS` in `golden-policy.ts` for the live list.

| Area | CJS reference | SDK file(s) | Notes |
| ---- | ------------- | ----------- | ----- |
| **`state.get`** | `state.cjs` `cmdStateGet` | `state.ts` `stateGet` | Add row or normalized test for optional field arg vs full document. |

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
