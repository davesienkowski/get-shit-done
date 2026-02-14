# Codebase Structure

**Analysis Date:** 2026-02-13

## Directory Layout

```
get-shit-done/
├── bin/                           # Installation and CLI tools
│   └── install.js                 # NPM package installer (npx entry point)
├── commands/
│   └── gsd/                       # GSD command definitions
│       ├── new-project.md         # Initialize new project
│       ├── plan-phase.md          # Create phase plans
│       ├── execute-phase.md       # Execute phase plans
│       ├── discuss-phase.md       # Phase discussion/review
│       ├── map-codebase.md        # Map existing codebase
│       ├── research-phase.md      # Research phase topic
│       ├── debug.md               # Debugging workflow
│       ├── check-todos.md         # Review and work on todos
│       ├── add-phase.md           # Add new phase to roadmap
│       └── ...                    # ~30 other commands
├── agents/                        # Specialized subagents
│   ├── gsd-planner.md            # Creates PLAN.md files
│   ├── gsd-executor.md           # Executes plans, creates SUMMARY.md
│   ├── gsd-phase-researcher.md   # Researches phase topics
│   ├── gsd-project-researcher.md # Researches project requirements
│   ├── gsd-debugger.md           # Debugs failing tasks/tests
│   ├── gsd-verifier.md           # Verifies work against requirements
│   ├── gsd-plan-checker.md       # Validates plan structure
│   ├── gsd-integration-checker.md # Checks cross-phase wiring
│   ├── gsd-roadmapper.md         # Creates ROADMAP.md
│   ├── gsd-codebase-mapper.md    # Maps codebase structure
│   ├── gsd-research-synthesizer.md # Synthesizes research findings
│   └── ...                        # ~11 total agents
├── hooks/                         # Safety and validation hooks
│   ├── check-dangerous-commands.js # Blocks unsafe operations
│   ├── check-phase-boundary.js    # Validates phase transitions
│   ├── check-plan-format.js       # Validates PLAN.md structure
│   ├── check-roadmap-sync.js      # Syncs ROADMAP.md with disk
│   ├── validate-commit.js         # Enforces commit style
│   ├── track-context-budget.js    # Monitors context usage
│   └── ...                        # ~18 total hooks
├── scripts/
│   └── build-hooks.js            # Bundles hooks via esbuild
├── get-shit-done/
│   ├── bin/
│   │   ├── gsd-tools.js          # Central CLI utility (400+ lines)
│   │   └── gsd-tools.test.js     # Tests for gsd-tools (5800+ lines)
│   ├── workflows/
│   │   ├── new-project.md        # Full new-project orchestration
│   │   ├── plan-phase.md         # Full phase planning orchestration
│   │   ├── execute-phase.md      # Full phase execution orchestration
│   │   ├── discuss-phase.md      # Phase context/decisions
│   │   ├── transition.md         # Mark phase done, advance
│   │   ├── discovery-phase.md    # For research projects
│   │   └── ...                   # ~30 total workflows
│   ├── references/               # Reference documentation
│   │   ├── planning-config.md    # Config options and behavior
│   │   ├── tdd.md                # TDD patterns and workflow
│   │   ├── checkpoints.md        # Checkpoint system details
│   │   ├── git-integration.md    # Git strategy documentation
│   │   ├── questioning.md        # Deep questioning patterns
│   │   ├── behavioral-contexts.md # Context types and profiles
│   │   ├── model-profiles.md     # Model configuration options
│   │   ├── continuation-format.md # Resuming paused work
│   │   └── ...                   # ~15 total references
│   ├── templates/
│   │   ├── config.json           # Default config template
│   │   ├── codebase/             # Codebase mapping templates
│   │   │   ├── STACK.md          # Technology stack template
│   │   │   ├── ARCHITECTURE.md   # Architecture template
│   │   │   └── ...
│   │   └── research-project/     # Research workflow templates
│   ├── schemas/
│   │   └── config-schema.json    # JSON schema for config validation
│   └── references/debugging/     # Debugging guides
└── .planning/                    # Project planning directory (generated)
    ├── codebase/                 # Codebase analysis docs
    ├── logs/                     # Workflow execution logs
    └── *.md                      # Project docs (STATE, ROADMAP, etc.)
```

## Directory Purposes

**`bin/`:**
- Purpose: Installation and CLI entry points
- Contains: Installer for npm distribution, core CLI utilities
- Key files: `install.js` (distributes GSD to runtimes), `gsd-tools.js` (400+ line state/config utility)

**`commands/gsd/`:**
- Purpose: User-facing command definitions for Claude Code/OpenCode/Gemini
- Contains: Markdown files defining each `/gsd:<command>` entry point
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `map-codebase.md`, `debug.md`
- Pattern: Each command refs a workflow file via execution_context

**`agents/`:**
- Purpose: Specialized subagents spawned by orchestrator workflows
- Contains: Role definitions, execution flows, tool declarations
- Key agents:
  - `gsd-planner.md` (creates PLAN.md with task breakdown)
  - `gsd-executor.md` (executes plans, creates SUMMARY.md)
  - `gsd-verifier.md` (verifies against requirements)
  - `gsd-debugger.md` (debugs failing tasks)
  - `gsd-phase-researcher.md` (researches phase topics)
  - `gsd-project-researcher.md` (elicits requirements)
- No subagent works alone; all spawned by workflows

**`hooks/`:**
- Purpose: Safety validation and enforcement
- Contains: Pre/post operation hooks for commits, commands, state transitions
- Key hooks:
  - `validate-commit.js` (enforces GSD-STYLE.md commit format)
  - `check-dangerous-commands.js` (blocks unsafe operations)
  - `check-plan-format.js` (validates PLAN.md frontmatter/structure)
  - `track-context-budget.js` (warns when approaching token limits)
- Compiled: `hooks/dist/` contains bundled hooks for distribution

**`scripts/`:**
- Purpose: Build and maintenance scripts
- Contains: Hook bundler (esbuild compilation)
- Run: `npm run build:hooks` to compile hooks into dist/

**`get-shit-done/bin/`:**
- Purpose: Core CLI utilities and testing
- Key files:
  - `gsd-tools.js` — 400+ line CLI with state/config/phase/progress operations
  - `gsd-tools.test.js` — 5800+ line test suite covering all gsd-tools commands
- Used by: All workflows and agents for structured operations

**`get-shit-done/workflows/`:**
- Purpose: Orchestrator implementations defining step-by-step workflows
- Structure: Each workflow is a single .md file with `<process>` section containing steps
- Key workflows:
  - `new-project.md` (questions → research → requirements → roadmap)
  - `plan-phase.md` (research → plan → verify, with revision loop)
  - `execute-phase.md` (discover plans → group by wave → spawn executors)
  - `transition.md` (verify completion → mark done → advance)
  - `discuss-phase.md` (load context → facilitate decisions)
- Pattern: Workflows use `init` for context, then execute steps with conditional branching

**`get-shit-done/references/`:**
- Purpose: Reference documentation for workflows and agents
- Key docs:
  - `planning-config.md` (config.json schema and behavior)
  - `tdd.md` (TDD patterns, when to use, RED-GREEN-REFACTOR flow)
  - `checkpoints.md` (checkpoint system, continuation format)
  - `git-integration.md` (branching strategy, commit patterns)
  - `behavioral-contexts.md` (context types, auto vs manual)
  - `model-profiles.md` (model selection, fall-through behavior)
  - `questioning.md` (deep questioning patterns for discovery)
- Used by: Workflows to understand capabilities and patterns

**`get-shit-done/templates/`:**
- Purpose: Template files for initialization and project structure
- Key files:
  - `config.json` (default project configuration)
  - `codebase/*.md` (templates for STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, INTEGRATIONS.md)
  - `research-project/*.md` (workflow templates for research phases)

**`get-shit-done/schemas/`:**
- Purpose: JSON schema validation
- Key files:
  - `config-schema.json` (schema for config.json validation)

## Key File Locations

**Entry Points:**
- Installation: `bin/install.js` (npm distribution entry)
- Commands: `commands/gsd/*.md` (user-facing command defs)
- Workflows: `get-shit-done/workflows/*.md` (orchestrator implementations)
- Core utility: `get-shit-done/bin/gsd-tools.js` (state/config CLI)

**Configuration:**
- Project config template: `get-shit-done/templates/config.json`
- Config schema: `get-shit-done/schemas/config-schema.json`
- Planning reference: `get-shit-done/references/planning-config.md`

**Core Logic:**
- Phase planning: `get-shit-done/workflows/plan-phase.md`
- Phase execution: `get-shit-done/workflows/execute-phase.md`
- Project initialization: `get-shit-done/workflows/new-project.md`
- State utility: `get-shit-done/bin/gsd-tools.js` (state load/update operations)

**Testing:**
- gsd-tools tests: `get-shit-done/bin/gsd-tools.test.js` (5800+ lines, Node test runner)

**Safety & Validation:**
- Commit validator: `hooks/validate-commit.js` (GSD-STYLE.md enforcement)
- Plan format checker: `hooks/check-plan-format.js` (PLAN.md structure)
- Command blocker: `hooks/check-dangerous-commands.js` (safety rails)

## Naming Conventions

**Files:**
- Commands: `<command-name>.md` (e.g., `plan-phase.md`, `execute-phase.md`)
- Agents: `gsd-<agent-name>.md` (e.g., `gsd-planner.md`, `gsd-executor.md`)
- Hooks: `<validation-type>.js` (e.g., `check-plan-format.js`, `validate-commit.js`)
- Workflows: `<workflow-name>.md` (e.g., `new-project.md`, `transition.md`)
- Tests: `<module>.test.js` (e.g., `gsd-tools.test.js`)

**Directories:**
- Functional areas: lowercase with dashes (e.g., `commands`, `agents`, `hooks`, `get-shit-done`)
- Phase directories (generated): `<padded-phase>-<slug>` (e.g., `01-project-setup`, `02.1-ui-components`)
- Planning directory: `.planning/` (hidden, git-tracked by default)
- Phase planning: `.planning/phases/` (contains subdirs per phase)

## Where to Add New Code

**New Command:**
- File: `commands/gsd/<command-name>.md`
- Structure: YAML frontmatter (name, description, argument-hint, allowed-tools), objective, execution_context, process
- Reference: Existing commands like `plan-phase.md`, `execute-phase.md`

**New Workflow:**
- File: `get-shit-done/workflows/<workflow-name>.md`
- Structure: purpose, required_reading, process (steps with bash/tool invocations)
- Location: Referenced by command via `@~/.claude/get-shit-done/workflows/<name>.md`
- Example: `plan-phase.md` orchestrates researcher→planner→checker

**New Agent:**
- File: `agents/gsd-<agent-name>.md`
- Structure: YAML frontmatter (name, description, tools, color), role, execution flow
- Spawned by: A workflow via markdown subagent reference
- Example: `gsd-planner.md` receives context from `plan-phase.md` workflow

**New Hook:**
- File: `hooks/<validation-name>.js`
- Built into: `hooks/dist/` via `npm run build:hooks`
- Pattern: Export function, receive args, call process.exit() with status
- Examples: `check-plan-format.js`, `validate-commit.js`

**New Reference/Documentation:**
- File: `get-shit-done/references/<topic>.md`
- Used by: Workflows/agents via execution_context @-reference
- Examples: `tdd.md` (TDD patterns), `checkpoints.md` (checkpoint system)

**New Template:**
- File: `get-shit-done/templates/<category>/<name>.md` or `.json`
- Used by: Initialization workflows
- Examples: `config.json` (default config), `codebase/STACK.md` (codebase mapping template)

## Special Directories

**`.planning/`:**
- Purpose: Project planning and state
- Generated: By `/gsd:new-project`, dynamically expanded by phase creation
- Committed: Yes (tracks planning decisions, defaults to committed unless added to .gitignore)
- Structure:
  - `STATE.md` — Project state, current phase, decisions, blockers
  - `ROADMAP.md` — Phase breakdown
  - `PROJECT.md` — Project context
  - `REQUIREMENTS.md` — Feature table stakes
  - `CONTEXT.md` — Phase-specific decisions (per-phase)
  - `config.json` — Workflow configuration
  - `phases/<N>-<slug>/` — Per-phase planning
    - `*-PLAN.md` — Executable task plans
    - `*-SUMMARY.md` — Execution results
    - `*-CONTEXT.md` — Phase-specific user decisions
    - `*-RESEARCH.md` — Phase research findings
  - `codebase/` — Codebase analysis (STACK.md, ARCHITECTURE.md, etc.)
  - `logs/` — Workflow execution logs

**`hooks/dist/`:**
- Purpose: Compiled hooks for distribution
- Generated: By `npm run build:hooks`
- Committed: Yes (allows offline operation)
- Content: Bundled JS from source `hooks/*.js` files

**`.claude/`:**
- Purpose: Installation directory for GSD system (generated by installer)
- Location: Global (`~/.claude/get-shit-done/`) or local (`./.claude/get-shit-done/`)
- Contents: Copy of `commands/`, `agents/`, `workflows/`, `get-shit-done/`, `hooks/dist/`
- Managed by: `bin/install.js` (installer)

---

*Structure analysis: 2026-02-13*
