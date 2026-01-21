# Architecture Decisions - Multi-Stack Analyzer

## Decision 1: Subagent Delegation Over Inline Logic

**Context:** Initial implementation put all stack detection patterns inline in analyze-codebase.md.

**Problem:** This bloated the orchestrator context from ~50 tokens to 500+ tokens, violating GSD's core philosophy.

**Decision:** Use subagent delegation pattern:
- Orchestrator calls `detect-stacks.js` via Bash (returns JSON)
- Orchestrator spawns `gsd-intel-stack-analyzer` per detected stack
- Each subagent loads only its stack profile
- Results merged back to orchestrator

**Rationale:**
> "Burn subagent context freely, preserve orchestrator context religiously."
> — GSD Philosophy

**Token Impact:**
- Naive: 7,200 tokens (all patterns in orchestrator)
- Optimized: 2,850 tokens (same as single-stack)

---

## Decision 2: JavaScript Module for Stack Detection

**Context:** Stack detection needs to check 20+ marker file patterns.

**Decision:** Create `hooks/lib/detect-stacks.js` as a standalone Node.js module.

**Rationale:**
1. Detection logic is file-system heavy (glob patterns)
2. JavaScript runs faster than Claude interpreting regex
3. Returns compact JSON to orchestrator (~50 tokens)
4. Can be unit tested independently
5. Follows pattern of existing hooks (gsd-intel-index.js, etc.)

**Interface:**
```javascript
// Usage from Bash in analyze-codebase.md
node hooks/lib/detect-stacks.js /project/root

// Returns JSON to stdout
{"stacks": ["typescript", "python"], "primary": "typescript", "polyglot": true}
```

---

## Decision 3: YAML for Stack Profiles

**Context:** Need to define patterns for 12+ language stacks.

**Decision:** Create `hooks/lib/stack-profiles.yaml` with lazy-loadable structure.

**Rationale:**
1. YAML is human-readable and easy to extend
2. Profiles can be loaded lazily (only detected stacks)
3. Easy for contributors to add new language support
4. Follows declarative configuration pattern
5. ~500 lines covers 12 primary stacks

**Structure:**
```yaml
stacks:
  python:
    globs: ["**/*.py"]
    excludes: ["__pycache__", "venv"]
    export_patterns: [...]
    import_patterns: [...]
    naming: {functions: snake_case, classes: PascalCase}
```

---

## Decision 4: Per-Stack Subagent Architecture

**Context:** Analyzing multiple stacks sequentially accumulates context.

**Decision:** Create `gsd-intel-stack-analyzer` subagent, spawn one per detected stack.

**Rationale:**
1. Each subagent gets fresh 200k context
2. Stacks analyzed in parallel (wave execution)
3. No context accumulation between stacks
4. Follows existing pattern (gsd-entity-generator, gsd-codebase-mapper)
5. Results merged at orchestrator level

**Flow:**
```
Orchestrator (50 tokens)
├── spawn: stack-analyzer for "typescript" (800 tokens, fresh context)
├── spawn: stack-analyzer for "python" (800 tokens, fresh context)
└── merge results into summary.md
```

---

## Decision 5: Additive Schema Changes Only

**Context:** index.json, conventions.json, entity frontmatter need stack info.

**Decision:** Add new fields, don't modify existing ones.

**Rationale:**
1. Backward compatibility with existing tooling
2. Single-stack projects continue working unchanged
3. Hook compatibility preserved (gsd-intel-session.js, etc.)
4. Migration path: existing data remains valid

**Schema additions:**
```json
// index.json v2 (additive)
{
  "version": 2,
  "primaryStack": "typescript",
  "stacks": ["typescript", "python"],
  "files": {
    "/path/to/file.ts": {
      "stack": "typescript",  // NEW field
      // existing fields unchanged
    }
  }
}
```

---

## Decision 6: Preserve Orchestrator Command Structure

**Context:** analyze-codebase.md has 10 steps that work for JS/TS.

**Decision:** Add Step 0 (stack detection) and Step 0.5 (subagent spawn), keep rest similar.

**Rationale:**
1. Minimal changes to existing flow
2. Steps 1-9 continue working for single-stack
3. Multi-stack handled by subagent delegation
4. Easy to understand/maintain

**Changes:**
- Add Step 0: Detect stacks (call detect-stacks.js)
- Add Step 0.5: Spawn subagents for each stack
- Step 2: Use detected stack globs (fallback to JS/TS)
- Steps 3-9: Mostly unchanged

---

## Anti-Patterns to Avoid

1. **DON'T** put all export/import patterns inline in markdown
2. **DON'T** load all stack profiles upfront
3. **DON'T** analyze stacks sequentially (accumulates context)
4. **DON'T** modify existing schema fields (break compatibility)
5. **DON'T** require user input during analysis
6. **DON'T** block on errors (log and continue)

---

## References

- GSD Philosophy: `proposals/multi-stack-analyzer/gsd-philosophy-alignment.md`
- Token Optimization: `proposals/multi-stack-analyzer/implementation/analyzer-context-optimization.md`
- Technical Spec: `proposals/multi-stack-analyzer/gsd-analyzer-enhancements.md`
