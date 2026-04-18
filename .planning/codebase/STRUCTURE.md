# Codebase Structure

**Analysis Date:** 2026-04-17

## Directory Layout

```
get-shit-done/                    # repository root (package name: get-shit-done-cc)
├── bin/                          # Published installer entry (`install.js`)
├── commands/gsd/                 # Slash command definitions (*.md)
├── get-shit-done/              # Bundled framework payload (workflows, bin, templates)
│   ├── bin/                    # gsd-tools.cjs + lib/*.cjs
│   ├── workflows/              # Orchestration markdown
│   ├── templates/              # Scaffolding templates
│   └── references/             # Shared workflow reference docs
├── agents/                     # gsd-*.md agent definitions
├── hooks/                      # Hook sources (built via scripts/build-hooks.js)
├── scripts/                    # build-hooks, run-tests, scans
├── sdk/                        # @gsd-build/sdk TypeScript package
│   ├── src/                    # Source (.ts); tests co-located
│   ├── prompts/                # Packaged prompts (agents, workflows)
│   └── package.json
├── tests/                      # Root CJS tests (*.test.cjs)
├── docs/                       # User and reference documentation (localized trees)
├── .github/                    # CI workflows
├── vitest.config.ts            # Vitest multi-project config (SDK unit + integration)
├── package.json                # Root package manifest and scripts
└── README*.md                  # Project readme files
```

## Directory Purposes

**`bin/`:**
- Purpose: Executable entry for npm `bin` map; installs framework into user toolchains.
- Contains: `install.js` (large installer script).
- Key files: `bin/install.js`

**`commands/gsd/`:**
- Purpose: One file per `/gsd:*` command — metadata and orchestration instructions for AI assistants.
- Contains: Markdown command specs (81+ files).
- Key files: e.g. `commands/gsd/plan-phase.md`, `commands/gsd/execute-phase.md`, `commands/gsd/map-codebase.md`

**`get-shit-done/workflows/`:**
- Purpose: Detailed workflow bodies copied or referenced by the installer; sequence of steps calling `gsd-tools` and agents.
- Contains: Markdown workflows.
- Key files: e.g. `get-shit-done/workflows/plan-phase.md`, `get-shit-done/workflows/map-codebase.md`

**`get-shit-done/bin/`:**
- Purpose: Runtime CLI and shared CommonJS modules for planning operations.
- Contains: `gsd-tools.cjs` router; `lib/*.cjs` domain modules.
- Key files: `get-shit-done/bin/gsd-tools.cjs`, `get-shit-done/bin/lib/state.cjs`, `get-shit-done/bin/lib/phase.cjs`

**`agents/`:**
- Purpose: Agent personas (`gsd-planner`, `gsd-executor`, `gsd-verifier`, mappers, etc.).
- Contains: `agents/gsd-*.md` definitions.

**`sdk/src/`:**
- Purpose: ESM TypeScript implementation of the SDK and query registry.
- Contains: Core modules (`index.ts`, `phase-runner.ts`, `session-runner.ts`, `gsd-tools.ts`), `query/` subtree, `golden/` test fixtures, transports, parsers.
- Key files: `sdk/src/index.ts`, `sdk/src/cli.ts`, `sdk/src/query/index.ts`

**`sdk/prompts/`:**
- Purpose: Additional packaged prompts shipped with the SDK (`sdk/package.json` `files` includes `prompts`).
- Contains: `sdk/prompts/agents/`, `sdk/prompts/workflows/`, `sdk/prompts/templates/`

**`hooks/`:**
- Purpose: Source for compiled hooks consumed by IDEs after build.
- Contains: `hooks/*.js` (processed by `scripts/build-hooks.js`).

**`scripts/`:**
- Purpose: Build, test orchestration, and maintenance shell scripts.
- Contains: `scripts/build-hooks.js`, `scripts/run-tests.cjs`, `scripts/base64-scan.sh`, etc.

**`tests/`:**
- Purpose: Repository-level Node tests for installer, hooks, and cross-cutting behavior.
- Contains: `tests/*.test.cjs` (run via root `npm test`).

**`docs/`:**
- Purpose: Human-facing guides and references (multiple locales under `docs/`).
- Contains: Markdown documentation; not runtime code.

## Key File Locations

**Entry Points:**
- `bin/install.js`: npm package primary binary.
- `get-shit-done/bin/gsd-tools.cjs`: planning CLI used by workflows and subprocess bridge.
- `sdk/src/cli.ts`: `gsd-sdk` CLI source.
- `sdk/src/index.ts`: library public API.

**Configuration:**
- `package.json`: root engines (`node >=22`), scripts (`test`, `build:hooks`).
- `sdk/package.json`: SDK dependencies, `tsc` build, Vitest scripts.
- `sdk/tsconfig.json`: TypeScript compiler options for the SDK.
- `vitest.config.ts`: workspace Vitest projects `unit` and `integration` rooted at `./sdk`.

**Core Logic:**
- `sdk/src/phase-runner.ts`, `sdk/src/session-runner.ts`, `sdk/src/context-engine.ts`, `sdk/src/plan-parser.ts`, `sdk/src/config.ts`
- `sdk/src/query/*.ts`: command handlers and registry wiring.
- `get-shit-done/bin/lib/*.cjs`: CJS implementations parallel to many query concerns.

**Testing:**
- `sdk/src/**/*.test.ts`: unit tests (excludes `*.integration.test.ts`).
- `sdk/src/**/*.integration.test.ts`: integration tests (120s timeout in `vitest.config.ts`).
- `tests/*.test.cjs`: root CJS tests.

## Naming Conventions

**Files:**
- TypeScript sources: kebab-case (`phase-runner.ts`, `gsd-tools.ts`) per project conventions.
- Tests: same basename with `.test.ts` or `.integration.test.ts`.
- Agents/commands: `gsd-` prefix for agents; command files under `commands/gsd/` are kebab-case topic names.

**Directories:**
- `sdk/src/query/`: one concern per file (e.g. `state.ts`, `commit.ts`, `phase-lifecycle.ts`).
- `get-shit-done/bin/lib/`: kebab-case or short names with `.cjs` extension.

## Where to Add New Code

**New query / gsd-tools command (SDK-first):**
- Implementation: `sdk/src/query/<concern>.ts` (or extend an existing module).
- Registration: `sdk/src/query/index.ts` (`createRegistry` wiring and `QUERY_MUTATION_COMMANDS` if mutating).
- Documentation of handlers: `sdk/src/query/QUERY-HANDLERS.md` when adding user-visible contracts.
- Parallel CJS: extend `get-shit-done/bin/gsd-tools.cjs` and relevant `get-shit-done/bin/lib/*.cjs` when CLI parity is required for non-SDK callers.

**New slash command:**
- Command spec: `commands/gsd/<name>.md`.
- Workflow: `get-shit-done/workflows/<name>.md` (or linked name) consistent with existing patterns.

**New agent:**
- Agent markdown: `agents/gsd-<role>.md`.
- Optional SDK prompt copy: `sdk/prompts/agents/gsd-<role>.md` if shipped with `@gsd-build/sdk`.

**New SDK-only feature (no new CLI verb):**
- Primary code: under `sdk/src/` following existing module boundaries; export from `sdk/src/index.ts` if public.

**Tests:**
- Unit: co-located `sdk/src/<module>.test.ts`.
- Integration: `sdk/src/<area>.integration.test.ts`.
- Installer / cross-repo: `tests/<topic>.test.cjs`.

## Special Directories

**`sdk/dist/`:**
- Purpose: Compiled JavaScript and declarations for `@gsd-build/sdk`.
- Generated: Yes (`npm run build` inside `sdk/`).
- Committed: Typically published artifact; check repo policy—many packages gitignore `dist/` (verify `.gitignore` locally).

**`.planning/` (consumer projects):**
- Purpose: Per-project roadmap, state, phases, config — not part of the framework source tree by default.
- Generated: By user workflows using GSD.
- Committed: User choice; often committed for team alignment.

---

*Structure analysis: 2026-04-17*
