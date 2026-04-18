---
phase: 12-verification-suite
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - sdk/src/query/verify.ts
  - sdk/src/query/validate.ts
  - sdk/src/query/frontmatter.ts
  - sdk/src/query/index.ts
  - sdk/src/query/verify.test.ts
  - sdk/src/query/validate.test.ts
  - sdk/src/query/frontmatter.test.ts
  - sdk/src/golden/golden.integration.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase delivers verification and validation query handlers (`verify.ts`, `validate.ts`), an extended frontmatter parser (`frontmatter.ts`), and their registration in the query index (`index.ts`). Unit and golden integration tests cover the new handlers. Overall quality is high: security guards (null-byte rejection, regex try/catch, home-directory guard) are consistently applied, error handling is structured, and tests are thorough.

Three warnings and three info items are noted. The most impactful is a logic bug in `verifyArtifacts` that produces a false-positive `all_passed: true` when every artifact entry lacks a `path` field — the results array is empty, and `0 === 0` evaluates to true. Two additional warnings concern an unescaped `RegExp` construction and a duplicate test invocation that can hide assertion failures.

## Warnings

### WR-01: `verifyArtifacts` false-positive `all_passed: true` on zero-result set

**File:** `sdk/src/query/verify.ts:295`
**Issue:** When every item in `must_haves.artifacts` is a plain string (no `path` property), the `continue` on line 247 skips all entries, leaving `results` empty. The final expression `all_passed: passed === results.length` then evaluates to `0 === 0 = true`. A caller receives `{ all_passed: true, passed: 0, total: 0 }` and may treat this as a passing check when nothing was actually verified. The early guard on line 240 only fires when the parsed `artifacts` list itself is empty; it does not catch the case where the list is non-empty but contains only string items.

**Fix:**
```typescript
// Replace the final return in verifyArtifacts:
const passed = results.filter(r => r.passed).length;
return {
  data: {
    // Require at least one result to be "all passed"; empty set is not a pass
    all_passed: results.length > 0 && passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  },
};
```

---

### WR-02: Unescaped user-controlled string used in `new RegExp` in `parseMustHavesBlock`

**File:** `sdk/src/query/frontmatter.ts:215`
**Issue:** `blockName` is interpolated directly into a `RegExp` constructor without escaping. If a caller passes a `blockName` containing regex metacharacters (e.g., `"key.links"` with a literal dot, or `"artifacts+"`), the pattern silently matches unintended lines and returns incorrect results instead of an empty set. There is no thrown error — the bug is silent data corruption.

Current callers only pass `'artifacts'`, `'key_links'`, and `'truths'`, which are all safe literals. However, `parseMustHavesBlock` is an exported function and can be called from test or future handler code with arbitrary input.

**Fix:**
```typescript
// Add a helper or inline escaping before constructing the regex:
function escapeRegexLocal(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const blockPattern = new RegExp(`^(\\s+)${escapeRegexLocal(blockName)}:\\s*$`, 'm');
```
Alternatively, import and reuse the existing `escapeRegex` helper from `helpers.ts` (already imported in `validate.ts`).

---

### WR-03: Double invocation in GSDError classification test masks assertion failure

**File:** `sdk/src/query/verify.test.ts:212-218`
**Issue:** The test calls `verifyPlanStructure([], tmpDir)` twice — once in the `rejects.toThrow` assertion and once inside the `try/catch` block that checks `classification`. If the first `rejects.toThrow` assertion passes, the second invocation runs independently. If the second invocation somehow does NOT throw (e.g., due to a race or environment difference), the `catch` block is never entered, the `expect` inside it is silently skipped, and the test passes green while the classification is never verified.

This pattern also appears in `validate.test.ts:29-34` for `verifyKeyLinks`.

**Fix:**
```typescript
it('throws GSDError with Validation classification when no args', async () => {
  // Single invocation — catch and assert in one place
  let caught: unknown;
  try {
    await verifyPlanStructure([], tmpDir);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(GSDError);
  expect((caught as GSDError).classification).toBe('validation');
});
```

---

## Info

### IN-01: `validateConsistency` ROADMAP/disk phase sync is asymmetric

**File:** `sdk/src/query/validate.ts:188-199`
**Issue:** The two sync loops use different normalization strategies. The ROADMAP→disk loop calls `normalizePhaseName(p)` (which zero-pads to 2 digits), then checks `diskPhases.has(normalized)`. The disk→ROADMAP loop calls `String(parseInt(p, 10))` (which strips leading zeros). These strategies are not mirror images. A project where ROADMAP uses zero-padded phase numbers ("02") and disk dirs are also zero-padded ("02") works correctly in practice, but the intent is harder to reason about and a different padding convention could produce spurious warnings. A code comment explaining the normalization strategy would prevent future regressions.

**Fix:** Add an inline comment explaining the deliberate asymmetry, or refactor to a single shared normalization function used in both directions.

---

### IN-02: `validateHealth` reads `config.json` twice in checks 5 and 5b

**File:** `sdk/src/query/validate.ts:421-449`
**Issue:** Check 5 reads and parses `config.json` (lines 426-436), and Check 5b independently re-reads and re-parses the same file (lines 441-449). This is redundant I/O. If the file changes between the two reads (unlikely in tests, theoretically possible in production), the two checks operate on inconsistent data.

**Fix:** Parse `config.json` once into a shared variable and reuse it in both checks:
```typescript
let configParsed: Record<string, unknown> | null = null;
if (existsSync(configPath)) {
  try {
    const raw = await readFile(configPath, 'utf-8');
    configParsed = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) { /* ... */ }
}
// Then use configParsed in both check 5 and check 5b
```

---

### IN-03: `MUTATION_COMMANDS` includes space-variant alias `'validate health'` but event wiring loop may silently skip it

**File:** `sdk/src/query/index.ts:69`
**Issue:** `MUTATION_COMMANDS` includes `'validate health'` (space variant). The event-wiring loop calls `registry.getHandler(cmd)` for each command in the set. The alias `'validate health'` is registered on line 218, so if `getHandler` returns it correctly, the wiring works. However, the handler registered at `'validate health'` is the same function object as `'validate.health'`. When the loop re-registers the wrapped version for `'validate health'`, it will also be re-registered for `'validate.health'` only if that is also in `MUTATION_COMMANDS`. Both `'validate.health'` and `'validate health'` are in the set (line 69), so both get wrapped — which means `validateHealth` gets double-wrapped if a caller dispatches via either alias. The double-wrap is harmless (outer wrapper calls inner wrapper calls original) but emits two events per call.

**Fix:** Remove the space-variant aliases from `MUTATION_COMMANDS` and normalize dispatch to the dotted form, or ensure the registry's alias mechanism maps both names to the same handler slot so wrapping one wraps both.

---

_Reviewed: 2026-04-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
