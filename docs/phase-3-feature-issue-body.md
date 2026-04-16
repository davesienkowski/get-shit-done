# Phase 3 — SDK query contract, golden parity, runners, and CJS deprecation (umbrella; parent #2007)

<!--
  Paste into: New issue → Feature Request template (all sections satisfied below).
  Labels: feature-request, needs-review (awaiting approved-feature per CONTRIBUTING.md).
-->

## Pre-submission checklist

- [x] I have searched existing issues and discussions — this has not been proposed and declined before (supersedes detailed tracking previously in #2291; see closing comment there).
- [x] I have read [CONTRIBUTING.md](https://github.com/gsd-build/get-shit-done/blob/main/CONTRIBUTING.md) and understand that I must wait for `approved-feature` before writing any code that is not already covered by an approved umbrella.
- [x] I have read the existing GSD commands and workflows and confirmed this does not duplicate Phase 1–2 work (#2083 / #2118, #2122): those phases added `gsd-sdk query` and migrated orchestration call sites; Phase 3 tightens **contracts**, **coverage**, and **documentation** around that foundation.
- [x] This solves a problem for solo developers using AI coding tools: silent drift between `gsd-tools.cjs` and `gsd-sdk query`, unclear CJS-only surfaces, and duplicated logic between programmatic runners and the query registry.

## Feature name

Phase 3 — SDK query parity policy, registry completion, runner alignment, and CJS deprecation headers (umbrella; parent #2007)

## Type of addition

**Other** — Phase 3 spans the `@gsd-build/sdk` query registry, Vitest golden suites under `sdk/src/golden/`, runner wiring in `sdk/src`, documentation (`QUERY-HANDLERS.md`, `docs/CLI-TOOLS.md`), and **comment-only** deprecation on CJS entry surfaces. It does not add a new end-user slash command.

## The solo developer problem

Phases 1–2 added `gsd-sdk query` and moved orchestration markdown to it, but confidence in a **single contract** against `get-shit-done/bin/gsd-tools.cjs` is only as good as tests and docs. Without a **policy-gated** parity story (`golden-policy.test.ts`), explicit **CJS-only** documentation, **runner alignment** with registered handlers, and **non-destructive** deprecation cues on legacy CLI entrypoints, developers and agents still risk subtle JSON differences, missed subcommands, and split maintenance between subprocess wrappers and in-process code paths.

## What this feature adds

Work is grouped into **four tracks** (each may be one or more PRs; see CONTRIBUTING “one concern per PR”).

### Track A — Golden / parity policy (SDK)

- Subprocess capture vs `gsd-tools.cjs` JSON (`sdk/src/golden/capture.ts`).
- `read-only-parity.integration.test.ts` + `READ_ONLY_JSON_PARITY_ROWS` for strict JSON `toEqual` where applicable.
- `golden.integration.test.ts` for composition / shape tests (e.g. `init.*`), including **documented normalization** where subprocess and in-process differ by design.
- `golden-policy.ts` / `golden-policy.test.ts` — every canonical registry command is **covered** or has a **documented exception** (`verifyGoldenPolicyComplete()`).
- `QUERY-HANDLERS.md` — human-readable matrix (full parity vs normalized vs shape-only vs time-dependent vs stubs).

**Invariant:** Do not shrink or delete golden assertions to “go green”; fix handlers or document test-side normalization in `QUERY-HANDLERS.md`.

### Track B — Registry and documentation

- Complete inventory: every portable `gsd-tools` operation either has a **registered** `gsd-sdk query` handler or appears in a **CJS-only matrix** with justification (`graphify`, `from-gsd2` / `gsd2-import`, etc., remain CLI-only by product decision).
- Keep `sdk/src/query/index.ts`, `QUERY-HANDLERS.md`, and `docs/CLI-TOOLS.md` aligned.

### Track C — Runner alignment (no bridge deletion)

- Align `PhaseRunner`, `InitRunner`, and `GSD` programmatic paths with the **same contracts** as query handlers (shared helpers or registry dispatch), **without** removing `sdk/src/gsd-tools.ts` / `GSDTools` in this feature (bridge retirement is a separate, future proposal if ever approved).

### Track D — CJS deprecation (headers only)

- Add file- or block-level deprecation notices on `get-shit-done/bin/gsd-tools.cjs` (and any other agreed entry surfaces) pointing maintainers and advanced users at `gsd-sdk query`.
- **No** deletion or unshipping of `gsd-tools.cjs` or `bin/lib/*.cjs` under this issue.

## Full scope of changes

**Created or substantially extended**

- Golden fixtures under `sdk/src/golden/fixtures/` as needed for parity.
- Optional small shared helpers under `sdk/src/query/` when they remove duplication between CJS ports and runners.

**Modified**

- `sdk/src/query/**/*.ts` — handlers and shared logic.
- `sdk/src/golden/**/*` — parity tests, policy, rows.
- `sdk/src/phase-runner.ts`, `sdk/src/init-runner.ts`, `sdk/src/index.ts` — runner alignment as required.
- `sdk/src/gsd-tools.ts`, `sdk/src/gsd-tools.test.ts` — only as needed for shared contracts or tests.
- `get-shit-done/bin/gsd-tools.cjs` — deprecation header / comment only.
- `docs/CLI-TOOLS.md`, `ARCHITECTURE.md` (if needed), `CHANGELOG.md` [Unreleased].
- `sdk/HANDOVER-GOLDEN-PARITY.md` — maintainer handover for parity batches (supporting doc, not a user doc).

**Explicitly out of scope**

- Deleting `GSDTools` / `sdk/src/gsd-tools.ts`.
- Deleting or stopping shipment of CJS `bin/lib/*.cjs`.
- Reintroducing `gsd-sdk query` → full CJS passthrough for all commands (explicitly rejected for Phase 2; not part of Phase 3 unless a separate approved issue says otherwise).
- Mechanical re-migration of Phase 2 markdown (already #2122).

**Systems affected**

- `@gsd-build/sdk` (`gsd-sdk query`, programmatic API).
- Documentation and CHANGELOG.

## User stories

1. As a solo developer using GSD with an AI agent, I want automated parity checks between `gsd-sdk query` and `gsd-tools.cjs` so that upgrades do not silently change JSON shapes or file behavior mid-milestone.

2. As a maintainer, I want every portable subcommand either registered or explicitly listed as CJS-only so the registry and docs cannot drift unnoticed.

3. As a consumer of programmatic SDK APIs (`GSD`, phase/init runners), I want the same behavior as `gsd-sdk query` for the same operation so I do not maintain two diverging implementations—without a breaking removal of the subprocess bridge class in this release.

## Acceptance criteria

- [ ] **Policy gate:** `npm run build` and `npx vitest run src/golden/golden-policy.test.ts --project unit` pass; `verifyGoldenPolicyComplete()` leaves no orphan canonicals.
- [ ] **Parity:** For each read-only handler in scope, either a strict subprocess row, a named test block with **documented** normalization (e.g. strip volatile fields), or an explicit `GOLDEN_PARITY_EXCEPTIONS` rationale in policy—documented in `QUERY-HANDLERS.md`.
- [ ] **Registry:** CJS-only matrix updated; no undocumented “hidden” CLI-only gaps for operations that should be typed.
- [ ] **Runners:** Programmatic paths aligned with query handler contracts; `GSDTools` remains exported.
- [ ] **Deprecation:** Comment-only deprecation on agreed CJS entry surfaces; no CJS file deletion.
- [ ] **Docs:** `QUERY-HANDLERS.md`, `docs/CLI-TOOLS.md`, `CHANGELOG.md` [Unreleased] updated for Phase 3.
- [ ] **CI:** Repository test and lint expectations pass on the standard matrix (see `.github/workflows` and CONTRIBUTING.md).

## Which area does this primarily affect?

**Multiple areas** (SDK, docs, thin CJS metadata).

## Applicable runtimes

**All runtimes** — SDK and docs affect every consumer; CJS deprecation is metadata only.

## Breaking changes assessment

**None intended.** Handler and test additions should preserve existing JSON consumers; normalization belongs in tests or docs, not silent field removal from public handler results. Deprecation is comment-only. If a field-order or whitespace difference is unavoidable, document it or normalize in tests—no intentional breaking API change for `gsd-sdk query` JSON.

## Maintenance burden

- Golden fixtures and rows must be updated when CJS or handler output changes; `QUERY-HANDLERS.md` and `sdk/HANDOVER-GOLDEN-PARITY.md` describe how to extend coverage.
- Registry and CJS matrix must stay updated when adding handlers.
- No new external dependencies beyond existing SDK `package.json` constraints unless separately justified.

## Alternatives considered

1. **Defer parity harness; only add handlers** — Rejected; fails the confidence goal of #2007 and invites silent drift.
2. **Delete CJS in Phase 3** — Rejected; out of scope; requires separate approval and migration story.
3. **Bridge removal in the same issue** — Rejected; increases review risk; split to a future issue.
4. **Single mega-PR** — Rejected; split by track (parity batches, runners, deprecation/docs) per CONTRIBUTING reviewability.

## Prior art and references

- #2007 — Umbrella SDK-first migration (closed; phasing supersedes old mega-PR approach).
- #2083 / #2118 — Phase 1 query foundation.
- #2122 — Phase 2 caller migration (markdown / orchestration).
- #2179 — Phase 2 implementation on `main` (reference for registry and docs state to rebase against).

## Additional context

- **Supersedes:** #2291 (closed when this issue was opened)—same umbrella intent, updated acceptance criteria and grouped tracks; avoids stale “implementation status” prose in the old body.
- **PR strategy:** Land work in focused PRs (e.g. parity batch → registry/docs → runners → deprecation); link each PR to this issue with `Closes`/`Fixes` only when the maintainers agree a PR fully completes a discrete deliverable, or reference without closing until the full checklist is done.
