# Requirements: GSD SDK-First Migration

**Defined:** 2026-04-07
**Core Value:** Systematically improve GSD's workflow quality, power-user configuration, and developer experience by adopting battle-tested patterns from PBR -- without breaking existing GSD workflows or philosophy.

## v3.0 Requirements

Requirements for SDK-First Migration. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: SDK defines error classification enum (validation, execution, blocked, interruption) extending existing GSDToolsError/PhaseRunnerError
- [x] **FOUND-02**: SDK defines exit code semantics (0=success, 1=execution error, 10=validation error, 11=blocked) for CLI mode
- [x] **FOUND-03**: SDK exposes `gsd-sdk query` subcommand in cli.ts with flat command registry routing
- [x] **FOUND-04**: SDK query commands return structured JSON with `--pick` field extraction support
- [x] **FOUND-05**: SDK query registry uses one-file-per-domain module structure under sdk/src/query/
- [x] **FOUND-06**: SDK provides slug generation and timestamp utilities as typed functions

### State Queries

- [x] **QUERY-01**: SDK can load and parse STATE.md into typed structure (state json, state get, state-snapshot)
- [x] **QUERY-02**: SDK can find phase directories on disk and list phases with metadata (find-phase, phases list, phase-plan-index)
- [x] **QUERY-03**: SDK can read config.json with typed access to all config keys (config-get, resolve-model, config-ensure-section)
- [x] **QUERY-04**: SDK can parse and analyze ROADMAP.md with disk status correlation (roadmap analyze, roadmap get-phase)
- [x] **QUERY-05**: SDK can render progress information in JSON format (progress json)
- [x] **QUERY-06**: SDK can parse YAML frontmatter from any .planning artifact (frontmatter get)

### State Mutations

- [x] **MUTATE-01**: SDK can update STATE.md fields atomically (state update, state patch, state begin-phase, state advance-plan)
- [x] **MUTATE-02**: SDK can write YAML frontmatter to .planning artifacts (frontmatter set, merge, validate)
- [x] **MUTATE-03**: SDK can write config.json values with schema validation (config-set, config-set-model-profile, config-new-project)
- [x] **MUTATE-04**: SDK can create git commits for planning artifacts (commit, check-commit)
- [x] **MUTATE-05**: SDK can fill templates for summary, plan, and verification artifacts (template fill)
- [x] **MUTATE-06**: SDK emits typed events through existing event stream on every state mutation

### Verification

- [x] **VERIFY-01**: SDK can validate plan structure against schema (verify plan-structure)
- [x] **VERIFY-02**: SDK can check phase completeness and artifact presence (verify phase-completeness)
- [x] **VERIFY-03**: SDK can verify artifact file existence and content (verify artifacts)
- [x] **VERIFY-04**: SDK can verify key-link integration points (verify key-links)
- [x] **VERIFY-05**: SDK can validate consistency between STATE.md, ROADMAP.md, and disk (validate consistency)
- [x] **VERIFY-06**: SDK can run health checks with optional repair mode (validate health --repair)

### Phase Lifecycle

- [ ] **LIFE-01**: SDK can add a phase to the end of the current roadmap (phase add)
- [ ] **LIFE-02**: SDK can insert a phase at a specific position with renumbering (phase insert)
- [ ] **LIFE-03**: SDK can remove a phase with renumbering (phase remove)
- [ ] **LIFE-04**: SDK can mark a phase complete and update all tracking artifacts (phase complete)
- [ ] **LIFE-05**: SDK can scaffold new phase directories with required files (phase scaffold)
- [ ] **LIFE-06**: SDK can archive phase directories for milestone completion (phases clear, phases archive)

### Composition

- [ ] **COMP-01**: SDK replaces 16 compound init commands with composable typed query chains (init execute-phase, init plan-phase, etc.)
- [ ] **COMP-02**: SDK implements staged execution pipeline (prepare/execute/finalize) wrapping registry dispatch
- [ ] **COMP-03**: SDK supports workspace-aware state resolution as first-class typed contexts
- [ ] **COMP-04**: SDK supports dry-run mode for mutations (preview changes without writing)

### Migration Infrastructure

- [x] **MIGR-01**: Golden file tests validate SDK output matches gsd-tools.cjs output for all migrated commands
- [x] **MIGR-02**: Wrapper tracking metric counts remaining gsd-tools.cjs bridge calls in SDK
- [ ] **MIGR-03**: All 65 workflow markdown files updated from `node gsd-tools.cjs` to `gsd-sdk query` calls
- [ ] **MIGR-04**: gsd-tools.cjs fully retired -- removed from tree, GSDTools bridge class removed from SDK
- [ ] **MIGR-05**: All new SDK query functions have unit tests via Vitest
- [ ] **MIGR-06**: SDK passes CI on all platforms (Ubuntu, macOS, Windows x Node 22, 24)

## v4.0 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Intel operations migrated from intel.cjs (21K lines) to SDK
- **ADV-02**: Learnings system migrated to SDK with global state support (~/.claude/gsd-knowledge/)
- **ADV-03**: UAT audit operations migrated to SDK
- **ADV-04**: Profiling pipeline (scan-sessions, extract-messages, profile-sample) as separate utility
- **ADV-05**: Hook extensibility points in SDK lifecycle stages
- **ADV-06**: Context compaction for SDK-driven sessions
- **ADV-07**: Bidirectional event stream control flow (pause/resume/cancel)

## Out of Scope

| Feature | Reason |
|---------|--------|
| GraphQL query language | GSD's data model is ~10 entities, not 1000+ packages. Typed methods are simpler and more discoverable |
| Plugin system for custom queries | GSD is an opinionated workflow tool, not a platform. Plugins create API surface to maintain |
| HTTP API server | Adds process management, port conflicts, security surface. WebSocket transport already exists |
| Backwards-compatible CJS exports | gsd-tools.cjs is only called by markdown workflows via bash. Clean break to ESM-only |
| Interactive TUI | AI agents are the primary consumers, not humans. TUI adds dependencies for zero agent benefit |
| Database-backed state | .planning/ files are git-tracked, human-readable, diff-friendly by design |
| Web search migration | Standalone script, not orchestration primitive |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 9 | Complete |
| FOUND-02 | Phase 9 | Complete |
| FOUND-03 | Phase 9 | Complete |
| FOUND-04 | Phase 9 | Complete |
| FOUND-05 | Phase 9 | Complete |
| FOUND-06 | Phase 9 | Complete |
| QUERY-01 | Phase 10 | Complete |
| QUERY-02 | Phase 10 | Complete |
| QUERY-03 | Phase 10 | Complete |
| QUERY-04 | Phase 10 | Complete |
| QUERY-05 | Phase 10 | Complete |
| QUERY-06 | Phase 10 | Complete |
| MUTATE-01 | Phase 11 | Complete |
| MUTATE-02 | Phase 11 | Complete |
| MUTATE-03 | Phase 11 | Complete |
| MUTATE-04 | Phase 11 | Complete |
| MUTATE-05 | Phase 11 | Complete |
| MUTATE-06 | Phase 11 | Complete |
| VERIFY-01 | Phase 12 | Complete |
| VERIFY-02 | Phase 12 | Complete |
| VERIFY-03 | Phase 12 | Complete |
| VERIFY-04 | Phase 12 | Complete |
| VERIFY-05 | Phase 12 | Complete |
| VERIFY-06 | Phase 12 | Complete |
| LIFE-01 | Phase 13 | Pending |
| LIFE-02 | Phase 13 | Pending |
| LIFE-03 | Phase 13 | Pending |
| LIFE-04 | Phase 13 | Pending |
| LIFE-05 | Phase 13 | Pending |
| LIFE-06 | Phase 13 | Pending |
| COMP-01 | Phase 14 | Pending |
| COMP-02 | Phase 14 | Pending |
| COMP-03 | Phase 14 | Pending |
| COMP-04 | Phase 14 | Pending |
| MIGR-01 | Phase 9 | Complete |
| MIGR-02 | Phase 9 | Complete |
| MIGR-03 | Phase 14 | Pending |
| MIGR-04 | Phase 14 | Pending |
| MIGR-05 | Phase 14 | Pending |
| MIGR-06 | Phase 14 | Pending |

**Coverage:**
- v3.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after roadmap phase mapping*
