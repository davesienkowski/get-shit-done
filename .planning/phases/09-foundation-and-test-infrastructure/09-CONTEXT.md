# Phase 9: Foundation and Test Infrastructure - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

SDK has a working query CLI with error classification, registry routing, and golden file test infrastructure that validates output compatibility. This phase creates the foundation that all subsequent SDK migration phases build on: error taxonomy, CLI subcommand routing, utility functions, and the golden file test harness that validates output parity with gsd-tools.cjs.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key codebase patterns to follow:
- ESM-only with `.js` extensions in imports
- TypeScript strict mode, ES2022 target
- Vitest for testing (unit + integration projects)
- Error classes extend `Error` with `name` property
- One-file-per-domain module structure (FOUND-05)
- `parseArgs` from `node:util` for CLI parsing
- JSON output with `--pick` field extraction pattern

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sdk/src/cli.ts` — existing CLI entry point with `parseCliArgs()` and subcommand routing for `run`, `auto`, `init`
- `sdk/src/gsd-tools.ts` — `GSDTools` bridge class with `exec()` method (the thing being migrated away from)
- `sdk/src/types.ts` — core type definitions for plans, frontmatter, tasks
- `sdk/src/config.ts` — config loading with typed `GSDConfig` interface
- `sdk/src/event-stream.ts` — typed event stream infrastructure

### Established Patterns
- Error classes: `GSDToolsError` in gsd-tools.ts with command/args/exitCode/stderr properties
- CLI parsing: `parseArgs()` from `node:util` with strict mode
- Test files co-located: `*.test.ts` for unit, `*.integration.test.ts` for integration
- Vitest with separate unit/integration project configs

### Integration Points
- `cli.ts` needs `query` subcommand added to routing
- New `sdk/src/query/` directory for domain modules (FOUND-05)
- Golden file fixtures in test directory
- Wrapper-count metric script in `scripts/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

Requirements mapped: FOUND-01 through FOUND-06, MIGR-01, MIGR-02.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
