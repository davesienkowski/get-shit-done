# Phase 11: State Mutations - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

SDK can write to all .planning/ state artifacts -- updating STATE.md fields, writing frontmatter, setting config values, creating git commits, filling templates -- with typed event emission on every mutation

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 10 query handlers in `sdk/src/queries/` — read-side counterparts for state, config, frontmatter, roadmap
- `sdk/src/queries/helpers.ts` — shared utilities (resolveProjectDir, etc.)
- `sdk/src/gsd-tools.ts` — GSDTools bridge class for fallback to gsd-tools.cjs
- `sdk/src/types.ts` — centralized type definitions including GSDEventType enum
- `sdk/src/events.ts` — event emission infrastructure (GSDEventStream, WSTransport)

### Established Patterns
- Query handlers follow registry pattern: exported function registered in `sdk/src/queries/registry.ts`
- Each handler gets `(args, projectDir)` and returns typed JSON result
- Error classification via `GSDError` with validation/execution/blocked/interruption categories
- Golden file tests capture CLI output for compatibility validation

### Integration Points
- `gsd-tools.cjs` state commands: `state update`, `state set-field`, `frontmatter set`, `config set`, `commit`
- Existing read handlers that mutation handlers must keep consistent with (state.load, config.get, frontmatter.get)
- Event stream for typed mutation events (GSDEventType enum)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
