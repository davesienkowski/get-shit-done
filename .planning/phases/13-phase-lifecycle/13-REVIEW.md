---
phase: 13-phase-lifecycle
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - sdk/src/query/phase-lifecycle.ts
  - sdk/src/query/phase-lifecycle.test.ts
  - sdk/src/query/index.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 13 introduces seven phase lifecycle handlers (`phaseAdd`, `phaseInsert`, `phaseScaffold`, `phaseRemove`, `phaseComplete`, `phasesClear`, `phasesArchive`) and wires them into the query registry. The code is well-structured, consistent with existing patterns, and covered by a thorough test suite. No security vulnerabilities or data-loss bugs were found.

Four warnings exist — two involve potential data loss from incorrect `parseInt` radix arguments or unguarded variable access after a closure, and two involve logic correctness issues in regex patterns and the ROADMAP update step. Three info items cover dead code paths, a magic constant, and a gap in the `phaseAdd` custom-id validation.

---

## Warnings

### WR-01: `parseInt` called without explicit radix on decimal phase strings

**File:** `sdk/src/query/phase-lifecycle.ts:747`
**Issue:** The decimal renaming code splits a decimal phase identifier (e.g. `"10.1"`) on `.` and calls `parseInt` on the fractional part. Both calls omit the radix argument, which is benign today but relies on engine defaulting to base-10. More critically, the normalised phase string fed into `parseInt` at line 748 is the full non-decimal string `normalized`, so the second `parseInt(normalized, ...)` (line 748) does parse `"10"` correctly, but the first argument `normalized.split('.')[1]` at line 747 could return `undefined` if `normalizePhaseName` strips the dot, and `parseInt(undefined, 10)` returns `NaN`. If `NaN` is passed as `removedDecimal`, the `filter` in `renameDecimalPhases` (`item.oldDecimal > removedDecimal`) evaluates to `false` for every entry, silently skipping all renaming without error.

```typescript
// line 747
const renamed = isDecimal
  ? await renameDecimalPhases(
      phasesDir,
      normalized.split('.')[0],
      parseInt(normalized.split('.')[1], 10)  // could be NaN if split yields undefined
    )
```

**Fix:** Guard the split result before parsing, and throw if the decimal part is missing:
```typescript
const parts = normalized.split('.');
if (parts.length < 2) {
  throw new GSDError(`Invalid decimal phase identifier: ${targetPhase}`, ErrorClassification.Validation);
}
const decimalPart = parseInt(parts[1], 10);
if (isNaN(decimalPart)) {
  throw new GSDError(`Invalid decimal part in phase: ${targetPhase}`, ErrorClassification.Validation);
}
const renamed = await renameDecimalPhases(phasesDir, parts[0], decimalPart);
```

---

### WR-02: `dirName` possibly-undefined used after `readModifyWriteRoadmapMd` closure in `phaseAdd`

**File:** `sdk/src/query/phase-lifecycle.ts:210`
**Issue:** `dirName` is declared with `let dirName: string` (no initialiser) before the `readModifyWriteRoadmapMd` callback. TypeScript's strict mode accepts the non-null assertion `dirName!` at line 210 and 211 because the compiler cannot see through the async callback boundary — it does not prove `dirName` was assigned. If `readModifyWriteRoadmapMd`'s modifier throws before reaching the assignment (e.g. the `mkdir` inside the callback fails after the `if/else` branch but before assignment), `dirName` remains `undefined` at line 210, and `join(planningPaths(projectDir).phases, dirName!)` constructs a path ending with `"undefined"`, silently returning incorrect data instead of throwing.

```typescript
// line 155-213 (abbreviated)
let dirName: string;         // uninitialised
await readModifyWriteRoadmapMd(projectDir, async (rawContent) => {
  // ... dirName = ... (assigned inside callback)
});
// line 210 — uses dirName! without proof it was assigned
directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir).phases, dirName!))),
```

**Fix:** Initialise `dirName` to `''` or extract the result value from the callback return rather than relying on closure mutation:
```typescript
let dirName = '';
// ... inside callback: dirName = computed value
// After callback:
if (!dirName) {
  throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);
}
```
The same pattern applies to `newPhaseId` (line 155 and 206) and `decimalPhase`/`dirName` in `phaseInsert` (lines 241-242, 322-326).

---

### WR-03: `phaseAdd` custom-id branch silently accepts empty string for `newPhaseId`

**File:** `sdk/src/query/phase-lifecycle.ts:163`
**Issue:** When `config.phase_naming === 'custom'` and `customId` is falsy (e.g. an empty string `""`), the assignment on line 163 evaluates `customId || slug.toUpperCase().replace(/-/g, '-')`. If the slug itself is also empty (e.g. description is all punctuation), `newPhaseId` becomes `""`. The subsequent check `if (!newPhaseId)` on line 164 would catch this, but the slug replacement expression `slug.toUpperCase().replace(/-/g, '-')` is a no-op (replaces dashes with dashes) suggesting a copy-paste error — it likely should convert to underscores or some other format, but that is unclear.

```typescript
// line 163
newPhaseId = customId || slug.toUpperCase().replace(/-/g, '-');  // replaces '-' with '-'
```

**Fix:** Clarify intent. If the fallback slug is the intended custom-id source, replace dashes with underscores for a more useful identifier:
```typescript
newPhaseId = customId || slug.toUpperCase().replace(/-/g, '_');
```
Or remove the fallback entirely and always require `customId` when `phase_naming === 'custom'`:
```typescript
newPhaseId = customId;
if (!newPhaseId) {
  throw new GSDError('--id required when phase_naming is "custom"', ErrorClassification.Validation);
}
```

---

### WR-04: ROADMAP renumbering regex in `updateRoadmapAfterPhaseRemoval` does not match `**Depends on:**` with non-standard spacing

**File:** `sdk/src/query/phase-lifecycle.ts:678`
**Issue:** The "depends on" renumbering regex is:
```
(Depends on:\*\*\s*Phase\s+)${escapeRegex(oldStr)}\b
```
This pattern requires the literal characters `Depends on:**` — i.e. the markdown bold closing `**` must appear immediately after the colon with no space. But the canonical ROADMAP.md format (as seen in test fixtures throughout the file) writes:
```
**Depends on:** Phase N
```
The bold markers wrap the entire `Depends on:` label, so the closing `**` appears before `Phase`, not after `on:`. The pattern will never match in practice, silently leaving `Depends on:` references pointing at stale phase numbers after a removal + renumber.

```typescript
// line 678
content = content.replace(
  new RegExp(`(Depends on:\\*\\*\\s*Phase\\s+)${escapeRegex(oldStr)}\\b`, 'gi'),
  `$1${newStr}`,
);
```

**Fix:** Correct the regex to match the actual markdown format:
```typescript
content = content.replace(
  new RegExp(`(\\*\\*Depends on:\\*\\*\\s*Phase\\s+)${escapeRegex(oldStr)}\\b`, 'gi'),
  `$1${newStr}`,
);
```

---

## Info

### IN-01: Unreachable `default` branch in `phaseScaffold` switch

**File:** `sdk/src/query/phase-lifecycle.ts:452`
**Issue:** The `switch (type)` statement is guarded by a `validTypes` set check at line 386 which throws for any unrecognised type. The `default` branch at line 452 (`throw new GSDError(...)`) is therefore unreachable. This is dead code and could mislead readers into thinking the guard above is insufficient.

**Fix:** Remove the dead `default` branch, or replace it with an exhaustive TypeScript assertion:
```typescript
default:
  // This branch is unreachable — validTypes guard above prevents unknown types.
  const _never: never = type as never;
  throw new GSDError(`Unknown scaffold type: ${_never}`, ErrorClassification.Validation);
```
Or simply delete lines 452-453 since the guard already handles this.

---

### IN-02: Magic constant `99` in `updateRoadmapAfterPhaseRemoval`

**File:** `sdk/src/query/phase-lifecycle.ts:644`
**Issue:** `const MAX_PHASE = 99` is used as the upper bound for ROADMAP renumbering. This is a porting artifact from the `.cjs` source. Projects with more than 99 phases would silently not renumber high-numbered phases. While this limit is probably sufficient for current use, an undocumented magic number in a critical renaming loop merits a named constant with a comment.

```typescript
const MAX_PHASE = 99;  // no comment explaining why 99
```

**Fix:** Add a constant at module scope with documentation:
```typescript
/** Maximum phase number considered when renumbering sequential phases after removal. */
const MAX_RENUMBER_PHASE = 999;
```
Or at minimum add an inline comment:
```typescript
const MAX_PHASE = 99; // increase if projects exceed 99 sequential phases
```

---

### IN-03: `phasesClear` redundant `Array.isArray` check

**File:** `sdk/src/query/phase-lifecycle.ts:1200`
**Issue:** The `QueryHandler` type contract already guarantees `args` is `string[]`. The `Array.isArray(args)` check at line 1200 is therefore always `true` and exists only as a defensive pattern not needed for this interface.

```typescript
const confirm = Array.isArray(args) && args.includes('--confirm');
```

**Fix:** Simplify to:
```typescript
const confirm = args.includes('--confirm');
```

---

_Reviewed: 2026-04-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
