# GSD Hooks System - Quick Summary

## The Three Intel Hooks

| Hook | Event | File | Purpose | Execution Time |
|------|-------|------|---------|-----------------|
| **gsd-intel-session.js** | SessionStart | `~/.claude/hooks/` | Inject codebase summary at session start | ~5ms |
| **gsd-intel-index.js** | PostToolUse | `~/.claude/hooks/` | Update intelligence after each tool use | 50-200ms |
| **gsd-intel-prune.js** | Stop | `~/.claude/hooks/` | Clean stale entries at session end | 10-50ms |

## How Incremental Updates Work

```
1. SessionStart
   └─ gsd-intel-session.js reads .planning/intel/summary.md
      └─ Injects <codebase-intelligence> tags into Claude context
         └─ Warm-up: Claude now knows naming conventions, key files, patterns

2. User Works (writes entities, modifies code)
   └─ Entity files created in .planning/intel/entities/*.md

3. After Each Tool Use
   └─ gsd-intel-index.js (PostToolUse)
      ├─ Reads all entity files
      ├─ Parses YAML frontmatter (path, type, status)
      ├─ Extracts [[wiki-links]] for dependencies
      ├─ Syncs to graph.db (SQLite - embedded)
      ├─ Updates conventions.json
      └─ Regenerates summary.md

4. Session End
   └─ gsd-intel-prune.js (Stop)
      └─ Checks fs.existsSync() for each indexed file
         └─ Removes deleted entries from index.json
```

## Key Insight: Graph Database

The `gsd-intel-index.js` hook (1.3MB) includes an **embedded SQLite WASM runtime** that:

- Maintains `graph.db` with nodes (entities) and edges (dependencies)
- Supports two query types:
  - `dependents <file>` → What files depend on this?
  - `hotspots` → Which files have most dependents?
- Synced **incrementally** after each tool use
- No external database needed (all local, WASM)

## Incremental vs Batch Analysis

### Batch Analysis (analyze-codebase)
```
Input: Entire codebase
Process: 9 steps (scan, index, conventions, entities, graph)
Output: Complete intel setup
Time: 1-5 minutes (depending on codebase size)
Frequency: Manual (user runs /gsd:analyze-codebase)
```

### Incremental Analysis (PostToolUse hook)
```
Input: Recently written entities only
Process: Read entities, parse YAML, extract wiki-links, sync to graph
Output: Updated graph.db, conventions.json, summary.md
Time: 50-200ms per tool use
Frequency: Automatic (after every tool execution)
Benefit: Always fresh without full rescans
```

## Intel Directory Structure

```
.planning/intel/
├── index.json           # File exports/imports index (from analyze-codebase)
├── conventions.json     # Naming patterns, directories, suffixes (from hook)
├── summary.md          # Context injection summary (from hook, < 500 tokens)
├── graph.db            # SQLite graph: nodes (entities) + edges (deps)
└── entities/
    ├── src-lib-db.md           # Entity files (from entity-generator)
    ├── src-api-users.md        # Written by gsd-entity-generator subagent
    └── ...                     # Auto-synced to graph.db by PostToolUse hook
```

## Summary Injection at Session Start

The `gsd-intel-session.js` hook outputs to Claude context:

```markdown
<codebase-intelligence>
# Codebase Intelligence Summary

Last updated: [ISO timestamp]
Indexed files: [N]

## Naming Conventions
- Export naming: camelCase (85% of 42 exports)

## Key Directories
- `src/components/`: UI components (15 files)
- `src/hooks/`: React/custom hooks (8 files)

## File Patterns
- `*.test.js`: Test files (12 files)
- `*.service.js`: Service layer (8 files)

Total exports: 234
</codebase-intelligence>
```

This warm-up is **only < 500 tokens**, making it efficient for context.

## Query Interface for Dependency Analysis

After entities are synced to graph.db, use `/gsd:query-intel`:

```bash
# Check blast radius before refactoring
/gsd:query-intel dependents src/lib/db.ts
# Output: List of files that depend on db.ts

# Find critical files (most dependencies)
/gsd:query-intel hotspots
# Output: Top 5 files with most dependents

# Limit results
/gsd:query-intel hotspots 10
```

## Performance Optimization Opportunities

### Current Bottlenecks
1. **Entity syncs every tool use** - Could batch these
2. **Full conventions recalculation** - Could track deltas
3. **Summary regeneration every sync** - Could cache
4. **Graph queries not cached** - Could cache hotspots for 60s

### Potential Improvements (for analyzer)
1. Batch entity syncs (10x reduction in DB writes)
2. Lazy summary generation (skip if unchanged)
3. Graph query caching (100x speedup for repeated queries)
4. Incremental conventions detection (avoid full recomputation)

## Integration with /gsd:analyze-codebase

The command does 9 steps:
1. Create directory structure
2. Find all indexable files (Glob)
3. Process each file (extract exports/imports)
4. Detect conventions (naming, directories, suffixes)
5. Write index.json
6. Write conventions.json
7. Generate summary.md (< 500 tokens)
8. Report completion statistics
9. **Optional:** Generate semantic entities (spawns subagent for 50 priority files)

After step 9, the PostToolUse hook takes over and keeps intel fresh incrementally.

## Safety & Error Handling

All hooks follow the non-blocking pattern:

```javascript
try {
  // Do work
  process.exit(0);
} catch (error) {
  process.exit(0);  // Always exit 0, never throw
}
```

This ensures:
- Failed intel updates don't break Claude
- Missing prerequisites (no index.json) handled gracefully
- Silent failures with informative user messages later
- Hooks are lightweight and fast

## Key Files to Review

**Hooks Implementation:**
- `~/.claude/hooks/gsd-intel-session.js` (40 lines, readable)
- `~/.claude/hooks/gsd-intel-index.js` (1.3MB, minified - uses WASM SQLite)
- `~/.claude/hooks/gsd-intel-prune.js` (70 lines, readable)

**Hook Configuration:**
- `~/.claude/settings.json` (hooks section)

**Commands Using Intel:**
- `~/.claude/commands/gsd/analyze-codebase.md`
- `~/.claude/commands/gsd/query-intel.md`

**Agent:**
- `~/.claude/agents/gsd-entity-generator.md`

## For Intel-Aware Analyzer

An analyzer that integrates with this system would:

1. **Consume summary.md** at startup (already injected into context)
2. **Parse entity files** from .planning/intel/entities/ for semantic purpose
3. **Query graph.db** for dependency relationships (via hook interface)
4. **Write new entities** for analyzed files
5. **Benefit from incremental syncs** (PostToolUse hook auto-syncs new entities)

Result: Intelligent, dependency-aware analysis with minimal manual intervention.
