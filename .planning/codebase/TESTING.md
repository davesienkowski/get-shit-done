# Testing Patterns

**Analysis Date:** 2026-02-13

## Test Framework

**Runner:**
- Node.js built-in `test` module (Node 18.13+)
- No external test framework dependencies
- Import: `const { test, describe, beforeEach, afterEach } = require('node:test');`

**Assertion Library:**
- Node.js built-in `assert` module
- Import: `const assert = require('node:assert');`

**Run Commands:**
```bash
npm test                    # Run all tests (runs gsd-tools.test.js)
node gsd-tools.test.js      # Run tests directly
```

**Package.json test script:**
```json
"test": "node --test get-shit-done/bin/gsd-tools.test.js"
```

## Test File Organization

**Location:**
- Co-located with source: `get-shit-done/bin/gsd-tools.test.js` tests `get-shit-done/bin/gsd-tools.js`
- Single test file for entire codebase
- Test file located immediately adjacent to implementation

**Naming:**
- Pattern: `{source-file}.test.js`
- Example: `gsd-tools.test.js` tests `gsd-tools.js`

**Structure:**
```
get-shit-done/bin/
├── gsd-tools.js
└── gsd-tools.test.js
```

## Test Structure

**Suite Organization:**
```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
  });

  test('nested frontmatter fields extracted correctly', () => {
    // Arrange: create test file structure
    // Act: run tool
    // Assert: validate output
  });
});
```

**Patterns:**
- Setup via `beforeEach()`: Create temporary project directory
- Teardown via `afterEach()`: Recursively delete temp directory
- Test organization: One logical concern per test
- Descriptive test names as sentences: `'empty phases directory returns valid schema'`

## Helper Functions

**Test infrastructure helpers (from `gsd-tools.test.js`):**

```javascript
// Execute gsd-tools command and capture output
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temporary project with directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Clean up temporary directory
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

## Mocking

**Framework:** None detected (no mocking library in dependencies)

**Patterns:**
- No mocking of external services or modules
- Isolated via temporary filesystem: tests create temp directories with `fs.mkdtempSync()`
- Test isolation: each test gets fresh temp directory via `beforeEach()`
- Command invocation via `execSync()` executes real tool code

**Implicit mocking approach:**
- Actual `gsd-tools.js` executed (not mocked)
- Tool operates on temporary project structure (isolated from real files)
- No stubbing of `fs` or `path` modules
- Real file I/O operations tested

## Fixtures and Test Data

**Test Data:**
Generated inline within test functions. Example from `nested frontmatter fields extracted correctly`:

```javascript
const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
fs.mkdirSync(phaseDir, { recursive: true });

const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
  - "JWT auth flow"
key-decisions:
  - "Use Prisma over Drizzle"
  - "JWT in httpOnly cookies"
---

# Summary content here
`;

fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);
```

**Location:**
- No separate fixtures directory
- Test data created directly in test functions within temp directories
- Enables each test to define exact file structure needed

**Fixture Patterns:**
- YAML frontmatter content embedded as template strings
- Multiple test files per phase for complex scenarios
- Inline array syntax and multiline syntax both tested

## Coverage

**Requirements:** No coverage enforcement detected

**View Coverage:**
- Not currently configured
- No `--coverage` flag in test script
- No coverage reporters in dependencies

**Coverage Approach:**
- Tests focus on command handlers and integration (via `execSync`)
- Test suites created for discrete features: `history-digest`, `phases list`, etc.
- Complex unit functions (`extractFrontmatter`, `validateField`) indirectly tested via command tests

## Test Types

**Unit Tests:**
- Scope: Individual command handlers tested via CLI invocation
- Approach: Execute `gsd-tools` with test args in isolated temp directory
- Example: `cmdHistoryDigest()` tested by running `history-digest` command with various frontmatter structures
- Benefits: Real filesystem I/O, no mocking complexity

**Integration Tests:**
- Scope: Multiple commands, tool behavior end-to-end
- Approach: Create project structure, run commands, verify output
- Example: `override add` command integration test creates override file, validates list command reads it

**E2E Tests:**
- Not explicitly separated from integration tests
- All tests operate on real filesystem in isolated temp directories
- Full tool execution path tested

**No UI/Snapshot Tests:**
- Tool is CLI-based
- JSON output validated via `JSON.parse()` and assertions
- String output validated via regex or substring matching

## Test Execution Patterns

**Async Testing:**
Not applicable — all tests are synchronous

**Error Testing:**
```javascript
test('override add without required args fails', () => {
  const result = runGsdTools('override add', tmpDir);
  assert.ok(!result.success, 'should fail without args');
});

test('override add blocks duplicates', () => {
  // Add first
  runGsdTools('override add --must-have "Test A" --reason "Reason A"', tmpDir);

  // Add duplicate should fail
  const result = runGsdTools('override add --must-have "Test A" --reason "Different reason"', tmpDir);
  assert.ok(!result.success, 'duplicate should fail');
  assert.ok(result.error.includes('already exists'), 'error should mention already exists');
});
```

**Backward Compatibility Testing:**
```javascript
test('flat provides field still works (backward compatibility)', () => {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
  fs.mkdirSync(phaseDir, { recursive: true });

  fs.writeFileSync(
    path.join(phaseDir, '01-01-SUMMARY.md'),
    `---
phase: "01"
provides:
  - "Direct provides"
---
`
  );

  const result = runGsdTools('history-digest', tmpDir);
  assert.ok(result.success);
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(digest.phases['01'].provides, ['Direct provides']);
});
```

**Array Syntax Variations Testing:**
```javascript
test('inline array syntax supported', () => {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
  fs.mkdirSync(phaseDir, { recursive: true });

  fs.writeFileSync(
    path.join(phaseDir, '01-01-SUMMARY.md'),
    `---
phase: "01"
provides: [Feature A, Feature B]
patterns-established: ["Pattern X", "Pattern Y"]
---
`
  );

  const result = runGsdTools('history-digest', tmpDir);
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(digest.phases['01'].provides.sort(), ['Feature A', 'Feature B']);
});
```

## Common Assertions

**Success/Failure checks:**
```javascript
assert.ok(result.success, `Command failed: ${result.error}`);
assert.ok(!result.success, 'should fail');
```

**Object equality:**
```javascript
assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
assert.deepStrictEqual(digest.phases['01'].provides, ['Feature A', 'Feature B']);
```

**Array length:**
```javascript
assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions');
```

**Array membership:**
```javascript
assert.ok(
  digest.decisions.some(d => d.decision === 'Use Prisma over Drizzle'),
  'Should contain first decision'
);
```

**String matching:**
```javascript
assert.ok(result.error.includes('already exists'), 'error should mention already exists');
```

## Test Coverage Areas

**Tested Commands:**
- `history-digest` — Frontmatter extraction, nested fields, multiple phases, malformed YAML handling
- `phases list` — Directory scanning, phase ordering
- `override add/list/remove` — Create, read, delete operations; duplicate prevention; nonexistent removal
- `state` subcommands — Load, get, patch operations

**Tested Scenarios:**
- Empty directory returns valid schema
- Nested YAML fields extracted correctly
- Multiple phases merged into single digest
- Malformed SUMMARY.md files skipped gracefully
- Backward compatibility with old field formats
- Both multiline and inline array syntax supported
- Duplicate prevention
- Nonexistent item removal
- Missing required arguments

**Not Tested:**
- Git integration (e.g., `state update`, commits)
- Brave Search API integration
- Email/alert functionality
- File locking contention (lock timeout behavior)
- Model profile resolution
- Build processes

## Running Tests Locally

```bash
# Run all tests
npm test

# Run with verbose output (if test runner supports)
node --test get-shit-done/bin/gsd-tools.test.js

# Run specific test file
node get-shit-done/bin/gsd-tools.test.js
```

## Test Isolation

**Temporary Directory Pattern:**
Each test gets isolated filesystem:
- `createTempProject()` generates unique temp dir: `/tmp/gsd-test-{random}/`
- `cleanup()` removes directory in `afterEach()`
- No shared state between tests
- No side effects on actual `.planning/` directory

**Process Isolation:**
- Each test spawns new Node.js process via `execSync()`
- Actual `gsd-tools.js` code executed, not imported/mocked
- No in-memory state pollution

---

*Testing analysis: 2026-02-13*
