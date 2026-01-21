# Phase 6: Multi-Stack Analyzer Enhancement - Research

**Researched:** 2026-01-20
**Domain:** Multi-language codebase analysis, subagent architecture, GSD context optimization
**Confidence:** HIGH

## Summary

This research validates the proposed multi-stack analyzer architecture against GSD's core philosophy and existing implementation patterns. The reference implementations (`detect-stacks.js` and `stack-profiles.yaml`) on the `feature/multi-stack-analyzer` branch are production-quality and align well with GSD principles.

The key insight from GSD philosophy is: **"Burn subagent context freely, preserve orchestrator context religiously."** The proposed architecture correctly applies this by delegating stack detection to JavaScript modules and per-stack analysis to subagents, keeping the orchestrator lightweight.

**Primary recommendation:** Proceed with the planned architecture. Minor adjustments recommended for file locations (use `hooks/lib/` subdirectory) and subagent naming (create new `gsd-intel-stack-analyzer` rather than extending `gsd-entity-generator`).

## Architecture Validation

### Alignment with GSD Philosophy

| Principle | Proposed Implementation | Alignment |
|-----------|------------------------|-----------|
| Context preservation | Stack detection returns ~50 tokens JSON | HIGH |
| Subagent delegation | Per-stack subagent with fresh 200k context | HIGH |
| Pragmatism over perfection | Confidence scoring, not perfect detection | HIGH |
| Brownfield-first | Handles polyglot codebases gracefully | HIGH |
| Autonomous operation | No user input during analysis | HIGH |

**Verified from gsd-philosophy-alignment.md:**
> "Burn subagent context freely, preserve orchestrator context religiously."

The proposed token budget comparison validates this:
- **Naive approach:** 7,200+ tokens (all patterns inline in orchestrator)
- **Optimized approach:** ~2,850 tokens (same as single-stack baseline)

### Critical Design Decision: Why Separate Subagent?

The existing `gsd-entity-generator` handles **file-by-file entity creation**. Stack analysis is fundamentally different:

| Aspect | gsd-entity-generator | gsd-intel-stack-analyzer (proposed) |
|--------|---------------------|-------------------------------------|
| Input | List of file paths | Stack ID + project root |
| Analysis scope | Individual files | Entire stack (conventions, patterns) |
| Output | Entity markdown files | JSON with stack-wide intel |
| Context needs | 200k per batch of files | 200k per language stack |

**Recommendation:** Create `gsd-intel-stack-analyzer` as a new subagent. Do not extend `gsd-entity-generator`.

## Standard Stack

### Core Implementation

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Stack detection | Node.js module | ES2020+ | Detect languages/frameworks |
| Stack profiles | YAML configuration | 1.0 | Define per-language patterns |
| Profile parsing | js-yaml | ^4.1.0 | Parse YAML in JavaScript |
| Subagent | GSD agent pattern | - | Per-stack analysis |

### Reference Implementation Quality

**detect-stacks.js Assessment:**

| Aspect | Rating | Notes |
|--------|--------|-------|
| Code structure | HIGH | Clean async/await, proper error handling |
| Language coverage | HIGH | 35+ languages with framework detection |
| Confidence scoring | HIGH | Marker files (40%) + file count (40%) + frameworks (20%) |
| Performance | MEDIUM | Serial directory walking, could parallelize |
| Module interface | HIGH | Both CLI and module export patterns |
| Test coverage | LOW | No tests included (needs test plan) |

**stack-profiles.yaml Assessment:**

| Aspect | Rating | Notes |
|--------|--------|-------|
| Language coverage | HIGH | 24 primary stacks with variants |
| Pattern quality | HIGH | Export/import patterns are regex-correct |
| Naming conventions | HIGH | Stack-appropriate conventions documented |
| Framework detection | HIGH | Major frameworks per ecosystem covered |
| Structure | HIGH | Lazy-loadable, consistent schema |
| Documentation | MEDIUM | Inline comments present but sparse |

**Production readiness:** Both files are suitable for production with minor enhancements:
1. Add unit tests for detect-stacks.js
2. Add integration test against real polyglot project
3. Consider parallel directory walking for large codebases

## Architecture Patterns

### Recommended File Structure

```
hooks/
├── gsd-intel-index.js        # Existing PostToolUse hook
├── gsd-intel-prune.js        # Existing cleanup hook
├── gsd-intel-session.js      # Existing session hook
├── gsd-statusline.js         # Existing statusline hook
├── gsd-check-update.js       # Existing update check
└── lib/                      # NEW: Reusable modules
    ├── detect-stacks.js      # Stack detection module
    └── stack-profiles.yaml   # Stack configuration
```

**Rationale for `hooks/lib/`:**
1. Follows Node.js convention for internal modules
2. Keeps top-level `hooks/` clean (only hook files)
3. Signals these are importable utilities, not standalone hooks
4. Matches pattern in existing codebases (e.g., `src/lib/`)

### Subagent Directory Structure

```
agents/
├── gsd-entity-generator.md       # Existing (file entities)
├── gsd-intel-stack-analyzer.md   # NEW (stack analysis)
└── ...
```

### Pattern 1: Stack Detection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ analyze-codebase.md (orchestrator)                              │
│ Step 0: node hooks/lib/detect-stacks.js /project json          │
│         → {"stacks": ["typescript", "python"], "primary": ...}  │
│         (~50 tokens to orchestrator context)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 0.5: For each detected stack, spawn subagent               │
│                                                                 │
│ Task(prompt="Analyze typescript stack...",                      │
│      subagent_type="gsd-intel-stack-analyzer")                  │
│                                                                 │
│ Task(prompt="Analyze python stack...",                          │
│      subagent_type="gsd-intel-stack-analyzer")                  │
│                                                                 │
│ (parallel execution, fresh 200k context each)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1+: Continue with merged stack results                     │
│ - Use detected globs for file discovery                         │
│ - Apply stack-specific export/import patterns                   │
│ - Generate stack-aware conventions.json                         │
└─────────────────────────────────────────────────────────────────┘
```

### Pattern 2: Stack-Aware Entity Generation

Entity frontmatter should include stack information for graph queries:

```yaml
---
path: /project/src/api/users.ts
type: api
stack: typescript               # NEW
framework: express              # NEW (optional)
updated: 2026-01-20
status: active
---
```

### Anti-Patterns to Avoid

- **DON'T** inline all 35 language patterns in analyze-codebase.md
- **DON'T** load all stack profiles upfront (lazy-load detected stacks only)
- **DON'T** analyze stacks sequentially in orchestrator (burns context)
- **DON'T** modify existing index.json fields (add new fields only)
- **DON'T** require user confirmation during detection

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing in JS | Custom parser | js-yaml | Edge cases (multiline, anchors) |
| Directory walking | Recursive readdir | Reference implementation | Ignore patterns, permissions |
| Glob matching | String matching | minimatch or picomatch | Brace expansion, negation |
| Language detection | File extension only | Marker file + confidence | False positives with extension |
| Regex patterns | Per-language from scratch | stack-profiles.yaml | Community-validated patterns |

**Key insight:** The reference implementations already solve the hard problems. Don't reinvent.

## Common Pitfalls

### Pitfall 1: Context Accumulation

**What goes wrong:** Analyzing multiple stacks in orchestrator sequentially accumulates context (800+ tokens per stack).

**Why it happens:** Natural tendency to do everything in one place.

**How to avoid:** Spawn subagent per stack. Each gets fresh 200k context.

**Warning signs:** Orchestrator context growing beyond ~100 tokens for stack handling.

### Pitfall 2: Breaking JS/TS Backward Compatibility

**What goes wrong:** Existing single-stack (JS/TS) projects break after multi-stack changes.

**Why it happens:** Changing existing patterns/globs without fallback.

**How to avoid:**
- Keep `**/*.{js,ts,jsx,tsx,mjs,cjs}` as default glob if no detection
- Don't modify existing index.json v1 schema, add v2 fields
- Test on JS-only project before merge

**Warning signs:** Missing `stack` field causes errors, old index.json unreadable.

### Pitfall 3: Detection False Positives

**What goes wrong:** Detecting stacks that aren't actually used (e.g., Python detected because of one script).

**Why it happens:** Relying solely on file extensions.

**How to avoid:**
- Require marker files for HIGH confidence (package.json, go.mod, etc.)
- Use confidence thresholds (40% minimum for primary)
- File count contributes to confidence

**Warning signs:** Primary stack is wrong, minor script language treated as primary.

### Pitfall 4: PostToolUse Hook Compatibility

**What goes wrong:** `gsd-intel-index.js` hook doesn't recognize new stack field in entities.

**Why it happens:** Hook hardcoded for existing schema.

**How to avoid:**
- Review hook's frontmatter parsing (lines 586-601)
- Ensure new fields are extracted and stored in graph node
- Update graph schema if needed (additive only)

**Warning signs:** Stack field present in entity but missing in graph.db queries.

### Pitfall 5: YAML Parsing in Subagent

**What goes wrong:** Subagent can't parse stack-profiles.yaml reliably.

**Why it happens:** Claude parsing YAML via regex is error-prone.

**How to avoid:**
- Have detect-stacks.js export relevant profile section as JSON
- Or create a separate `get-stack-profile.js` helper
- Subagent receives pre-parsed profile data

**Warning signs:** Regex patterns extracted incorrectly, multiline YAML values truncated.

## Code Examples

### Stack Detection CLI Usage

```bash
# From analyze-codebase.md Step 0
node hooks/lib/detect-stacks.js /project/path json

# Returns:
{
  "projectPath": "/project/path",
  "detected": [
    {
      "stack": "typescript",
      "name": "TypeScript",
      "fileCount": 47,
      "evidence": ["markers: tsconfig.json", "47 source files"],
      "frameworks": [{"name": "react", "evidence": ["package dependencies: react, react-dom"]}],
      "confidence": 85
    },
    {
      "stack": "python",
      "name": "Python",
      "fileCount": 12,
      "evidence": ["markers: requirements.txt", "12 source files"],
      "frameworks": [],
      "confidence": 55
    }
  ],
  "primary": "typescript",
  "isPolyglot": true,
  "stackCount": 2,
  "duration": 234
}
```

### Orchestrator Integration (Step 0)

```markdown
## Step 0: Detect stacks

Run stack detection to identify languages and frameworks:

\`\`\`bash
node hooks/lib/detect-stacks.js $(pwd) json > /tmp/stacks.json
cat /tmp/stacks.json
\`\`\`

Parse the JSON result:
- If `stackCount` is 0, fall back to default JS/TS patterns
- If `isPolyglot` is true, spawn subagent per detected stack
- Store `primary` stack for conventions priority
```

### Subagent Invocation (Step 0.5)

```python
# For each detected stack:
for stack in detected_stacks:
    Task(
        prompt=f"""Analyze {stack.name} stack in this codebase.

**Stack ID:** {stack.stack}
**Project root:** {project_path}
**Confidence:** {stack.confidence}%
**Frameworks:** {stack.frameworks}

**Your job:**
1. Load profile from hooks/lib/stack-profiles.yaml (section: {stack.stack})
2. Find all files matching profile globs
3. Extract exports/imports using profile patterns
4. Detect naming conventions
5. Return JSON with findings (not raw file contents)

**Return format:**
{{
  "stack": "{stack.stack}",
  "files_analyzed": N,
  "exports_found": N,
  "conventions": {{"functions": "...", "classes": "..."}},
  "directories": {{"src": "purpose", ...}}
}}
""",
        subagent_type="gsd-intel-stack-analyzer"
    )
```

### Index.json v2 Schema (Additive)

```json
{
  "version": 2,
  "updated": 1737360330000,
  "primaryStack": "typescript",
  "stacks": ["typescript", "python"],
  "files": {
    "/path/to/file.ts": {
      "exports": ["functionA", "ClassB"],
      "imports": ["react", "./utils"],
      "indexed": 1737360330000,
      "stack": "typescript"
    },
    "/path/to/script.py": {
      "exports": ["main", "helper"],
      "imports": ["os", "json"],
      "indexed": 1737360330000,
      "stack": "python"
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded JS/TS globs | Marker-based detection | This phase | 35+ language support |
| Extension-only detection | Confidence scoring | This phase | Better accuracy |
| Sequential analysis | Parallel subagents | This phase | Preserved context |
| Single conventions.json | Per-stack conventions | This phase | Multi-language projects |

**Current GSD Version:** 1.9.1 (as of feature branch)

## Integration Impact Assessment

### Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `hooks/lib/detect-stacks.js` | ~600 | Stack detection module |
| `hooks/lib/stack-profiles.yaml` | ~1200 | Stack configuration |
| `agents/gsd-intel-stack-analyzer.md` | ~150 | Per-stack analysis subagent |

### Files to Modify

| File | Changes | Impact |
|------|---------|--------|
| `commands/gsd/analyze-codebase.md` | Add Step 0, 0.5; update globs | ~100 lines added |
| `hooks/gsd-intel-index.js` | Extract stack field | ~20 lines |
| `templates/entity.md` (if exists) | Add stack/framework fields | ~10 lines |

### Backward Compatibility

| Component | Single-Stack Behavior | Multi-Stack Behavior |
|-----------|----------------------|---------------------|
| Detection | Falls back to JS/TS | Detects all stacks |
| Index.json | v1 schema still valid | v2 adds stack fields |
| Conventions | Same format | Per-stack sections |
| Entities | Same format | Adds stack frontmatter |
| Graph queries | Same API | Filter by stack possible |

**Critical:** Run test on JS-only project after changes to verify backward compatibility.

## Open Questions

1. **Profile loading in subagent:**
   - What we know: Subagent needs stack profile to apply patterns
   - What's unclear: Should subagent parse YAML directly or receive pre-parsed JSON?
   - Recommendation: Create `hooks/lib/get-stack-profile.js` that returns JSON for specific stack

2. **Entity regeneration trigger:**
   - What we know: Entities get stack field in frontmatter
   - What's unclear: Should existing entities be regenerated to add stack field?
   - Recommendation: Add stack field to new entities only; existing entities remain valid

3. **Conventions.json structure:**
   - What we know: Currently single conventions object
   - What's unclear: Nested by stack or top-level per-stack fields?
   - Recommendation: Nested structure: `{"typescript": {...}, "python": {...}}`

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking JS/TS projects | MEDIUM | HIGH | Extensive backward compatibility testing |
| Detection accuracy | LOW | MEDIUM | Confidence thresholds, marker-first approach |
| Hook compatibility | MEDIUM | MEDIUM | Review and update gsd-intel-index.js |
| Performance regression | LOW | LOW | Parallel subagent execution |
| YAML parsing errors | MEDIUM | MEDIUM | Pre-parse to JSON for subagents |

## Recommended Changes to Plan

1. **File location:** Use `hooks/lib/` not `hooks/` for detect-stacks.js and stack-profiles.yaml

2. **Add helper module:** Create `hooks/lib/get-stack-profile.js` to return JSON profile for a specific stack (avoids YAML parsing in subagent)

3. **Test plan priority:** Add explicit backward compatibility test for JS-only project to Plan 06-06

4. **Hook update task:** Add explicit task to update gsd-intel-index.js for stack field extraction

5. **Entity template:** Verify if `templates/entity.md` exists; if not, document stack fields in gsd-entity-generator.md directly

## Sources

### Primary (HIGH confidence)

- **gsd-philosophy-alignment.md** - Core philosophy validation (git show feature/multi-stack-analyzer)
- **detect-stacks.js reference** - Production-quality implementation (git show feature/multi-stack-analyzer)
- **stack-profiles.yaml reference** - Comprehensive stack configurations (git show feature/multi-stack-analyzer)
- **analyze-codebase.md** - Current implementation analysis (local file)
- **gsd-entity-generator.md** - Existing subagent pattern (local file)
- **gsd-intel-index.js** - PostToolUse hook implementation (local file)

### Secondary (MEDIUM confidence)

- **DECISIONS.md** - Architecture decisions already made
- **PLAN.md** - High-level implementation plan
- **gsd-codebase-mapper.md** - Subagent document writing pattern

## Metadata

**Confidence breakdown:**
- Architecture validation: HIGH - Philosophy docs confirm approach
- File structure: HIGH - Follows existing patterns
- Reference code quality: HIGH - Production-ready with minor gaps
- Integration points: MEDIUM - Hook updates need verification
- Backward compatibility: MEDIUM - Needs testing

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable domain)
