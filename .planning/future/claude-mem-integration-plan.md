# Claude-Mem Integration Plan for Get-Shit-Done

> **Status:** Future Enhancement (Not Yet Implemented)
> **Created:** 2026-01-09
> **Source:** Analysis of claude-mem plugin (https://github.com/thedotmack/claude-mem)

## Quick Summary

**What it does:** Adds optional persistent memory to GSD that tracks your decisions, issues, and patterns across sessions and projects.

**How it works:**
- During `/gsd:new-project`, GSD detects if claude-mem is installed
- If found, asks if you want to enable it (opt-in)
- When enabled, claude-mem passively observes your work via hooks
- Workflows query this history for relevant context

**Key enhancements:**

| Workflow | What claude-mem adds |
|----------|---------------------|
| `plan-phase` | Surfaces past decisions related to current work |
| `consider-issues` | Detects recurring issue patterns |
| `resume-project` | Injects recent session context |

**Long-term benefits:**
- Cross-project learning ("What auth approach worked in Project X?")
- Pattern recognition ("This type of issue keeps recurring")
- Velocity insights across all your GSD projects

**Backwards compatible:** GSD works exactly as before if claude-mem isn't installed or is disabled. All memory features are additive and optional.

### Overlap Analysis

| Feature | GSD Approach | Claude-Mem Approach | Overlap? |
|---------|-------------|---------------------|----------|
| **Session Continuity** | STATE.md + agent-history.json | Automatic observation capture | Complementary |
| **Decision Tracking** | PROJECT.md Decisions section | Observation database | Replaceable |
| **Context Injection** | Manual file loading per workflow | Automatic session start injection | Complementary |
| **Search** | Frontmatter scanning in SUMMARY files | Semantic + full-text search | Claude-mem superior |
| **Cross-Project Learning** | None | Built-in | Claude-mem adds capability |
| **Subagent Tracking** | agent-history.json (new) | No subagent awareness | GSD unique |

### Workflow Touchpoints

| Workflow | Current Context Source | Claude-Mem Enhancement |
|----------|----------------------|------------------------|
| resume-project | STATE.md + agent-history.json | Add: recent observations for context |
| plan-phase | SUMMARY frontmatter scan | Add: semantic search for relevant decisions |
| execute-phase | PLAN.md only | Add: observe task completions |
| discuss-phase | User Q&A | Add: surface past similar discussions |
| verify-work | UAT-ISSUES.md | Add: observe test failures for patterns |
| consider-issues | ISSUES.md review | Add: pattern search across sessions |

---

## Executive Summary

This plan outlines how to integrate claude-mem as an **opt-in enhancement** for GSD, following GSD's existing patterns for feature detection and user preferences.

---

## Integration Design

### A. Detection & Opt-In Flow

**During `/gsd:new-project` (after mode/depth questions):**

```
# Step: Check for claude-mem availability
CLAUDE_MEM_AVAILABLE=$(claude mcp list 2>/dev/null | grep -q "claude-mem" && echo "yes")

<if CLAUDE_MEM_AVAILABLE="yes">
  Use AskUserQuestion:
  - header: "Memory"
  - question: "Claude-mem detected. Enable persistent memory for this project?"
  - options:
    - "Enable memory" — Track decisions, patterns, cross-session insights
    - "Skip for now" — Use standard GSD context only
</if>
```

### B. Config.json Extension

```json
{
  "mode": "interactive",
  "depth": "standard",
  "memory": {
    "enabled": true,
    "observe_decisions": true,
    "observe_issues": true,
    "inject_on_plan": true,
    "cross_project": false
  },
  "gates": { ... },
  "safety": { ... }
}
```

### C. Workflow Touchpoints

| Workflow | Memory Integration |
|----------|-------------------|
| **new-project** | Detect claude-mem, ask preference, store in config |
| **plan-phase** | Query relevant observations before planning |
| **execute-phase** | Observe task completions and deviations |
| **discuss-phase** | Surface past similar discussions |
| **consider-issues** | Search for recurring issue patterns |
| **resume-project** | Inject recent observations for context |

---

## 1. What Each System Does

### Get-Shit-Done (GSD)
A **meta-prompting and context engineering system** for Claude Code that enables:
- Spec-driven development with session continuity
- Subagent orchestration with fresh 200k token contexts
- Layered context files (PROJECT → ROADMAP → STATE → PLAN → SUMMARY)
- Dependency graph via YAML frontmatter in SUMMARY files
- Agent resume capability (Phase 10 - in progress)

### Claude-Mem
A **persistent memory plugin** for Claude Code that provides:
- Automatic observation capture via lifecycle hooks
- SQLite + Chroma vector storage with semantic search
- Progressive disclosure workflow (search → timeline → get_observations)
- Cross-session knowledge retrieval (~10x token savings via filtering)

---

## 2. Overlap Analysis

| Feature | GSD Approach | Claude-Mem Approach | Overlap? |
|---------|-------------|---------------------|----------|
| **Session Continuity** | STATE.md + agent-history.json | Automatic observation capture | Complementary |
| **Decision Tracking** | PROJECT.md Decisions section | Observation database | Replaceable |
| **Context Injection** | Manual file loading per workflow | Automatic session start injection | Complementary |
| **Search** | Frontmatter scanning in SUMMARY files | Semantic + full-text search | Claude-mem superior |
| **Cross-Project Learning** | None | Built-in | Claude-mem adds capability |
| **Subagent Tracking** | agent-history.json (new) | No subagent awareness | GSD unique |

---

## 3. Integration Opportunities

### A. Enhance (Use Both Systems Together)

**1. Decision Observation Bridge**
- GSD captures decisions in PROJECT.md and SUMMARY.md
- Claude-mem could observe these decisions automatically
- Enables: "What decisions have we made about authentication across all projects?"

**2. Issue Discovery Pattern Recognition**
- GSD logs issues in ISSUES.md with effort estimates
- Claude-mem could track patterns: "What types of issues recur most?"
- Enables: Predictive issue prevention based on historical patterns

**3. Velocity Analytics**
- GSD tracks execution time in STATE.md (2.6 min avg)
- Claude-mem could build long-term velocity trends
- Enables: "Which phase types take longest?" insights

**4. Subagent Execution Observability**
- GSD spawns subagents for plan execution
- Claude-mem could capture what each subagent discovers
- Enables: Real-time observability during autonomous execution

### B. Replace (Claude-Mem Could Supersede)

**1. Decision History in PROJECT.md**
- Current: Manual section in markdown
- Claude-mem: Queryable observation database
- Recommendation: Use claude-mem for query, keep PROJECT.md as source of truth

**2. ISSUES.md Pattern Tracking**
- Current: Manual list with effort estimates
- Claude-mem: Could auto-categorize and surface recurring patterns
- Recommendation: Hybrid - ISSUES.md for active tracking, claude-mem for historical analysis

**3. Context Assembly in plan-phase**
- Current: Scans SUMMARY.md frontmatter (first 25 lines each)
- Claude-mem: Semantic search could surface relevant context
- Recommendation: Claude-mem for discovery, frontmatter for explicit dependencies

---

## 4. Integration Architecture

### Option A: Observation Layer (Recommended)

```
GSD Workflows
     ↓
[PostToolUse Hook] → claude-mem observations
     ↓
STATE.md / SUMMARY.md (unchanged)
     ↓
[SessionStart Hook] → inject relevant observations
```

**Benefits:**
- Zero changes to GSD file structure
- Additive enhancement only
- Queryable history without workflow modifications

### Option B: Deep Integration

```
GSD Workflows
     ↓
decision → observe("decision", {...})
issue → observe("issue", {...})
     ↓
claude-mem MCP tools for context assembly
```

**Benefits:**
- Richer observation metadata
- Direct integration with GSD concepts
- Cross-project insights

**Costs:**
- Requires workflow modifications
- Additional complexity
- Dependency on claude-mem availability

---

## 5. Specific Enhancement Points

### Already Prepared
GSD already has `CLAUDE.md` files with claude-mem context blocks:
```markdown
<claude-mem-context>
# Recent Activity
*No recent activity*
</claude-mem-context>
```

These exist in:
- `.planning/CLAUDE.md`
- `.planning/phases/XX-name/CLAUDE.md`
- `get-shit-done/workflows/CLAUDE.md`
- `get-shit-done/templates/CLAUDE.md`

**This is the integration point already waiting for claude-mem.**

### Workflow Touchpoints

| Workflow | Current Context Source | Claude-Mem Enhancement |
|----------|----------------------|------------------------|
| resume-project | STATE.md + agent-history.json | Add: recent observations for context |
| plan-phase | SUMMARY frontmatter scan | Add: semantic search for relevant decisions |
| execute-phase | PLAN.md only | Add: observe task completions |
| discuss-phase | User Q&A | Add: surface past similar discussions |
| verify-work | UAT-ISSUES.md | Add: observe test failures for patterns |

---

## 6. Recommendation

### Short-term: Enable Passive Observation
1. Install claude-mem alongside GSD
2. Let hooks capture observations automatically
3. Use MCP search tools to query history when useful
4. No GSD modifications required

### Medium-term: Enhance Context Assembly
1. Modify `/gsd:plan-phase` to query claude-mem for relevant decisions
2. Add observation types for GSD concepts (decision, issue, phase-complete)
3. Surface patterns in `/gsd:consider-issues`

### Long-term: Cross-Project Intelligence
1. Query observations across multiple GSD-managed projects
2. Build project templates based on successful patterns
3. Predictive phase planning based on historical execution

---

## 7. What NOT to Replace

Keep GSD's file-based system for:
- **STATE.md**: Quick human-readable status (essential for non-Claude access)
- **SUMMARY.md frontmatter**: Explicit dependency declarations
- **PLAN.md structure**: Atomic task definitions for subagent execution
- **agent-history.json**: Subagent resume capability (claude-mem unaware of subagents)

These provide deterministic behavior that semantic search cannot guarantee.

---

## 8. Implementation Plan (Full Integration with Backwards Compatibility)

**Scope:** Detection, opt-in, passive observation, AND query integration. All features gracefully degrade when claude-mem is unavailable.

**Backwards Compatibility Principle:** Every claude-mem integration point uses conditional logic:
```
<if memory.enabled AND claude-mem available>
  # Use claude-mem features
</if>
# Always continue with standard GSD behavior regardless
```

---

### Phase 1: Foundation (Config + Detection)

#### Task 1.1: Update config.json template

**File:** `get-shit-done/templates/config.json`

```json
{
  "mode": "interactive",
  "depth": "standard",
  "memory": {
    "enabled": false,
    "query_on_plan": true,
    "query_on_issues": true,
    "cross_project": false
  },
  "gates": { ... },
  "safety": { ... }
}
```

#### Task 1.2: Add detection + opt-in to new-project.md

**File:** `commands/gsd/new-project.md`

Add after mode/depth preference questions:

```markdown
## Step: Memory Integration (Optional)

# Detection - attempt to use claude-mem MCP search tool
# If tools like mcp__plugin_claude-mem_mcp-search__search exist, claude-mem is available

<if claude-mem MCP tools available>
  Use AskUserQuestion:
  - header: "Memory"
  - question: "Claude-mem detected. Enable persistent memory for cross-session insights?"
  - options:
    - "Enable" — Track decisions/patterns, query history during planning
    - "Skip" — Use standard GSD context only (can enable later)

  <if user selects "Enable">
    Set memory.enabled = true in config.json
  </if>
</if>

<if claude-mem NOT available>
  # Silently continue - GSD works perfectly without claude-mem
  # Don't add memory section to config (or set enabled: false)
</if>
```

---

### Phase 2: Query Integration (Short-term)

#### Task 2.1: Enhance plan-phase.md with memory query

**File:** `get-shit-done/workflows/plan-phase.md`

Add BEFORE the existing context loading steps:

```markdown
## Step: Query Memory Context (Optional)

<if memory.enabled AND memory.query_on_plan>
  # Query claude-mem for relevant past decisions and patterns

  Use mcp__plugin_claude-mem_mcp-search__search:
  - query: "{phase_name} OR {phase_keywords}"
  - project: "{project_name}"
  - type: "decision" OR "discovery"
  - limit: 10

  <if results found>
    Use mcp__plugin_claude-mem_mcp-search__get_observations to fetch details

    Include in planning context:
    """
    ## Relevant Past Decisions (from claude-mem)
    {formatted observations}
    """
  </if>
</if>

# ALWAYS continue with standard GSD context loading:
# - Load STATE.md
# - Load SUMMARY.md frontmatter scanning
# - Load codebase/*.md based on phase type
```

#### Task 2.2: Enhance consider-issues.md with pattern search

**File:** `commands/gsd/consider-issues.md`

Add pattern recognition step:

```markdown
## Step: Search for Issue Patterns (Optional)

<if memory.enabled AND memory.query_on_issues>
  # Search for recurring issue patterns across sessions

  Use mcp__plugin_claude-mem_mcp-search__search:
  - query: "issue OR bug OR blocked OR deferred"
  - project: "{project_name}"
  - type: "issue"
  - limit: 20

  <if patterns found>
    Present to user:
    """
    ## Recurring Patterns Detected
    - {pattern 1}: Occurred {N} times
    - {pattern 2}: Occurred {N} times

    Consider addressing root causes in current planning.
    """
  </if>
</if>

# ALWAYS continue with standard ISSUES.md review
```

#### Task 2.3: Enhance resume-project.md with recent context

**File:** `get-shit-done/workflows/resume-project.md`

Add memory context injection:

```markdown
## Step: Inject Recent Session Context (Optional)

<if memory.enabled>
  # Get recent observations for this project

  Use mcp__plugin_claude-mem_mcp-search__search:
  - query: "*"
  - project: "{project_name}"
  - limit: 5
  - orderBy: "timestamp DESC"

  <if recent observations found>
    Include in resume context:
    """
    ## Recent Activity (from claude-mem)
    {formatted recent observations}
    """
  </if>
</if>

# ALWAYS continue with standard resume:
# - Load STATE.md
# - Check for .continue-here*.md
# - Check agent-history.json for interrupted agents
```

---

### Phase 3: Enhanced Context Assembly (Medium-term)

#### Task 3.1: Add observation types for GSD concepts

When claude-mem captures GSD workflow events, tag them appropriately:

| GSD Event | Observation Type | Captured Data |
|-----------|-----------------|---------------|
| Decision in PROJECT.md | `gsd:decision` | Decision text, rationale, phase |
| Issue logged | `gsd:issue` | Issue description, effort estimate |
| Phase completed | `gsd:phase-complete` | Phase name, duration, outcomes |
| Plan deviation | `gsd:deviation` | What changed, why |

#### Task 3.2: Smart context selection in plan-phase

Enhance frontmatter scanning with memory-augmented selection:

```markdown
## Step: Assemble Planning Context

# 1. Standard frontmatter scan (ALWAYS runs)
Scan all SUMMARY.md files for:
- requires/provides dependencies
- affects declarations
- key-decisions

# 2. Memory-augmented discovery (OPTIONAL)
<if memory.enabled AND memory.query_on_plan>
  Query claude-mem for decisions related to:
  - Technologies mentioned in phase
  - Patterns being implemented
  - Similar past phases

  Merge into context (deduplicated with frontmatter data)
</if>
```

---

### Phase 4: Cross-Project Intelligence (Long-term/Optional)

#### Task 4.1: Cross-project querying

**Controlled by:** `memory.cross_project` config flag (default: false)

```markdown
<if memory.enabled AND memory.cross_project>
  # Query observations from ALL projects

  Use mcp__plugin_claude-mem_mcp-search__search:
  - query: "{relevant_keywords}"
  - project: null  # No project filter = all projects
  - limit: 10

  Present as:
  """
  ## Insights from Other Projects
  - In {project_x}: {relevant observation}
  - In {project_y}: {relevant observation}
  """
</if>
```

#### Task 4.2: Pattern-based recommendations

When starting new phases, suggest approaches based on historical success:

```markdown
<if memory.enabled AND phase_type matches historical patterns>
  Query: "phase:{phase_type} status:completed"

  Present:
  """
  ## What Worked Before
  - {approach from past phase}: {outcome}
  - {approach from past phase}: {outcome}
  """
</if>
```

---

## 9. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `templates/config.json` | Modify | Add memory config section |
| `commands/gsd/new-project.md` | Modify | Detection + opt-in question |
| `workflows/plan-phase.md` | Modify | Query memory before planning |
| `workflows/resume-project.md` | Modify | Inject recent observations |
| `commands/gsd/consider-issues.md` | Modify | Pattern search |
| `templates/memory-integration.md` | Create | User documentation |

---

## 10. Backwards Compatibility Guarantees

1. **Config absent:** If `memory` section missing from config.json, all memory features disabled
2. **Claude-mem unavailable:** All `<if memory.enabled>` blocks silently skip
3. **Query failures:** If MCP calls fail, log warning and continue with standard GSD
4. **No data:** If queries return empty, continue without memory context
5. **Standard flows preserved:** Every workflow continues with its normal GSD behavior after optional memory steps

---

## 11. Conclusion

**Claude-mem is complementary to GSD, not a replacement.**

- GSD: Structured workflow orchestration with deterministic context loading
- Claude-mem: Semantic memory layer for pattern discovery and cross-session insights

**Integration approach:** Opt-in via `/gsd:new-project`, conditional execution in workflows, graceful degradation when unavailable.

The existing `CLAUDE.md` files in GSD already contain claude-mem context blocks, ready for activation.
