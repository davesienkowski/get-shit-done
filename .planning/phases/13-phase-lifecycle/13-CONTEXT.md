# Phase 13: Phase Lifecycle - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

SDK can manage the full phase lifecycle -- adding, inserting, removing, completing, scaffolding, and archiving phases -- with all tracking artifacts updated atomically

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 11 mutation handlers (state mutations, frontmatter writes, config writes, commits)
- Phase 12 verification handlers (plan structure, phase completeness, artifacts, key-links, consistency, health)
- `sdk/src/query/helpers.ts` — shared utilities (planningPaths, normalizePhaseName, etc.)
- `sdk/src/query/index.ts` — QueryRegistry with MUTATION_COMMANDS event emission
- `sdk/src/query/roadmap.ts` — roadmapAnalyze, roadmapGetPhase for reading roadmap state

### Established Patterns
- Query handlers follow registry pattern: exported function registered in createRegistry()
- Mutation handlers use readModifyWriteStateMd for atomic STATE.md updates
- Event emission via MUTATION_COMMANDS set in createRegistry
- Golden file tests for CJS compatibility validation

### Integration Points
- `gsd-tools.cjs` phase commands: `phase add`, `phase insert`, `phase remove`, `phase complete`, `phase scaffold`, `phases clear`, `phases archive`
- `get-shit-done/bin/lib/phase.cjs` — 226 lines changed in v1.34.0 merge (must use updated version)
- ROADMAP.md manipulation (checkbox marking, section insertion/removal)
- STATE.md atomic updates (progress, current phase advancement)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
