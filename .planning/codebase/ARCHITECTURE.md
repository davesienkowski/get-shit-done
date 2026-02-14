# Architecture

**Analysis Date:** 2026-02-13

## Pattern Overview

**Overall:** Multi-agent orchestration system with layered workflow execution

**Key Characteristics:**
- Command-driven orchestrators that spawn specialized subagents
- Workflow files define each orchestrator's behavior and agent spawning
- gsd-tools.js provides centralized state, config, and utility operations
- Phase-based project progression with configurable gates and safety rails
- Wave-based parallel execution for plan tasks with dependency tracking

## Layers

**Command Layer (Commands):**
- Purpose: Entry points for CLI commands (e.g., `/gsd:plan-phase`, `/gsd:execute-phase`)
- Location: `commands/gsd/`
- Contains: Markdown command definitions with tool declarations
- Depends on: Workflow execution layer
- Used by: Claude Code/OpenCode/Gemini CLI systems

**Workflow Layer (Orchestrators):**
- Purpose: Implement command logic through workflow steps, coordinate subagent spawning
- Location: `get-shit-done/workflows/`
- Contains: Detailed workflow steps (YAML/markdown), init sequences, validation logic
- Depends on: Agent layer, gsd-tools.js, state management
- Used by: Command layer to execute complex multi-step processes
- Examples: `plan-phase.md` (spawns researcher→planner→checker), `execute-phase.md` (spawns executor agents)

**Agent Layer (Subagents):**
- Purpose: Specialized, focused agents that execute discrete responsibilities
- Location: `agents/`
- Contains: Agent role definitions, execution flows, tool declarations
- Depends on: gsd-tools.js, project state, codebase files
- Used by: Workflows as spawned subagents
- Key agents: gsd-planner, gsd-executor, gsd-phase-researcher, gsd-verifier, gsd-debugger

**Utilities Layer:**
- Purpose: Centralized CLI utilities for state/config management, git operations, file I/O
- Location: `get-shit-done/bin/gsd-tools.js`
- Contains: Atomic commands (state load/update, config validation, phase operations, progress tracking)
- Depends on: Node.js fs, child_process, path modules
- Used by: All workflows and agents for structured operations

**Configuration & References:**
- Purpose: Templates, schemas, and reference documentation
- Location: `get-shit-done/templates/`, `get-shit-done/schemas/`, `get-shit-done/references/`
- Contains: Config templates, JSON schemas, behavioral guides, model profiles
- Used by: Installation, initialization, workflow context

**Hooks & Validations:**
- Purpose: Pre/post operation validation and safety enforcement
- Location: `hooks/`
- Contains: Commit validators, phase boundary checks, plan format validation, context budget tracking
- Used by: Workflows and agents for safety rails

## Data Flow

**Project Initialization Flow:**

1. User runs `/gsd:new-project`
2. Workflow: `new-project.md` executes steps
   - Load project config via gsd-tools.js `init new-project`
   - Spawn gsd-project-researcher for requirements
   - Spawn gsd-roadmapper for phase breakdown
   - Write PROJECT.md, REQUIREMENTS.md, ROADMAP.md
3. Create `.planning/` directory structure
4. Initialize STATE.md with project metadata

**Phase Planning Flow:**

1. User runs `/gsd:plan-phase <N>`
2. Workflow: `plan-phase.md` orchestrates
   - Load phase context via `init plan-phase`
   - **Conditional research:** Spawn gsd-phase-researcher if RESEARCH.md missing
   - **Spawn gsd-planner** with phase goals, context, research findings
   - Planner creates PLAN.md files with tasks
   - **Spawn gsd-plan-checker** to validate plan structure
   - Revision loop (max 3 iterations) if checker finds issues
   - Commit planning artifacts

**Phase Execution Flow:**

1. User runs `/gsd:execute-phase <N>`
2. Workflow: `execute-phase.md` orchestrates
   - Load phase via `init execute-phase`
   - Discover and group plans by wave
   - For each wave (parallel or sequential):
     - **Spawn gsd-executor** for each plan
     - Executor runs tasks, commits per-task, produces SUMMARY.md
     - Checkpoint handling: if plan hits checkpoint, pause and notify
   - Collect all SUMMARY.md files
   - Update STATE.md with progress
3. User transitions via `transition` workflow to mark phase done

**State Management:**

- `.planning/STATE.md` — Project state, current phase, decisions, blockers
- `.planning/ROADMAP.md` — Phase breakdown and descriptions
- `.planning/PROJECT.md` — Project context and intent
- `.planning/REQUIREMENTS.md` — Feature table stakes
- `.planning/CONTEXT.md` — Phase-specific user decisions (per-phase)
- `.planning/phases/<N>-<slug>/PLAN*.md` — Executable task plans
- `.planning/phases/<N>-<slug>/SUMMARY*.md` — Execution results
- `.planning/config.json` — Workflow configuration, gates, safety rails, model profiles

## Key Abstractions

**Orchestrator Pattern:**
- Purpose: Coordinate multi-step workflows without executing domain logic directly
- Examples: `plan-phase.md` (research→plan→verify), `execute-phase.md` (discover→group→execute)
- Pattern: Load init → Validate → Spawn agents → Collect results → Update state

**Subagent Spawning:**
- Purpose: Isolate concerns, enable parallel execution, provide fresh context
- Mechanism: Workflows describe subagent in markdown, system spawns with context
- Input: User decisions from CONTEXT.md, phase data, research findings
- Output: Markdown deliverables (PLAN.md, SUMMARY.md, RESEARCH.md)

**Wave-Based Execution:**
- Purpose: Optimize parallel execution by grouping dependent tasks
- Data: Plan's `wave` field defines which wave it belongs to
- Behavior: Plans in same wave execute parallel (if enabled), different waves sequential
- Depends on: Plan's `depends_on` field for dependency tracking

**Verification Gates:**
- Purpose: Ensure quality before advancing (plans complete before transition)
- Implementation: Workflows check artifact existence, verify frontmatter, validate structure
- Checkpoints: Autonomous plans execute fully; checkpoint plans pause for user review
- Safety Rails: Always confirm destructive actions (skip plans, milestone completion)

**Model Profiles:**
- Purpose: Allow users to control execution speed vs quality
- Types: `"inherit"` (use active profile), specific model (e.g., "claude-opus-4-6")
- Applied to: Each agent type (planner, executor, researcher, etc.)
- Stored in: `config.json` under `models.*`

## Entry Points

**Installation Entry Point:**
- Location: `bin/install.js`
- Triggers: `npx get-shit-done-cc@latest`
- Responsibilities:
  - Interactive runtime/location selection
  - Copy command, workflow, and agent files to global/local `.claude/`
  - Set up hooks in destination

**Command Entry Points:**
- Location: `commands/gsd/*.md`
- Triggers: `/gsd:<command-name>` in Claude Code/OpenCode/Gemini
- Responsibilities:
  - Define CLI argument hints
  - Declare allowed tools
  - Reference orchestrator workflow
  - Examples: `plan-phase.md`, `execute-phase.md`, `new-project.md`

**Workflow Entry Points:**
- Location: `get-shit-done/workflows/*.md`
- Triggers: Called by command via execution_context
- Responsibilities:
  - Execute orchestrator steps
  - Manage agent spawning
  - Handle state transitions
  - Examples: `plan-phase.md` orchestrates researcher→planner→checker

**Utility Entry Point:**
- Location: `get-shit-done/bin/gsd-tools.js`
- Triggers: CLI via `node gsd-tools.js <command> [args]`
- Responsibilities:
  - `init *` commands: return JSON with full context
  - State CRUD: load/update STATE.md
  - Config validation: validate config.json against schema
  - Phase operations: add/remove/complete phases
  - Git integration: structured commits with safety checks

## Error Handling

**Strategy:** Defensive validation with user confirmation for destructive operations

**Patterns:**

- **Init validation:** Every workflow starts with `init` to validate state exists, files parse, phase found
- **Missing artifacts:** If expected file missing (ROADMAP.md, STATE.md), error with hint on recovery
- **Git safety:** `gsd-tools.js commit` checks commit_docs config, gitignore status before attempting
- **Destructive gates:** Operations like "skip incomplete plans", "mark phase done with gaps" require explicit confirmation
- **Checkpoint errors:** If executor hits unknown deviation, pauses with detailed error message
- **Model resolution:** If requested model not available, falls back to inherit profile

**Error Messages Locations:**
- Workflow validation: `get-shit-done/workflows/*.md` error blocks
- Tool errors: `gsd-tools.js` error() calls return structured error JSON
- Hooks validation: `hooks/check-*.js` exit with descriptive messages

## Cross-Cutting Concerns

**Logging:**
- Console output in workflows and agents (stage banners, progress)
- Hook logging via `hooks/hook-logger.js`
- Context budget tracking via `hooks/track-context-budget.js`

**Validation:**
- Frontmatter validation: `gsd-tools.js frontmatter validate <file> --schema plan|summary|verification`
- Plan structure: `gsd-tools.js verify plan-structure <file>` checks tasks, objectives, success criteria
- Phase consistency: `gsd-tools.js validate consistency` checks phase numbering, disk/roadmap sync
- Commit safety: `hooks/validate-commit.js` enforces GSD-STYLE.md format

**Configuration:**
- Centralized in `.planning/config.json`
- Loaded via `gsd-tools.js state load` (returns full merged config)
- Keys: `mode` (interactive/auto), `depth`, `model_profile`, `workflow.*`, `gates.*`, `safety.*`, `hooks.*`
- Defaults applied if missing (preserves backward compatibility)

**State Mutation:**
- Only via `gsd-tools.js state update <field> <value>` or `state patch --field val ...`
- All mutations atomic (single file write)
- STATE.md format: YAML frontmatter + markdown sections
- Tracks: current_phase, milestones, decisions, blockers, completion_date

---

*Architecture analysis: 2026-02-13*
