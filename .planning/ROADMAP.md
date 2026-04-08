# Roadmap: GSD SDK-First Migration

## Overview

Migrate all deterministic orchestration from gsd-tools.cjs (12K-line CJS monolith) into the TypeScript SDK (@gsd-build/sdk), retiring gsd-tools.cjs entirely. The migration proceeds in dependency order: foundation and test infrastructure first, then read-only queries, then mutations, then verification, then phase lifecycle, and finally composition patterns that replace compound commands and retire the legacy monolith. Each phase pairs native TypeScript rewrites with call-site migration -- no permanent wrappers.

## Milestones

- ✅ **v1.0 PBR Backport** - Phases 1-6 (shipped 2026-04-04)
- ✅ **v2.0 Thinking Partner** - Phases 7-8 (shipped 2026-04-04)
- ✅ **v3.0 SDK-First Migration** - Phases 9-14 (shipped 2026-04-08)

## Phases

<details>
<summary>✅ v1.0 PBR Backport (Phases 1-6) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>✅ v2.0 Thinking Partner (Phases 7-8) - SHIPPED 2026-04-04</summary>

See MILESTONES.md for details.

</details>

<details>
<summary>✅ v3.0 SDK-First Migration (Phases 9-14) - SHIPPED 2026-04-08</summary>

See MILESTONES.md for details.

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Foundation and Test Infrastructure | v3.0 | 3/3 | Complete | 2026-04-08 |
| 10. Read-Only Queries | v3.0 | 3/3 | Complete | 2026-04-08 |
| 11. State Mutations | v3.0 | 3/3 | Complete | 2026-04-08 |
| 12. Verification Suite | v3.0 | 3/3 | Complete | 2026-04-08 |
| 13. Phase Lifecycle | v3.0 | 3/3 | Complete | 2026-04-08 |
| 13.1. Upstream Reconciliation | v3.0 | 2/2 | Complete | 2026-04-08 |
| 14. Composition and Retirement | v3.0 | 4/4 | Complete | 2026-04-08 |
