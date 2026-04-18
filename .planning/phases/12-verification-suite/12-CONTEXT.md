# Phase 12: Verification Suite - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

SDK can validate plan structure, check phase completeness, verify artifact existence, validate key-link integration points, and run health checks with optional repair -- replacing verify.cjs entirely

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 10 query handlers for reading state, config, frontmatter, roadmap, progress
- Phase 11 mutation handlers for writing state, config, frontmatter, commits
- `sdk/src/query/helpers.ts` — shared utilities (planningPaths, stateExtractField, etc.)
- `sdk/src/query/registry.ts` — QueryRegistry with handler registration and dispatch
- `sdk/src/errors.ts` — GSDError with classification enum

### Established Patterns
- Query handlers follow registry pattern: exported function registered in createRegistry()
- Each handler gets (args, projectDir) and returns typed JSON result
- Error classification via GSDError with validation/execution/blocked/interruption categories
- Golden file tests capture CLI output for compatibility validation
- TDD cycle: failing tests first, then implementation

### Integration Points
- `gsd-tools.cjs` verify commands: `verify plan-structure`, `verify phase-completeness`, `verify key-links`, `validate consistency`, `validate health`
- Existing plan parser in `sdk/src/plan-parser.ts` for frontmatter extraction
- Phase directory scanning patterns from phase.ts and roadmap.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
