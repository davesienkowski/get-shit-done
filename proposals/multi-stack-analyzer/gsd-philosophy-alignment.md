# GSD Philosophy and Multi-Stack Analyzer Alignment

**Document Purpose:** Capture GSD's core philosophy to guide enhancement decisions for the codebase analyzer.

**Created:** 2026-01-20
**Source Analysis:** `~/.claude/get-shit-done/` and `~/.claude/commands/gsd/`
**GSD Version:** 1.9.1

---

## Part 1: GSD Core Philosophy

### The Name Says It All

GSD stands for "Get Shit Done" - this isn't accidental. The entire framework is designed around **pragmatic execution over theoretical perfection**. Every design decision should be evaluated against: "Does this help people ship working software?"

### Central Tenet: Context Preservation Across Sessions

GSD's most fundamental insight is that **context loss is the primary enemy of productivity** in AI-assisted development. From the `/gsd:resume-work` workflow:

> "Where were we?" should have an immediate, complete answer.

This manifests in:
- **STATE.md** - A living memory document that's read first in every workflow
- **Checkpoint files** (`.continue-here`) - Mid-plan resumption points
- **Agent history tracking** - Interrupted agents can be resumed
- **Reconstruction capability** - STATE.md can be rebuilt from artifacts if lost

The philosophy: **Never force the user to re-explain what they're building.**

### Brownfield-First Mindset

GSD explicitly supports "brownfield codebases" - existing projects with their own patterns and debt. This is captured in:

1. **`/gsd:map-codebase`** - Parallel agents that explore and document existing code
2. **`/gsd:analyze-codebase`** - Bootstrap intelligence for existing projects
3. **Inferred Validated Requirements** - Existing code becomes the baseline, not a liability

From the brownfield section of `templates/project.md`:

> For existing codebases:
> 1. Map codebase first via /gsd:map-codebase
> 2. Infer Validated requirements from existing code
> 3. Gather Active requirements from user

**The philosophy:** Existing code is valuable context, not an obstacle to overcome.

### Dream Extraction, Not Requirements Gathering

From `questioning.md`:

> Project initialization is dream extraction, not requirements gathering. You're helping the user discover and articulate what they want to build. This isn't a contract negotiation - it's collaborative thinking.

This means:
- **Follow the thread** - Don't rush through checklists
- **Challenge vagueness** - "Good" means what? "Users" means who?
- **Make abstract concrete** - "Walk me through using this"

**The philosophy:** Understanding WHY precedes understanding WHAT.

### Subagent Architecture for Context Efficiency

GSD uses subagents extensively, not for parallelism alone, but for **context isolation**:

> **Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.

This appears in:
- `gsd-debugger` - Gets fresh context per investigation
- `gsd-codebase-mapper` - 4 parallel agents with domain-specific focus
- `gsd-entity-generator` - Reads files in fresh context, writes entities
- `gsd-project-researcher` - Parallel research across Stack/Features/Architecture/Pitfalls

**The philosophy:** Burn subagent context freely, preserve orchestrator context religiously.

---

## Part 2: Principles Most Relevant to Analyzer Improvements

### Principle 1: Pragmatism Over Perfection

**How it manifests in GSD:**
- Quick mode (`/gsd:quick`) skips optional agents for small tasks
- Config allows disabling researchers, plan checkers, and verifiers
- "YOLO mode" auto-approves most decisions
- Depth settings (quick/standard/comprehensive) let users choose thoroughness

**Implications for multi-stack analyzer:**
- Detection should be "good enough" not "perfectly accurate"
- False positives are preferable to missed detection
- Multiple detection strategies can run in parallel with voting
- User can always override/correct detected stack
- Speed matters - don't read 1000 files when 50 would suffice

**Guiding question:** Will more precision actually help someone ship code?

### Principle 2: Context Preservation Across Sessions

**How it manifests in GSD:**
- STATE.md is read first, updated after every action
- Progress bars and position tracking persist
- Incomplete work detection (PLAN without SUMMARY)
- Agent interruption recovery (current-agent-id.txt)

**Implications for multi-stack analyzer:**
- Output must be **immediately useful** on next session start
- `summary.md` should be injected into context automatically
- Intel should survive `/clear` commands
- Detection results should be stored, not recalculated

**Guiding question:** If the user comes back tomorrow, does the intel still help?

### Principle 3: Reducing Cognitive Load

**How it manifests in GSD:**
- Clear next-step formatting (`## Next Up` with copy-paste commands)
- Visual progress indicators (progress bars, phase/plan counts)
- Unified workflows (`/gsd:new-project` handles questioning -> research -> requirements -> roadmap)
- Contextual options based on project state

**Implications for multi-stack analyzer:**
- Stack detection should produce **actionable output**
- Don't just list technologies - explain what patterns to follow
- Conventions must be prescriptive ("Use X") not descriptive ("Sometimes Y")
- Output should tell Claude what to do, not what exists

**Guiding question:** Does reading this intel reduce the thinking required?

### Principle 4: Enabling Autonomous Operation

**How it manifests in GSD:**
- YOLO mode for minimal interruption
- Parallel execution of independent plans
- Quick resume ("continue" or "go" triggers immediate action)
- Atomic commits (artifacts persist even if context is lost)

**Implications for multi-stack analyzer:**
- Analysis should complete without user input
- Results should be self-contained (not require follow-up questions)
- Intel should enable planning without re-analysis
- Errors should be logged and skipped, not blocking

**Guiding question:** Can Claude start planning immediately after analysis?

### Principle 5: Supporting Brownfield Codebases

**How it manifests in GSD:**
- `/gsd:map-codebase` is recommended before `/gsd:new-project`
- `/gsd:analyze-codebase` works standalone
- CONCERNS.md explicitly tracks tech debt
- Existing capabilities become "Validated requirements"

**Implications for multi-stack analyzer:**
- Must handle **mixed/polyglot codebases** gracefully
- Must handle **legacy patterns** without judgment
- Should identify conventions **as they exist**, not as they "should be"
- Should recognize when patterns are inconsistent (and note it)
- Should work on partial codebases (monorepo subdirectories)

**Guiding question:** Does this help someone understand code they didn't write?

---

## Part 3: How Multi-Stack Support Aligns with GSD Goals

### The Core Alignment

GSD's `/gsd:analyze-codebase` currently focuses on JavaScript/TypeScript:
- Glob pattern: `**/*.{js,ts,jsx,tsx,mjs,cjs}`
- Export/import patterns: ES6 and CommonJS only
- No handling of other ecosystems

**Multi-stack support directly serves GSD's brownfield-first philosophy.** Real enterprise codebases are rarely single-language:

| Common Brownfield Pattern | What Multi-Stack Enables |
|--------------------------|--------------------------|
| .NET backend + JS frontend | Full-stack understanding |
| Python ML + TypeScript API | Cross-boundary intel |
| PowerShell automation + C# apps | Tooling + application context |
| Legacy SQL + Modern services | Data layer + service layer mapping |

### Specific Alignment Points

| GSD Principle | Multi-Stack Implementation |
|--------------|---------------------------|
| **Pragmatism** | Detect common patterns, skip exotic edge cases |
| **Context preservation** | Stack-specific intel persists in conventions.json |
| **Reduce cognitive load** | Single unified analysis, not per-language tools |
| **Autonomous operation** | Run all detectors in parallel, merge results |
| **Brownfield support** | Handle messy reality of mixed codebases |

### What Multi-Stack Enables for GSD Users

1. **Better Phase Planning**
   - Phases can span technologies (e.g., "Add auth" touches .NET backend AND React frontend)
   - Claude understands the full blast radius of changes

2. **Accurate Convention Detection**
   - PowerShell naming conventions differ from C#
   - SQL capitalization differs from Python
   - Multi-stack captures each correctly

3. **Improved Entity Generation**
   - Entities can reference cross-language dependencies
   - "Used By" section can span language boundaries

4. **Realistic Brownfield Mapping**
   - Real projects have multiple languages
   - Mapping only JS/TS misses critical context

---

## Part 4: Design Guidelines for Analyzer Enhancements

Based on GSD philosophy, analyzer improvements should:

### DO:
- Detect stack from **manifest files first** (package.json, .csproj, pom.xml) - fastest signal
- Use **parallel detection** across languages (follows subagent pattern)
- Output **prescriptive conventions** ("Use PascalCase for public methods")
- Keep summary.md under 500 tokens (context injection target)
- Handle **partial/incomplete** codebases gracefully
- Support **incremental updates** (PostToolUse hook pattern)
- Make output **immediately actionable** for Claude
- Include **file paths as concrete examples**

### DON'T:
- Try to be 100% accurate (pragmatism over perfection)
- Read every file when samples suffice
- Block on errors (log and continue)
- Require user input during analysis
- Output descriptive prose instead of actionable conventions
- Assume single-language codebases
- Forget that output serves planning, not human reading

### Output Quality Bar

From GSD templates, good intel output:
- Has clear sections (Naming, Imports, Error Handling)
- Uses tables for structured data
- Includes file path examples with backticks
- Is prescriptive ("Use X") not descriptive ("X is sometimes used")
- Notes inconsistencies ("Legacy code uses Y, new code should use X")
- Stays under target length (conventions < 150 lines, summary < 500 tokens)

---

## Part 5: Recommended Enhancement Priorities

Based on GSD alignment analysis:

### Priority 1: Manifest-First Detection
- Check package.json, *.csproj, requirements.txt, Cargo.toml, go.mod first
- These definitively identify the stack with minimal file reads
- Aligns with: Pragmatism, Autonomous operation

### Priority 2: Parallel Language Detectors
- Each language has its own detector running independently
- Results merge into unified conventions.json
- Aligns with: Subagent architecture, Context efficiency

### Priority 3: Prescriptive Convention Output
- Move from "I found PascalCase" to "Use PascalCase for class names"
- Include code examples from actual codebase
- Aligns with: Reducing cognitive load, Actionable output

### Priority 4: Stack-Aware Entity Generation
- Entities should include language/runtime context
- Cross-language dependencies should be trackable
- Aligns with: Brownfield support, Full-stack understanding

### Priority 5: Graceful Degradation
- Unknown languages get basic file indexing
- Errors logged but don't block
- Partial results are still useful
- Aligns with: Pragmatism, Autonomous operation

---

## Summary

GSD's philosophy centers on:
1. **Getting things done** over theoretical perfection
2. **Preserving context** across sessions and agents
3. **Reducing cognitive load** through actionable output
4. **Enabling autonomy** through complete, self-contained intel
5. **Supporting brownfield** codebases as the common case

Multi-stack analyzer support directly serves these goals by:
- Making the analyzer useful for real-world mixed codebases
- Providing complete context for planning phases that span technologies
- Enabling Claude to understand and follow conventions across languages
- Treating the messy reality of existing code as valuable context

**The north star:** If someone runs `/gsd:analyze-codebase` on their real project, they should get immediately useful intel regardless of what languages they use.

---

*Document created to guide analyzer enhancement decisions in alignment with GSD philosophy.*
