---
phase: 11-state-mutations
fixed_at: 2026-04-08T00:00:00Z
review_path: .planning/phases/11-state-mutations/11-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-08
**Source review:** .planning/phases/11-state-mutations/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Double-read race condition in `stateAdvancePlan`

**Files modified:** `sdk/src/query/state-mutation.ts`
**Commit:** 308195a
**Applied fix:** Moved the initial file read and plan-number parsing logic inside the `readModifyWriteStateMd` callback so that both read and write happen under the same lock. The modifier callback now receives the body (frontmatter already stripped by `readModifyWriteStateMd`), which also fixes the IN-04 concern about operating on raw content with frontmatter. Error cases return the unmodified content and set the result object accordingly.

### WR-02: Missing path traversal guard in `frontmatterMerge`

**Files modified:** `sdk/src/query/frontmatter-mutation.ts`
**Commit:** 22da617
**Applied fix:** Added null-byte path traversal guard (`filePath.includes('\0')`) to both `frontmatterMerge` and `frontmatterValidate`, consistent with the existing guard in `frontmatterSet`.

### WR-03: Config JSON write has no atomic safety

**Files modified:** `sdk/src/query/config-mutation.ts`
**Commit:** d1a6cb7
**Applied fix:** Added `rename` to the `node:fs/promises` import and introduced an `atomicWriteConfig` helper that writes to a `.tmp` file then renames atomically. Replaced all 4 direct `writeFile` calls in `configSet`, `configSetModelProfile`, `configNewProject`, and `configEnsureSection` with the new helper.

### WR-04: `sanitizeCommitMessage` silently returns falsy input unchanged

**Files modified:** `sdk/src/query/commit.ts`
**Commit:** 16cdc17
**Applied fix:** Changed the early return from `return text` (which could return `null`, `undefined`, or `0`) to `return ''`, ensuring the function always returns a string as its type signature promises.

---

_Fixed: 2026-04-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
