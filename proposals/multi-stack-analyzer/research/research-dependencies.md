# GSD Analyze-Codebase: Integration & Dependency Analysis

**Date**: 2025-01-20
**Research Focus**: How `gsd:analyze-codebase` command interacts with other GSD components
**Status**: Complete

---

## Executive Summary

The `gsd:analyze-codebase` command is the **bootstrap engine** for GSD's Codebase Intelligence system. It generates foundational artifacts that multiple GSD components consume, hooks update incrementally, and agents query for decision-making.

**Key Finding**: 8 downstream consumers depend on analyze-codebase output, creating a critical intelligence hub that enables:
- Context-aware code navigation for agents
- Semantic understanding of file relationships
- Incremental learning as code evolves
- Dependency graph analysis

---

## 1. Output Files & Purposes

The command generates 4 core output types in `.planning/intel/`:

### 1.1 `index.json` — File Inventory
**Purpose**: Maps every indexable file to its exports and imports
**Structure**:
```json
{
  "version": 1,
  "updated": 1737360330000,
  "files": {
    "/absolute/path/file.js": {
      "exports": ["functionA", "ClassB"],
      "imports": ["react", "./utils"],
      "indexed": 1737360330000
    }
  }
}
```

**Used by**:
- `gsd-intel-index.js` hook — Syncs to graph.db
- `gsd:query-intel` command — Converts paths to entity IDs
- PostToolUse hook — Incremental updates after code changes

### 1.2 `conventions.json` — Project Patterns
**Purpose**: Detects naming conventions, directory purposes, file suffixes
**Structure**:
```json
{
  "naming": {
    "exports": {
      "dominant": "camelCase",
      "percentage": 85
    }
  },
  "directories": {
    "components": {"purpose": "UI components", "files": 15}
  },
  "suffixes": {
    ".test.js": {"purpose": "Test files", "count": 12}
  }
}
```

**Used by**:
- `gsd-planner` agent — Enforces conventions when creating new files
- Context injection hooks — Provides project style baseline

### 1.3 `summary.md` — Concise Intelligence
**Purpose**: Minimal context injection at session startup
**Size**: < 500 tokens (intentionally compact)
**Content**:
- Naming conventions detected
- Key directories and their purposes
- Top file patterns
- Export counts

**Used by**:
- `gsd-intel-session.js` hook — Injects into Claude context on startup
- `plan-phase` workflow — Provides codebase intel to planner agent
- Context windows — Keeps overhead minimal

**Injected as**: `<codebase-intelligence>summary.md</codebase-intelligence>`

### 1.4 `entities/*.md` — Semantic Documentation (Optional)
**Purpose**: Capture PURPOSE of key files, not just syntax
**Structure**:
```markdown
---
path: /absolute/path
type: [module|component|util|config|api|hook|service|model|test]
updated: 2025-01-20
status: active
---

# filename

## Purpose
[1-3 sentences: what this does, why it exists]

## Exports
- `functionName(params): ReturnType` — description

## Dependencies
- [[internal-file-slug]] — why needed
- external-package — what provides

## Used By
[Filled in by graph analysis]
```

**Special relationship**: [[wiki-links]] format enables graph edge creation.

---

## 2. Hook Integrations

### 2.1 `gsd-intel-prune.js` (Stop Event Hook)
**Trigger**: After each Claude response completes
**Operation**: Removes stale entries from index.json when files are deleted
**Implementation**:
- Reads current index.json
- For each file path: `fs.existsSync(filePath)`
- Deletes entries where file no longer exists
- Updates timestamp
- Silent failure (exit 0 always) — never blocks Claude

**Interaction with analyze-codebase**:
- Maintains the index created by analyze-codebase
- Ensures index stays fresh as codebase evolves
- Runs automatically without user intervention

### 2.2 `gsd-intel-index.js` (Graph Database Sync)
**Trigger**: PostToolUse hook after entity files are written
**Operation**: Syncs entities to graph.db for dependency querying
**Size Note**: 1.3MB minified file (contains SQLite WASM + graph logic)

**What it does**:
- Reads entity files from `.planning/intel/entities/`
- Parses YAML frontmatter (path, type, status)
- Extracts [[wiki-links]] from Dependencies section to build edges
- Syncs to SQLite graph.db for fast queries

**Interaction with analyze-codebase**:
- Consumes entity files created by `gsd-entity-generator` subagent
- Entity generation happens in Step 9 of analyze-codebase
- Graph enables `/gsd:query-intel` dependency analysis

### 2.3 `gsd-intel-session.js` (SessionStart Context Injection)
**Trigger**: Session startup and resume events
**Operation**: Injects pre-generated summary.md into Claude context

**Process**:
```javascript
1. Detect session source: startup or resume
2. Read .planning/intel/summary.md (if exists)
3. Inject as: <codebase-intelligence>summary.md</codebase-intelligence>
4. Exit silently if missing (never blocks)
```

**Interaction with analyze-codebase**:
- Consumes summary.md created by analyze-codebase Step 7
- Summary is created fresh on each analyze-codebase run
- Enables session to start with codebase context without reparsing

---

## 3. Command Dependencies

### 3.1 `/gsd:query-intel` Command
**Purpose**: Query dependency relationships in the graph
**Dependency**: Requires `.planning/intel/graph.db` (created by analyze-codebase Step 9)

**Usage**:
```
/gsd:query-intel dependents src/lib/db.ts
→ Returns files that depend on db.ts (blast radius analysis)

/gsd:query-intel hotspots
→ Returns files with most dependents (change carefully)
```

**Process**:
1. Convert file path to entity ID: `src/lib/db.ts` → `src-lib-db`
2. Query graph.db using converted ID
3. Return relationship information

**Fallback**: If graph.db missing, returns error: "Run `/gsd:analyze-codebase` first"

### 3.2 `/gsd:new-project` Command
**Interaction**: Creates empty `.planning/intel/` directory
**Step in process**: Phase 1 (Setup) creates the directory structure:
```bash
mkdir -p .planning/intel
```

**Purpose**: Prepares directory for PostToolUse hook to populate incrementally
**Note**: Does NOT run analyze-codebase automatically (optional for greenfield)

### 3.3 `/gsd:plan-phase` Command
**Interaction**: Reads `.planning/intel/summary.md` for context injection
**Step 7 (Read Context Files)**:
```bash
INTEL_CONTENT=$(cat .planning/intel/summary.md 2>/dev/null)
```

**Usage in planner prompt**:
```markdown
**Codebase Intel (if exists):**
<codebase-intel>
{intel_content}
</codebase-intel>
```

**Purpose**: Planner agent creates files following detected conventions
**Fallback**: Empty string if summary.md missing (plan continues normally)

### 3.4 `/gsd:execute-phase` Workflow
**Interaction**: Uses entities to track file modifications
**Step: `update_intel_entity`**:
1. After each task completes (verification passed)
2. Identifies modified files from task's `<files>` list or git status
3. Derives entity path: `src/lib/auth.ts` → `src-lib-auth.md`
4. Creates/updates entity in `.planning/intel/entities/`
5. Stages entity file in same commit as task code

**Example entity creation during execution**:
```markdown
---
path: /absolute/path/src/lib/auth.ts
type: util
updated: 2025-01-20
status: active
---

# auth.ts

## Purpose
Manages JWT creation and validation for authentication flow. Provides token generation with refresh rotation and expiry handling.

## Exports
- `createToken(userId, expiresIn): string` — Creates signed JWT
- `validateToken(token): TokenPayload` — Validates and returns payload
- `createRefreshToken(userId): string` — Creates long-lived refresh token

## Dependencies
- jose - JWT signing and verification
- dayjs - Timestamp calculations

## Used By
TBD
```

**Purpose**: Knowledge base self-evolves as you code
**Automatic syncing**: PostToolUse hook syncs to graph.db after commit

---

## 4. Agent Consumption Patterns

### 4.1 `gsd-planner` Agent
**Reads**: `.planning/intel/summary.md`
**When**: During phase planning (Step 8 in plan-phase)
**Usage**:
```markdown
**Codebase Intel (if exists):**
{intel_content}
```

**How it uses it**:
- Identifies existing patterns when creating new files
- Maintains naming convention consistency (camelCase vs PascalCase)
- Places files in appropriate directories
- Writes comments in project's style

**Example**: If conventions.json shows 85% camelCase exports, planner will use camelCase for new functions

### 4.2 `gsd-entity-generator` Subagent
**Spawned by**: analyze-codebase Step 9
**Reads**: Source files only (paths provided)
**Writes**: Entity files to `.planning/intel/entities/`

**Process**:
1. Receive list of up to 50 file paths
2. For each file:
   - Read source code
   - Analyze purpose (semantic understanding)
   - Extract exports and imports
   - Determine module type (component, util, service, etc.)
   - Convert internal imports to [[wiki-links]]
3. Write entity markdown
4. Return statistics only (not entity contents)

**Critical rules**:
- Frontmatter MUST be valid YAML (hook parsing depends on it)
- [[wiki-links]] MUST use correct slugs (graph edges depend on accuracy)
- Purpose MUST be substantive ("Manages JWT creation..." not "Exports auth functions")

### 4.3 `gsd-phase-researcher` Agent
**Reads**: No direct intel dependency
**Indirect benefit**: Can reference conventions in research findings
**Example**: "Project uses camelCase exports, so API routes should follow {GET /api/users}"

### 4.4 Other Agents
- `gsd-project-researcher` — No intel dependency
- `gsd-roadmapper` — No intel dependency
- `gsd-plan-checker` — No intel dependency
- `gsd-executor` — Uses intel entities to update knowledge base during execution

---

## 5. Workflow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│  gsd:analyze-codebase (Step 1-8)                                    │
│  └─ Creates: index.json, conventions.json, summary.md               │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                    ┌────▼─────────────────────────────────┐
                    │ PostToolUse Hook System              │
                    │ (gsd-intel-prune.js runs on stop)   │
                    └────────────────────────────────────────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
      ▼                  ▼                  ▼
  gsd:new-project   gsd:plan-phase   gsd:analyze-codebase Step 9
  (setup phase)     (planning)        (Optional: entity generation)
      │                  │                  │
      │                  │                  ▼
      │                  │           gsd-entity-generator subagent
      │                  │           (spawned with file list)
      │                  │                  │
      │                  │                  ▼
      │                  │           Writes: entities/*.md
      │                  │                  │
      │                  ▼                  ▼
      │          Reads summary.md    gsd-intel-index.js hook
      │          for context         (syncs to graph.db)
      │                  │                  │
      └──────────────────┼──────────────────┘
                         │
                    ┌────▼─────────────────────────────────┐
                    │ gsd-intel-session.js hook            │
                    │ (SessionStart: injects summary.md)   │
                    └────────────────────────────────────────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
      ▼                  ▼                  ▼
  gsd-planner       gsd:execute-phase   gsd:query-intel
  agent             workflow            command
  │                 │                   │
  │ Uses            │ Updates           │ Queries
  │ conventions     │ entities          │ graph.db
  │ for style       │ as code evolves   │
  │                 │                   │
  └─────────────────┴───────────────────┘
           │
           ▼
    Codebase intelligence
    evolves with project
```

---

## 6. Data Flow Diagram

### 6.1 Initial Analysis (analyze-codebase)
```
Source Code Files
├─ *.js, *.ts, *.jsx, *.tsx
└─ (excludes node_modules, dist, .git, etc.)
        │
        ▼
   Analyze Files
   ├─ Extract exports (named, default, CommonJS)
   ├─ Extract imports (ES6, require)
   ├─ Detect naming conventions (camelCase %, PascalCase %, etc.)
   ├─ Classify directories (components/, services/, utils/, etc.)
   └─ Identify file suffixes (.test., .service., etc.)
        │
        ├─────────────────────┬─────────────────┬─────────────┐
        ▼                     ▼                 ▼             ▼
   index.json          conventions.json    summary.md    entities/*.md
   (2-50KB)            (1-10KB)            (1-5KB)       (50 files × 2KB)
   File inventory      Patterns detected   Context       Semantic docs
                                          injection     (optional)
        │
        ├─────────────────────┬─────────────────┬──────────────┐
        ▼                     ▼                 ▼              ▼
   gsd-intel-prune    gsd-intel-session   gsd-intel-index
   (Stops: prunes)    (Start: injects)    (Creates graph.db)
```

### 6.2 Incremental Learning (During Execution)
```
gsd:execute-phase
├─ Execute Task 1
├─ Verify done criteria
├─ For each modified file:
│  ├─ Read file content
│  ├─ Analyze purpose
│  └─ Create/update entity → .planning/intel/entities/{slug}.md
├─ Commit code + entity files
└─ gsd-intel-index.js hook (PostToolUse)
   ├─ Parse entity YAML frontmatter
   ├─ Extract [[wiki-links]] from Dependencies
   └─ Sync to graph.db
        │
        ▼
   Graph now knows:
   ├─ What this file does (Purpose)
   ├─ What it exports
   ├─ What it depends on
   ├─ What depends on it (from graph queries)
   └─ Ready for /gsd:query-intel
```

---

## 7. Hook Execution Timeline

### 7.1 SessionStart Hook (`gsd-intel-session.js`)
**Trigger**: Claude session starts or resumes
**Input**: Session metadata (source: startup|resume|other)
**Output**: `<codebase-intelligence>...</codebase-intelligence>` injected into context
**Timing**: Before any user commands execute
**Blocking**: No - exits 0 even if summary.md missing
**Size**: summary.md kept under 500 tokens for minimal context overhead

### 7.2 PostToolUse Hook (`gsd-intel-index.js`)
**Trigger**: After any Tool call completes (Write, Bash, Glob, etc.)
**Input**: Checks for new entity files in `.planning/intel/entities/`
**Operation**:
1. Detect new/modified entity files
2. Parse YAML frontmatter
3. Extract [[wiki-link]] references
4. Create/update graph.db nodes and edges
5. Index for fast dependency queries

**Timing**: After task execution, before next step
**Blocking**: No - failures logged but don't block execution
**Performance**: Designed for incremental updates (single file scanning, not full rebuild)

### 7.3 Stop Hook (`gsd-intel-prune.js`)
**Trigger**: After Claude response completes (session ending or pausing)
**Input**: None (just filesystem check)
**Operation**: Prunes deleted files from index.json
**Timing**: Last action before session ends
**Blocking**: No - always exits 0
**Performance**: O(n) where n = files in index (fast fs.existsSync checks)

---

## 8. Key Integration Points

### 8.1 Context Injection (SessionStart)
**How it works**:
```
Session starts
    ↓
gsd-intel-session.js hook runs
    ↓
Read .planning/intel/summary.md (if exists)
    ↓
Inject as: <codebase-intelligence>[summary content]</codebase-intelligence>
    ↓
Claude starts with project context automatically
```

**Impact**:
- Every session automatically aware of codebase patterns
- No manual context copying needed
- Compact format (< 500 tokens) keeps token budget low

### 8.2 Graph Synchronization (PostToolUse)
**How it works**:
```
Task execution completes
    ↓
Entity file written: .planning/intel/entities/src-lib-auth.md
    ↓
gsd-intel-index.js hook detects new entity
    ↓
Parse frontmatter: path, type, updated, status
    ↓
Extract [[wiki-links]] from Dependencies section
    ↓
Create/update graph.db nodes and edges
    ↓
/gsd:query-intel now knows this file's relationships
```

**Critical dependency**: Accuracy of [[wiki-links]] in entities determines graph correctness

### 8.3 Incremental Index Updates (Various hooks)
**Prune cycle**:
```
Code file deleted
    ↓
Execute task that removes file
    ↓
Session ends or pauses
    ↓
gsd-intel-prune.js hook runs
    ↓
fs.existsSync() check for each file in index
    ↓
Remove deleted entries from index.json
    ↓
Update timestamp
```

**Benefit**: Index stays accurate without manual refresh

---

## 9. Failure Modes & Recovery

### 9.1 Missing Summary.md
**Trigger**: analyze-codebase never run or incomplete
**Impact on commands**:
| Command | Impact | Behavior |
|---------|--------|----------|
| gsd-intel-session.js | No context injected | Silent exit (doesn't block) |
| gsd:plan-phase | No intel passed to planner | Planner works without codebase intel |
| gsd:execute-phase | No intel context | Entity updates still happen normally |

**Recovery**: Run `/gsd:analyze-codebase` to regenerate

### 9.2 Missing Graph.db
**Trigger**: analyze-codebase Step 9 skipped or failed
**Impact on commands**:
| Command | Impact | Behavior |
|---------|--------|----------|
| gsd:query-intel | Can't query | Error: "Run analyze-codebase first" |
| gsd:execute-phase | No effect | Entity updates still work |

**Recovery**: Run `/gsd:analyze-codebase` with Step 9 enabled

### 9.3 Invalid Entity YAML
**Trigger**: Malformed entity file (bad frontmatter)
**Impact on commands**:
| Command | Impact | Behavior |
|---------|--------|----------|
| gsd-intel-index.js | Parse error | Logged but doesn't block; entity skipped |
| gsd:query-intel | Incomplete graph | Returns data for valid entities only |

**Prevention**: gsd-entity-generator validates YAML before writing

### 9.4 Wrong Wiki-Link Format
**Trigger**: Entity Dependencies use wrong slug: `[[src/lib/auth]]` instead of `[[src-lib-auth]]`
**Impact**: Graph edges missing (file relationships not tracked)
**Prevention**: gsd-entity-generator applies slug conversion rules

---

## 10. Optimization Opportunities

### 10.1 Incremental index.json Updates
**Current**: analyze-codebase rescans all files (O(n) time)
**Opportunity**: PostToolUse hook could incrementally update index as files change
**Benefit**: Faster index updates during development (only changed files rescanned)
**Tradeoff**: More complex hook logic, risk of stale entries

### 10.2 Lazy Entity Generation
**Current**: Step 9 generates up to 50 entities immediately
**Opportunity**: Only generate entities for files queried (lazy loading)
**Benefit**: Faster initial analyze-codebase run
**Tradeoff**: First query slower, requires request caching

### 10.3 Graph Database Persistence
**Current**: gsd-intel-index.js syncs to graph.db after each entity write
**Opportunity**: Batch sync multiple entities per phase execution
**Benefit**: Fewer PostToolUse hook invocations, faster execution
**Tradeoff**: Delay in query availability, more complex batching logic

### 10.4 Convention Detection Refinement
**Current**: Simple pattern matching (counts %, matches regex)
**Opportunity**: ML-based pattern detection (learns from codebase style)
**Benefit**: More accurate convention detection for mixed-style codebases
**Tradeoff**: Complexity, external dependencies

---

## 11. Integration Checklist for New Workflows

When adding new GSD workflows that need codebase intelligence, ensure:

- [ ] Read `.planning/intel/summary.md` if working with existing projects
- [ ] Convert file paths to entity IDs when querying graph.db
- [ ] Use [[wiki-links]] format in Dependencies section of entities
- [ ] Validate YAML frontmatter in entity files before syncing to graph
- [ ] Handle missing intel gracefully (fallback, don't error)
- [ ] Include entity updates in commit messages (`update entity: src-lib-auth`)
- [ ] Test with both greenfield (no intel) and brownfield (existing intel) projects

---

## 12. References

**Key Files**:
- Command: `/home/dave/.claude/commands/gsd/analyze-codebase.md`
- Hook (Prune): `/home/dave/.claude/hooks/gsd-intel-prune.js` (79 lines)
- Hook (Index): `/home/dave/.claude/hooks/gsd-intel-index.js` (1.3MB minified)
- Hook (Session): `/home/dave/.claude/hooks/gsd-intel-session.js` (40 lines)
- Agent: `/home/dave/.claude/agents/gsd-entity-generator.md`
- Query Command: `/home/dave/.claude/commands/gsd/query-intel.md`
- Plan-Phase: `/home/dave/.claude/commands/gsd/plan-phase.md` (Step 7, Step 8)
- Execute-Phase: `/home/dave/.claude/get-shit-done/workflows/execute-plan.md` (update_intel_entity step)

**Output Directory**: `.planning/intel/`
- `index.json` — File inventory with exports/imports
- `conventions.json` — Detected patterns
- `summary.md` — Concise context injection (~500 tokens)
- `entities/` — Semantic documentation of key files
- `graph.db` — SQLite dependency graph (built from entities)

---

**End of Research Document**
