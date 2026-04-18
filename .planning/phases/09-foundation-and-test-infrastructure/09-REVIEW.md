---
phase: 09-foundation-and-test-infrastructure
reviewed: 2026-04-07T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - scripts/wrapper-count.cjs
  - sdk/src/cli.test.ts
  - sdk/src/cli.ts
  - sdk/src/errors.test.ts
  - sdk/src/errors.ts
  - sdk/src/golden/capture.ts
  - sdk/src/golden/fixtures/current-timestamp.golden.json
  - sdk/src/golden/fixtures/generate-slug.golden.json
  - sdk/src/golden/golden.integration.test.ts
  - sdk/src/query/index.ts
  - sdk/src/query/registry.test.ts
  - sdk/src/query/registry.ts
  - sdk/src/query/utils.test.ts
  - sdk/src/query/utils.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-04-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase delivers the foundation for the SDK query subsystem: a `QueryRegistry` with `generate-slug` and `current-timestamp` native handlers, a CLI entry point (`cli.ts`) with `run`/`init`/`auto`/`query` commands, an error classification system (`errors.ts`), and golden file integration tests comparing SDK output to the legacy `gsd-tools.cjs` bridge.

The implementation is well-structured and largely correct. One critical bug was found: the `--pick` flag documented in the USAGE string and wired into the query handler is unusable in practice because `parseCliArgs` runs with `strict: true` and will throw on `--pick` before the query handler can consume it. Two warnings were identified: a test that uses `vi.doMock` on an already-cached module (the assertion may pass for the wrong reason), and missing validation of `--pick`'s index argument when it appears at the end of `queryArgs`. One informational item covers test coverage of the `readStdin` TTY error path.

## Critical Issues

### CR-01: `--pick` flag throws before query handler can consume it

**File:** `sdk/src/cli.ts:40-54` (parseCliArgs), `sdk/src/cli.ts:214-219` (pick extraction)

**Issue:** `parseCliArgs` is called with `strict: true` in `parseArgs`. The `--pick` option is not registered in the `options` map passed to `parseArgs`. When a user runs `gsd-sdk query generate-slug "My Phase" --pick slug`, `parseCliArgs` throws `Unknown option '--pick'` at line 180, before control ever reaches the query block at line 200 where `--pick` is extracted from `queryArgs`. The documented feature (USAGE line: `--pick`) is therefore broken — it exits with code 1 and prints the error message rather than extracting the field.

Verified with Node.js:
```
$ node -e "const {parseArgs}=require('node:util'); parseArgs({args:['query','gen','--pick','slug'],options:{help:{type:'boolean'}},allowPositionals:true,strict:true})"
Unknown option '--pick'. To specify a positional argument starting with a '-'...
```

**Fix:** Add `pick` to the `parseArgs` options map in `parseCliArgs`, or (preferred for symmetry with how `queryArgs.splice` works) switch the `--pick` extraction to run before `parseCliArgs` by pre-processing `argv`:

```typescript
// Option A: register --pick in parseArgs options
options: {
  'project-dir': { type: 'string', default: process.cwd() },
  'ws-port':     { type: 'string' },
  model:         { type: 'string' },
  'max-budget':  { type: 'string' },
  init:          { type: 'string' },
  pick:          { type: 'string' },   // <-- add this
  help:          { type: 'boolean', short: 'h', default: false },
  version:       { type: 'boolean', short: 'v', default: false },
},
```

And surface it on `ParsedCliArgs`:
```typescript
export interface ParsedCliArgs {
  // ... existing fields ...
  pick: string | undefined;
}
```

Then remove the manual `queryArgs.indexOf('--pick')` splice in `main()` and use `args.pick` directly.

## Warnings

### WR-01: `vi.doMock` fallback test may not actually exercise the fallback

**File:** `sdk/src/query/registry.test.ts:84-108`

**Issue:** The test at line 84 ("dispatch falls back to GSDTools for unregistered command") calls `vi.doMock('../gsd-tools.js', ...)` and then does a dynamic re-`import('./registry.js')`. In Vitest's ESM mode, `registry.js` was already statically imported at the top of the file (line 6). The module cache will return the already-loaded version rather than a fresh one wired with the mock. As a result, the `mockExec` spy (line 90) is never verified with `expect(mockExec).toHaveBeenCalled()`, and the test passes by asserting on the return value of a real (not mocked) `GSDTools.exec()` call — or it throws silently. The test provides false confidence that the fallback path is covered.

**Fix:** Either use `vi.mock` (hoisted, applies before imports) at the top of the test file with conditional behavior, or restructure the test to inject a fake registry that has a controllable fallback. A simpler approach is to expose the fallback as an injectable dependency:

```typescript
// In registry.test.ts — replace the vi.doMock block with:
it('dispatch falls back to GSDTools for unregistered command', async () => {
  // Verify that an unregistered command name passes through dispatch without throwing
  // (full integration tested in golden.integration.test.ts)
  const registry = new QueryRegistry();
  expect(registry.has('unknown-cmd')).toBe(false);
  // The real fallback test lives in golden integration tests where gsd-tools.cjs is available
});
```

Or, add a `mockExec` assertion to catch regressions:
```typescript
expect(mockExec).toHaveBeenCalledWith('unknown-cmd', ['arg1']);
```

### WR-02: `--pick` index argument not bounds-checked — silent `undefined` when `--pick` is last token

**File:** `sdk/src/cli.ts:216-219`

**Issue:** When `--pick` appears as the last argument (no value following it), `queryArgs[pickIdx + 1]` is `undefined`, so `pickField` is silently `undefined`. The field extraction is skipped and the full JSON is printed. This is a confusing user experience (no error, wrong output) rather than a crash, but it can mask mistyped commands.

```typescript
// Current code (line 216-219):
const pickIdx = queryArgs.indexOf('--pick');
let pickField: string | undefined;
if (pickIdx !== -1) {
  pickField = queryArgs[pickIdx + 1];  // undefined when --pick is last token
  queryArgs.splice(pickIdx, 2);
}
```

**Fix:** Validate that a value follows `--pick`:

```typescript
if (pickIdx !== -1) {
  pickField = queryArgs[pickIdx + 1];
  if (!pickField || pickField.startsWith('--')) {
    console.error('Error: --pick requires a field path argument (e.g. --pick slug)');
    process.exitCode = 10;
    return;
  }
  queryArgs.splice(pickIdx, 2);
}
```

Note: This fix only matters once CR-01 is resolved and `--pick` is accepted by `parseCliArgs`.

## Info

### IN-01: `resolveInitInput` TTY path is not tested; test comment acknowledges this

**File:** `sdk/src/cli.test.ts:333-340`

**Issue:** The test "throws TTY error when no input and stdin is TTY" (line 333) does not actually test the TTY error path — the comment at line 337 explicitly notes that `stdin.isTTY` is undefined in test environments. The test body falls through to a raw-text path instead. The `readStdin` function at `cli.ts:154-172` is therefore not covered by the test suite.

**Fix:** Add a test that mocks `process.stdin.isTTY`:

```typescript
it('throws TTY error when no input and stdin is TTY', async () => {
  const originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  try {
    await expect(
      resolveInitInput(makeArgs({ initInput: undefined }))
    ).rejects.toThrow('No input provided');
  } finally {
    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  }
});
```

---

_Reviewed: 2026-04-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
