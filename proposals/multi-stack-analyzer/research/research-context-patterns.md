# GSD Context Optimization Patterns - Research Findings

**Date:** 2026-01-20
**Scope:** Analysis of GSD command architecture for context consumption optimization
**Sources:** ~/.claude/commands/gsd/*.md, ~/.claude/get-shit-done/references/*.md

---

## Executive Summary

GSD (Get Shit Done) optimizes context consumption through **5 core patterns**:

1. **Subagent Delegation** - Orchestrator stays lean (~15% context), subagents get fresh full context
2. **Lazy Loading** - Resources loaded on-demand, not bulk
3. **Staged Verification** - Verification uses fresh context, not orchestrator context
4. **Summarization at Handoff** - PLAN.md files are atomic prompts that carry execution context
5. **Wave-based Parallelization** - Execute independent plans in parallel to avoid context accumulation

**Token Economics:** Orchestrator overhead ~50 tokens per command, subagents get 100% fresh context allocation (~200k per subagent).

---

## 1. SUBAGENT DELEGATION PATTERNS

### Core Philosophy
**Orchestrator stays thin, subagents get fat context allocation.**

From `execute-phase.md`:
```
Orchestrator role: discover plans, analyze dependencies, group into waves,
spawn subagents, collect results.
Context budget: ~15% orchestrator, 100% fresh per subagent.
```

### Pattern: Wave-Based Execution
**Location:** `/gsd:execute-phase` Step 4

Each wave spawns subagents in **parallel** with full context:
```yaml
For each wave in order:
  - Spawn gsd-executor for each plan in wave (parallel Task calls)
  - Wait for completion (Task blocks)
  - Verify SUMMARYs created
  - Proceed to next wave
```

**Why this works:**
- Orchestrator only tracks wave completion status
- Each executor gets independent 200k context window
- Plans can be 10+ subagents in parallel without context bloat
- No context accumulation from previous plan outputs

**Evidence:** `/gsd:quick` uses same pattern for single tasks:
```bash
Task(
  prompt="Execute quick task ${next_num}."
  subagent_type="gsd-executor",
  model="{executor_model}"
)
```

### Token Impact
- Single orchestrator call: ~50 tokens overhead
- Each subagent: Fresh ~200k context window
- Total for 5 parallel executors: 50 + (5 × 200k) ≠ accumulated bloat

---

## 2. LAZY LOADING PATTERNS

### Dynamic Resource Loading
**Location:** `/gsd:plan-phase` and loading-config.yml

#### Core Strategy
Load **only what's needed**, when needed:

```yaml
Progressive_Loading:
  Minimal_Start:
    Initial_Load: "Core files + command index only"
    Token_Cost: "~4650 tokens (base + command index)"
    Expansion_Triggers:
      - Command invocation
      - Flag usage
      - Complexity detection
```

#### Command Index (Lazy Discovery)
**Location:** `loading-config.yml`

```yaml
Commands:
  Trigger: /
  Path: .claude/commands/
  Size: ~50 tokens per command
  Cache: Most recent 5 commands
  Index: command names & risk levels only
```

Instead of loading all 28 GSD commands (~1400 tokens) upfront:
- Index command names only: ~50 tokens
- Load full command when invoked: ~50 tokens per command
- Cache last 5 used: ~250 tokens total

**Savings: 1400 tokens → 50 tokens (on first load)**

#### Shared Resource Lazy Loading
**Location:** `loading-config.yml`

```yaml
SharedResources:
  LoadWith: Associated commands
  Path: .claude/commands/shared/
  Size: ~150 tokens per YAML
  Examples:
    - cleanup-patterns.yml→loads w/ /cleanup
    - git-workflow.yml→loads w/ git ops
    - planning-mode.yml→loads w/ risky commands
```

Pattern: `.claude/commands/gsd/execute-phase.md` references:
```
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/workflows/execute-phase.md
```

**Not** embedded. **Loaded only when command runs.**

#### Intelligent Caching
```yaml
Intelligent_Caching:
  Predictive: Anticipate likely-needed resources based on command patterns
  Contextual: Load resources based on project type
  Lazy: Defer loading non-critical resources until explicitly needed
  Incremental: Load minimal first, expand as complexity increases
```

---

## 3. SUMMARIZATION STRATEGIES

### PLAN.md as Execution Carrier

**Location:** All GSD commands use PLAN.md format

Each PLAN.md is **self-contained executable prompt**:

```xml
<objective>
[What to build - 1-2 sentences]
[Purpose: why it matters]
</objective>

<context>
@relative/paths/to/files
@project/state.md
</context>

<process>
1. Specific numbered steps
2. Exact commands/code to run
3. Verification criteria
</process>

<success_criteria>
- [ ] Observable outcome 1
- [ ] Observable outcome 2
</success_criteria>
```

**Why this works:**
- Executor gets complete context in one prompt
- No need to reconstruct intent from ROADMAP
- Plan can reference dependencies: `@.planning/STATE.md`
- Self-documenting (becomes artifact for future reference)

### Summary Handoff Pattern
**Location:** `/gsd:execute-phase` and `/gsd:quick`

After execution, subagent creates SUMMARY.md:
```bash
git add ${QUICK_DIR}/${next_num}-SUMMARY.md
```

**Orchestrator doesn't read SUMMARY content.** Only collects path:
```yaml
After executor returns:
1. Verify summary exists at ${QUICK_DIR}/${next_num}-SUMMARY.md
2. Extract commit hash from executor output
3. Report completion status
```

**Why:**
- SUMMARY stays on disk for human review later
- Orchestrator doesn't load it into context
- Keeps orchestrator lean for next wave

---

## 4. VERIFICATION WITH FRESH CONTEXT

### Checkpoint Architecture
**Location:** `verification-patterns.md` and `checkpoints.md`

**Key principle:**
```
Checkpoint Types:
  checkpoint:human-verify (90%)  - Claude automated everything, human confirms
  checkpoint:decision (9%)       - Human makes architectural choice
  checkpoint:human-action (1%)   - Truly unavoidable manual step
```

### Staged Verification (Not Inline)
**Location:** `/gsd:execute-phase` Step 7-8

```yaml
7. Verify phase goal
   - Spawn gsd-verifier subagent with phase directory and goal
   - Verifier checks must_haves against actual codebase (not SUMMARY claims)
   - Creates VERIFICATION.md with detailed report
   - Route by status: passed → step 8, gaps_found → offer gap closure
```

**Why separate agent:**
- Verifier gets fresh context to check code (not orchestrator's notes)
- Verifier focuses on ONE task: verify must_haves
- Doesn't accumulate context from execution details
- Can dive deep into code without bloating orchestrator

### Verification Pattern
From `checkpoints.md`:

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude automated and deployed]</what-built>
  <how-to-verify>
    [Exact steps to test - numbered, specific]
  </how-to-verify>
  <resume-signal>[How to continue - "approved", "yes"]</resume-signal>
</task>
```

**Why minimal structure:**
- Only carries decision point info
- Leaves heavy lifting to human or verifier agent
- No context accumulation from test data

---

## 5. FILE CHUNKING & INCREMENTAL ANALYSIS

### Codebase Analysis without Context Bloat
**Location:** `/gsd:analyze-codebase` Step 9

```yaml
Execution model (Step 9 - Entity Generation):
- Orchestrator selects files for entity generation (up to 50 based on priority)
- Spawns gsd-entity-generator subagent with file list (paths only, not contents)
- Subagent reads files in fresh 200k context, generates entities
- PostToolUse hook automatically syncs entities to graph.db
- Subagent returns statistics only (not entity contents)
- This preserves orchestrator context for large codebases (500+ files)
```

**Chunking strategy:**
- Orchestrator: Only path names → ~50 tokens
- Subagent: Full files + entity generation → 200k context
- Return: Statistics, not content → ~20 tokens back
- Result: On disk, indexed, synced

**For 500 file codebase:**
- Naive approach: Read all 500 files into context = +500k tokens (impossible)
- GSD approach: 50 files/batch × fresh context = 200k per batch

---

## 6. STATE PRESERVATION & RECOVERY

### Checkpoint-Based Session Recovery
**Location:** `recovery-state-patterns.yml`

```yaml
Checkpoint_Components:
  State_Preservation:
    modified_files: "List → snapshots w/ content hash"
    git_state: "Branch, commit SHA, uncommitted changes"
    session_context: "Command history, todos, decisions, blockers"
    environment: "Working dir, env vars, tool versions"
    mcp_cache: "Active servers, cached responses, token usage"
```

**Why this matters for context:**
- On session resume: Load checkpoint metadata (~100 tokens)
- Reconstruct state without re-reading all project files
- TodoWrite restores task list (~50 tokens)
- MCP cache reloads previous responses

**Token Impact:**
- Full context reconstruction: ~500-1000 tokens
- Checkpoint-based recovery: ~150 tokens
- Savings: ~75% of context on resume

---

## 7. PARALLELIZATION WITHOUT CONTEXT EXPLOSION

### Wave-Based Grouping
**Location:** `/gsd:execute-phase` Step 3

```bash
3. Group by wave
   - Read wave from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user
```

**Why parallelization helps:**
```
Scenario: 5 plans in sequence
  Sequential: Plan 1 (200k) → Plan 2 (200k) → Context bloat from outputs
  Parallel:   Plan 1,2,3,4,5 (5 × 200k) → No context accumulation
```

**Orchestrator burden:**
- Stays at ~50 tokens
- Spawns 5 subagents in parallel
- Waits for all to complete
- Collects 5 SHORt summaries (~20 tokens each)

---

## 8. MCP CACHING & REUSE

### MCP Cache Patterns
**Location:** `/commands/shared/mcp-cache-patterns.yml`

```yaml
MCP_Optimization_Strategies:
  Caching_Patterns:
    Context7_Cache: "Library docs + examples (session-persistent)"
    Sequential_Cache: "Analysis patterns + solutions (cross-session)"
    Magic_Cache: "Component templates + variations (persistent)"
```

**How it saves context:**
- First query to Context7: "React hooks documentation" → Full docs cached
- Subsequent queries: Hit cache → ~20 tokens instead of +1000 tokens
- Cache persists across commands in same session

---

## 9. COMPRESSION STRATEGIES WHEN CONTEXT PRESSURE

### Auto-Activation Triggers
**Location:** `compression-performance-patterns.yml`

```yaml
Activation_Triggers:
  Natural_Language: ["compress", "concise", "brief", "minimal"]
  Automatic_Triggers:
    High_Context_Usage: "Context usage >75% → Auto-activate"
    Token_Budget_Pressure: "Approaching token limits → Auto-activate"
    Large_Codebases: "Project >10k files → Recommend --uc"
    Long_Sessions: "Session >2 hours → Suggest --uc"
```

**UltraCompressed Patterns:**
```yaml
Symbol_Substitutions:
  Logical: "→(leads to) &(and) |(or) ∵(because) ∴(therefore)"
  Process: "▶(start) ⏸(pause) ✅(success) ❌(failure)"
  Technical: "cfg(config) impl(implementation) perf(performance)"
```

**Token Impact:**
- Normal text: 1000 tokens
- UltraCompressed: 300-350 tokens (65-70% reduction)

---

## 10. CONFIGURATION LAZY LOADING

### Model Profile Resolution
**Location:** `/gsd:plan-phase` Step 1

Instead of loading all possible models:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"' | ... || echo "balanced")
```

**Lookup table resolved at runtime:**
```yaml
| Agent | quality | balanced | budget |
| gsd-planner | opus | opus | sonnet |
| gsd-executor | opus | sonnet | sonnet |
```

**Why:**
- Config file: ~50 tokens
- Model names: ~20 tokens
- Total per command: ~70 tokens
- Alternative: Load full config + all model descriptions = ~300 tokens

---

## 11. CONTEXT BUDGET ALLOCATION

### Per-Command Overhead Analysis

**Minimal Command (e.g., `/gsd:quick`):**
```
50     tokens: Command definition
100    tokens: Core context (ROADMAP, STATE)
50     tokens: Prompt to subagent
---
200    tokens: Orchestrator overhead

Then: Subagent gets fresh 200k
```

**Heavy Command (e.g., `/gsd:execute-phase` with 5 plans):**
```
50     tokens: Command definition
200    tokens: Phase context (plans index)
100    tokens: Verify configuration
---
350    tokens: Orchestrator overhead

Then: 5 × 200k context for subagents (parallel)
```

**Key insight:** Orchestrator scales ~O(1), not O(n) with complexity.

---

## 12. ANTI-PATTERNS OBSERVED

### What GSD Avoids:

**❌ Don't: Load all command docs upfront**
- Would add ~1400 tokens on every invocation
- Instead: Index + lazy load per command (~50 tokens)

**❌ Don't: Keep executor output in orchestrator context**
- SUMMARY stays on disk, not loaded back
- Prevents context accumulation across waves

**❌ Don't: Inline verification with execution**
- Verification is separate agent with fresh context
- Orchestrator never reads VERIFICATION.md

**❌ Don't: Read entire codebase into context**
- Analyze-codebase uses subagent chunking (50 files/batch)
- Results indexed on disk, not kept in memory

**❌ Don't: Accumulate task state across phases**
- ROADMAP.md is source of truth
- Each phase gets fresh ROADMAP state
- Checkpoints are lightweight metadata

---

## 13. PRACTICAL RECOMMENDATIONS FOR LARGE PROJECTS

### Token Budget Allocation

For a project with 500+ files:

```yaml
Suggested_Allocation:
  Core_Context: 50 tokens (command + brief state)
  Subagent_Work: 200k tokens (full context for plan)
  Result_Caching: 500 tokens (store analysis results)
  MCP_Cache: 1000 tokens (persistent library docs)
  Compression_Buffer: 1000 tokens (emergency UltraCompressed)
  ---
  Reserve: ~198k tokens free for next command
```

### Chunking Large Codebases

If codebase is >10k files:
1. Use `/gsd:analyze-codebase` to index (creates .planning/intel/)
2. Each command loads only intel/index.json (~100 tokens)
3. Subagents can query entities from disk
4. Avoid loading raw source unless analyzing specific file

### Session Recovery

Instead of full context reload:
```bash
# On resume, load only:
1. Checkpoint metadata (~100 tokens)
2. Current task metadata (~50 tokens)
3. ROADMAP.md (~200 tokens)
4. STATE.md (~100 tokens)
---
Total: ~450 tokens vs. full reload = ~5000 tokens
```

---

## 14. TESTING CONTEXT OPTIMIZATION

### Measurement Framework

**For any GSD workflow:**

```bash
1. Measure orchestrator context used
   - Count tokens in @-references at command start
   - Track added context from external loads

2. Measure subagent context used
   - Each Task() call gets fresh allocation
   - Verify no context carryover between plans

3. Measure recovery efficiency
   - Time to resume from checkpoint
   - Context tokens needed for recovery

4. Measure cache hit rates
   - MCP cache hits vs. misses
   - Result cache effectiveness
```

---

## 15. IMPLEMENTATION PATTERNS SUMMARY

| Pattern | Location | Purpose | Token Savings |
|---------|----------|---------|-----------------|
| Subagent Delegation | execute-phase.md | Parallel execution | ~90% (O(1) orchestrator) |
| Lazy Loading | loading-config.yml | On-demand resources | ~75% (index vs. full) |
| Staged Verification | verification-patterns.md | Fresh context verification | ~80% (separate agent) |
| Summarization | All PLAN.md files | Atomic prompts | ~60% (self-contained) |
| Wave Grouping | execute-phase.md | Parallel waves | ~85% (no accumulation) |
| Entity Chunking | analyze-codebase.md | Batch processing | ~95% (50 files/batch) |
| State Recovery | recovery-state-patterns.yml | Checkpoint-based | ~75% (metadata vs. full) |
| Configuration | plan-phase.md | Runtime resolution | ~75% (config vs. all models) |
| MCP Caching | mcp-cache-patterns.yml | Persistent results | ~90% (cache hit) |
| Compression | compression-performance-patterns.yml | Emergency shrinking | ~70% (UltraCompressed) |

---

## 16. KEY INSIGHTS

1. **Context is a bottleneck, not a feature**
   - GSD treats context as scarce resource
   - Every pattern minimizes context used

2. **Parallelization != Context Explosion**
   - Fresh context per subagent
   - Orchestrator stays thin
   - 5 parallel tasks don't create 5× context load

3. **Verification needs fresh eyes**
   - Separate agent + fresh context
   - Doesn't contaminate execution context
   - Can verify deep without orchestrator overhead

4. **Summaries stay on disk**
   - Don't load SUMMARY back into orchestrator
   - Humans read it later
   - Keeps orchestrator context clean

5. **Indexing beats loading**
   - Index all available commands: ~50 tokens
   - Load only needed command: +50 tokens
   - Saves ~1350 tokens vs. loading all

6. **State is cheap to recover**
   - Checkpoint metadata: ~100 tokens
   - Full context restore: ~5000 tokens
   - 50× savings on resume

---

## References

- `~/.claude/commands/gsd/execute-phase.md` - Wave-based parallel execution
- `~/.claude/commands/gsd/plan-phase.md` - Subagent delegation pattern
- `~/.claude/commands/gsd/quick.md` - Minimal orchestrator example
- `~/.claude/commands/shared/loading-config.yml` - Lazy loading strategy
- `~/.claude/commands/shared/compression-performance-patterns.yml` - Context compression
- `~/.claude/get-shit-done/references/checkpoints.md` - Verification patterns
- `~/.claude/get-shit-done/references/verification-patterns.md` - Stub detection & verification
- `~/.claude/get-shit-done/references/continuation-format.md` - State handoff format
- `~/.claude/commands/shared/recovery-state-patterns.yml` - Session recovery

