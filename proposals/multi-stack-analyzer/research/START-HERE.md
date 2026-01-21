# GSD Analyze-Codebase Research - START HERE

**Research Task**: GSD Analyze-Codebase Integration Analysis
**Completion Date**: 2025-01-20
**Total Research Files**: 10 documents, ~3,850 lines
**Directory**: `/mnt/d/Repos-Work/msow/symplr/.planning/quick/001-gsd-analyzer-optimization/`

---

## What This Research Covers

Complete technical analysis of how the GSD `analyze-codebase` command:
- Generates codebase intelligence artifacts
- Integrates with other GSD commands and workflows
- Feeds data to agents and hooks
- Creates self-evolving knowledge base

**Finding**: The analyze-codebase command is the **bootstrap engine** for GSD's entire intelligence system, with 8 downstream consumers depending on its output.

---

## Quick Navigation

### I Need to Understand...

**The Big Picture**
→ Read: `RESEARCH-COMPLETED.md` (comprehensive overview)
Or: `SUMMARY.txt` (50-line quick facts)

**How analyze-codebase Works**
→ Read: `research-dependencies.md` (Section 1-3, "Output Files & Hook Integrations")

**Which Commands Use It**
→ Read: `research-dependencies.md` (Section 3, "Command Dependencies")

**How the Intelligence System Flows**
→ Read: `research-dependencies.md` (Section 5-7, "Workflow Chain" and "Data Flow")

**What Can Go Wrong**
→ Read: `research-dependencies.md` (Section 9, "Failure Modes & Recovery")

**How to Integrate New Workflows**
→ Read: `research-dependencies.md` (Section 11, "Integration Checklist")

**Hook Architecture Details**
→ Read: `research-hooks.md` (dedicated hook analysis)

**Optimization Opportunities**
→ Read: `OPTIMIZATION-GUIDE.md` (or Section 10 of research-dependencies.md)

---

## File Guide

| File | Size | Purpose | Best For |
|------|------|---------|----------|
| **research-dependencies.md** | 625 lines | PRIMARY DOCUMENT: Complete technical analysis with 12 sections | Architecture review, reference |
| **RESEARCH-COMPLETED.md** | 270 lines | Research summary and key findings | Project overview, quick understanding |
| **SUMMARY.txt** | 50 lines | Executive bullet points | Fast lookup, meetings |
| **README.md** | 400+ lines | Research overview and usage guide | Understanding research methodology |
| **OPTIMIZATION-GUIDE.md** | 400+ lines | Detailed optimization strategies | Performance tuning work |
| **HOOKS-SUMMARY.md** | 200+ lines | Hook system details | Understanding hook interactions |
| **research-hooks.md** | 400+ lines | Comprehensive hook analysis | Deep dive into hook mechanisms |
| **research-context-patterns.md** | 500+ lines | Context optimization patterns | Token budget optimization |
| **FINDINGS.md** | 200+ lines | High-level summary | Quick understanding |
| **INDEX.md** | 400+ lines | Cross-referenced index | Finding specific topics |

---

## Key Findings at a Glance

### 1. Eight Downstream Consumers
- 3 hooks (SessionStart, PostToolUse, Stop)
- 2 commands (/query-intel, /plan-phase)
- 1 workflow (/execute-phase)
- 2 agents (gsd-planner, gsd-entity-generator)

### 2. Output Artifacts
- **index.json** — File inventory (exports/imports)
- **conventions.json** — Naming patterns (camelCase %, directories, suffixes)
- **summary.md** — Context for session injection (~500 tokens)
- **entities/** — Semantic file documentation (optional Step 9)
- **graph.db** — Dependency graph (from Step 9)

### 3. Three-Hook System
```
SessionStart Hook       → Injects summary.md at session startup
PostToolUse Hook       → Syncs entities to graph.db after writes
Stop Hook              → Prunes deleted files from index.json
```

### 4. Critical Integration Points
- Context injection (automatic, requires summary.md)
- Graph synchronization (automatic via PostToolUse)
- Convention enforcement (used by planner agent)
- Incremental learning (entities updated as code evolves)

### 5. Data Flow (High Level)
```
analyze-codebase (Steps 1-8)
  ├─ Creates: index.json, conventions.json, summary.md
  │
  └─ Step 9 (Optional): Entity Generation
       ├─ Creates: entities/*.md files
       │
       └─ PostToolUse Hook (gsd-intel-index.js)
            ├─ Parses YAML frontmatter
            ├─ Extracts [[wiki-links]]
            └─ Syncs to graph.db
                 └─ /gsd:query-intel can query relationships
```

---

## How This Research Was Conducted

### Sources Analyzed (8 Files)
1. `/home/dave/.claude/commands/gsd/analyze-codebase.md` — Command definition
2. `/home/dave/.claude/commands/gsd/query-intel.md` — Query command
3. `/home/dave/.claude/commands/gsd/plan-phase.md` — Planning workflow
4. `/home/dave/.claude/agents/gsd-entity-generator.md` — Agent definition
5. `/home/dave/.claude/hooks/gsd-intel-prune.js` — Stop hook
6. `/home/dave/.claude/hooks/gsd-intel-session.js` — SessionStart hook
7. `/home/dave/.claude/hooks/gsd-intel-index.js` — PostToolUse hook
8. `/home/dave/.claude/get-shit-done/workflows/execute-plan.md` — Execution workflow

### Analysis Approach
1. Mapped all commands referencing "intel" and "analyze-codebase"
2. Traced data flows from output to consumers
3. Identified all hook integrations
4. Documented agent consumption patterns
5. Created workflow dependency diagrams
6. Analyzed failure modes and recovery

---

## Quick Facts

- **Bootstrap engine**: analyze-codebase starts GSD's intelligence system
- **Graceful degradation**: Works with or without intel
- **Three tiers**: SessionStart (inject), PostToolUse (sync), Stop (cleanup)
- **Self-evolving**: Knowledge base updates as code is created
- **No manual refresh**: Hooks handle incremental updates
- **Silent failures**: Missing intel doesn't break workflows
- **Critical dependency**: /gsd:query-intel requires graph.db (from Step 9)

---

## Integration Checklist for New Workflows

- [ ] Read `.planning/intel/summary.md` for existing projects
- [ ] Convert file paths to entity IDs (src/lib/auth.ts → src-lib-auth)
- [ ] Use [[wiki-links]] in Dependencies section of entities
- [ ] Validate YAML frontmatter before syncing to graph
- [ ] Handle missing intel gracefully (don't error)
- [ ] Include entity updates in commit messages
- [ ] Test with both greenfield and brownfield projects

---

## How to Use These Findings

### For Architecture Decisions
1. Read RESEARCH-COMPLETED.md (key insights)
2. Review data flow diagrams (research-dependencies.md Section 6)
3. Check critical integration points (Section 8)
4. Study failure modes (Section 9)

### For Integration Work
1. Start with integration checklist (research-dependencies.md Section 11)
2. Review command dependencies (Section 3)
3. Study agent consumption (Section 4)
4. Check file references (Section 12)

### For Optimization
1. Read OPTIMIZATION-GUIDE.md
2. Review opportunities (research-dependencies.md Section 10)
3. Analyze hook timing (Section 7)
4. Consider incremental updates option

### For Troubleshooting
1. Check failure modes (research-dependencies.md Section 9)
2. Review hook system (research-hooks.md)
3. Verify file paths exist
4. Check YAML frontmatter validity

---

## Next Steps

1. **Read RESEARCH-COMPLETED.md** for comprehensive overview
2. **Consult SUMMARY.txt** for quick facts
3. **Review research-dependencies.md** for details on specific topics
4. **Use INDEX.md** for finding specific sections
5. **Reference integration checklist** when building new workflows

---

## Document Quality Metrics

- **Total lines of analysis**: ~3,850 lines
- **Sections in primary document**: 12 major sections
- **Downstream consumers identified**: 8
- **Integration points mapped**: 12 major
- **Failure modes documented**: 4 with recovery
- **Optimization opportunities**: 4 identified
- **Files analyzed**: 8 GSD system files
- **Code references**: 50+ specific file locations

---

## Research Status

- **Completion Date**: 2025-01-20
- **Status**: COMPLETE
- **Quality**: Comprehensive, detailed, cross-referenced
- **Ready For**: Architecture reviews, integration planning, optimization work

---

**Start with**: `RESEARCH-COMPLETED.md` or `SUMMARY.txt` depending on depth needed
**Then reference**: Specific sections in `research-dependencies.md` as needed
**For detailed work**: Use specialized documents (OPTIMIZATION-GUIDE.md, research-hooks.md, etc.)
