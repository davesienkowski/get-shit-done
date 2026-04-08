---
phase: 14-composition-and-retirement
plan: 04
status: complete
started: 2026-04-08T15:00:00Z
completed: 2026-04-08T16:00:00Z
commits:
  - cd040ab feat(14-04): remove GSDTools bridge, retire gsd-tools.cjs, add Windows CI
  - eb2e4a2 feat(14-04): fully migrate v4.0 features — intel, learnings, uat, profile, scan-sessions
requirements_covered: [MIGR-04, MIGR-06]
---

# Plan 14-04 Summary: Bridge Retirement

## Task 1: Remove GSDTools Bridge

- **sdk/src/gsd-tools.ts** — DELETED
- **sdk/src/gsd-tools.test.ts** — DELETED
- **sdk/src/query/registry.ts** — `fallbackToGsdTools` removed; unknown commands throw `GSDError` (T-14-13)
- **sdk/src/phase-runner.ts** — `PhaseRunnerTools` interface replaces `GSDTools` dependency
- **sdk/src/init-runner.ts** — `InitRunnerTools` interface replaces `GSDTools` dependency
- **sdk/src/index.ts** — `createTools()` returns `PhaseRunnerTools` (native SDK); `createInitTools()` returns `InitRunnerTools`; `run()` calls `roadmapAnalyze()` directly
- **sdk/src/milestone-runner.test.ts** — Mock switched from `gsd-tools.js` to `query/roadmap.js`
- **sdk/src/phase-runner-types.test.ts** — `GSDTools typed methods` section removed
- **sdk/src/query/registry.test.ts** — Fallback test updated to verify GSDError throw

## Task 2: Deprecate CJS + Installer + CI

- **22 CJS files** deprecated with `@deprecated` headers (gsd-tools.cjs + all 21 lib/*.cjs)
- **bin/install.js** — `GSD_SDK_BIN = 'gsd-sdk'` constant added (primary query interface)
- **scripts/wrapper-count.cjs** — Updated to detect actual imports (not comments); now exits 0; regression guard (exit 1 if > 0)
- **.github/workflows/test.yml** — CI matrix expanded to `ubuntu-latest + macos-latest + windows-latest × Node 22 + 24` (MIGR-06)

## V4.0 Feature Migration

Per CONTEXT.md locked decision ("No CJS shim — migrate everything now"):

**sdk/src/query/advanced.ts** (new, 600 lines):
- Intel: `intelStatus`, `intelDiff`, `intelSnapshot`, `intelValidate`, `intelQuery`, `intelExtractExports`, `intelPatchMeta`
- Learnings: `learningsCopy` — reads LEARNINGS.md, writes to `~/.gsd/knowledge/` with deduplication
- UAT: `auditUat` — scans all `*-UAT.md` and `*-VERIFICATION.md` files across phases
- Profile: `scanSessions`, `profileSample`, `profileQuestionnaire`, `writeProfile`, `generateClaudeProfile`, `generateDevPreferences`, `generateClaudeMd`

All 17 handlers have real filesystem implementations instead of deferred stubs.

## Verification

- 1172 unit tests passing
- `wrapper-count.cjs` reports 0 bridge calls
- TypeScript compiles clean
- Zero `gsd-tools.cjs` references in active markdown files

## Human Verification Required (Task 3)

Per plan, Task 3 is a blocking human checkpoint. Please verify:
1. `cd sdk && npx vitest run` — all tests pass
2. `grep -r "node.*gsd-tools\.cjs" get-shit-done/workflows/ agents/ commands/gsd/ | wc -l` — should be 0
3. `bash scripts/wrapper-count.cjs` — should report 0
4. `ls sdk/src/gsd-tools.ts` — should fail (file deleted)
5. `head -5 get-shit-done/workflows/execute-phase.md` — should show `gsd-sdk query` not `gsd-tools.cjs`
6. `cd sdk && npx tsc --noEmit` — should compile clean
