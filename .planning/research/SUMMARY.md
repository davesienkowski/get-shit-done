# Research Summary: SDK-First Migration (gsd-sdk query)

**Domain:** CLI/SDK integration architecture for deterministic state query migration
**Researched:** 2026-04-07
**Overall confidence:** HIGH

## Executive Summary

The gsd-sdk query CLI integrates with the existing SDK by extending the current cli.ts entry point with a new query subcommand that delegates to a flat command registry. The registry maps dot-separated command keys (e.g., state.load, roadmap.analyze) to typed handler functions organized as one file per domain (~15 files). This preserves the SDK's dual-mode contract: library consumers import handlers directly and get typed returns; CLI consumers get JSON on stdout with semantic exit codes.

The existing SDK architecture is well-suited for this extension. cli.ts already handles run/auto/init subcommands; adding query follows the established pattern. The GSDTools class in gsd-tools.ts becomes a temporary fallback bridge for un-migrated commands, then gets deleted when migration completes. No existing SDK module needs breaking changes -- only additive modifications to cli.ts, types.ts, index.ts, and event-stream.ts.

The 6 GSD-2 seeds have clear architectural integration points. Error classification and exit codes are foundational (build first). Staged execution wraps the registry dispatch (build after core migration). Hook extensibility plugs into stage boundaries (build after staged execution). Context compaction and event stream extensions are orthogonal workstreams that can proceed in parallel with query migration.

The migration sequence follows the dependency graph: foundation (errors, registry, pure utilities) first, then read-only state queries, then state mutations, then complex operations (verification, init), then cleanup (retire gsd-tools.cjs). Five waves, each independently testable and deployable. Total estimated effort: ~2,750 lines of new TypeScript replacing ~12,600 lines of CJS.

## Key Findings

**Stack:** Extend existing TypeScript SDK (ES2022, strict mode, Vitest). No new dependencies needed.
**Architecture:** Flat registry pattern with one-file-per-domain query modules under sdk/src/query/. Extend cli.ts with query subcommand, don't create new binary.
**Critical pitfall:** The "wrapper trap" -- temporary bridges to gsd-tools.cjs that become permanent. Enforce same-phase rewrite rule and track wrapper count as a CI metric.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation** - Error classification, registry infrastructure, CLI extension, pure utility migration
   - Addresses: errors.ts, query/registry.ts, query/misc.ts, cli.ts update
   - Avoids: Building on unstable foundation; proves the pattern works with simplest commands first

2. **Read-Only Queries** - Config, state, frontmatter, roadmap (read paths only)
   - Addresses: Most frequently called queries from workflows (state.load, config.get, roadmap.analyze)
   - Avoids: State corruption risk (reads are safe); single-writer rule established

3. **State Mutations** - State update/patch, phase CRUD, git commits
   - Addresses: Write operations with event emission and validation
   - Avoids: Mutation without validation (depends on read infrastructure from phase 2)

4. **Complex Operations** - Verification suite, init queries, scaffolding
   - Addresses: Multi-step operations that compose simpler queries
   - Avoids: Premature complexity (these depend on phases, state, config, frontmatter)

5. **Completion + Seeds** - Intel, progress, staged execution, hooks, legacy retirement
   - Addresses: Remaining commands, cross-cutting concerns, gsd-tools.cjs deletion
   - Avoids: Premature abstraction (hooks/stages added after pattern is proven)

**Phase ordering rationale:**
- Foundation must come first because error classification and the registry are used by every subsequent phase
- Read-only before mutations because reads are safe to get wrong (no state corruption) and build confidence in the pattern
- Mutations before complex operations because complex operations compose mutations
- Seeds (staged execution, hooks) last because they wrap existing handlers; adding them earlier would mean rewriting wrappers as handlers change

**Research flags for phases:**
- Phase 3 (State Mutations): Likely needs deeper research on STATE.md format parsing -- the 1,353-line state.cjs handles many edge cases
- Phase 4 (Verification): Needs research into plan-structure validation rules currently in verify.cjs (1,032 lines)
- Phase 5 (Hooks): Q2 and Q4 from research questions remain open -- staged execution pipeline design and event stream control flow

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new tech. Extending existing TypeScript SDK with same conventions. |
| Architecture | HIGH | Registry pattern is well-established. Dual-mode (library+CLI) proven by existing cli.ts. |
| Features | HIGH | Complete audit of all 60+ gsd-tools.cjs commands. Categorized by operation type. |
| Migration Sequence | HIGH | Dependency graph is clear from code analysis. Wave ordering follows natural dependencies. |
| GSD-2 Seed Integration | MEDIUM | Integration points clear but staged execution (Q2) and event control flow (Q4) need phase-specific research. |
| Pitfalls | HIGH | Based on direct codebase analysis of 669 call sites across 96 files. |

## Gaps to Address

- STATE.md parsing edge cases: The 1,353-line state.cjs handles many markdown manipulation edge cases
- Verification rule inventory: verify.cjs (1,032 lines) needs audit of which rules are still relevant
- init.cjs complexity: At 1,522 lines, some logic may belong in InitRunner rather than query system
- Q2 (Staged Execution Pipeline Design) and Q4 (Event Stream Control Flow) remain open
- Output contract testing: Need to catalog all 669 gsd-tools.cjs call sites and their expected output formats
