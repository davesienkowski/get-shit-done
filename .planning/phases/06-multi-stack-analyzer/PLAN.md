# Phase 6: Multi-Stack Analyzer Enhancement

**Goal:** Extend `/gsd:analyze-codebase` to support 35+ programming languages while preserving GSD's context optimization philosophy.

**GitHub Issue:** https://github.com/glittercowboy/get-shit-done/issues/202

**Branch:** `feature/multi-stack-analyzer-impl` on `myfork`

---

## Critical Architecture Decision

**DO NOT** put all stack detection logic inline in `analyze-codebase.md`.

This violates GSD's core philosophy:
> "Burn subagent context freely, preserve orchestrator context religiously."

**Correct approach:**
1. Orchestrator stays lightweight (~50 tokens)
2. Stack detection delegated to JavaScript helper
3. Per-stack analysis delegated to subagents
4. Profiles loaded lazily (only detected stacks)

---

## Plans

### Plan 06-01: Stack Detection Module
**Wave 1 - Foundation**

Create `hooks/lib/detect-stacks.js`:
- Marker file detection (package.json, go.mod, Cargo.toml, *.csproj, etc.)
- Confidence scoring (marker exists: +50, framework detected: +30, source files: +20)
- Framework detection within stacks (React, Django, Blazor, etc.)
- Returns JSON array of detected stack IDs

**Files to create:**
- `hooks/lib/detect-stacks.js` (~200 lines)

**Token budget:** Detection runs once, returns compact JSON (~50 tokens to orchestrator)

### Plan 06-02: Stack Profiles Configuration
**Wave 1 - Foundation (parallel with 06-01)**

Create `hooks/lib/stack-profiles.yaml`:
- 12 primary stacks (JS/TS, Python, Go, Rust, C#, PowerShell, PHP, Ruby, Java, Kotlin, SQL, Swift)
- Per-stack: globs, excludes, export patterns, import patterns, naming conventions
- Framework-specific patterns nested under each stack
- Lazy-loadable structure (load only detected stacks)

**Files to create:**
- `hooks/lib/stack-profiles.yaml` (~500 lines)

**Token budget:** Profiles loaded by subagents, not orchestrator

### Plan 06-03: Stack Analyzer Subagent
**Wave 2 - Depends on 06-01, 06-02**

Create `agents/gsd-intel-stack-analyzer.md`:
- Receives: stack ID, project root
- Loads: only its stack profile from YAML
- Analyzes: files matching stack patterns
- Outputs: JSON with entities, exports, imports for that stack
- Fresh 200k context per stack (no accumulation)

**Files to create:**
- `agents/gsd-intel-stack-analyzer.md` (~150 lines)

**Token budget:** Each subagent uses ~800 tokens independently

### Plan 06-04: Lightweight Orchestrator Update
**Wave 3 - Depends on 06-01, 06-02, 06-03**

Update `commands/gsd/analyze-codebase.md`:
- Step 0: Call detect-stacks.js (via Bash), get JSON result (~50 tokens)
- Step 0.5: For each detected stack, spawn gsd-intel-stack-analyzer subagent
- Steps 1-9: Mostly unchanged, but use merged results from subagents
- Output: stacks.json, updated index.json (v2), conventions.json (per-stack)

**Files to modify:**
- `commands/gsd/analyze-codebase.md` (add ~100 lines, not 500+)

**Token budget:** Orchestrator stays at ~50-100 tokens for stack handling

### Plan 06-05: Entity Template Update
**Wave 3 - Parallel with 06-04**

Update `get-shit-done/templates/entity.md`:
- Add frontmatter fields: stack, language, framework
- Add stack-specific type values documentation
- Update example to show stack fields

**Files to modify:**
- `get-shit-done/templates/entity.md` (~30 lines added)

### Plan 06-06: Integration & Testing
**Wave 4 - Depends on all above**

- Test on JS/TS-only project (backward compatibility)
- Test on polyglot project (multi-stack detection)
- Verify token budget (~2,850 tokens, not 7,200)
- Verify parallel subagent execution
- Create PR to upstream

---

## Wave Structure

```
Wave 1 (parallel):
├── 06-01: detect-stacks.js
└── 06-02: stack-profiles.yaml

Wave 2:
└── 06-03: gsd-intel-stack-analyzer subagent

Wave 3 (parallel):
├── 06-04: analyze-codebase.md (lightweight update)
└── 06-05: entity.md template update

Wave 4:
└── 06-06: Integration & testing
```

---

## Token Budget Comparison

| Approach | Orchestrator | Per-Stack | Total (2 stacks) |
|----------|-------------|-----------|------------------|
| **Naive (WRONG)** | 500+ tokens | 1000+ each | 7,200+ tokens |
| **Optimized (CORRECT)** | ~50 tokens | ~800 each (parallel) | ~2,850 tokens |

---

## Key Files Reference

**Proposal docs (on feature/multi-stack-analyzer branch):**
- `proposals/multi-stack-analyzer/gsd-philosophy-alignment.md` - Philosophy guide
- `proposals/multi-stack-analyzer/gsd-analyzer-enhancements.md` - Technical spec
- `proposals/multi-stack-analyzer/implementation/analyzer-context-optimization.md` - Token optimization
- `proposals/multi-stack-analyzer/implementation/detect-stacks.js` - Reference implementation
- `proposals/multi-stack-analyzer/implementation/stack-profiles.yaml` - Reference profiles

**To access proposal docs:**
```bash
git show feature/multi-stack-analyzer:proposals/multi-stack-analyzer/[filename]
```

---

## Success Criteria

- [ ] Stack detection works via `hooks/lib/detect-stacks.js`
- [ ] Stack profiles loadable from `hooks/lib/stack-profiles.yaml`
- [ ] Subagent `gsd-intel-stack-analyzer` generates per-stack entities
- [ ] Orchestrator stays lightweight (~50-100 tokens for stack handling)
- [ ] Total token budget ~2,850 (same as single-stack baseline)
- [ ] JS/TS-only projects work identically (backward compatible)
- [ ] Polyglot projects get unified intelligence across all stacks
- [ ] PR submitted to upstream (closes #202)

---

## Resume Instructions

```bash
# Switch to implementation branch
git checkout feature/multi-stack-analyzer-impl

# Read this plan
cat .planning/phases/06-multi-stack-analyzer/PLAN.md

# Start with Wave 1
# Create detect-stacks.js and stack-profiles.yaml in parallel
```

Or use GSD:
```
/gsd:progress
```
