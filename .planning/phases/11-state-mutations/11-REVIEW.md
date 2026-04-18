---
phase: 11-state-mutations
reviewed: 2026-04-08T08:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - sdk/src/query/state-mutation.ts
  - sdk/src/query/frontmatter-mutation.ts
  - sdk/src/query/config-mutation.ts
  - sdk/src/query/commit.ts
  - sdk/src/query/template.ts
  - sdk/src/query/helpers.ts
  - sdk/src/query/index.ts
  - sdk/src/query/registry.ts
  - sdk/src/query/state.ts
  - sdk/src/types.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 11: Code Review Report (Post-Fix Re-Review)

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This is a re-review after four fix commits addressed all warnings from the iter2 review (WR-01 through WR-04). All four fixes were verified in place and are correct:

- WR-01: `stateAdvancePlan` plan parsing now happens inside `readModifyWriteStateMd` under the lock.
- WR-02: Null-byte path traversal guards added to both `frontmatterMerge` and `frontmatterValidate`.
- WR-03: All four config write sites now use `atomicWriteConfig` (temp file + rename).
- WR-04: `sanitizeCommitMessage` returns `''` instead of passing falsy input through.

One new warning was found during this pass: a TypeScript compiler error (`tsc --noEmit`) in `state.ts:50` that is present in the current codebase. Three info items from iter2 remain unaddressed and are carried forward.

## Warnings

### WR-01: TypeScript compiler error — unsafe cast in `getMilestonePhaseFilter`

**File:** `sdk/src/query/state.ts:50`

**Issue:** `tsc --noEmit` reports `TS2352: Conversion of type '() => true' to type '((dirName: string) => boolean) & { phaseCount: number }' may be a mistake because neither type sufficiently overlaps with the other.` The code casts `(() => true)` directly to the intersection type, which TypeScript strict mode rejects because `() => true` does not satisfy the `phaseCount` property requirement. The SDK does not compile cleanly under its own `tsconfig.json`.

**Fix:** Use an intermediate `unknown` cast, or assign via a typed intermediate variable:

```typescript
// Option A: two-step cast through unknown
const passAll = (() => true) as unknown as ((dirName: string) => boolean) & { phaseCount: number };
passAll.phaseCount = 0;
return passAll;

// Option B: typed intermediate (cleaner)
const passAllFn = (_dirName: string): boolean => true;
const passAll = passAllFn as typeof passAllFn & { phaseCount: number };
passAll.phaseCount = 0;
return passAll;
```

---

## Info

### IN-01: `stateResolveBlocker` returns `resolved: true` even when search text matches nothing

**File:** `sdk/src/query/state-mutation.ts:631-645`

**Issue:** `resolved` is set to `true` whenever the blockers section exists (line 645), regardless of whether any blocker line actually matched `searchText`. If the caller passes a search string that does not match any blocker, the function returns `{ resolved: true }` but made no change. Callers relying on the return value to confirm a blocker was removed receive a false positive.

**Fix:** Track whether a matching line was actually removed:

```typescript
const beforeCount = lines.filter(l => l.startsWith('- ')).length;
const filtered = lines.filter(line => {
  if (!line.startsWith('- ')) return true;
  return !line.toLowerCase().includes(searchText.toLowerCase());
});
const afterCount = filtered.filter(l => l.startsWith('- ')).length;
resolved = afterCount < beforeCount;
```

---

### IN-02: `MUTATION_COMMANDS` includes read-only operations

**File:** `sdk/src/query/index.ts:59-67`

**Issue:** `MUTATION_COMMANDS` includes `frontmatter.validate` and `template.select`, which are pure read operations that do not write any files. Including them causes `FrontmatterMutation` and `TemplateFill` events to be emitted for operations that changed nothing, which may mislead consumers of the event stream.

**Fix:** Remove the read-only commands from `MUTATION_COMMANDS`:

```typescript
const MUTATION_COMMANDS = new Set([
  'state.update', 'state.patch', 'state.begin-phase', 'state.advance-plan',
  'state.record-metric', 'state.update-progress', 'state.add-decision',
  'state.add-blocker', 'state.resolve-blocker', 'state.record-session',
  'frontmatter.set', 'frontmatter.merge',
  // 'frontmatter.validate' removed — read-only
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit',
  'template.fill',
  // 'template.select' removed — read-only
]);
```

---

### IN-03: `needsQuoting` does not handle YAML boolean/null literals or flow indicators

**File:** `sdk/src/query/frontmatter-mutation.ts:116-118`

**Issue:** `needsQuoting` only checks for `:` and `#`. YAML reserved literals (`true`, `false`, `null`, `~`) and flow indicators (`[`, `{`, `>`, `|`) at nested sub-key positions are not guarded. A sub-key value of `"true"` would serialize as `key: true` and round-trip back as a boolean rather than a string. The top-level scalar path (lines 85-89) has a partial check for `[` and `{`, but the nested-key path at line 80 only calls `needsQuoting`.

**Fix:**

```typescript
function needsQuoting(s: string): boolean {
  if (s.includes(':') || s.includes('#')) return true;
  if (s.startsWith('[') || s.startsWith('{') || s.startsWith('>') || s.startsWith('|')) return true;
  if (s === 'true' || s === 'false' || s === 'null' || s === '~') return true;
  return false;
}
```

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
