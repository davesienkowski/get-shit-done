---
phase: 10-read-only-queries
reviewed: 2026-04-07T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - sdk/src/query/helpers.ts
  - sdk/src/query/helpers.test.ts
  - sdk/src/query/frontmatter.ts
  - sdk/src/query/frontmatter.test.ts
  - sdk/src/query/config-query.ts
  - sdk/src/query/config-query.test.ts
  - sdk/src/query/state.ts
  - sdk/src/query/state.test.ts
  - sdk/src/query/phase.ts
  - sdk/src/query/phase.test.ts
  - sdk/src/query/roadmap.ts
  - sdk/src/query/roadmap.test.ts
  - sdk/src/query/progress.ts
  - sdk/src/query/progress.test.ts
  - sdk/src/query/index.ts
  - sdk/src/golden/golden.integration.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the full Phase 10 query module — helpers, frontmatter parser, config-query, state, phase, roadmap, progress, the registry index, and the golden integration test suite. The overall implementation is solid: consistent error handling via `GSDError`, read-only design, POSIX path normalization, and good test coverage.

Four warnings were found. The most impactful are an unguarded `JSON.parse` call in `configGet` that will throw an unclassified `SyntaxError` on malformed config, and a `parseInt` call in `stateSnapshot` that silently produces `NaN` for the typical GSD progress-bar format (`[████░░░░░░] 40%`). A roadmap section-boundary detection regex excludes custom-ID phases, causing section bleed-over. A fourth warning covers a code-duplication issue — `getMilestoneInfo` and `extractCurrentMilestone` are implemented identically in both `state.ts` and `roadmap.ts`, which creates a maintenance hazard.

Five info items cover minor code quality issues: a `phaseNum` extraction gap in `progressJson` for project-code-prefixed directories, an inconsistency in the prefix-stripping regex case sensitivity, a misleading variable name in the golden test, non-idiomatic bare `SUMMARY.md` matching edge cases, and the non-deterministic `last_updated` field in state output.

---

## Warnings

### WR-01: `JSON.parse` in `configGet` is unguarded — throws raw `SyntaxError` on malformed config

**File:** `sdk/src/query/config-query.ts:82`
**Issue:** `JSON.parse(raw)` has no try/catch. If `.planning/config.json` contains invalid JSON (e.g., from a partial write or manual edit), this throws a native `SyntaxError` instead of a `GSDError`. Callers expecting `GSDError` for all failure modes will receive an unclassified exception, bypassing any exit-code mapping.
**Fix:**
```typescript
let config: Record<string, unknown>;
try {
  config = JSON.parse(raw) as Record<string, unknown>;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  throw new GSDError(`config.json is not valid JSON: ${msg}`, ErrorClassification.Execution);
}
```

---

### WR-02: `stateSnapshot` produces `NaN` for `progress_percent` with the standard GSD progress-bar format

**File:** `sdk/src/query/state.ts:424`
**Issue:** `parseInt(progressRaw.replace('%', ''), 10)` assumes `progressRaw` is a bare percentage like `"40%"`. The actual GSD STATE.md format writes progress as `[████░░░░░░] 40%`. After `.replace('%', '')` the string is `[████░░░░░░] 40`, and `parseInt` on a string starting with `[` returns `NaN`. The `stateSnapshot` result will then contain `progress_percent: NaN`, which silently breaks any downstream numeric comparison.
**Fix:**
```typescript
const pctMatch = progressRaw.match(/(\d+)%/);
const progressPercent = pctMatch ? parseInt(pctMatch[1], 10) : null;
```
This is the same approach already used correctly in `buildStateFrontmatter` (line 243 of `state.ts`).

---

### WR-03: Roadmap section-end detection in `searchPhaseInContent` and `roadmapAnalyze` misses custom-ID phases

**File:** `sdk/src/query/roadmap.ts:200` and `sdk/src/query/roadmap.ts:308`
**Issue:** Both locations use the pattern `\n#{2,4}\s+Phase\s+\d` to find the start of the next phase section. The `\d` anchors detection to numerically-identified phases. A custom-ID phase section like `### Phase AUTH: Authentication` or `### Phase PROJ-42: Migration` is not recognized as a boundary, so the extracted section for the preceding phase will include all text through the next numerically-identified phase or end of file. This produces incorrect `section`, `goal`, and `success_criteria` values.
**Fix:**
```typescript
// Before (line 200):
const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);

// After:
const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+[\w]/i);
```
Apply the same change to the equivalent line 308 in `roadmapAnalyze`.

---

### WR-04: `getMilestoneInfo` and `extractCurrentMilestone` are duplicated between `state.ts` and `roadmap.ts`

**File:** `sdk/src/query/state.ts:43-133` and `sdk/src/query/roadmap.ts:63-157`
**Issue:** Both modules contain private/internal copies of `getMilestoneInfo` and `extractCurrentMilestone` that are byte-for-byte identical. A bug fix or behavior change in one will silently not apply to the other. `roadmap.ts` already exports these functions — `state.ts` should import them from there instead.
**Fix:** In `state.ts`, remove the private implementations and import from `roadmap.ts`:
```typescript
// Remove the two private functions from state.ts and add:
import { getMilestoneInfo, extractCurrentMilestone } from './roadmap.js';
```
The existing `roadmap.ts` exports are already public, so no change is needed in that file.

---

## Info

### IN-01: `progressJson` does not extract the phase number from project-code-prefixed directories

**File:** `sdk/src/query/progress.ts:86-88`
**Issue:** The directory-name regex `^(\d+(?:\.\d+)*)-?(.*)` only matches pure-numeric phase directories like `01-foundation`. A directory named `CK-01-authentication` produces `phaseNum = 'CK-01-authentication'` (the full name) rather than `CK-01`. All other handlers (`findPhase`, `comparePhaseNum`) account for this prefix form; `progressJson` does not.
**Fix:**
```typescript
// Replace the current dm regex with one that handles optional project-code prefix:
const dm = dir.match(/^(?:[A-Z]{1,6}-)?(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
```

---

### IN-02: `normalizePhaseName` strips only uppercase project-code prefixes; `phaseTokenMatches` strips case-insensitively

**File:** `sdk/src/query/helpers.ts:61` vs `sdk/src/query/helpers.ts:156`
**Issue:** `normalizePhaseName` uses `/^[A-Z]{1,6}-(?=\d)/` (no `i` flag — uppercase only). `phaseTokenMatches` uses `/^[A-Z]{1,6}-(?=\d)/i` (case-insensitive). If a project code happens to be lowercase (e.g., `ck-01`), `phaseTokenMatches` will strip it and match correctly, but `normalizePhaseName` will return `ck-01` verbatim rather than `01`. The inconsistency is low-risk in practice since project codes are convention-uppercase.
**Fix:** Add the `i` flag to the prefix regex in `normalizePhaseName`:
```typescript
const stripped = str.replace(/^[A-Z]{1,6}-(?=\d)/i, '');
```

---

### IN-03: Golden test uses `PROJECT_DIR` (sdk package root) for handlers that only accept `REPO_ROOT`

**File:** `sdk/src/golden/golden.integration.test.ts:9-10`
**Issue:** `PROJECT_DIR` resolves to the `sdk/` subdirectory (two levels above `__dirname`), not the repo root. It is used for `generate-slug` and `current-timestamp` tests, which ignore the `projectDir` argument entirely and so work correctly. However, the naming `PROJECT_DIR` implies it points to the project root, which could mislead future contributors into passing it to handlers that _do_ read from `projectDir` (e.g., adding a `config-get` test using `PROJECT_DIR` would silently fail to find `.planning/`).
**Fix:** Rename for clarity:
```typescript
const SDK_DIR = resolve(__dirname, '..', '..');   // sdk package root (used for pure handlers)
const REPO_ROOT = resolve(__dirname, '..', '..', '..'); // repo root with .planning/
```

---

### IN-04: Commented-out import note left in `state.test.ts`

**File:** `sdk/src/query/state.test.ts:13`
**Issue:** Line 13 reads `// Will be imported once implemented` — a leftover planning comment that no longer applies since the module is now implemented and imported on line 14.
**Fix:** Remove the comment.

---

### IN-05: `determinePhaseStatus` reads only the first verification file when multiple exist

**File:** `sdk/src/query/progress.ts:43`
**Issue:** `files.find(...)` returns the first lexicographic match. If a phase directory contains multiple verification files (e.g., `09-01-VERIFICATION.md` and `09-VERIFICATION.md`), only one is read. The status derived may not represent the overall phase verification state. This is a low-probability edge case but worth documenting.
**Fix:** If multi-plan verification is a supported pattern, prefer the phase-level `XX-VERIFICATION.md` file over plan-level ones, or read all and take the most conservative status. At minimum, add a comment noting the single-file assumption.

---

_Reviewed: 2026-04-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
