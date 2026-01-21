# GSD Analyzer Optimization Guide

**Research Date:** 2026-01-20
**Scope:** How to build an analyzer that leverages GSD's incremental intel system
**Target:** High-performance, low-context semantic analysis

---

## 1. Architecture Overview

The GSD hooks system enables a three-tier intelligence architecture:

```
Tier 1: Summary (< 500 tokens)
   ↓
   Injected at session start via gsd-intel-session.js
   Provides: naming conventions, key directories, patterns
   Usage: Warm-up Claude's understanding
   Frequency: Once per session

Tier 2: Entities (semantic documentation)
   ↓
   Written by gsd-entity-generator subagent
   Provides: file purpose, exports, dependencies
   Usage: Detailed module understanding
   Frequency: Generated on demand, cached

Tier 3: Graph Database (dependency relationships)
   ↓
   Built incrementally by gsd-intel-index.js PostToolUse hook
   Provides: blast radius analysis, hotspot detection
   Usage: Efficient dependency queries
   Frequency: Updated after each tool use
```

An optimal analyzer would use **all three tiers** for different tasks:
- **Quick questions:** Use Tier 1 (summary) - already in context
- **Purpose/intent questions:** Use Tier 2 (entities) - parse .md files
- **Dependency questions:** Use Tier 3 (graph) - query SQLite

---

## 2. Leveraging the Summary (Tier 1)

### What's Available

The summary is **already injected** into Claude's context at session start:

```markdown
<codebase-intelligence>
# Codebase Intelligence Summary

## Naming Conventions
- Exports: camelCase (85% of 42 exports)
- Key directories: src/components, src/hooks, src/utils

## File Patterns
- Test files: *.test.js (12 files)
- Service layer: *.service.js (8 files)

## Key Statistics
- Total files indexed: 127
- Total exports: 234
- Total imports: 456
</codebase-intelligence>
```

### How to Use in Analyzer

1. **Parse summary at startup** (it's already in context)
   ```
   - Extract conventions section
   - Extract directory patterns
   - Build mental model of codebase structure
   ```

2. **Ask Claude to reference it** when analyzing code
   ```
   "Based on the codebase intelligence (naming conventions are camelCase),
    does this file follow the conventions?"
   ```

3. **Use patterns for quick heuristics**
   ```
   "This file is in src/services/, so it's likely a service module.
    Check if it exports a class with 'Service' suffix."
   ```

### Optimization: Pre-load Key Data

Instead of asking Claude to parse summary, could:
1. Read summary.md in analyzer at startup
2. Extract conventions to structured format
3. Pass to Claude as analyzer parameters
4. Example: `{"dominantCase": "camelCase", "keyDirs": ["components", "hooks"]}`

**Impact:** 100-200 tokens saved per analysis, faster pattern matching

---

## 3. Leveraging Entities (Tier 2)

### What's Available

Entity files in `.planning/intel/entities/` with structure:

```markdown
---
path: /absolute/path/to/src/lib/db.ts
type: module
updated: 2026-01-20
status: active
---

# db.ts

## Purpose
Provides database connection pooling and query interface for the application.
Wraps pg library with connection reuse and error recovery.

## Exports
- `createPool(config): Pool` - Initialize connection pool
- `query(sql, params): Promise<Result>` - Execute parameterized query

## Dependencies
- pg - PostgreSQL driver
- pino - Logging

## Used By
TBD
```

### How to Use in Analyzer

1. **Understand file purpose before analyzing**
   ```
   - Read entity file for target file
   - Extract purpose section
   - Understand "why" the file exists
   ```

2. **Verify exports match documentation**
   ```
   - Compare actual exports to Exports section
   - Check for undocumented exports
   - Identify breaking changes
   ```

3. **Trace dependencies efficiently**
   ```
   - Read Dependencies section
   - No need to grep for imports
   - Understand intent of each dependency
   ```

4. **Answer "Used By" questions**
   ```
   - Graph database tracks dependents
   - Query: /gsd:query-intel dependents file.ts
   - Get list of files that depend on this one
   ```

### Optimization: Parse Entities at Startup

Instead of reading entities on demand:
1. Scan `.planning/intel/entities/` at startup
2. Build entity index: `{path -> purpose, exports, dependencies}`
3. Load into memory for O(1) lookups
4. Update incrementally as new entities are written

**Impact:** Instant access to semantic data, no file I/O during analysis

---

## 4. Leveraging Graph Database (Tier 3)

### What's Available

Embedded SQLite database (`graph.db`) with:
- **Nodes:** Entity files (path, type, status)
- **Edges:** Wiki-links from Dependencies sections
- **Queries:** `dependents(entity)` and `hotspots(limit)`

### Query Interface

**Option A: Via PostToolUse Hook**
```bash
echo '{"action":"query","type":"dependents","target":"src-lib-db"}' \
  | node ~/.claude/hooks/gsd-intel-index.js
```

**Option B: Via /gsd:query-intel Command**
```bash
/gsd:query-intel dependents src/lib/db.ts
/gsd:query-intel hotspots 10
```

### How to Use in Analyzer

1. **Find files that depend on target**
   ```
   Query: dependents("src-lib-db")
   Result: ["src-api-users", "src-services-auth", ...]
   Use: Determine blast radius before refactoring
   ```

2. **Identify critical (most-depended-on) files**
   ```
   Query: hotspots(10)
   Result: [
     {"entity": "src-types-user", "dependents": 45},
     {"entity": "src-utils-format", "dependents": 38},
     ...
   ]
   Use: Know which files to change carefully
   ```

3. **Verify dependency correctness**
   ```
   Read entity file, check Dependencies section
   Query graph for actual dependents
   Compare: Expected vs actual usage
   ```

### Optimization: Cache Graph Queries

Current implementation queries graph.db fresh each time.

**Optimization:** Cache query results for 60 seconds
```javascript
// At PostToolUse hook time
cache = {
  'hotspots-5': [...],
  'dependents-src-lib-db': [...],
  timestamp: Date.now()
}

// At query time
if (cache[query] && Date.now() - cache.timestamp < 60000) {
  return cache[query];  // Instant result
} else {
  // Query graph.db and update cache
}
```

**Impact:** 100x speedup for repeated queries, 1MB cache overhead

---

## 5. Incremental Update Strategy

### Current Flow

```
1. User writes entity file to .planning/intel/entities/db.ts.md
2. PostToolUse hook runs immediately
3. Hook reads entity file
4. Hook parses YAML frontmatter and [[wiki-links]]
5. Hook syncs to graph.db
6. Hook regenerates conventions.json and summary.md
```

### Optimization: Batch Entity Syncs

**Problem:** PostToolUse hook runs after every tool, but entities might be:
- Written in batches (Write tool creates multiple files)
- Partial (incomplete first pass)
- Stable (no changes between tool uses)

**Solution:** Batch entity syncs with debouncing

```javascript
// In gsd-intel-index.js
let pendingEntities = [];
let syncTimer = null;

function addPendingEntity(path) {
  pendingEntities.push(path);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    batchSync(pendingEntities);
    pendingEntities = [];
  }, 2000);  // Wait 2 seconds for more entities
}

function batchSync(entities) {
  // Sync all pending entities to graph.db in one transaction
  // Regenerate conventions and summary once, not per entity
  // Could reduce hook execution time by 10x
}
```

**Impact:** From 50-200ms per tool use → 10-50ms, but 2s delay for batch

### Optimization: Lazy Summary Regeneration

**Problem:** Summary regenerated after every entity sync, even if unchanged

**Solution:** Only regenerate if key data changes

```javascript
// After syncing entities to graph.db
const oldConventions = JSON.parse(fs.readFileSync(conventionsPath));
const newConventions = detectConventions(index);

if (JSON.stringify(oldConventions) === JSON.stringify(newConventions)) {
  // Conventions unchanged, skip summary generation
  return;
}

// Only regenerate if conventions changed
generateSummary(newConventions);
```

**Impact:** 80-90% of syncs skip summary generation (only 10-20ms instead of 50-100ms)

---

## 6. Analyzer Integration Points

### Entry Point: At Analyze Time

```
1. Read summary.md from .planning/intel/
2. Load entity index from .planning/intel/entities/
3. Build conventions object from conventions.json
4. Ready for analysis with three tiers of data
```

### Analysis Loop

```
For each file to analyze:
  1. Check entity index for entity file
  2. If exists:
     - Read entity file
     - Extract purpose, exports, dependencies
  3. If not exists:
     - Analyze file from scratch
     - Offer to generate entity for future use

  4. For dependency analysis:
     - Query graph.db via PostToolUse hook interface
     - Or cache queries for repeated analysis
```

### Output Integration

```
After analysis completes:
  1. If new entities were generated:
     - Write to .planning/intel/entities/
     - PostToolUse hook will auto-sync to graph.db
  2. If analysis revealed updates needed:
     - Suggest entity updates
     - Or run /gsd:analyze-codebase to refresh
```

---

## 7. Performance Targets

### Analysis Speed Targets

| Scenario | Current | With Optimization | Target |
|----------|---------|-------------------|--------|
| Quick question (use summary) | 5-10s | 2-3s | < 2s |
| Dependency analysis (hotspots) | 10-15s | 500ms (cached) | < 500ms |
| New entity generation | 30-60s | 10-20s | < 15s |
| Full codebase analysis (100+ files) | 2-5 min | 30-60s | < 1 min |

### Memory Targets

| Component | Current | With Optimization |
|-----------|---------|-------------------|
| Entity index in memory | 1-5 MB | 5-10 MB (OK) |
| Graph.db on disk | 10-50 MB | 10-50 MB (OK) |
| Query cache | 0 | 1 MB (OK) |
| Summary in context | < 500 tokens | < 500 tokens (OK) |

---

## 8. Recommended Optimization Priority

### Phase 1 (Quick Wins - 80/20)

1. **Load entity index at startup**
   - Time saved: 5-10s per analysis
   - Complexity: Low
   - Impact: High

2. **Pre-parse summary conventions**
   - Time saved: 1-2s per analysis
   - Complexity: Low
   - Impact: High

3. **Cache graph queries**
   - Time saved: 90% for repeated queries
   - Complexity: Medium
   - Impact: Very High

### Phase 2 (Medium Effort)

4. **Batch entity syncs in PostToolUse hook**
   - Time saved: 80% reduction in hook overhead
   - Complexity: High (touches hook mechanism)
   - Impact: High (but affects all users)

5. **Lazy summary generation**
   - Time saved: 60% of sync time
   - Complexity: Medium
   - Impact: Medium

### Phase 3 (Advanced)

6. **Incremental conventions detection**
   - Time saved: 50% of convention computation
   - Complexity: High
   - Impact: Medium

7. **Graph schema optimization**
   - Time saved: 20-30% of query time
   - Complexity: Very High
   - Impact: Medium (only for large codebases)

---

## 9. Implementation Checklist

### For Building Intel-Aware Analyzer

- [ ] Read summary.md at session start
- [ ] Load entity index from .planning/intel/entities/ into memory
- [ ] Build conventions data structure from conventions.json
- [ ] Parse target file for analysis
- [ ] Look up entity if exists (use entity index)
- [ ] If entity not found, analyze from scratch
- [ ] For dependency questions, query graph.db
- [ ] Cache graph queries for 60 seconds
- [ ] After analysis, offer to generate/update entities
- [ ] If entities written, let PostToolUse hook sync them

### For Optimizing PostToolUse Hook

- [ ] Implement entity sync batching (2-second debounce)
- [ ] Implement lazy summary generation (skip if conventions unchanged)
- [ ] Add graph query result caching
- [ ] Measure performance before/after optimizations
- [ ] Add metrics to hook output for monitoring

---

## 10. Testing & Validation

### Performance Baseline

Before optimizations, establish baseline:

```bash
# Time a typical analysis
time /gsd:analyze-codebase

# Time graph queries
time /gsd:query-intel hotspots

# Measure hook overhead
# Check .planning/intel/index.json timestamps
```

### Optimization Validation

After each optimization:

```bash
# Measure new execution time
# Verify results are unchanged
# Check that entities still sync to graph.db
# Validate cache hit rate for queries
```

### Load Testing

Test with varying codebase sizes:

```
- Small (< 50 files): Should be instant
- Medium (50-500 files): Should be < 1 min
- Large (500-5000 files): Should be < 5 min
- Very Large (5000+ files): Should be < 15 min
```

---

## 11. Key Files for Reference

### Research Documents
- `/projects/healthcare-integration/.planning/quick/001-gsd-analyzer-optimization/research-hooks.md` (detailed)
- `/projects/healthcare-integration/.planning/quick/001-gsd-analyzer-optimization/HOOKS-SUMMARY.md` (quick)

### Hook Implementation
- `~/.claude/hooks/gsd-intel-session.js` (40 lines)
- `~/.claude/hooks/gsd-intel-index.js` (1.3MB minified - SQLite WASM)
- `~/.claude/hooks/gsd-intel-prune.js` (70 lines)

### Hook Configuration
- `~/.claude/settings.json` (hooks section lines 26-65)

### GSD Commands Using Intel
- `~/.claude/commands/gsd/analyze-codebase.md`
- `~/.claude/commands/gsd/query-intel.md`
- `~/.claude/agents/gsd-entity-generator.md`

---

## Conclusion

The GSD hooks system is already highly optimized for **incremental** intelligence updates. The three-tier architecture (summary → entities → graph) provides the right abstraction level for different analysis tasks:

1. **Quick pattern checks:** Use summary (< 500 tokens, already cached)
2. **Semantic understanding:** Use entities (parsed on demand)
3. **Dependency analysis:** Use graph.db (incremental, queryable)

The main optimization opportunities are:
1. **Caching** (queries and parsed entities) → 10-100x speedup
2. **Batching** (entity syncs) → 80% reduction in hook overhead
3. **Lazy computation** (skip unchanged updates) → 60% reduction in sync time

An analyzer that integrates with this system would be:
- **Intelligent:** Has access to semantic entity data
- **Fast:** Can use cached indexes and queries
- **Lightweight:** Doesn't need to rescan codebase
- **Incremental:** Benefits from automatic updates via PostToolUse hook

This is the foundation for building a high-performance semantic analyzer that scales to large codebases.
