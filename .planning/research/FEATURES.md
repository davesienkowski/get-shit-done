# Feature Research: SDK-First Migration

**Domain:** Build orchestration SDK replacing a CJS CLI monolith
**Researched:** 2026-04-07
**Confidence:** HIGH (based on direct codebase audit + external pattern research)

## Operation Categories in gsd-tools.cjs

Before listing features, the 13,571 lines across 23 CJS modules decompose into six operation categories. Every SDK feature maps to exactly one category.

| Category | Description | Examples | Requires Git | Requires AI |
|----------|-------------|----------|:---:|:---:|
| **State Queries** | Read-only access to .planning/ artifacts | `state json`, `state get`, `find-phase`, `phases list`, `roadmap analyze`, `intel query`, `progress` | No | No |
| **State Mutations** | Write to .planning/ files | `state update`, `state patch`, `state begin-phase`, `phase add/remove/complete`, `requirements mark-complete` | No | No |
| **Config Management** | Read/write config.json | `config-get`, `config-set`, `config-ensure-section`, `resolve-model` | No | No |
| **Git Operations** | Shell out to git | `commit`, `commit-to-subrepo`, `check-commit`, `verify commits` | Yes | No |
| **Verification/Validation** | Structural checks on artifacts | `verify plan-structure`, `verify artifacts`, `verify key-links`, `validate consistency`, `validate health` | No | No |
| **Compound Init** | Bundle state+config+context for workflow boot | `init execute-phase`, `init plan-phase`, `init new-project`, etc. (16 variants) | No | No |

**Key insight:** Zero operations require AI judgment. Every gsd-tools.cjs operation is deterministic and expressible as typed TypeScript. This confirms the SDK-first architecture decision.

## Feature Landscape

### Table Stakes (Must Build to Replace gsd-tools.cjs)

These are non-negotiable for the migration. Without them, workflows cannot call `gsd-sdk query` instead of `node gsd-tools.cjs`.

| Feature | Why Expected | Complexity | Category | Depends On |
|---------|--------------|------------|----------|------------|
| **State loader** (`state json`, `state get`, `state-snapshot`) | 40+ workflows read STATE.md on every invocation | MEDIUM | State Query | Frontmatter parser |
| **Phase finder** (`find-phase`, `phases list`, `phase-plan-index`) | Every phase workflow needs to locate phase dirs on disk | LOW | State Query | File system scanner |
| **Config reader** (`config-get`, `resolve-model`, `config-ensure-section`) | Model selection, feature flags, and depth settings read on every agent spawn | LOW | Config Mgmt | Config schema types |
| **Roadmap analyzer** (`roadmap analyze`, `roadmap get-phase`) | Plan-phase and next workflows need full roadmap parse with disk status | MEDIUM | State Query | Phase finder |
| **Compound init bundles** (16 `init *` commands) | Each workflow's entry point; bundles 5-8 queries into one JSON blob | HIGH | Compound Init | All query features |
| **State mutators** (`state update`, `state patch`, `state begin-phase`, `state advance-plan`) | Phase transitions, progress tracking, blocker management | MEDIUM | State Mutation | State loader, frontmatter writer |
| **Phase lifecycle** (`phase add`, `phase insert`, `phase remove`, `phase complete`) | Roadmap management; creates dirs, updates ROADMAP.md, renumbers phases | HIGH | State Mutation | Roadmap analyzer, phase finder |
| **Frontmatter CRUD** (`get`, `set`, `merge`, `validate`) | Plans, summaries, and verifications all use YAML frontmatter | MEDIUM | State Mutation | YAML parser |
| **Verification suite** (`plan-structure`, `phase-completeness`, `references`, `artifacts`, `key-links`) | Verifier agent and plan-checker depend on structural validation | HIGH | Verification | Phase finder, plan parser (exists in SDK) |
| **Config writer** (`config-set`, `config-set-model-profile`, `config-new-project`) | New project setup, profile changes, feature flag toggling | LOW | Config Mgmt | Config schema types |
| **Commit operations** (`commit`, `check-commit`) | Every phase execution ends with a planning commit | LOW | Git Ops | Git availability check |
| **Template fill** (`template fill summary/plan/verification`) | Plan-phase creates pre-filled artifacts from templates | MEDIUM | State Mutation | Phase finder, frontmatter writer |
| **Validation checks** (`validate consistency`, `validate health --repair`) | Health checks catch drift between STATE.md, ROADMAP.md, and disk | MEDIUM | Verification | State loader, roadmap analyzer |
| **Progress renderer** (`progress json/table/bar`) | Progress workflow and status displays | LOW | State Query | State loader |
| **Error classification** (validation/execution/blocked/interruption) | Callers need programmatic retry-vs-abort decisions; current errors are untyped | MEDIUM | Cross-cutting | Existing error classes |
| **Exit code semantics** (0/1/10/11) | CI/CD integration needs "blocked" vs "failed" distinction | LOW | Cross-cutting | Error classification |
| **JSON output with --pick** | All 65 workflows expect structured JSON with field extraction | LOW | Cross-cutting | Already partially in SDK |
| **Slug/timestamp utilities** (`generate-slug`, `current-timestamp`) | Used in scaffolding, commit messages, file naming | LOW | Utility | None |

### Differentiators (Competitive Advantage Over gsd-tools.cjs)

These go beyond feature parity. They are the reason to migrate rather than just wrapping.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Typed query API** (like Turborepo's `turbo query`) | IntelliSense, compile-time safety, discoverable API surface. Turborepo uses GraphQL for repo queries; GSD SDK should use typed method calls with discriminated union returns | MEDIUM | Pattern: `sdk.state.phases()`, `sdk.roadmap.analyze()`, not string-in/string-out |
| **Staged execution pipeline** (prepare/execute/finalize/steer) | Know WHERE in the pipeline something failed. Prevents premature termination on validation errors vs runtime errors | MEDIUM | From GSD-2 seed; GH CLI and Nx both separate validation from execution internally |
| **Structured error hierarchy** with classification enum | `error.classification === 'blocked'` enables workflow-level retry logic. gh CLI returns structured errors with machine-readable codes | MEDIUM | Extends existing `GSDToolsError` and `PhaseRunnerError` |
| **Event emission on mutations** | Every state mutation emits a typed event through the existing event stream. Enables WebSocket dashboards, CI logging, audit trails | LOW | Event system already exists in SDK; mutations just need to emit |
| **Composable query chaining** | `init execute-phase` currently shells out 8+ times internally; typed SDK can compose queries in-process with zero IPC overhead | HIGH | Eliminates 16 compound init commands as special cases; they become composition of atomic queries |
| **Workspace-aware state resolution** | Workstream isolation already exists in CJS but is string-based path manipulation; SDK can model workstreams as first-class typed contexts | MEDIUM | Current `--ws` flag and `GSD_WORKSTREAM` env var become `sdk.withWorkstream('name')` |
| **Dry-run mode for mutations** | Preview what `phase complete` or `milestone complete` would change without writing. No equivalent exists today | LOW | Compose: run prepare stage, skip execute stage, return diff |
| **Schema validation on config writes** | Reject invalid config values at write time, not at next read. Current config-set is unconstrained | LOW | TypeScript interfaces already define the shape; validate on set |

### Anti-Features (Do NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **GraphQL query language** (like Turborepo) | Turborepo uses it; seems sophisticated | GSD's data model is 10 entities, not 1000+ packages. GraphQL adds parser complexity and learning curve for no benefit. Turborepo needs it for monorepo scale; GSD doesn't | Typed method calls: `sdk.phases.list()` not `query { phases { items { ... } } }` |
| **Plugin system for custom queries** | Extensibility sounds good | GSD is an opinionated workflow tool, not a platform. Plugins create API surface to maintain. The 23 CJS modules are already too many abstractions | Export typed functions; users compose in TypeScript |
| **HTTP API server** | Enables web dashboards | Adds process management, port conflicts, security surface. WebSocket transport already exists for event streaming | Keep existing WS transport for events; dashboards read .planning/ files directly |
| **Backwards-compatible CJS exports** | Don't break old callers | gsd-tools.cjs is only called by markdown workflows via bash. Once workflows migrate to `gsd-sdk query`, there are zero CJS consumers. Maintaining dual module format is pure waste | Clean break: ESM-only SDK. Migration is the cutover |
| **Interactive TUI** | Pretty terminal UI for phase management | AI agents are the primary consumers, not humans staring at terminals. TUI adds ncurses/ink dependencies for zero agent benefit | JSON output that agents parse; humans use `/gsd-*` commands |
| **Database-backed state** | SQLite for faster queries | .planning/ files are the source of truth by design. They're git-tracked, human-readable, diff-friendly. Database adds sync complexity | Keep file-based state; add in-memory caching for hot-path queries |
| **Profiling pipeline in SDK** | `scan-sessions`, `extract-messages`, `profile-sample` are in gsd-tools.cjs | These are user-facing profile generation tools, not orchestration primitives. They don't belong in the build SDK. They can stay as standalone scripts | Keep as separate `gsd-profile` utility or move to a dedicated package |

## Feature Dependencies

```
[Config Schema Types]
    |
    +---> [Config Reader] ---> [Model Resolver]
    +---> [Config Writer]
    |
[Frontmatter Parser]
    |
    +---> [State Loader] ---> [Progress Renderer]
    |         |
    |         +---> [Roadmap Analyzer] ---> [Phase Lifecycle]
    |         |         |
    |         |         +---> [Validation Checks]
    |         |
    |         +---> [State Mutators] ---> [Event Emission]
    |
    +---> [Frontmatter CRUD]
    |
[File System Scanner]
    |
    +---> [Phase Finder] ---> [Phase Plan Index]
    |         |
    |         +---> [Template Fill]
    |         +---> [Verification Suite]
    |
[Error Classification]
    |
    +---> [Exit Code Semantics]
    +---> [Staged Execution Pipeline]
    |
[All Query Features]
    |
    +---> [Compound Init Bundles] ---> [Composable Query Chaining]
```

### Dependency Notes

- **State Loader requires Frontmatter Parser:** STATE.md uses YAML frontmatter for structured fields
- **Compound Init requires ALL query features:** Each init bundle is a composition of 5-8 atomic queries
- **Composable Query Chaining replaces Compound Init:** Once atomic queries are typed methods, init bundles become simple function composition, not special commands
- **Error Classification enables Staged Pipeline:** Pipeline stages classify their errors; callers check classification to decide retry/abort/wait
- **Phase Lifecycle requires Roadmap Analyzer:** Adding/removing phases must update ROADMAP.md; analyzer provides the parse tree
- **Verification Suite reuses plan-parser:** SDK already has plan-parser.ts; verification extends it with structural checks

## MVP Definition

### Wave 1: Foundation (enables first workflow migrations)

- [x] Config reader (config-get, resolve-model) -- LOW complexity, high call frequency
- [x] Phase finder (find-phase, phases list) -- LOW complexity, used by every phase workflow
- [x] State loader (state json, state get, state-snapshot) -- MEDIUM complexity, universal dependency
- [x] Error classification enum + exit codes -- LOW complexity, cross-cutting foundation
- [x] JSON output with --pick support -- LOW complexity, CLI contract

### Wave 2: Mutations + Verification (enables execute/verify workflows)

- [ ] State mutators (state update, patch, begin-phase, advance-plan) -- MEDIUM
- [ ] Frontmatter CRUD (get, set, merge, validate) -- MEDIUM
- [ ] Config writer (config-set, config-new-project) -- LOW
- [ ] Commit operations (commit, check-commit) -- LOW
- [ ] Verification suite (plan-structure, artifacts, key-links) -- HIGH

### Wave 3: Lifecycle + Templates (enables plan-phase, new-project)

- [ ] Phase lifecycle (add, insert, remove, complete) -- HIGH
- [ ] Roadmap analyzer + get-phase -- MEDIUM
- [ ] Template fill (summary, plan, verification) -- MEDIUM
- [ ] Validation checks (consistency, health --repair) -- MEDIUM
- [ ] Scaffold operations -- LOW

### Wave 4: Compound Commands + Differentiators (retire gsd-tools.cjs)

- [ ] Composable query chaining (replaces 16 init commands) -- HIGH
- [ ] Staged execution pipeline -- MEDIUM
- [ ] Event emission on mutations -- LOW
- [ ] Workspace-aware state resolution -- MEDIUM
- [ ] Dry-run mode for mutations -- LOW

### Defer (not part of migration)

- [ ] Profiling pipeline (scan-sessions, extract-messages, profile-sample) -- separate utility
- [ ] Web search (websearch command) -- stays as standalone script
- [ ] Intel operations -- complex enough to warrant own migration phase
- [ ] Learnings system -- low frequency, can stay as thin wrapper initially
- [ ] UAT audit -- niche feature, migrate last

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| State loader | HIGH | MEDIUM | P1 | Called by every workflow |
| Phase finder | HIGH | LOW | P1 | Universal dependency |
| Config reader | HIGH | LOW | P1 | Model resolution on every spawn |
| Error classification | HIGH | LOW | P1 | Cross-cutting foundation |
| State mutators | HIGH | MEDIUM | P1 | Phase transitions break without them |
| Verification suite | HIGH | HIGH | P1 | Verifier agent depends on it |
| Compound init (as composition) | HIGH | HIGH | P1 | Workflow boot depends on it |
| Phase lifecycle | MEDIUM | HIGH | P2 | Less frequent than queries |
| Roadmap analyzer | MEDIUM | MEDIUM | P2 | Planning workflows only |
| Frontmatter CRUD | MEDIUM | MEDIUM | P2 | Mostly used during planning |
| Template fill | MEDIUM | MEDIUM | P2 | Plan-phase only |
| Staged pipeline | MEDIUM | MEDIUM | P2 | Differentiator, not blocker |
| Event emission | MEDIUM | LOW | P2 | Enhances observability |
| Dry-run mode | LOW | LOW | P3 | Nice-to-have |
| Workspace-aware context | LOW | MEDIUM | P3 | Only needed for parallel milestones |
| Intel operations | LOW | HIGH | P3 | Complex, niche, can stay wrapped |

**Priority key:**
- P1: Must have for gsd-tools.cjs retirement
- P2: Should have, enables differentiator value
- P3: Nice to have, migrate when convenient

## Competitor Feature Analysis (Build Tool Query APIs)

| Capability | Turborepo (`turbo query`) | Nx (DevKit) | gh CLI (`--json`) | GSD SDK (Planned) |
|-----------|--------------------------|-------------|--------------------|--------------------|
| Query language | GraphQL | TypeScript API | `--json` + `--jq` | Typed methods |
| Output format | JSON (nested, with metadata) | TypeScript objects | JSON with field selection | JSON (structured, typed) |
| Field selection | GraphQL fields | Programmatic | `--json field1,field2` | `--pick field.path` (exists) |
| Filtering | GraphQL + `--filter` | Programmatic | `--jq` expressions | Typed method params |
| Change detection | `affected` shorthand | `nx affected` | N/A | Phase dependency graph |
| Interactive explorer | GraphiQL playground | `nx graph` web UI | N/A | Not planned (anti-feature) |
| Error codes | Standard exit codes | Standard exit codes | Standard exit codes | Semantic (0/1/10/11) |
| Shorthand commands | `ls`, `affected` | `show`, `list`, `run` | Subcommands | Atomic + compound queries |

**Design decision:** Follow gh CLI's `--json` + `--jq`/`--pick` pattern, not Turborepo's GraphQL. GSD's data model (phases, plans, config, state) is small and well-defined; typed methods with JSON output are simpler, faster, and more discoverable than a query language. The `--pick` flag already exists in gsd-tools.cjs and should carry forward.

## Sources

- Direct audit of `gsd-tools.cjs` (1,047 lines) and 23 lib modules (13,571 lines total)
- [Turborepo query API reference](https://turborepo.dev/docs/reference/query) -- GraphQL-based repo querying
- [Turborepo 2.2 announcement](https://turborepo.dev/blog/turbo-2-2-0) -- `turbo query` introduction
- [Nx ProjectGraph DevKit](https://nx.dev/docs/reference/devkit/ProjectGraph) -- typed project graph API
- [Nx project graph exploration](https://nx.dev/docs/features/explore-graph) -- visualization patterns
- [gh CLI formatting guide](https://cli.github.com/manual/gh_help_formatting) -- `--json` + `--jq` pattern
- SDK architecture decision: `.planning/notes/sdk-first-architecture.md`
- Error classification seed: `.planning/seeds/sdk-error-classification.md`
- Exit code semantics seed: `.planning/seeds/sdk-exit-code-semantics.md`
- Staged execution seed: `.planning/seeds/sdk-staged-tool-execution.md`

---
*Feature research for: SDK-First Migration*
*Researched: 2026-04-07*
