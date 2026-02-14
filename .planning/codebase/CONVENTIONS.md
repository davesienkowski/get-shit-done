# Coding Conventions

**Analysis Date:** 2026-02-13

## Naming Patterns

**Files:**
- Kebab-case for all file names: `gsd-tools.js`, `bundle-builder.js`, `check-syntax.js`, `install.js`
- Test files use `.test.js` suffix: `gsd-tools.test.js`
- Utility scripts at root level for build/check functions: `bundle-builder.js`, `check-braces.js`, `resolve-conflicts.js`

**Functions:**
- camelCase for all function names
- Prefix-based organization:
  - `cmd*` for CLI command handlers: `cmdStateLoad()`, `cmdHistoryDigest()`, `cmdConfigValidate()`
  - Helper functions use descriptive names without prefix: `safeReadFile()`, `atomicWrite()`, `lockedFileUpdate()`
  - Validation functions use `validate*` or `is*`: `validateField()`, `isGitIgnored()`
  - Parsing functions use `parse*` or `extract*`: `parseIncludeFlag()`, `extractFrontmatter()`

**Variables:**
- camelCase for variable names: `selectedRuntimes`, `tmpDir`, `lockFd`, `filePath`
- Boolean variables use `has*`, `is*`, `can*` prefixes: `hasGlobal`, `lockAcquired`, `inConflict`
- Underscore prefix for ignored/unused variables: `_e`, `_statErr`, `_cleanupErr`
- Constants use UPPER_SNAKE_CASE: `MODEL_PROFILES`, `TOOLS_PATH`
- Single-letter variables allowed only in loops and well-scoped contexts

**Types/Interfaces:**
- Objects representing structured data use camelCase keys: `{ success, error, output }`, `{ exitCode, stdout, stderr }`
- Nested objects preserve structure: `{ success: boolean, content?, error? }`
- No TypeScript/JSDoc type annotations in main code (Node.js pure JavaScript)

## Code Style

**Formatting:**
- No automatic formatter detected (no .prettierrc, eslint config found)
- Manual formatting standards observed:
  - 2-space indentation throughout
  - Lines typically kept under 100 characters (observed in main files)
  - No semicolons required but widely used
  - Single quotes for strings (dominant pattern in codebase)

**Linting:**
- No eslint configuration detected
- Manual style enforcement through code review

**Spacing:**
- One blank line between function definitions
- Two blank lines before major section headers (marked with `// ─── `
- No blank lines at start/end of functions
- Spaces around operators: `a = b`, `a === b`

## Import Organization

**Order:**
1. Node.js built-in modules first: `fs`, `path`, `os`, `readline`, `crypto`, `child_process`
2. No external npm dependencies in core files (package.json has no dependencies)
3. Local requires last (if any)

**Path Style:**
- Relative imports using `require()` for local modules
- Absolute file paths using `path.join()` for filesystem operations
- No path aliases or module mapping

**Example from `gsd-tools.js`:**
```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
```

## Error Handling

**Patterns:**
- Explicit try-catch blocks with error recovery
- Functions return result objects: `{ success: boolean, error?: string, ... }`
- Errors passed to `output()` helper for CLI display: `output({ error: 'message' }, raw)`
- Graceful degradation: non-fatal errors logged but execution continues

**Error Object Pattern:**
```javascript
// Failure case
return { success: false, error: e.message };

// Success with data
return { success: true, content: newContent };
```

**File operation error handling (from `atomicWrite()`):**
```javascript
// Atomic writes with backup and restore on failure
const tmpPath = filePath + '.tmp';
const bakPath = filePath + '.bak';
// Write to temp, backup original, rename atomically
// On failure, restore from backup
```

**Lock contention handling (from `lockedFileUpdate()`):**
```javascript
// Acquire lock with retries and exponential backoff
// Check for stale locks (older than timeoutMs)
// Release lock in finally block
```

## Logging

**Framework:** `console` module (no logging framework detected)

**Patterns:**
- No explicit logging calls in main tools (output routing through `output()` helper)
- Helper functions `output()` and `error()` handle all CLI messaging
- Color codes for CLI output: `cyan`, `green`, `yellow`, `dim`, `reset` (used in `install.js`)
- `execSync` calls use `stdio: ['pipe', 'pipe', 'pipe']` to suppress output (unless needed)

**Output helpers (from `gsd-tools.js`):**
```javascript
function output(result, raw, rawValue) {
  if (raw) {
    if (rawValue !== undefined) return process.stdout.write(rawValue);
    if (typeof result !== 'object') return process.stdout.write(result);
    return process.stdout.write(JSON.stringify(result));
  }
  return console.log(JSON.stringify(result, null, 2));
}

function error(message) {
  console.error(message);
  process.exit(1);
}
```

## Comments

**When to Comment:**
- Section headers use decorated ASCII lines: `// ─── Helpers ────────────────────────`
- Block comments before complex logic: parsing, locking, conflict resolution
- Inline comments for non-obvious algorithm steps
- No comments for self-documenting code

**JSDoc/TSDoc:**
- JSDoc used selectively for public/complex functions
- Pattern: `@param {type} name - description` and `@returns {type} description`
- Applied to: `atomicWrite()`, `lockedFileUpdate()`, `execGitRetry()`, `validateField()`

**Example:**
```javascript
/**
 * Write content to a file atomically: write to .tmp, backup original to .bak,
 * rename .tmp over original. On failure, restore from .bak if available.
 *
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @returns {{success: boolean, error?: string}} Result
 */
function atomicWrite(filePath, content) {
```

## Function Design

**Size:**
- Wide range observed: 10-50 lines typical for helpers, 100+ lines for complex command handlers
- Largest files: `gsd-tools.js` (6631 lines), `install.js` (1914 lines)
- Long functions consolidated at end of file with heavy comments

**Parameters:**
- Minimal parameters (1-3 typical): `function output(result, raw, rawValue)`
- Complex state passed as options objects: `opts = { retries, retryDelayMs, timeoutMs }`
- `cwd` (current working directory) standard first parameter for commands
- `raw` flag for output format control (JSON vs. pretty)

**Return Values:**
- Consistent pattern for operations: `{ success: boolean, error?: string, ...data }`
- Void functions used for CLI-side effects (calling `output()` or `error()`)
- No null/undefined returns in critical paths (use error objects instead)

## Module Design

**Exports:**
- Single monolithic file pattern: `gsd-tools.js` exports nothing (CLI tool only, entry point via `main()`)
- Helper functions defined in same file, no internal exports
- Executable scripts use `#!/usr/bin/env node` shebang

**Organization:**
- Section headers with ASCII decoration divide file into logical regions
- Helper functions early (lines 200-700 in `gsd-tools.js`)
- Command handlers mid-file (lines 700-2000)
- Main switch statement at end (lines 6400+)
- Call to `main()` at very end

**Barrel Files:**
- Not used in this codebase
- All files are self-contained or CLI entrypoints

## Conditional and Loop Patterns

**Short circuit early returns:**
```javascript
if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
if (!text) { output({ error: 'text required' }, raw); return; }
```

**Switch statements for command routing:**
```javascript
switch (command) {
  case 'state': {
    const subCmd = args[1];
    switch (subCmd) {
      case 'load': cmdStateLoad(cwd, raw); break;
      // ...
    }
    break;
  }
}
```

**Ternary operators for simple selections:**
```javascript
const selectedRuntimes = hasAll ? ['claude', 'opencode', 'gemini'] : [];
const runtime = runtime === 'opencode' ? 'OpenCode' : 'Claude';
```

## Special Patterns

**Atomic file operations:**
- Write to temporary file first
- Backup original before rename
- Atomic rename (single system call)
- Restore from backup on failure
- Location: `atomicWrite()` function

**File locking:**
- Exclusive lock via `fs.openSync(lockPath, 'wx')` (write exclusive)
- Retry logic with exponential backoff
- Stale lock detection (timeout-based)
- PID written to lock file for debugging
- Location: `lockedFileUpdate()` function

**Conflict resolution:**
- Keep-both strategy for merged files
- Automatic brace balancing for JavaScript case statements
- Marker stripping (remove `<<<<<<`, `======`, `>>>>>>>`)
- File-specific merge strategies in `bundle-builder.js`

## Variable Scope

**Module scope:**
- Configuration objects at top: `MODEL_PROFILES`, `colorNameToHex`, `claudeToOpencodeTools`
- Built-in module requires at top
- Helper functions defined before use
- `main()` function at very end

**Function scope:**
- Variables declared with `const` (no `let` or `var` observed)
- Minimal variable hoisting
- Lock file descriptors stored in try block scope for cleanup

## Code Reuse

**Shared patterns:**
- Repeated `if (!fs.existsSync(path)) { output({ error: 'not found' }, raw); return; }` pattern (could be helper)
- `parseIncludeFlag()` used across multiple command handlers
- `safeReadFile()` wraps all file reads with try-catch
- `lockedFileUpdate()` used for all STATE.md modifications

**No utility files:**
- All utilities co-located in same file with command handlers
- Monolithic design simplifies deployment (single file copy)

---

*Convention analysis: 2026-02-13*
