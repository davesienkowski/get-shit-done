# Pitfalls Research: SDK-First Migration (CJS Monolith to TypeScript SDK)

**Domain:** CJS-to-ESM migration, CLI SDK development, incremental monolith retirement
**Researched:** 2026-04-07
**Confidence:** HIGH (based on codebase analysis of 669 gsd-tools.cjs call sites across 96 files, existing SDK bridge pattern in `sdk/src/gsd-tools.ts`, and established Node.js ESM migration patterns)

## Critical Pitfalls

### Pitfall 1: The Wrapper Trap -- Temporary Bridges That Become Permanent

**What goes wrong:**
The SDK's `GSDTools` class (sdk/src/gsd-tools.ts) already shells out to gsd-tools.cjs for every state operation. During migration, `gsd-sdk query` will delegate to gsd-tools.cjs internally so workflows can migrate call sites immediately. But once the 669 call sites across 96 files are migrated to `gsd-sdk query`, there is no remaining pressure to rewrite the underlying logic. The wrappers "work," so they never get replaced. You end up with a TypeScript SDK that is functionally a typed `execFile()` wrapper around a CJS script -- the worst of both worlds: process-spawn overhead, string parsing fragility, no unit testability, but now with extra layers of indirection.

**Why it happens:**
- Migrating call sites (markdown `node gsd-tools.cjs X` to `gsd-sdk query X`) is visible, measurable progress
- Rewriting the underlying 1047-line gsd-tools.cjs + 21 CJS library files is invisible, risky work
- Once all 96 consumer files use the new CLI, there's no "broken" signal to motivate rewriting internals
- The architecture note says "No Permanent Wrappers" but project pressure always favors shipping features over retiring wrappers

**How to avoid:**
- Track wrapper count as a first-class metric: each `gsd-sdk query` subcommand starts as a wrapper, each gets a deadline for native rewrite
- Enforce the rule: a wrapper may exist for at most ONE milestone after the call site migration phase. If it survives two milestones, it's permanent debt
- Structure phases so that call-site migration and native rewrite happen in the SAME phase for each command group (state, roadmap, phase, config), not in separate "migrate then rewrite" mega-phases
- Add a CI check: count `execFile` / `child_process` calls in sdk/src/ -- the number must decrease each milestone, never increase

**Warning signs:**
- More than 5 wrapper methods in GSDTools class after call-site migration is "complete"
- PRs that add new wrapper methods instead of native implementations
- The phrase "we'll rewrite this later" in PR descriptions
- sdk/src/gsd-tools.ts grows instead of shrinks over time

**Phase to address:**
Every phase. The first phase should establish the wrapper tracking mechanism and the "same-phase rewrite" rule. Each subsequent phase must rewrite the wrappers it inherits.

---

### Pitfall 2: Dual-Writer State Corruption

**What goes wrong:**
During migration, both gsd-tools.cjs (called by not-yet-migrated workflows) and the SDK (called by already-migrated workflows) read and write the same `.planning/` files: STATE.md, config.json, ROADMAP.md, phase directories. If both systems modify the same file in the same session -- or even across sessions with different assumptions about file format -- state becomes inconsistent. Examples:
- SDK writes STATE.md with slightly different frontmatter formatting than gsd-tools.cjs expects
- gsd-tools.cjs updates `current_phase` in STATE.md, then SDK reads a stale cached version
- Two workflows in the same `gsd-sdk auto` run: one calls gsd-tools.cjs for `phase complete`, another calls SDK's native method -- they disagree on phase status

**Why it happens:**
- gsd-tools.cjs uses raw string manipulation (regex-based YAML frontmatter parsing in `state.cjs`, `frontmatter.cjs`)
- The SDK will likely use a proper YAML parser or structured JSON, producing subtly different output
- There's no locking mechanism on `.planning/` files
- During incremental migration, some commands go through gsd-tools.cjs and some through SDK -- the user can't predict which path runs

**How to avoid:**
- **Single writer rule:** During migration, ALL writes to a given file type go through ONE system. If STATE.md writes are still in gsd-tools.cjs, the SDK must delegate STATE.md writes to gsd-tools.cjs (even if reads are native). Only switch writes to native SDK after verifying byte-level output compatibility
- **Golden file tests:** For every file the SDK will write (STATE.md, config.json, ROADMAP.md), create snapshot tests comparing SDK output to gsd-tools.cjs output for identical inputs. The test fails if formatting differs
- **Migrate by file, not by command:** Instead of "migrate the `state` command group," think "migrate STATE.md ownership." All reads AND writes for STATE.md move to SDK together, in one phase

**Warning signs:**
- Tests pass but `git diff` shows unexpected whitespace/formatting changes in `.planning/` files after SDK-driven operations
- gsd-tools.cjs errors about "unexpected format" or "parse failed" on files the SDK recently wrote
- Intermittent failures in workflows that mix old and new code paths
- STATE.md frontmatter fields appearing in different order across sessions

**Phase to address:**
The phase that builds `gsd-sdk query` must establish the single-writer rule and golden file tests BEFORE any workflow migration begins. This is load-bearing infrastructure.

---

### Pitfall 3: Output Format Breakage Across 669 Call Sites

**What goes wrong:**
The 65 workflow markdown files and 11 agent files parse gsd-tools.cjs output using bash patterns: `$(node gsd-tools.cjs ...)`, pipe to `jq`, grep for specific strings, check exit codes. The migration replaces `node gsd-tools.cjs X` with `gsd-sdk query X`, but if the new command produces output that differs in ANY way -- extra whitespace, different JSON key ordering, missing trailing newline, different stderr behavior -- the bash parsing in the calling markdown breaks silently. The agent reads garbled data, makes wrong decisions, and the user sees inexplicable behavior 3-4 steps later.

**Why it happens:**
- gsd-tools.cjs has two output modes: `--raw` (plain text) and default (JSON). 35 call sites use `--raw` or `--pick`. The SDK must honor both
- gsd-tools.cjs writes some output to stdout and some diagnostics to stderr. Workflows use `2>/dev/null` on 15+ calls. If the SDK changes what goes to stderr vs stdout, filtering breaks
- JSON key ordering in Node.js `JSON.stringify` is insertion-order-dependent. If the SDK constructs objects differently, downstream `jq` queries or agent JSON parsing may fail
- The `@file:` prefix pattern (large output written to temp file, stdout contains path) is a gsd-tools.cjs-specific convention the SDK must replicate

**How to avoid:**
- **Output contract tests:** For EVERY gsd-tools.cjs command that workflows call, create a test that runs both `node gsd-tools.cjs X` and `gsd-sdk query X` on the same input and asserts identical stdout, stderr, and exit code
- **Catalog all output parsing patterns:** Before migration, grep all 96 files for output handling patterns: `$()` capture, `jq` pipelines, `--raw`, `--pick`, `2>/dev/null`, exit code checks. Build a matrix of command -> expected output format -> consuming files
- **Ship `gsd-sdk query` with exact backward-compatible output first**, then optionally add `--format json-typed` for richer structured output later. Never change default output format

**Warning signs:**
- Workflow tests pass individually but `gsd-sdk auto` fails mid-execution
- Agents report "unexpected format" or produce truncated outputs
- `--raw` output contains JSON wrapping, or JSON output contains raw text
- Bash variable captures contain unexpected quotes or escape characters

**Phase to address:**
The audit phase (before any migration) must catalog output contracts. The `gsd-sdk query` build phase must include output contract tests as acceptance criteria.

---

### Pitfall 4: CJS-to-ESM Import Incompatibility

**What goes wrong:**
The SDK is ESM (`"type": "module"` in sdk/package.json, `import` syntax throughout). gsd-tools.cjs and its 21 helper files in `get-shit-done/bin/lib/*.cjs` are CommonJS (`require()`, `module.exports`). During migration, you need to move logic FROM CJS files INTO ESM SDK files. This creates several traps:
- `require()` calls for dynamic module loading (gsd-tools.cjs loads lib/*.cjs dynamically) have no ESM equivalent without `createRequire`
- `__dirname` / `__filename` don't exist in ESM; must use `import.meta.url` + `fileURLToPath` (the SDK already does this correctly in cli.ts and gsd-tools.ts, but each new migration must remember)
- `require.resolve()` for finding files relative to the module has no ESM equivalent
- CJS modules can `require()` JSON files directly; ESM needs `assert { type: 'json' }` or `fs.readFile`
- The root package.json has `"engines": {"node": ">=22.0.0"}` but the SDK has `"engines": {"node": ">=20"}` -- Node 20 ESM support is slightly different from Node 22

**Why it happens:**
- CJS patterns are deeply embedded in the 21 helper files -- every one uses `require()` and `module.exports`
- Copy-pasting logic from .cjs files into .ts files requires manual conversion of EVERY import/export
- `__dirname` is the most common CJS idiom and the most commonly forgotten during conversion
- JSON imports are particularly tricky and the syntax has changed across Node versions

**How to avoid:**
- Create a conversion checklist for each .cjs file being migrated: `require()` -> `import`, `module.exports` -> `export`, `__dirname` -> `fileURLToPath(import.meta.url)`, `require.resolve()` -> `import.meta.resolve()` (Node 20.6+)
- Set the SDK's minimum Node version to match the root package: `>=22.0.0`, eliminating Node 20 ESM edge cases
- Use `readFile` + `JSON.parse` for JSON loading (already the SDK's pattern in cli.ts), never `import ... assert { type: 'json' }`
- Lint rule: ban `require`, `__dirname`, `__filename` in sdk/src/ -- any occurrence is a migration bug

**Warning signs:**
- `ReferenceError: __dirname is not defined` at runtime
- `ERR_REQUIRE_ESM` when SDK code accidentally tries to `require()` an ESM module
- `ERR_IMPORT_ASSERTION_TYPE_MISSING` on JSON imports
- Tests pass on Node 22 but fail on Node 20 (or vice versa)

**Phase to address:**
The first phase should align engine versions and establish the lint rule. Each migration phase must use the conversion checklist.

---

### Pitfall 5: CLI Entry Point and Cross-Platform Shebang Failures

**What goes wrong:**
The SDK declares `"bin": {"gsd-sdk": "./dist/cli.js"}` in package.json. On npm install, npm creates a shim script that invokes `node dist/cli.js`. This works on macOS/Linux but has Windows-specific traps:
- The shebang `#!/usr/bin/env node` in cli.ts (line 1) is compiled into dist/cli.js. On Windows with Git Bash, this works. On Windows CMD/PowerShell without Git Bash, npm's `.cmd` wrapper handles it -- but only if the file extension is `.js`. If TypeScript compilation produces `.mjs`, the wrapper breaks
- The `dist/cli.js` path uses forward slashes, which is correct for package.json but the resolution at runtime uses `import.meta.url` which produces `file:///D:/...` URLs on Windows -- `fileURLToPath` handles this, but manual path construction doesn't
- When workflows call `gsd-sdk query` via bash blocks in markdown, on Windows the agent runs these in Git Bash. But `gsd-sdk` is an npm bin link, and npm bin links on Windows are `.cmd` files. Calling a `.cmd` file from Git Bash requires explicit `.cmd` extension or a PATH that includes npm's bin directory

**Why it happens:**
- GSD explicitly supports Windows (the project is developed on Windows 11)
- The SDK's cli.ts already uses `fileURLToPath(import.meta.url)` correctly, but new code may not
- npm's cross-platform bin link behavior is well-known but has subtle edge cases
- Workflow markdown runs bash blocks via the AI runtime's shell, which varies by platform

**How to avoid:**
- Always use `fileURLToPath` + `path.resolve` for path construction from `import.meta.url`, never string concatenation
- Test CLI invocation on both Windows (CMD, PowerShell, Git Bash) and Unix. Add a CI matrix that includes Windows
- For workflow markdown calling `gsd-sdk query`, use `npx gsd-sdk query` or the full path `node path/to/dist/cli.js` to avoid bin link resolution issues
- Keep the compiled output as `.js` (not `.mjs`) to maintain npm bin wrapper compatibility. The SDK's tsconfig already targets `NodeNext` module resolution which produces `.js` output -- do not change this

**Warning signs:**
- "command not found: gsd-sdk" on Windows but works on macOS CI
- `ENOENT` errors with backslash paths in stack traces
- Tests pass locally (Windows) but fail in CI (Ubuntu) or vice versa
- `import.meta.url` producing unexpected paths in tests vs production

**Phase to address:**
The `gsd-sdk query` CLI build phase. Must include Windows + Unix testing as acceptance criteria from day one.

---

### Pitfall 6: Testing CLI Output Instead of Library API

**What goes wrong:**
When adding `gsd-sdk query` subcommands, the natural testing approach is to spawn the CLI process, capture stdout, and assert on the output string. This creates brittle tests that break on formatting changes, are slow (process spawn per test), and don't test the actual library logic. Meanwhile, the library API (typed functions) gets zero direct test coverage because "the CLI tests cover it." When a CLI output format changes later, all tests break even though the underlying logic is correct.

**Why it happens:**
- The existing test pattern in sdk/src/gsd-tools.test.ts tests the GSDTools class by mocking `execFile` -- this is already the right pattern for the bridge, but new `query` subcommands may not follow it
- CLI tests feel more "real" because they test the full stack
- The SDK's cli.ts is already 429 lines with complex argument parsing -- adding `query` subcommands will make it grow further, tempting developers to test through the CLI layer
- The gsd-tools.cjs being migrated FROM has no tests at all, so there's no existing test-the-library culture

**How to avoid:**
- **Two-layer testing rule:** Every SDK capability has (1) a unit test of the typed function that returns structured data, and (2) a thin integration test of the CLI that verifies the function is correctly wired to the subcommand. The unit test is the source of truth; the CLI test is a smoke test
- **Extract query handlers into pure functions** that take typed input and return typed output, separate from CLI argument parsing. The CLI layer is just: parse args -> call function -> format output. Test the function, not the formatting
- **Never test JSON output by string matching.** Parse it and assert on structure. This prevents key-ordering and whitespace breakage

**Warning signs:**
- Test files that import `child_process` or `execSync` to test SDK logic
- Tests that assert on specific string output (not parsed JSON structure)
- CLI tests that take >1s each (process spawn overhead)
- Zero tests for the typed function, only tests for the CLI wrapper

**Phase to address:**
The `gsd-sdk query` build phase. Establish the two-layer testing pattern with the first subcommand, then enforce it for all subsequent subcommands.

---

### Pitfall 7: Breaking Published npm Consumers During Migration

**What goes wrong:**
`@gsd-build/sdk` is published on npm at v0.1.0. The migration will add new exports (`query` subcommands, error classification, exit code enums), change existing interfaces (`GSDTools` class methods), and potentially restructure the module. If a published version changes or removes an exported type/function that external consumers depend on, those consumers break on `npm update`. Even internal consumers (the GSD plugin itself) break if the SDK version in the lockfile doesn't match what's installed.

**Why it happens:**
- The SDK is at v0.1.0, which signals instability -- but npm consumers may still pin to `^0.1.0` expecting minor compatibility
- Adding `gsd-sdk query` CLI subcommands is additive, but restructuring the `GSDTools` class (to make wrappers native) changes existing API surface
- The SDK's `index.ts` re-exports everything -- any internal restructuring becomes a public API change
- The root package.json (get-shit-done-cc) doesn't declare a dependency on @gsd-build/sdk -- they're sibling packages in a monorepo-like structure, making version coordination manual

**How to avoid:**
- **Semver discipline:** Stay on 0.x during migration. Use 0.2.0 for additive query commands, 0.3.0 for breaking GSDTools changes, etc. Never make breaking changes in patch versions
- **Mark the bridge as internal:** The `GSDTools` class that shells out to gsd-tools.cjs should NOT be re-exported from index.ts. It's implementation detail, not public API. Consumers should use the higher-level `GSD` class or typed query functions
- **Add `@internal` JSDoc tags** to bridge code so it's clear what's public vs migration scaffolding
- **Don't re-export types that will change.** If `PhaseOpInfo` is going to get restructured when its source moves from CJS to native TS, don't export it from index.ts until the structure is stable

**Warning signs:**
- `index.ts` exports growing faster than the stable API surface
- External issues reporting "type X no longer exists" after a minor version bump
- The GSDTools class appearing in consumer import statements
- Types that mirror gsd-tools.cjs JSON output shape rather than a clean domain model

**Phase to address:**
The first phase should audit index.ts exports and mark bridge code as internal. Each subsequent phase should consider API stability when adding exports.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Shell out to gsd-tools.cjs from SDK | Instant migration of call sites | Process spawn overhead, no type safety on inputs, untestable internals | Only during active migration, with per-wrapper rewrite deadline |
| Parse gsd-tools.cjs stdout as JSON | Reuse existing output format | Fragile string coupling, key ordering assumptions, no schema validation | Only as temporary bridge; native functions must return typed objects |
| Copy-paste CJS logic into TS files | Quick port of individual functions | Preserves CJS-era patterns (string manipulation, regex parsing) in typed code | Never -- rewrite to idiomatic TS during migration, using proper parsers |
| Dual CLI entry points (gsd-tools.cjs + gsd-sdk query) | Gradual migration without big-bang | User confusion about which to use, inconsistent behavior, double maintenance | Only during migration; each command must have exactly ONE canonical path |
| Testing through CLI only | "Full stack" coverage | Slow tests, formatting-coupled assertions, no library coverage | Never for unit tests; acceptable for one smoke test per subcommand |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Workflow markdown calling SDK CLI | Using `gsd-sdk query X` without handling Windows bin link resolution | Use `node "$HOME/.claude/sdk/dist/cli.js" query X` or ensure PATH includes npm bin dir |
| Agent markdown parsing SDK output | Assuming JSON output from SDK matches gsd-tools.cjs key ordering | Use output contract tests; agents should parse by key name, never by position |
| SDK reading `.planning/` files | Reading files that gsd-tools.cjs just wrote (stale cache) | No in-memory caching during migration; always read from disk |
| SDK exit codes in bash | Checking `$?` for 0/1 but SDK now uses 0/1/10/11 | Workflows must check for `$? -eq 0` (success) or `$? -ne 0` (any failure), not specific codes, until all sites are migrated |
| npm publish of SDK | Publishing SDK with gsd-tools.cjs bridge but not including gsd-tools.cjs in package files | Either bundle gsd-tools.cjs in SDK's npm package, or don't ship bridge methods to npm -- only native implementations |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Process spawn per query | `gsd-sdk query` takes 200-500ms per call; workflows calling 10+ queries = 2-5s overhead | Native TS functions eliminate spawn cost; batch queries into single calls where possible | Noticeable with >5 queries per workflow; painful with >15 |
| Re-reading `.planning/` files on every query | Each `gsd-sdk query` invocation reads STATE.md, config.json, ROADMAP.md from disk independently | For CLI: acceptable (stateless). For library API: cache within a session, invalidate on write | Always slow for library users; acceptable for CLI |
| Spawning Node.js for trivial checks | `gsd-sdk query verify-path-exists path` spawns a Node process to call `fs.existsSync` | Inline trivial checks in workflow bash: `[ -f path ]` instead of calling SDK | Immediately wasteful; never should have been a CLI command |

## "Looks Done But Isn't" Checklist

- [ ] **Call site migration:** All 669 gsd-tools.cjs references updated -- verify that agent files (48 occurrences across 11 files) and reference docs are included, not just workflows
- [ ] **`--raw` mode:** SDK query commands support `--raw` flag -- verify all 35 `--raw`/`--pick` call sites produce identical output format
- [ ] **Error output on stderr:** SDK diagnostic messages go to stderr, query results to stdout -- verify `2>/dev/null` patterns in workflows still suppress errors correctly
- [ ] **Exit codes:** SDK returns 0 on success -- verify no workflow checks `$? -eq 1` specifically (vs `$? -ne 0`) which would break with new exit code semantics (10, 11)
- [ ] **`@file:` protocol:** Large output uses temp file indirection -- verify SDK replicates this for commands that produce >64KB output (roadmap analyze on large projects)
- [ ] **Windows paths:** All new `import.meta.url` usage wrapped in `fileURLToPath` -- verify no raw URL string manipulation
- [ ] **gsd-tools.cjs actually deleted:** Not just unused, but removed from the file tree and from the root package.json `files` array -- verify no dead code ships to npm
- [ ] **GSDTools class removed:** The bridge class in sdk/src/gsd-tools.ts is deleted, not just unused -- verify index.ts no longer exports it

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrapper trap (wrappers become permanent) | MEDIUM | Audit wrapper count, create issues for each, block next milestone until count decreases |
| Dual-writer corruption | HIGH | Identify which system wrote the corrupted file, revert to last good state via git, enforce single-writer rule going forward |
| Output format breakage | LOW | Pin the broken command to old gsd-tools.cjs path temporarily, fix SDK output, add contract test, re-migrate |
| CJS import in ESM module | LOW | Fix the import, add lint rule, no runtime state damage |
| Windows CLI failure | MEDIUM | Add Windows CI job, fix path handling, may need to change how workflows invoke SDK |
| Published API breakage | HIGH | Publish patch version restoring removed exports (deprecated), plan proper removal in next minor |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrapper trap | Every phase (wrapper tracking from phase 1) | Wrapper count metric decreases each phase; zero at final phase |
| Dual-writer corruption | Phase building `gsd-sdk query` foundation | Golden file tests pass; git diff shows zero formatting changes |
| Output format breakage | Audit phase (before migration) | Output contract matrix exists for all 669 call sites |
| CJS-to-ESM imports | Phase 1 (engine alignment + lint rules) | ESLint/ban rule blocks `require`/`__dirname` in sdk/src/ |
| CLI cross-platform | `gsd-sdk query` build phase | Windows + macOS + Linux CI matrix passes |
| Testing CLI vs library | `gsd-sdk query` build phase | Every subcommand has typed function + unit test; CLI test is separate smoke test |
| npm consumer breakage | Every phase publishing to npm | GSDTools class not exported; @internal tags on bridge code |

## Sources

- Codebase analysis: `sdk/src/gsd-tools.ts` (bridge pattern), `sdk/src/cli.ts` (CLI entry point), `sdk/package.json` (ESM config)
- Call site count: grep of `node.*gsd-tools.cjs` across repo (669 occurrences, 96 files)
- Output modifier analysis: grep of `--raw`/`--pick` in workflows (35 occurrences, 18 files)
- Agent call sites: 48 occurrences across 11 agent files
- CJS helper library: 21 files in `get-shit-done/bin/lib/*.cjs`
- SDK architecture decision: `.planning/notes/sdk-first-architecture.md`
- Error classification seed: `.planning/seeds/sdk-error-classification.md`
- Exit code semantics seed: `.planning/seeds/sdk-exit-code-semantics.md`
- Node.js ESM documentation (training data, HIGH confidence -- well-established patterns)
- npm bin link behavior (training data, HIGH confidence -- stable npm feature)

---
*Pitfalls research for: SDK-First Migration (CJS Monolith to TypeScript SDK)*
*Researched: 2026-04-07*
