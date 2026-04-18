# Phase 14: Composition and Retirement - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

SDK replaces all 16 compound init commands with composable typed query chains, implements a staged execution pipeline with dry-run support, and migrates all 77 workflow/command/agent files from `node gsd-tools.cjs` to `gsd-sdk query`. CJS files are deprecated (not deleted) pending validation.

</domain>

<decisions>
## Implementation Decisions

### Composition Architecture
- Init composition handlers live in a single new `sdk/src/query/init.ts` module (mirrors CJS lib/init.cjs)
- Hybrid call style: direct function calls for read-only queries (type-safe, no overhead), registry.dispatch() for mutations (gets event emission)
- Results are flat JSON matching CJS output exactly — golden tests validate this shape, workflows parse these keys
- Always compute full bundle (no lazy loading) — CJS returns everything, workflows may rely on any field

### Migration Scope
- Domain-by-domain sweep: group workflow files by which init command they call, migrate all callers of one init command together
- Golden tests updated per init command — each composition handler gets its own golden test validating CJS output parity
- See `<deferred>` for CJS shim + GSDTools bridge retirement (re-scoped into Phase 15)

### Retirement Boundary
- All workflows migrated to `gsd-sdk query`, CJS files marked deprecated (not deleted)
- Deletion deferred to cleanup after validation — deprecate rather than delete for safety
- Installer (bin/install.js) updated to reference SDK paths
- Wrapper-count metric script should report 0 after migration

### Staged Execution Pipeline (COMP-02 + COMP-04)
- Three stages: prepare (resolve context) → execute (dispatch handler) → finalize (write events/logs)
- Implementation as registry-level middleware wrapping dispatch() with pre/post hooks
- Dry-run mode integrated as stage gate: prepare runs, execute is skipped
- Dry-run for mutations: clone state in-memory, run mutation, diff original vs result, return diff without writing

### Claude's Discretion
- Workspace-aware state resolution (COMP-03) implementation details
- Ordering of domain-by-domain migration sweep
- Test structure for init composition handlers (unit vs integration split)
- Error handling strategy for init handlers when sub-queries fail

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sdk/src/query/index.ts` — QueryRegistry with 55+ atomic handlers already registered (Phases 9-13)
- `sdk/src/query/helpers.ts` — planningPaths(), normalizePhaseName(), shared utilities
- `sdk/src/query/registry.ts` — QueryRegistry class with dispatch(), register(), getHandler(), extractField()
- `sdk/src/event-stream.ts` — GSDEventStream with typed event emission
- `sdk/src/gsd-tools.ts` — GSDTools bridge class (to be deleted after migration)
- `get-shit-done/bin/lib/init.cjs` — 16 cmdInit* functions showing exact composition logic and output shapes

### Established Patterns
- Query handlers: exported async function taking (args: string[], projectDir: string) → QueryResult
- Mutation event emission via MUTATION_COMMANDS set in createRegistry()
- Golden file tests comparing SDK output to captured CJS output
- One-file-per-domain module structure in sdk/src/query/
- Space-delimited aliases for CJS compatibility (e.g., 'phase add' alongside 'phase.add')

### Integration Points
- 77 files across get-shit-done/workflows/, commands/, agents/ reference gsd-tools.cjs
- 16 init subcommands: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, manager, new-workspace, list-workspaces, remove-workspace
- 20 lib/*.cjs files: commands, config, core, docs, frontmatter, init, intel, learnings, milestone, model-profiles, phase, profile-output, profile-pipeline, roadmap, schema-detect, security, state, template, uat, verify
- bin/install.js references CJS paths for runtime configuration
- scripts/wrapper-count.sh tracks remaining bridge calls

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose "deprecate, don't delete" for CJS files — final deletion in separate cleanup
- init.ts should use the hybrid pattern: direct imports for reads, registry.dispatch() for mutations
- Staged execution pipeline is registry-level middleware, not a separate class
- Original "migrate everything now, no CJS shim" stance re-scoped 2026-04-17 — see `<deferred>` for Phase 15 rationale

</specifics>

<deferred>
## Deferred Ideas

- Full v4.0 feature implementation (intel 21K lines, learnings, uat, security, profile) — only thin stubs needed for Phase 14
- Final CJS file deletion — deferred to post-validation cleanup
- Event stream bidirectional control flow (ADV-07) — v4.0 scope
- **GSDTools bridge class retirement** — Re-scoped in Phase 15 (v3.1-upstream-landing) on 2026-04-17. Universal CJS fallback (per open PR #2342 review) requires GSDTools as a durable shim during the transition period. Deletion deferred until upstream parity is validated across PR #2340–#2343 and the `GSD_QUERY_FALLBACK` policy ships.
- **No CJS shim stance** — Re-scoped in Phase 15 (v3.1-upstream-landing) on 2026-04-17. Universal fallback (`fallbackToCjs: 'not-registered' | 'always' | 'never'`) is the agreed design for upstream PR landing; `gsd-tools.cjs` remains callable as the fallback target until Phase 3 PRs merge and soak. Original intent (eventual full SDK ownership) is preserved — the shim is transitional, not permanent.

</deferred>
