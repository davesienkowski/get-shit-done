# Phase 10: Read-Only Queries - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

SDK can read and parse all .planning/ state artifacts -- config, STATE.md, phase directories, ROADMAP.md, progress, and frontmatter -- returning typed JSON. This phase ports the read-only query operations from gsd-tools.cjs into native TypeScript SDK modules, registering each as a query handler in the registry built in Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key patterns from Phase 9 to follow:
- Query handlers return `QueryResult` type from `sdk/src/query/utils.ts`
- One-file-per-domain under `sdk/src/query/` (FOUND-05)
- Register handlers in `createRegistry()` via `sdk/src/query/index.ts`
- Golden file tests validate output parity with gsd-tools.cjs
- Error classification via `GSDError` from `sdk/src/errors.ts`
- ESM-only with `.js` extensions, TypeScript strict mode

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sdk/src/query/registry.ts` — QueryRegistry with register/dispatch/fallback pattern (Phase 9)
- `sdk/src/query/utils.ts` — QueryResult, QueryHandler types, generateSlug, currentTimestamp (Phase 9)
- `sdk/src/query/index.ts` — createRegistry factory where new handlers are registered (Phase 9)
- `sdk/src/errors.ts` — GSDError, ErrorClassification, exitCodeFor (Phase 9)
- `sdk/src/config.ts` — existing loadConfig() that reads .planning/config.json
- `sdk/src/golden/capture.ts` — captureGsdToolsOutput for golden file tests (Phase 9)
- `get-shit-done/bin/lib/state.cjs` — 1,353 lines, the CJS implementation being ported
- `get-shit-done/bin/lib/core.cjs` — config loading, phase finding, roadmap analysis

### Established Patterns
- CJS functions in `lib/*.cjs` are the reference implementations
- SDK modules use typed interfaces, not `Record<string, unknown>`
- Vitest for unit tests, integration tests for golden file comparison

### Integration Points
- New query handlers register in `createRegistry()` in `sdk/src/query/index.ts`
- Golden file tests extend `sdk/src/golden/` fixtures directory
- CLI routing already handles `gsd-sdk query <command>` via Phase 9

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

Requirements mapped: QUERY-01 through QUERY-06.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
