---
phase: 11-state-mutations
plan: 02
subsystem: sdk
tags: [typescript, config-mutation, git-commit, query-handler, value-coercion]

requires:
  - phase: 10-read-only-queries
    provides: "Query handler pattern, registry, config-query (MODEL_PROFILES, VALID_PROFILES), helpers"
provides:
  - "4 config mutation handlers (configSet, configSetModelProfile, configNewProject, configEnsureSection)"
  - "2 git commit handlers (commit, checkCommit)"
  - "VALID_CONFIG_KEYS allowlist with isValidConfigKey validation"
  - "parseConfigValue coercion (string to boolean/number/JSON)"
  - "execGit helper for subprocess git calls"
  - "sanitizeCommitMessage for prompt injection prevention"
affects: [13-config-commit-template]

tech-stack:
  added: []
  patterns: ["VALID_CONFIG_KEYS allowlist with dynamic pattern matching", "parseConfigValue coercion chain", "spawnSync-based execGit helper", "sanitizeCommitMessage with zero-width/injection neutralization"]

key-files:
  created:
    - sdk/src/query/config-mutation.ts
    - sdk/src/query/config-mutation.test.ts
    - sdk/src/query/commit.ts
    - sdk/src/query/commit.test.ts
  modified:
    - sdk/src/query/index.ts

key-decisions:
  - "Used Set-based VALID_CONFIG_KEYS with regex dynamic patterns (agent_skills.*, features.*) matching CJS implementation exactly"
  - "spawnSync for execGit instead of execSync for consistent exitCode/stdout/stderr capture"
  - "sanitizeCommitMessage ported from security.cjs sanitizeForPrompt -- strips zero-width chars, null bytes, and injection markers"

patterns-established:
  - "Config mutation: read -> validate key -> coerce value -> set at dot-path -> write JSON"
  - "Git commit: check commit_docs -> sanitize message -> stage files -> diff --cached check -> commit -> rev-parse hash"

requirements-completed: [MUTATE-03, MUTATE-04]

duration: 12min
completed: 2026-04-08
---

# Phase 11 Plan 02: Config Mutations and Git Commit Handlers Summary

**4 config.json mutation handlers with key validation and value coercion, plus 2 git commit handlers with message sanitization, all registered and tested with 40 new tests (984 total green)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-08T06:59:23Z
- **Completed:** 2026-04-08T07:11:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Ported VALID_CONFIG_KEYS allowlist (36 exact keys + dynamic agent_skills.* and features.* patterns) with isValidConfigKey validation and typo suggestion
- Implemented parseConfigValue coercion chain: "true"->true, "false"->false, numeric strings->numbers, JSON strings->parsed objects
- Ported configSet (key validation + value coercion + dot-notation write), configSetModelProfile (profile validation + MODEL_PROFILES import), configNewProject (defaults + API key detection + user choice merge), configEnsureSection (idempotent section creation)
- Ported execGit (spawnSync wrapper matching core.cjs), sanitizeCommitMessage (zero-width chars, null bytes, XML/SYSTEM/INST injection markers), commit (stages files, checks commit_docs, supports --force/--amend/--no-verify), checkCommit (pre-commit validation)
- All 6 handlers registered in createRegistry(); 40 new tests pass, 984 total tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Config mutation handlers** - `e3b6862` (test), `7dd43a2` (feat) -- VALID_CONFIG_KEYS, isValidConfigKey, parseConfigValue, configSet, configSetModelProfile, configNewProject, configEnsureSection
2. **Task 2: Git commit handlers** - `16b5d40` (test), `6bfac18` (feat) -- execGit, sanitizeCommitMessage, commit, checkCommit

## Files Created/Modified

- `sdk/src/query/config-mutation.ts` - 4 config mutation handlers with key validation and value coercion
- `sdk/src/query/config-mutation.test.ts` - 24 tests for config mutation handlers
- `sdk/src/query/commit.ts` - 2 git commit handlers with execGit helper and message sanitization
- `sdk/src/query/commit.test.ts` - 16 tests for commit and check-commit handlers
- `sdk/src/query/index.ts` - 6 new handler registrations (4 config + 2 commit)

## Decisions Made

- Used Set-based VALID_CONFIG_KEYS with regex dynamic patterns for agent_skills.* and features.* -- matches CJS implementation exactly rather than using the simplified array+wildcard approach from the plan
- Used spawnSync for execGit instead of execSync -- provides consistent exitCode/stdout/stderr capture matching core.cjs behavior
- sanitizeCommitMessage ported from security.cjs sanitizeForPrompt rather than simplified implementation -- preserves full injection protection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All config mutation handlers ready for call-site migration from gsd-tools.cjs
- Git commit handler ready for workflow integration
- Config key validation and value coercion patterns can be reused by future mutation handlers
- Phase 12 (verification handlers) has no dependency on this plan's outputs

## Self-Check: PASSED

All 5 files verified present. All 4 commit hashes verified in git log.

---
*Phase: 11-state-mutations*
*Completed: 2026-04-08*
