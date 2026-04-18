---
phase: 11-state-mutations
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 17
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
  - sdk/src/query/state-mutation.test.ts
  - sdk/src/query/frontmatter-mutation.test.ts
  - sdk/src/query/config-mutation.test.ts
  - sdk/src/query/commit.test.ts
  - sdk/src/query/template.test.ts
  - sdk/src/query/helpers.test.ts
  - sdk/src/golden/golden.integration.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase implements STATE.md mutation handlers, frontmatter mutations, config mutations, git commit handlers, template helpers, and wires them all into the `QueryRegistry` with event emission. The code is well-structured, follows project conventions consistently, and the test coverage is solid. No critical security vulnerabilities or data-loss bugs were found.

Four warnings were identified: a double-read race condition in `stateAdvancePlan`, a path traversal gap in `frontmatterMerge`, a potential partial-write data loss in `configSet`/`configSetModelProfile`, and a `sanitizeCommitMessage` no-op on falsy input. Four info items cover minor quality issues.

## Warnings

### WR-01: Double-read race condition in `stateAdvancePlan`

**File:** `sdk/src/query/state-mutation.ts:382-449`

**Issue:** `stateAdvancePlan` reads STATE.md _outside_ the lock to parse `currentPlan`/`totalPlans`, then acquires the lock for the write. If two callers run concurrently, both could read the same plan number (e.g., `2 of 3`), both decide to advance, and both write `currentPlan = 3` — skipping one increment. All other mutation handlers use `readModifyWriteStateMd` for the full read-modify-write cycle under the lock.

**Fix:** Move the initial file read and plan-parsing logic inside `readModifyWriteStateMd` so it happens under the lock:

```typescript
export const stateAdvancePlan: QueryHandler = async (_args, projectDir) => {
  const today = new Date().toISOString().split('T')[0];
  let result: Record<string, unknown> = { error: 'STATE.md not found' };

  await readModifyWriteStateMd(projectDir, (content) => {
    const legacyPlan = stateExtractField(content, 'Current Plan');
    // ... rest of plan parsing and mutation logic ...
    return content;
  });

  return { data: result };
};
```

---

### WR-02: Missing path traversal guard in `frontmatterMerge`

**File:** `sdk/src/query/frontmatter-mutation.ts:210-239`

**Issue:** `frontmatterSet` checks for null bytes in the file path (line 177) as a path traversal guard. `frontmatterMerge` accepts the same `filePath` argument but performs no such check — it constructs `fullPath` directly without validation. An attacker-controlled path with directory traversal sequences (`../../../etc/passwd`) could reach files outside the project.

**Fix:** Add the same null-byte guard that `frontmatterSet` uses, or extract it into a shared helper:

```typescript
export const frontmatterMerge: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  const jsonString = args[1];

  if (!filePath || !jsonString) {
    throw new GSDError('file and data required', ErrorClassification.Validation);
  }

  // Add the same guard as frontmatterSet
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  const fullPath = isAbsolute(filePath) ? filePath : join(projectDir, filePath);
  // ...
};
```

Note: `frontmatterValidate` has the same omission. However, `frontmatterValidate` is read-only, so the risk there is lower.

---

### WR-03: Config JSON write has no atomic safety — partial write on failure

**File:** `sdk/src/query/config-mutation.ts:189-190`, `232`, `347`, `383`

**Issue:** All config-writing handlers (`configSet`, `configSetModelProfile`, `configNewProject`, `configEnsureSection`) use `writeFile` directly on `config.json` without a write-to-temp-then-rename pattern. If the process is killed mid-write, the config file will be truncated or corrupted with no recovery path. STATE.md uses a lockfile + full read-modify-write cycle for exactly this reason. Config mutations have no equivalent protection.

**Fix:** Write to a `.tmp` file first, then rename atomically:

```typescript
import { rename } from 'node:fs/promises';

const tmpPath = paths.config + '.tmp';
await writeFile(tmpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
await rename(tmpPath, paths.config);
```

This is a consistent pattern fix needed in all four write sites in `config-mutation.ts`.

---

### WR-04: `sanitizeCommitMessage` silently returns falsy input unchanged

**File:** `sdk/src/query/commit.ts:62`

**Issue:** The guard `if (!text || typeof text !== 'string') return text;` returns whatever was passed in when `text` is falsy — including `null`, `undefined`, or `0`. The return type is `string`, so callers receive a non-string without a type error. In the `commit` handler at line 128, `sanitized` is passed to `execGit` as a commit message. If `message` were somehow falsy (not guarded before this point), the git command would receive `undefined` as an argument.

The immediate caller does guard with `if (!message && !hasAmend)` at line 109, so this is not currently exploitable. But the defensive guard in `sanitizeCommitMessage` itself is misleading — it should either throw or return `''`.

**Fix:**
```typescript
export function sanitizeCommitMessage(text: string): string {
  if (!text) return '';
  // ... rest of sanitization
}
```

---

## Info

### IN-01: `stateResolveBlocker` sets `resolved: true` even when section not found

**File:** `sdk/src/query/state-mutation.ts:652-657`

**Issue:** `resolved` is initialized to `false` and set to `true` only if the blockers section is matched (line 651). However the return always returns `{ resolved }`, so when the section is absent, `resolved: false` is returned correctly. The logic is correct but the comment on line 646 says "Removes the first blocker line matching the search text" — there is no check that a matching line was actually removed. If `searchText` matches nothing in the section, `resolved: true` is still returned (the section matched, so `resolved` is set to `true` at line 651, but no line was actually removed).

**Fix:** Track whether at least one line was actually filtered out:

```typescript
const beforeCount = lines.filter(l => l.startsWith('- ')).length;
const filtered = lines.filter(line => { ... });
const afterCount = filtered.filter(l => l.startsWith('- ')).length;
resolved = afterCount < beforeCount;
```

---

### IN-02: `MUTATION_COMMANDS` includes `frontmatter.validate` and `template.select` which are read-only

**File:** `sdk/src/query/index.ts:59-67`

**Issue:** `MUTATION_COMMANDS` includes `frontmatter.validate` and `template.select`, which are pure read operations — they do not mutate any files. Including them causes mutation events (`FrontmatterMutation`, `TemplateFill`) to be emitted for operations that changed nothing, which may confuse consumers of the event stream.

**Fix:** Remove read-only commands from `MUTATION_COMMANDS`. `frontmatter.validate` should not emit a `FrontmatterMutation` event. `template.select` should not emit a `TemplateFill` event.

---

### IN-03: `needsQuoting` in `frontmatter-mutation.ts` does not cover all YAML quoting cases

**File:** `sdk/src/query/frontmatter-mutation.ts:116-118`

**Issue:** The `needsQuoting` helper only checks for `:` and `#`. Standard YAML requires quoting for values that start with `[`, `{`, `"`, `'`, `|`, `>`, `!`, `&`, `*`, `?`, `-`, `,`, or are boolean/null literals (`true`, `false`, `null`). At the top-level scalar path (lines 85-89) there is a separate check for `[` and `{`, but this is missing in the sub-key path (line 80) which only calls `needsQuoting`. A value like `"true"` at a nested key would be written unquoted as `key: true` and then parsed back as a boolean.

**Fix:** Extend `needsQuoting` to include the full set of YAML special prefixes and reserved words:

```typescript
function needsQuoting(s: string): boolean {
  if (s.includes(':') || s.includes('#')) return true;
  if (s.startsWith('[') || s.startsWith('{') || s.startsWith('>') || s.startsWith('|')) return true;
  if (s === 'true' || s === 'false' || s === 'null' || s === '~') return true;
  return false;
}
```

---

### IN-04: `stateAdvancePlan` reads the raw file (with frontmatter) for field extraction

**File:** `sdk/src/query/state-mutation.ts:390-394`

**Issue:** `stateAdvancePlan` calls `stateExtractField(fileContent, 'Current Plan')` on the full file content including YAML frontmatter (line 390-393). All other handlers strip frontmatter before operating on the body. Since `Current Plan` and `Plan` are body-level fields (not YAML keys), this works incidentally because the regex matches the body rather than the frontmatter. But a future STATE.md template that moves `current_plan` into the frontmatter YAML could cause a silent double-match. The pattern is inconsistent with the rest of the module.

**Fix:** Strip frontmatter before field extraction, consistent with the rest of the file:

```typescript
const { stripFrontmatter } = await import('./frontmatter.js'); // already imported
const body = stripFrontmatter(fileContent);
const legacyPlan = stateExtractField(body, 'Current Plan');
const legacyTotal = stateExtractField(body, 'Total Plans in Phase');
const planField = stateExtractField(body, 'Plan');
```

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
