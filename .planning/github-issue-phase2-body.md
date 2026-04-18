## Pre-submission checklist

- [x] I have searched existing issues and discussions — this has not been proposed and declined before
- [x] I have read CONTRIBUTING.md and understand that I must wait for `approved-feature` before opening a merge-ready PR
- [x] I have read the existing GSD commands and workflows and confirmed this feature does not duplicate existing behavior
- [x] This feature solves a problem for solo developers using AI coding tools, not a personal preference

## Feature name

SDK-first Phase 2: mechanical migration of workflows, agents, and commands to `gsd-sdk query`

## Type of addition

**Other** — Coordinated migration of **orchestration call sites** in markdown (workflows, agents, command docs) from **`node …/gsd-tools.cjs`** to **`gsd-sdk query`**, aligned with maintainer and community phasing on #2007. Does **not** remove CJS, delete the SDK bridge, or change `InitRunner` / `PhaseRunner` wiring — those belong to a **later phase** (see below).

## Relationship to existing work

- **Umbrella:** #2007 (SDK-first migration — replace monolithic `gsd-tools.cjs` usage with typed SDK query system).
- **Phase 1:** #2083 — `sdk/` query foundation, `gsd-sdk query`, tests; **CJS and markdown call sites unchanged** in scope.
- **Maintainer phasing (#2007):** trek-e requested **incremental** delivery — e.g. Phase 1 SDK **alongside** CJS, **Phase 2 migrates workflows**, **Phase 3 retires CJS**, each as a **separate approved issue and PR** ([comment](https://github.com/gsd-build/get-shit-done/issues/2007#issuecomment-4225046183)).
- **Ecko95’s split (#2007):** Phase 2 = **mechanical** migration of workflow/agent/command markdown to `gsd-sdk query`; **CJS remains on disk** (deprecated but functional). **Phase 3** = bridge retirement in SDK runners, bridge deletion, further cleanup — **separate issue** ([comment](https://github.com/gsd-build/get-shit-done/issues/2007#issuecomment-4227071619)).
- **This issue:** Defines **Phase 2 only** — caller/documentation migration in the repo’s orchestration layer; **not** Phase 3 bridge retirement.

## The solo developer problem

Phase 1 makes **`gsd-sdk query`** real, but **workflows and agents** still instruct tools to run the **legacy CJS CLI**. Solo developers and AI agents therefore keep paying **extra subprocess overhead**, **stringly-typed** parsing, and **review risk** on every long session — the problems #2007 describes. Until **markdown call sites** match the typed path, the migration is incomplete for day-to-day GSD use.

## What this feature adds

1. **Workflow updates** — `get-shit-done/workflows/**/*.md`: replace or supersede `gsd-tools.cjs` spawn patterns with **`gsd-sdk query <handler> …`** and documented flags (`--raw`, `--cwd`, etc.) per Phase 1 registry.
2. **Agent updates** — `agents/**/*.md`: same for embedded run instructions and examples.
3. **Command definitions** — `commands/gsd/**/*.md`: documented invocation paths aligned with Phase 2 (no renamed slash commands unless already approved elsewhere).
4. **Tests** — Root / `tests/` (and CI) expectations that still assert on **`gsd-tools.cjs`** invocation updated to **`gsd-sdk query`** or equivalent, per CONTRIBUTING test standards.
5. **Docs** — `docs/` updates so CLI/tooling docs describe **one** supported query entrypoint for new users.

**Example (illustrative):**

```bash
gsd-sdk query roadmap.analyze --raw --cwd "$PROJECT"
```

(Exact subcommands remain those registered under `sdk/src/query/`.)

## Full scope of changes (Phase 2 only)

**Primary areas (representative):**

- `get-shit-done/workflows/**/*.md`
- `agents/**/*.md`
- `commands/gsd/**/*.md`
- `docs/**/*.md` as needed for accuracy
- `tests/**/*` — invocation expectations and any related fixtures

**Explicitly out of scope for Phase 2:**

- **Deleting or unpublishing** `get-shit-done/bin/gsd-tools.cjs` or `get-shit-done/bin/lib/*.cjs` — CJS must **remain** for dual-mode operation (per Ecko95 / maintainer phasing).
- **SDK runner bridge retirement** — switching `InitRunner` / `PhaseRunner` off `GSDTools` to direct query imports, deleting `sdk/src/gsd-tools.ts` (or equivalent bridge), and related SDK-internal wiring — **Phase 3**, separate issue.
- **Large unrelated rewrites** of workflow prose beyond what is needed for correct `gsd-sdk query` invocation and clarity.

**Systems affected:**

- Copy-paste and agent-executable paths in orchestration markdown
- Tests that snapshot or assert CLI invocation

## User stories

1. As a **solo developer using GSD with an AI agent**, I want **workflows and agents to show `gsd-sdk query`** so my runs stop defaulting to the legacy monolith spawn pattern.
2. As a **reviewer**, I want a **bounded Phase 2 PR** with **spot-check evidence** so mechanical wide diffs are safe to approve (see #2008 review).

## Acceptance criteria

- [ ] **Zero required user-facing instructions** that rely on **`node …/gsd-tools.cjs`** for operations where **`gsd-sdk query`** is available — document any **temporary** exceptions explicitly in the PR if unavoidable.
- [ ] **Reviewability / spot-checks:** Per maintainer concern on #2008 — large mechanical migration is hard to verify from diffs alone. The Phase 2 PR includes a **short spot-check list** (representative workflows, agents, commands) and what was exercised.
- [ ] **CI:** All required **Ubuntu / macOS / Windows × Node** matrix jobs green for the Phase 2 PR.
- [ ] **Parity:** Use **existing** golden or parity tests **where the repo has them** after Phase 1; add **targeted** tests or checks for gaps found during migration. Do **not** claim JSON parity alone proves identical on-disk behavior ([review note](https://github.com/gsd-build/get-shit-done/pull/2008)).
- [ ] **`npm test`** (or project-standard root test command) passes.
- [ ] **CHANGELOG** updated under **[Unreleased]** describing Phase 2 caller migration.
- [ ] No merge-ready PR until this issue has **`approved-feature`** (CONTRIBUTING).

## Which area does this primarily affect?

**Multiple areas** — Workflows, agents, commands, docs, tests.

## Applicable runtimes

- [x] All runtimes (any runtime consuming shipped markdown under `get-shit-done/`, `agents/`, `commands/`)

## Breaking changes assessment

**Intent: no change to slash command names or planning file schemas.** Risk: **contributors or local scripts** that still invoke **`gsd-tools.cjs` by path** must switch to **`gsd-sdk query`**; document in CHANGELOG. If any output shape differs, document **compatibility** notes.

## Maintenance burden

- New workflow steps must use **`gsd-sdk query`** patterns; avoid reintroducing CJS spawns for query operations.
- Docs must stay aligned when the **query registry** grows (Phase 1 module).

## Alternatives considered

1. **Single mega-PR with Phase 1+2+3** — Rejected by maintainer/community (#2007 / #2008); incremental phases required.
2. **Phase 2 without prior Phase 1 on `main`** — Rejected; Phase 2 depends on **`gsd-sdk query`** existing and stable.
3. **Enhancement issue** — Rejected; this is a **coordinated migration** across many files — **Feature** scale.

## Prior art and references

- #2007 — umbrella migration; maintainer phasing comment.
- #2083 — Phase 1 (SDK-only foundation).
- #2008 — prior combined PR; maintainer review on **scope**, **spot-checks**, **CI matrix**, **parity limits** — informs Phase 2 acceptance criteria.
- Ecko95 — Phase 2 = mechanical workflow migration with CJS retained; Phase 3 = bridge retirement: https://github.com/gsd-build/get-shit-done/issues/2007#issuecomment-4227071619

## Additional context

- **Depends on:** Phase 1 (`gsd-sdk query` + registry) merged or otherwise available on `main` before Phase 2 PR targets are meaningful.
- **Optional follow-up:** Parity quirks found in the wild (e.g. config key resolution differences) can be tracked as separate fixes or docs; not required to block Phase 2 scope.
- **Ask:** Label **`approved-feature`** when this Phase 2 scope is acceptable.

/cc @trek-e @Ecko95 — incremental Phase 2 aligns with prior phasing and community split.
