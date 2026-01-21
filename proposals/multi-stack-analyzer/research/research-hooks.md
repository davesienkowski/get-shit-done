# GSD Hooks System Research

**Date:** 2026-01-20
**Research Focus:** Intel-related hooks and incremental update mechanisms

## Executive Summary

The GSD hooks system is a sophisticated event-driven architecture that maintains codebase intelligence incrementally. Three primary hooks manage the intelligence lifecycle:

1. **PostToolUse** hook (`gsd-intel-index.js`) - Updates intel on every tool use
2. **SessionStart** hook (`gsd-intel-session.js`) - Injects intel at session start
3. **Stop** hook (`gsd-intel-prune.js`) - Cleans stale entries at session end

Together, these enable continuous intelligence updates without requiring full reanalysis.

---

## 1. Hook Configuration

### Location
Global hooks are configured in: `~/.claude/settings.json`

### Hook Events Defined

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/gsd-check-update.js\""
      },
      {
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/gsd-intel-session.js\""
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/gsd-intel-index.js\""
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "node \"$HOME/.claude/hooks/gsd-intel-prune.js\""
      }
    ]
  }
}
```

### Available Hook Events
From Claude Code plugin documentation, the system supports:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution (used by intel system)
- `Stop` - Session end (used for pruning)
- `SubagentStop` - Subagent completion
- `SessionStart` - Session initialization (used for context injection)
- `SessionEnd` - Session cleanup
- `UserPromptSubmit` - After user input
- `PreCompact` - Before context compaction
- `Notification` - System notifications

---

## 2. Intel Hook Details

### 2.1 gsd-intel-session.js - SessionStart Hook

**Purpose:** Inject codebase intelligence at session start

**Execution Flow:**
1. Triggered on `SessionStart` event
2. Reads pre-generated summary from `.planning/intel/summary.md`
3. Wraps summary in `<codebase-intelligence>` tags
4. Outputs to Claude's context via stdout
5. Always exits with code 0 (silent failure if no intel exists)

**Key Features:**
- Non-blocking: Never fails or throws errors
- Conditional: Only injects if source is `startup` or `resume`
- Silent: Exits cleanly if summary doesn't exist
- Context-efficient: Reuses pre-generated summary (< 500 tokens)

**Slug Convention Used:**
- Path conversion for entity IDs: `/src/lib/db.ts` → `src-lib-db`

**Code Signature:**
```javascript
// Only inject on startup/resume
if (!['startup', 'resume'].includes(data.source)) {
  process.exit(0);
}

// Read pre-generated summary
const summaryPath = path.join(process.cwd(), '.planning', 'intel', 'summary.md');
if (fs.existsSync(summaryPath)) {
  const summary = fs.readFileSync(summaryPath, 'utf8').trim();
  if (summary) {
    process.stdout.write(`<codebase-intelligence>\n${summary}\n</codebase-intelligence>`);
  }
}
```

---

### 2.2 gsd-intel-index.js - PostToolUse Hook

**Purpose:** Maintain incremental codebase intelligence updates after each tool use

**Size:** 1.3MB (minified, built with embedded SQLite WASM runtime)

**Execution Flow:**
1. Triggered after every tool execution (`PostToolUse` event)
2. Receives session data via stdin
3. Performs incremental index updates
4. Syncs entities to graph.db (embedded SQLite database)
5. Updates conventions.json
6. Regenerates summary.md
7. Always exits with code 0

**Key Capabilities:**
- **Incremental indexing:** Only processes new/changed files
- **Graph database:** Maintains dependency relationships in graph.db
- **Entity synchronization:** Syncs .md files from `.planning/intel/entities/` to graph
- **Wiki-link parsing:** Extracts `[[slug]]` references for dependency edges
- **YAML frontmatter parsing:** Extracts type, status, path metadata
- **Query interface:** Supports `dependents` and `hotspots` queries

**Optimization Strategy:**
- Embedded SQLite for fast local queries (no external DB)
- WASM runtime (compiled into JS for portability)
- Incremental updates prevent full reanalysis
- Event-driven (runs after every tool, not on schedule)

**Graph Database Schema (inferred):**
- **Nodes:** Entity files with metadata (path, type, status)
- **Edges:** Dependency relationships from wiki-links
- **Queries:** `dependents(entity_id)`, `hotspots(limit)`

**Input Format (stdin):**
Receives JSON session data with tool information.

---

### 2.3 gsd-intel-prune.js - Stop Hook

**Purpose:** Clean stale entries from index when files are deleted

**Execution Flow:**
1. Triggered on session `Stop` event
2. Reads existing `.planning/intel/index.json`
3. Iterates through all indexed files
4. Uses `fs.existsSync()` to check if file still exists
5. Removes deleted entries from index
6. Updates index timestamp
7. Writes updated index back to disk
8. Always exits with code 0 (never blocks)

**Key Features:**
- **Fast:** Uses `fs.existsSync()` checks only (no file reading)
- **Silent:** Never errors, always returns 0
- **Minimal:** Only prunes index.json, not conventions/summary
- **Safe:** Doesn't fail if index doesn't exist yet

**Return Statistics:**
```javascript
return {
  pruned: deleted.length,
  total: filePaths.length
};
```

**Code Signature:**
```javascript
function pruneIndex() {
  const intelDir = path.join(process.cwd(), '.planning', 'intel');
  const indexPath = path.join(intelDir, 'index.json');

  if (!fs.existsSync(intelDir)) {
    return { pruned: 0, total: 0 };
  }

  // Read, filter deleted files, write back
  let index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const deleted = Object.keys(index.files)
    .filter(filePath => !fs.existsSync(filePath));

  for (const filePath of deleted) {
    delete index.files[filePath];
  }
  index.updated = Date.now();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}
```

---

### 2.4 gsd-check-update.js - SessionStart Update Check

**Purpose:** Background check for GSD updates

**Execution Flow:**
1. Triggered on `SessionStart` event
2. Spawns background Node.js process (non-blocking)
3. Checks project `.claude/get-shit-done/VERSION` first
4. Falls back to global `~/.claude/get-shit-done/VERSION`
5. Runs `npm view get-shit-done-cc version` to get latest
6. Writes result to `~/.claude/cache/gsd-update-check.json`
7. Main process exits immediately (fire-and-forget)

**Features:**
- **Non-blocking:** Uses `spawn()` with `windowsHide: true`
- **Timeout:** 10-second timeout on npm view
- **Silent:** Never fails or blocks Claude
- **Caching:** Result cached for statusline display

---

## 3. Intel Directory Structure

Created and maintained by the hooks and `/gsd:analyze-codebase`:

```
.planning/intel/
├── index.json              # File index (exports, imports, timestamps)
├── conventions.json        # Naming/directory patterns detected
├── summary.md             # < 500 token summary (injected at session start)
├── graph.db               # SQLite database (built by PostToolUse hook)
└── entities/              # Semantic entity files
    ├── src-lib-db.md
    ├── src-api-users.md
    └── ...
```

### index.json Schema

```json
{
  "version": 1,
  "updated": 1737360330000,
  "files": {
    "/absolute/path/to/file.js": {
      "exports": ["functionA", "ClassB"],
      "imports": ["react", "./utils"],
      "indexed": 1737360330000
    }
  }
}
```

### conventions.json Schema

```json
{
  "version": 1,
  "updated": 1737360330000,
  "naming": {
    "exports": {
      "dominant": "camelCase",
      "count": 42,
      "percentage": 85
    }
  },
  "directories": {
    "components": { "purpose": "UI components", "files": 15 }
  },
  "suffixes": {
    ".test.js": { "purpose": "Test files", "count": 12 }
  }
}
```

### Entity File Schema

```markdown
---
path: /absolute/path/to/file.ts
type: [module|component|util|config|api|hook|service|model|test]
updated: 2026-01-20
status: active
---

# filename

## Purpose

[1-3 sentences explaining what/why]

## Exports

- `functionName(params): ReturnType` - Description
- `ClassName` - What it represents

## Dependencies

- [[internal-file-slug]] - Why needed
- external-package - What it provides

## Used By

TBD
```

---

## 4. Incremental Update Mechanism

### Workflow

```
SessionStart
  ├─ gsd-check-update.js (background)
  └─ gsd-intel-session.js
      └─ Reads .planning/intel/summary.md
         └─ Injects <codebase-intelligence> to context

Tool Execution
  └─ Write entities to .planning/intel/entities/*.md

PostToolUse (after each tool)
  └─ gsd-intel-index.js
      ├─ Reads all written entity files
      ├─ Parses YAML frontmatter
      ├─ Extracts [[wiki-links]] for dependencies
      ├─ Syncs to graph.db (SQLite)
      ├─ Updates conventions.json
      └─ Regenerates summary.md

SessionStop
  └─ gsd-intel-prune.js
      ├─ Reads .planning/intel/index.json
      ├─ Checks fs.existsSync() for each file
      └─ Removes deleted entries
```

### Key Incremental Features

1. **Entity-driven:** Only index files that have been analyzed
2. **Hook-triggered:** Updates happen automatically (no manual refresh needed)
3. **Graph-based:** Dependencies tracked in SQLite for fast queries
4. **Lazy generation:** summary.md and conventions.json regenerated after writes
5. **Pruning:** Stale entries cleaned at session end

---

## 5. Integration with /gsd:analyze-codebase

### Initial Setup

`/gsd:analyze-codebase` command performs 9 steps:

1. **Create directory structure**
   ```bash
   mkdir -p .planning/intel
   ```

2. **Find all indexable files** (Glob patterns)
   - Languages: `.{js,ts,jsx,tsx,mjs,cjs}`
   - Excludes: `node_modules`, `dist`, `build`, `.git`, etc.

3. **Process each file**
   - Extract exports (named, default, CommonJS)
   - Extract imports (ES6, side-effect, CommonJS)
   - Store in index.json

4. **Detect conventions**
   - Naming: camelCase, PascalCase, snake_case (70%+ threshold)
   - Directory patterns: components, hooks, utils, services, etc.
   - Suffix patterns: .test, .service, .controller, .model, etc.

5. **Write index.json** - File exports/imports index

6. **Write conventions.json** - Detected patterns

7. **Generate summary.md** - Context injection summary (< 500 tokens)

8. **Report completion** - Statistics to user

9. **Generate semantic entities** (optional)
   - Spawns `gsd-entity-generator` subagent
   - Passes list of up to 50 priority files
   - Subagent reads each file and writes `.planning/intel/entities/{slug}.md`
   - **PostToolUse hook** automatically syncs entities to graph.db

### Continuous Updates via Hooks

After initial `/gsd:analyze-codebase`, incremental updates happen through:

1. **Entity generation:** When you create/modify files with entities
2. **PostToolUse hook:** Automatically syncs new entities to graph.db
3. **Graph queries:** Use `/gsd:query-intel dependents <file>` to check blast radius
4. **Summary refresh:** Regenerated after each entity sync

---

## 6. Graph Database Query Interface

### Supported Queries

The embedded SQLite graph.db supports two query types:

#### 1. Dependents Query
```bash
echo '{"action":"query","type":"dependents","target":"src-lib-db","limit":20}' | node gsd-intel-index.js
```

**Response:** List of files that depend on target file

**Use case:** Determine blast radius before refactoring

#### 2. Hotspots Query
```bash
echo '{"action":"query","type":"hotspots","limit":5}' | node gsd-intel-index.js
```

**Response:** Files with most dependents (ranked by impact)

**Use case:** Identify critical files that need careful changes

### Query Interface via /gsd:query-intel

```bash
/gsd:query-intel dependents src/lib/db.ts
/gsd:query-intel hotspots
/gsd:query-intel hotspots 10
```

Converts file paths to entity IDs (`src/lib/db.ts` → `src-lib-db`), executes query, formats results.

---

## 7. Statusline Integration

The statusline hook (`gsd-statusline.js`) displays:
- Current model
- In-progress task (from todos)
- Directory name
- Context window usage (colored progress bar)
- GSD update availability

This provides real-time feedback on session state without blocking.

---

## 8. Error Handling & Safety

All hooks are **non-blocking** and **silent**:

```javascript
// Standard hook pattern:
try {
  // Do work
  process.exit(0);
} catch (error) {
  // Always exit 0, never block Claude
  process.exit(0);
}
```

This ensures:
- Failed intel updates don't break Claude sessions
- Hooks are lightweight (no heavy validation)
- Missing prerequisites (missing index.json, etc.) are handled gracefully
- Silent failures with informative error messages to user later

---

## 9. Performance Characteristics

### Hook Execution Times

1. **gsd-intel-session.js** - O(1)
   - Just reads existing summary.md
   - ~5ms per session

2. **gsd-intel-index.js** - O(n) where n = entities
   - Reads all entity files in .planning/intel/entities/
   - Parses YAML, extracts wiki-links
   - Syncs to graph.db
   - ~50-200ms per tool use (depending on entity count)

3. **gsd-intel-prune.js** - O(m) where m = indexed files
   - Checks fs.existsSync() for each file
   - Only removes deleted entries
   - ~10-50ms per session end

### Optimization Opportunities

1. **Batch entity syncs** - Current: every tool use triggers graph sync
   - Could batch in PostToolUse hook
   - Reduce DB writes from 10+ per minute to 1-2

2. **Incremental conventions detection** - Current: full recomputation
   - Could track deltas in index.json
   - Only recompute if threshold files changed

3. **Lazy summary generation** - Current: regenerated after every entity sync
   - Could cache summary if unchanged
   - Only regenerate if conventions changed

4. **Graph.db queries cache** - Current: query each time user asks
   - Could cache hotspots/dependents for 60 seconds
   - Huge speedup for repeated `/gsd:query-intel` calls

---

## 10. Extensibility Points

The hooks system is designed to be extensible:

1. **Custom hooks in ~/.claude/hooks/**
   - Can be added to SessionStart, PostToolUse, Stop events
   - Receive JSON via stdin, output JSON
   - Must exit cleanly (code 0)

2. **Entity type expansion**
   - Currently: module, component, util, config, api, hook, service, model, test
   - Can add custom types by modifying entity-generator

3. **Graph schema extension**
   - SQLite allows arbitrary schema changes
   - Could add new node/edge types for custom analysis

4. **Summary.md customization**
   - Could add custom sections for domain-specific patterns
   - Could integrate with other tools via hook pipeline

---

## 11. Key Insights for Analyzer Optimization

### What We Learned

1. **Intel is incremental by design**
   - Initial scan (analyze-codebase) is heavy (steps 1-7)
   - Continuous updates (PostToolUse hook) are lightweight
   - Final step (entity generation) is optional and parallelizable

2. **Graph database is the intelligence core**
   - All entity metadata lives in graph.db
   - Supports fast dependency queries
   - Built incrementally (not batch computed)

3. **Summary is pre-computed for context injection**
   - Generated once at session start
   - Used to warm up Claude's understanding
   - < 500 tokens (efficient context usage)

4. **Pruning keeps stale entries out**
   - Deleted files are removed at session end
   - Prevents stale index/entities from accumulating
   - Safe operation (never fails)

### Implications for Analyzer

An analyzer that uses intel would:
- Start with pre-loaded summary from context injection
- Use graph.db queries to find hotspots/dependents
- Parse entity files to understand purpose (not just syntax)
- Benefit from incremental updates (no full rescans needed)

This means an intel-aware analyzer could:
1. Answer questions about dependencies in O(1) via graph queries
2. Understand purpose/intent via entity files (better than syntax alone)
3. Scale to large codebases (incremental, not batch analysis)
4. Work efficiently in limited context (summary < 500 tokens)

---

## References

### Hook Configuration
- **File:** `~/.claude/settings.json`
- **Hook implementations:** `~/.claude/hooks/gsd-*.js`

### Commands Using Intel
- **analyze-codebase:** `~/.claude/commands/gsd/analyze-codebase.md`
- **query-intel:** `~/.claude/commands/gsd/query-intel.md`
- **map-codebase:** `~/.claude/commands/gsd/map-codebase.md`

### Entity Generator
- **Agent:** `~/.claude/agents/gsd-entity-generator.md`

### Plugin Documentation
- **Hook Development:** `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/plugin-dev/skills/hook-development/SKILL.md`

