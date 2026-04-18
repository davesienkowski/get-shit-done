# Codebase Concerns

**Analysis Date:** 2026-04-17

## Tech Debt

**Dual implementation (SDK vs CJS CLI):**
- Issue: Planning operations exist in two places: the TypeScript query registry under `sdk/src/query/` and the published CLI bundle `get-shit-done/bin/gsd-tools.cjs` with helpers in `get-shit-done/bin/lib/*.cjs`. Behavior must stay aligned for installs that still shell out to CJS.
- Files: `sdk/src/gsd-tools.ts`, `sdk/src/golden/golden-policy.ts`, `get-shit-done/bin/gsd-tools.cjs`
- Impact: Fixes or new commands can land in one path first; regressions appear only for native-query-off, workstream, or subprocess workflows.
- Fix approach: Keep `GOLDEN_PARITY_INTEGRATION_COVERED` / `GOLDEN_PARITY_EXCEPTIONS` in `sdk/src/golden/golden-policy.ts` accurate when adding registry commands; extend `sdk/src/golden/golden.integration.test.ts` or handler tests per `READ_HANDLER_ONLY_REASON` guidance.

**Golden parity exceptions for read-only commands:**
- Issue: Many canonical registry commands are explicitly documented as lacking subprocess JSON `toEqual` rows until shapes align; coverage relies on unit tests under `sdk/src/query/*.test.ts` and `sdk/src/query/stubs.test.ts`.
- Files: `sdk/src/golden/golden-policy.ts`, `sdk/src/query/QUERY-HANDLERS.md`
- Impact: Subprocess vs in-process drift may exist until golden rows are added.
- Fix approach: Add `captureGsdToolsOutput` + `registry.dispatch` checks in `sdk/src/golden/` when JSON shapes stabilize (see policy strings in `golden-policy.ts`).

**Intentional eslint suppression:**
- Issue: `stripFrontmatter` uses `while (true)` with `eslint-disable-next-line no-constant-condition` for greedy multi-block stripping.
- Files: `sdk/src/query/frontmatter.ts`
- Impact: Low; hides a lint rule locally instead of restructuring the loop.
- Fix approach: Replace with a bounded loop or iterator if block-count limits become a product requirement.

## Known Bugs

**Not detected:** No systematic bug tracker linkage in-repo. GitHub issues are referenced from root `package.json` (`bugs.url`). Runtime failures surface as `GSDToolsError` / thrown `Error` in SDK paths (`sdk/src/errors.ts`, `sdk/src/gsd-tools.ts`).

## Security Considerations

**`@file:` JSON indirection trust model:**
- Risk: `GSDTools.parseOutput` in `sdk/src/gsd-tools.ts` follows `@file:` in stdout and reads that path from disk. A compromised or malicious child process (or unexpected stdout) could direct reads outside intended artifacts.
- Files: `sdk/src/gsd-tools.ts`, tests in `sdk/src/gsd-tools.test.ts`
- Current mitigation: Assumes `gsd-tools.cjs` is trusted; tests cover happy path and missing file.
- Recommendations: Restrict allowed `@file:` roots to the project directory or temp dirs when feasible; avoid passing untrusted stdout through `parseOutput`.

**Optional API keys and dotfile paths:**
- Risk: Search integrations read `process.env.*_API_KEY` and optional files under the user home (e.g. `~/.gsd/` patterns referenced from config probing).
- Files: `sdk/src/query/config-mutation.ts`, `sdk/src/query/init-complex.ts`
- Current mitigation: Keys are optional; file existence checks gate features.
- Recommendations: Document that `~/.gsd/` files are secrets-equivalent; never commit them.

**Path boundary checks on mutations:**
- Risk: Writing or resolving paths outside the project could corrupt unrelated trees.
- Files: `sdk/src/query/state-mutation.ts` (rejects paths outside project), `sdk/src/query/verify.ts` (tilde/`$HOME` style refs)
- Current mitigation: Explicit rejection errors for disallowed paths in state mutation.
- Recommendations: Keep new file-touching handlers consistent with the same `projectDir` sandbox patterns.

## Performance Bottlenecks

**Large JSON buffers and subprocess timeouts:**
- Problem: `execFile` uses `maxBuffer: 10 * 1024 * 1024` and default `DEFAULT_TIMEOUT_MS = 30_000` in `sdk/src/gsd-tools.ts` for CJS invocations.
- Files: `sdk/src/gsd-tools.ts`
- Cause: Very large plan/state payloads can approach buffer limits or time out on slow disks.
- Improvement path: Stream or file-based handoff only if real workloads hit limits; native query avoids subprocess for matched commands.

**Heavy synchronous git calls in init flows:**
- Problem: `execSync` for `git status` / `git --version` with 5s timeouts in `sdk/src/query/init.ts` blocks the event loop during those calls.
- Files: `sdk/src/query/init.ts`
- Cause: Synchronous child processes on large repos may stall briefly.
- Improvement path: Async equivalents if interactive latency becomes an issue.

## Fragile Areas

**Registry / canonical command synchronization:**
- Files: `sdk/src/golden/golden-policy.ts` (`verifyGoldenPolicyComplete`), `sdk/src/golden/registry-canonical-commands.ts`, `sdk/src/query/index.ts`
- Why fragile: Adding a registry command without updating golden policy sets fails CI-style checks or leaves stale exception maps.
- Safe modification: Run policy verification after registry edits; update `GOLDEN_PARITY_*` lists and `QUERY-HANDLERS.md` together.

**Native query error path (no fallback):**
- Files: `sdk/src/gsd-tools.ts` (`exec`, `execRaw` — JSDoc states registry throws do not auto-fallback to `gsd-tools.cjs`)
- Why fragile: Operators may expect CLI fallback when SDK handlers throw.
- Safe modification: Catch at call sites or disable native query for troubleshooting; document operational playbook.

**Workstream forces CJS path:**
- Files: `sdk/src/gsd-tools.ts` (header comment: workstream dispatches to `gsd-tools.cjs` for env alignment)
- Why fragile: Code paths diverge from native registry behavior when `--ws` is active.
- Safe modification: Test both modes for any change touching planning state or env vars.

## Scaling Limits

**Single-machine planning model:**
- Current capacity: All state lives under `.planning/` in the repo; no server-side coordination.
- Limit: Concurrent edits from multiple machines or branches rely on git discipline, not framework locks.
- Scaling path: External locking or PR-based workflows remain out of scope for core GSD.

## Dependencies at Risk

**Anthropic Agent SDK coupling:**
- Risk: `sdk/package.json` pins `@anthropic-ai/claude-agent-sdk` (major API or auth changes could break `sdk/src/session-runner.ts`, phase runners).
- Impact: Programmatic plan execution and transports depend on SDK behavior.
- Migration plan: Follow upstream release notes; integration tests in `sdk/src/*.integration.test.ts` are the regression net.

## Missing Critical Features

**Unified Node version story:**
- Problem: Root `package.json` declares `"engines": { "node": ">=22.0.0" }` while `sdk/package.json` declares `>=20`. Documentation in workspace rules references Node 20+.
- Blocks: Confusion for contributors and CI image selection; not a runtime bug if everything runs on 22+.
- Files: `package.json`, `sdk/package.json`, `CLAUDE.md` (embedded stack)

## Test Coverage Gaps

**Split coverage targets:**
- What's not tested together: Root `npm run test:coverage` (see `package.json`) instruments `get-shit-done/bin/lib/*.cjs` via c8; SDK TypeScript uses Vitest in `sdk/` with separate config (`vitest.config.ts` at repo root).
- Files: `package.json` scripts, `vitest.config.ts`, `sdk/package.json`
- Risk: A change might satisfy one suite while the other path regresses (CJS vs TS).
- Priority: Medium for maintainers bridging PBR backport work; run both `npm test` (root) and `npm test` inside `sdk/` before release.

**Integration vs unit boundaries:**
- What's not uniformly covered: Subprocess golden parity is explicitly incomplete for several read-only commands (see `GOLDEN_PARITY_EXCEPTIONS` in `sdk/src/golden/golden-policy.ts`).
- Files: `sdk/src/golden/golden-policy.ts`, `sdk/src/golden/golden.integration.test.ts`
- Risk: Subprocess JSON shape drift until golden rows exist.
- Priority: Medium; escalates when CLI output contracts change.

---

*Concerns audit: 2026-04-17*
