# Codebase Concerns

**Analysis Date:** 2026-02-13

## Tech Debt

### Synchronous File Operations Without Locking
- Issue: `gsd-tools.js` uses 66 synchronous file operations (`fs.readFileSync`, `fs.writeFileSync`, `execSync`) without atomic write guarantees
- Files: `get-shit-done/bin/gsd-tools.js`
- Impact: Race conditions when multiple hooks execute in parallel; partial writes on interruption; state corruption in concurrent phase execution
- Fix approach: Implement file locking wrapper with atomic writes for all `.planning/` operations. Provide `atomicWrite()` as centralized utility with retry logic.

### Known Claude Code Runtime Bug: `classifyHandoffIfNeeded`
- Issue: Claude Code crashes with `classifyHandoffIfNeeded is not defined` AFTER task completion, causing false "failed" reports
- Files: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/execute-plan.md`, `get-shit-done/workflows/quick.md`
- Impact: Agents report failure even when all work completes successfully; users see false errors; recovery requires manual spot-checking
- Workaround in place: Execute workflows now run spot-checks (verify SUMMARY.md exists, check git commits) before trusting agent status
- Fix approach: This is a Claude Code issue—GSD has already implemented the workaround. Document workaround prominence in execute-phase to set expectations.

### Parallel Execution Race Conditions
- Issue: #380 "Hitting `Sibling tool call errored`" — parallel tool calls fail unpredictably when spawning multiple executors simultaneously
- Files: `get-shit-done/workflows/execute-phase.md` (wave parallelization logic)
- Impact: Phase execution becomes flaky—same phase succeeds sometimes, fails other times. Users lose trust in automation.
- Fix approach: Implement sequential wave execution by default (not parallel), provide `--parallel` flag. Add exponential backoff on Task() failures. Log detailed timings to diagnose which executor crashed.

### JSON Parse Without Error Handling for Malformed State
- Issue: Multiple `JSON.parse()` calls throughout `gsd-tools.js` without comprehensive error recovery (e.g., lines 378, 703, 888, 908, 970, 2720, 2733, 2747, 4102, 4117)
- Files: `get-shit-done/bin/gsd-tools.js`
- Impact: Single malformed `.planning/` JSON file (config.json, progress file, frontmatter) crashes entire tool; users can't recover
- Fix approach: Wrap all `JSON.parse()` with try/catch. On parse failure, log location + context, attempt recovery (use defaults, strip corrupted line, rebuild from backups).

### YAML Frontmatter Extraction Fragile
- Issue: `extractFrontmatter()` uses regex to parse YAML between `---` markers; doesn't validate structure, can skip fields or fail silently on complex YAML
- Files: `get-shit-done/bin/gsd-tools.js` (frontmatter extraction logic)
- Impact: Nested structures (e.g., `dependency-graph.provides`) silently drop if YAML is malformed; planner gets incomplete context; plans miss dependencies
- Fix approach: Use proper YAML parser (gray-matter or yaml library) instead of regex. Validate against schema after parsing.

## Known Bugs

### Package Version Stale on npm (#412)
- Symptoms: Users install `npx get-shit-done-cc` and get v1.11.1 which is missing recent GitHub commits
- Files: `package.json` (version field), npm registry
- Trigger: Run `npx get-shit-done-cc@latest` when npm package hasn't been published despite main branch updates
- Workaround: Users can reinstall from main: `node bin/install.js --claude --local` from cloned repo
- Fix approach: Set up CI/CD pipeline to auto-publish to npm on tag. Add pre-publish validation to ensure package.json version matches latest tag.

### Model Resolver Fails on Non-Anthropic Models (#403)
- Symptoms: Users on OpenAI, Gemini, or custom models run `/gsd:plan-phase` or `/gsd:debug` and get `ProviderModelNotFoundError`
- Files: `get-shit-done/bin/gsd-tools.js` (resolve-model command)
- Trigger: `resolve-model <agent>` hardcodes Anthropic models; doesn't support `gpt-5.2-codex-xhigh` or Gemini equivalents
- Workaround: Manually set model in `config.json` → agent picks up setting
- Fix approach: Refactor `resolve-model` to: (1) check user's active model from Claude settings, (2) validate against supported models for agent, (3) provide fallback if profile doesn't match, (4) log warning if model untested.

### Windows/WSL Path Handling (#249)
- Symptoms: `gsd-intel-index.js` crashes on Windows and WSL; paths use backslashes, breaking Unix-style path operations
- Files: `get-shit-done/bin/gsd-tools.js`, `hooks/` files
- Trigger: Initialize GSD on Windows → phase paths use backslashes → phase lookup fails
- Workaround: Already patched in CHANGELOG v1.17 — now normalizes backslash paths in gsd-tools invocations
- Status: FIXED — verify no regressions in new code; Windows path handling now centralized in `bin/gsd-tools.js`

### Model Profile Cannot Be Changed When Mapping Existing Codebase (#264)
- Symptoms: Users run `/gsd:map-codebase` → system sets config.json with default profile → users can't switch to `budget` or `quality` until after mapping completes
- Files: `commands/gsd/map-codebase.md`, `bin/install.js`
- Trigger: First-time users on expensive models want budget profile, but mapping forces setup before settings
- Workaround: Users manually edit `.planning/config.json` after mapping
- Fix approach: Add `--profile` flag to `/gsd:map-codebase`. Or, move profile selection into `/gsd:new-project` before research agents spawn, apply retroactively to mapping.

## Security Considerations

### No Input Validation on Phase/Plan Arguments
- Risk: Users pass arbitrary strings as phase numbers, plan names, descriptions. Commands don't validate input, could enable code injection if subprocess calls are unsafe
- Files: `get-shit-done/bin/gsd-tools.js` (phase add, phase insert, phase remove, commit commands)
- Current mitigation: Commands use `execSync` carefully (no shell=true); arguments passed via CLI args, not shell strings
- Recommendations: (1) Add explicit validation for phase number format (must be decimal or X.Y), (2) Sanitize plan descriptions before embedding in commit messages, (3) Use spawn instead of execSync where possible to avoid shell interpretation.

### Secrets in Environment Variables Not Verified
- Risk: `resolve-model` reads from ENV without checking if real API keys are present; planner could try to spawn agent with fake/empty API key
- Files: `get-shit-done/bin/gsd-tools.js` (resolve-model, environ handling)
- Current mitigation: Tool exits gracefully if model resolution fails, agent spawning will fail later with clear error
- Recommendations: (1) Validate API keys exist before agent spawn in execute-phase/plan-phase, (2) Add `/gsd:validate-keys` command to pre-check all required env vars, (3) Document in README which env vars are critical.

### File Read Permissions Not Checked
- Risk: `gsd-tools.js` reads from `.planning/` without checking file ownership. If GSD installed in shared directory, one user could read another user's private planning docs
- Files: `get-shit-done/bin/gsd-tools.js` (file I/O operations)
- Current mitigation: `.planning/` not in `.gitignore` (can be committed); GitHub's file permissions prevent cross-user access
- Recommendations: (1) Document that `.planning/` should be `.gitignore`'d for private projects, (2) Add warning if `.planning/` is world-readable, (3) Add `--exclude-secrets` flag to map-codebase to skip reading certain paths.

## Performance Bottlenecks

### Synchronous Directory Scanning on Large Projects
- Problem: `fs.readdirSync()` called repeatedly without pagination; scanning `.planning/phases/` for 50+ phases blocks event loop
- Files: `get-shit-done/bin/gsd-tools.js` (cmdHistoryDigest ~1015, cmdPhasesList ~1089)
- Cause: Each phase read is synchronous; no batching or streaming
- Improvement path: (1) Implement `readdirAsync()` for streaming large directories, (2) Add pagination to phase list commands, (3) Cache phase list in memory during single workflow execution.

### JSON Serialization of Large Objects
- Problem: `history-digest` converts all Sets to Arrays via spread operator; on 100+ phases with many decisions, creates large JSON that serializes slowly
- Files: `get-shit-done/bin/gsd-tools.js` (lines 1076-1081)
- Cause: No streaming output; entire object serialized at once; no pagination
- Improvement path: (1) Implement streaming JSON output (JSONL format), (2) Add `--limit` flag to digest command, (3) Lazy-load phase data instead of all-at-once.

### Nested Frontmatter Extraction Loop
- Problem: `extractFrontmatter()` runs for every summary in every phase; on 100 phase summaries × 3 frontmatter fields each = 300+ regex searches
- Files: `get-shit-done/bin/gsd-tools.js` (cmdHistoryDigest loop ~1020-1072)
- Cause: Sequential processing; no caching; regex re-compiled per call
- Improvement path: (1) Compile regex once at module level, (2) Implement LRU cache for frontmatter reads, (3) Batch read all summaries in one pass instead of nested loop.

## Fragile Areas

### Phase Numbering System
- Files: `get-shit-done/bin/gsd-tools.js` (phase next-decimal, phase insert, phase remove commands)
- Why fragile: Decimal numbering (1.1, 1.2, 1.3 → 2.1) requires careful string parsing and renumbering. Off-by-one errors in sort order break phase lookup. Renumbering subsequent phases is a batch operation with no rollback.
- Safe modification: (1) Always test phase arithmetic with both single and decimal phases, (2) Add dry-run mode to phase remove/insert that shows what would be renumbered, (3) Create backup of ROADMAP.md before any phase operation, (4) Add phase consistency check after modification.
- Test coverage: 22 tests in `gsd-tools.test.js` cover history-digest; limited coverage for phase arithmetic. Add tests for: phase insert between decimals, phase remove with subsequent consolidation, edge cases (phase 1.10 → 1.11 sort order).

### ROADMAP.md Parsing and Sync
- Files: `get-shit-done/bin/gsd-tools.js` (roadmap analyze, validate consistency commands), `hooks/check-roadmap-sync.js`
- Why fragile: ROADMAP.md is hand-edited markdown; no schema validation. Phase sections can be deleted by users without updating STATE.md. Sync checks compare three sources (ROADMAP, STATE, disk) and can give conflicting guidance.
- Safe modification: (1) Add schema validation to roadmap parsing, (2) Implement three-way merge when ROADMAP ≠ STATE ≠ disk, (3) Document ROADMAP format as stable contract in README, (4) Add `--force` flag to sync operations with clear warnings.
- Test coverage: Hook has manual checks but no unit tests. Add tests for: missing phase section, out-of-order phases, state vs. roadmap conflicts.

### Frontmatter Validation
- Files: `get-shit-done/bin/gsd-tools.js` (frontmatter validate command)
- Why fragile: Validates against schema but doesn't guarantee nested structure correctness. PLAN.md frontmatter can have missing fields (`must_haves.artifacts[]` required but may be empty array). SUMMARY.md may have nested objects where executor forgot fields.
- Safe modification: (1) Split validation into strict (must-haves) vs. optional (patterns), (2) Add `--auto-fix` mode that fills missing fields with sensible defaults, (3) Document frontmatter schema in separate file referenced by planner/executor, (4) Log validation errors by document type for debugging.
- Test coverage: Limited; add tests for malformed nested YAML, missing required fields, invalid field types.

### Subagent Output Detection in Hooks
- Files: `hooks/check-subagent-output.js`, `hooks/check-phase-boundary.js`
- Why fragile: Uses string matching (`combinedText.includes('gsd-executor')`) to detect agent completion. If Claude changes output format slightly, hook misses detection and reports false failure. No canonical list of expected outputs.
- Safe modification: (1) Standardize subagent output format with version header, (2) Move output validation from regex to structured checks (e.g., "SUMMARY.md exists"), (3) Add fallback detection via file system checks (look for SUMMARY*.md), (4) Log all detection failures for debugging.
- Test coverage: None; add integration tests for each hook with mock agent outputs.

## Scaling Limits

### Parallel Wave Execution Unpredictable Above 3 Agents
- Current capacity: 1-3 parallel executor agents per wave (tested). 4+ agents trigger "Sibling tool call errored" (#380)
- Limit: Claude Code API has undocumented Task() concurrency limit; exceeding it causes hangs or crashes
- Scaling path: (1) Implement sequential fallback when parallel fails, (2) Add `--max-parallel` config flag, (3) Test and document safe concurrency limits per model (Opus vs. Sonnet), (4) Implement adaptive parallelization (reduce if failures detected).

### Phase History Digest Size
- Current capacity: ~50 phases, ~500 summaries, compresses to ~50KB JSON
- Limit: Planner/executor context gets bloated if digest exceeds 100KB; becomes useless as context reference
- Scaling path: (1) Implement pagination for phase queries, (2) Add `--phase` filter to digest (only recent phases), (3) Implement lazy-loading (return phase list, fetch details on demand), (4) Switch to JSONL format for streaming large digests.

### `.planning/` Directory on Slow Filesystems
- Current capacity: 50+ phases × 5 files per phase = 250+ files; on NFS or slow SSD, `fs.readdirSync()` can take 2+ seconds
- Limit: Workflow startup becomes noticeably slow (planner waits for init to complete before reasoning)
- Scaling path: (1) Implement file watchers to cache directory state, (2) Add optional `.planning/.cache/phase-index.json` for fast lookups, (3) Move to database backend for large projects (not needed yet, document for future).

## Dependencies at Risk

### esbuild ^0.24.0 (Only Dev Dependency)
- Risk: esbuild is build tool only; no runtime risk. But build-hooks.js runs esbuild without error handling; if esbuild fails, hook distribution breaks
- Impact: New installations get broken hooks; workflows fail to start
- Migration plan: Already low-risk (only devDep); improve by adding `--bundle-check` to CI, verify hooks compile before publishing to npm.

### No Production Dependencies (Zero-Dependency Design)
- Risk: None; intentional design. Pure Node.js/fs for modularity
- Impact: No supply chain attacks; works in any Node environment
- Status: STRENGTH; maintain this approach

## Missing Critical Features

### No Atomicity Guarantee for Multi-Step Operations
- Problem: Phase operations (add, remove, insert) update ROADMAP + STATE + disk in 3+ steps. If interrupted midway, state becomes inconsistent
- Blocks: Reliable phase lifecycle management; users must manually repair state after interruptions
- Fix approach: (1) Implement transaction log (write intended changes first), (2) All-or-nothing semantics for phase ops, (3) Add `--force-repair` recovery command.

### No Backup/Rollback System
- Problem: Users can't easily undo a bad `/gsd:plan-phase` or `/gsd:execute-phase`
- Blocks: Risk-free experimentation; users hesitant to use GSD on critical projects
- Fix approach: (1) Auto-create dated backups in `.planning/.backups/` before major operations, (2) Implement `gsd-tools restore <date>` command, (3) Add `--dry-run` mode to all write operations.

### No Concurrent Phase Execution
- Problem: Only one phase can execute at a time; if phase 1 takes 2 hours, phase 2 must wait
- Blocks: #291 "Support concurrent milestone execution"; large projects blocked
- Fix approach: Implement phase dependency graph, allow parallel execution of independent phases. Requires transactional state updates.

## Test Coverage Gaps

### gsd-tools.js Coverage Incomplete
- What's not tested: 90% of commands (only history-digest tested); phase arithmetic, frontmatter CRUD, state operations untested
- Files: `get-shit-done/bin/gsd-tools.js`
- Risk: Silent failures in phase operations; users discover bugs in production after state corruption
- Priority: HIGH — add tests for: phase add/insert/remove, config validate, frontmatter get/set, state patch, progress operations

### Hooks Not Unit Tested
- What's not tested: All 18 hooks have zero unit tests; only tested manually via workflows
- Files: `hooks/*.js` (18 files, ~2000 lines total)
- Risk: Hook failures only discovered mid-workflow; no way to verify hook logic without running full phase
- Priority: HIGH — add hook tests for: phase boundary checks, plan format validation, subagent output detection, roadmap sync validation

### Integration Tests Between Tools
- What's not tested: Multi-step workflows (e.g., phase add → commit → roadmap analyze). Only unit tests exist.
- Files: Tests would cover `commands/` and `workflows/`
- Risk: Changes to gsd-tools break downstream workflows; no early warning
- Priority: MEDIUM — create integration tests that simulate: new-project → discuss → plan → execute cycle

### End-to-End Phase Execution (Real Project)
- What's not tested: Full phase execution with real file I/O, real git commits, real subagent spawning
- Files: Would test entire orchestration in `execute-phase.md` + subagent coordination
- Risk: Workflow logic breaks in production after months of use; users discover edge cases
- Priority: MEDIUM (after unit tests) — create test project fixture, run through complete phase cycle, verify all artifacts created and committed correctly

---

*Concerns audit: 2026-02-13*
