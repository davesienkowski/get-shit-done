# SDK Codebase Structure

**Analysis Date:** 2026-04-07
**Package:** `@gsd-build/sdk` at `sdk/`

---

## Directory Layout

```
sdk/
├── src/                          # TypeScript source (compiled → dist/)
│   ├── index.ts                  # Public API: GSD class + all re-exports
│   ├── types.ts                  # All shared types, interfaces, enums
│   ├── config.ts                 # .planning/config.json loader
│   ├── gsd-tools.ts              # Bridge to gsd-tools.cjs CLI
│   ├── plan-parser.ts            # YAML frontmatter + XML task parser
│   ├── session-runner.ts         # Agent SDK query() execution
│   ├── phase-runner.ts           # Phase lifecycle state machine
│   ├── phase-prompt.ts           # Phase-aware prompt factory
│   ├── prompt-builder.ts         # Executor prompt assembly (plan→prompt)
│   ├── prompt-sanitizer.ts       # Strip interactive patterns from prompts
│   ├── context-engine.ts         # .planning/ file loader per phase type
│   ├── context-truncation.ts     # Markdown truncation + milestone extraction
│   ├── tool-scoping.ts           # Phase → allowed tools mapping
│   ├── research-gate.ts          # RESEARCH.md open questions check
│   ├── event-stream.ts           # SDKMessage → GSDEvent mapping + transport bus
│   ├── cli-transport.ts          # ANSI-colored stdout transport
│   ├── ws-transport.ts           # WebSocket broadcast transport
│   ├── logger.ts                 # Structured JSON debug logger (stderr)
│   ├── init-runner.ts            # New-project init workflow orchestrator
│   ├── cli.ts                    # CLI entry point (gsd-sdk binary)
│   │
│   ├── *.test.ts                 # Unit tests (co-located, excluded from build)
│   └── *.integration.test.ts     # Integration tests (require live Agent SDK)
│
├── prompts/                      # Headless versions of GSD-1 prompts
│   ├── agents/                   # Agent definition files (.md)
│   │   ├── gsd-executor.md
│   │   ├── gsd-phase-researcher.md
│   │   ├── gsd-plan-checker.md
│   │   ├── gsd-planner.md
│   │   ├── gsd-project-researcher.md
│   │   ├── gsd-research-synthesizer.md
│   │   ├── gsd-roadmapper.md
│   │   └── gsd-verifier.md
│   ├── workflows/                # Workflow instruction files (.md)
│   │   ├── discuss-phase.md
│   │   ├── execute-plan.md
│   │   ├── plan-phase.md
│   │   ├── research-phase.md
│   │   └── verify-phase.md
│   └── templates/                # Document templates for init workflow
│       ├── project.md
│       ├── requirements.md
│       ├── roadmap.md
│       ├── state.md
│       └── research-project/
│           ├── ARCHITECTURE.md
│           ├── FEATURES.md
│           ├── PITFALLS.md
│           ├── STACK.md
│           └── SUMMARY.md
│
├── test-fixtures/
│   └── sample-plan.md            # Minimal PLAN.md for E2E tests
│
├── dist/                         # Build output (tsc → excluded from source control)
│   ├── index.js                  # Compiled public API
│   ├── index.d.ts                # TypeScript declarations
│   ├── *.js.map                  # Source maps
│   └── ...                       # All other compiled modules
│
├── node_modules/                 # SDK-local deps (@anthropic-ai/claude-agent-sdk, ws, etc.)
├── package.json                  # npm package config (@gsd-build/sdk v0.1.0)
├── tsconfig.json                 # TypeScript compiler config
└── vitest.config.ts              # Test runner config (unit + integration projects)
```

---

## Every File in `sdk/src/`

### Core modules (production)

**`index.ts`** — Public API entry point. Exports the `GSD` class and re-exports all public
symbols from every other module. The only file external consumers need to import.
Sections: GSD class implementation, re-exports grouped by S02 (events/context/prompts), S03
(phase lifecycle), S05 (transports), init workflow.

**`types.ts`** — Centralized type definitions. Contains all interfaces, enums, and discriminated
union types. No logic — types only. Grouped by: frontmatter types, task types, parsed plan,
init types, session types, event types (large section), phase lifecycle types.
Key enums: `PhaseType`, `GSDEventType`, `PhaseStepType`.
Key types: `ParsedPlan`, `GSDEvent`, `PlanResult`, `PhaseRunnerResult`, `MilestoneRunnerResult`,
`HumanGateCallbacks`, `TransportHandler`.

**`config.ts`** — Loads `.planning/config.json` and deep-merges with `CONFIG_DEFAULTS`.
Exports: `loadConfig(projectDir)`, `GSDConfig`, `WorkflowConfig`, `CONFIG_DEFAULTS`.
Three-level merge: top-level → `git` object → `workflow` object → `hooks` object.

**`gsd-tools.ts`** — Bridge to `gsd-tools.cjs`. Uses `execFile` to shell out.
Exports: `GSDTools` class, `GSDToolsError`, `resolveGsdToolsPath()`.
`exec()` returns parsed JSON. `execRaw()` returns raw string. Handles `@file:` prefix pattern
for large outputs. Timeout: 30s default.

**`plan-parser.ts`** — Pure parser (no I/O except `parsePlanFile`). Stack-based YAML parser
for frontmatter, regex-based XML parser for tasks and sections.
Exports: `parsePlan(content)`, `parsePlanFile(filePath)`, `extractFrontmatter()`, `parseTasks()`.

**`session-runner.ts`** — Wraps Agent SDK `query()` with GSD conventions.
Exports: `runPlanSession()`, `runPhaseStepSession()`.
Internal: `resolveModel()`, `processQueryStream()`, `extractResult()`, `stepTypeToPhaseType()`.

**`phase-runner.ts`** — 800+ line state machine. The heaviest single module.
Exports: `PhaseRunner`, `PhaseRunnerError`, `PhaseRunnerDeps`, `VerificationOutcome`.
Internal: `runStep()`, `runExecuteStep()`, `runVerifyStep()`, `runAdvanceStep()`,
`runPlanCheckStep()`, `runSelfDiscussStep()`, `executeSinglePlan()`, `retryOnce()`,
`checkResearchGate()`, `invokeBlockerCallback()`, `stepToPhaseType()`.

**`phase-prompt.ts`** — Phase-aware prompt assembly. Reads workflow and agent files from disk.
Exports: `PromptFactory`, `extractBlock()`, `extractSteps()`, `PHASE_WORKFLOW_MAP`.
`buildPrompt()` has two paths: execute+plan → `buildExecutorPrompt()`, other phases → workflow
file + agent role + phase instructions + context files.

**`prompt-builder.ts`** — Executor-specific prompt assembly from `ParsedPlan`.
Exports: `buildExecutorPrompt()`, `parseAgentTools()`, `parseAgentRole()`, `DEFAULT_ALLOWED_TOOLS`.
Internal: `formatTask()`.

**`prompt-sanitizer.ts`** — Strips GSD-1 interactive patterns from prompts for headless use.
Exports: `sanitizePrompt(input)`.
Removes: `@file:`, `/gsd-`, `/gsd:`, `AskUserQuestion()`, `SlashCommand()`, STOP directives,
"wait for user", "ask the user".

**`context-engine.ts`** — Loads `.planning/` state files per phase type with context reduction.
Exports: `ContextEngine`, `PHASE_FILE_MANIFEST`, `FileSpec`.
Two-stage reduction: milestone extraction then markdown truncation. Reads from `<projectDir>/.planning/`.

**`context-truncation.ts`** — Pure functions for markdown truncation and milestone extraction.
Exports: `truncateMarkdown()`, `extractCurrentMilestone()`, `DEFAULT_TRUNCATION_OPTIONS`, `TruncationOptions`.
No I/O. Default `maxContentLength`: 8192 chars.

**`tool-scoping.ts`** — Maps `PhaseType` to allowed tool arrays.
Exports: `getToolsForPhase()`, `PHASE_AGENT_MAP`, `PHASE_DEFAULT_TOOLS`.

**`research-gate.ts`** — Pure function. Checks `RESEARCH.md` for unresolved open questions.
Exports: `checkResearchGate(researchContent)`, `ResearchGateResult`.

**`event-stream.ts`** — Event bus extending `EventEmitter`.
Exports: `GSDEventStream`, `EventStreamContext`.
Internal: per-type `mapXxxMessage()` private methods, `updateCost()`.

**`cli-transport.ts`** — ANSI terminal output transport.
Exports: `CLITransport`.
Handles all major event types with colored banners, step indicators, cost totals.

**`ws-transport.ts`** — WebSocket broadcast transport.
Exports: `WSTransport`, `WSTransportOptions`.
Requires `await transport.start()` before connecting to eventStream.

**`logger.ts`** — Structured JSON logger to stderr (debugging facility, separate from event stream).
Exports: `GSDLogger`, `GSDLoggerOptions`, `LogLevel`, `LogEntry`.
Four levels: debug, info, warn, error. Context fields: phase, plan, sessionId.

**`init-runner.ts`** — New-project init workflow.
Exports: `InitRunner`, `InitRunnerDeps`.
Internal: `runStep()`, `runParallelResearch()`, `buildProjectPrompt()`, `buildResearchPrompt()`,
`buildSynthesisPrompt()`, `buildRequirementsPrompt()`, `buildRoadmapPrompt()`, `runSession()`,
`readGSDFile()`, `readAgentFile()`.

**`cli.ts`** — CLI entry point for `gsd-sdk` binary.
Exports: `main()`, `parseCliArgs()`, `resolveInitInput()`, `ParsedCliArgs`, `USAGE`.
Commands: `run <prompt>`, `auto`, `init [input]`.
Options: `--project-dir`, `--ws-port`, `--model`, `--max-budget`, `--init`.

### Test files (unit)

All co-located with the source file they test. Named `<source-name>.test.ts`.

**`plan-parser.test.ts`** — Tests for `extractFrontmatter()`, `parseTasks()`, `parsePlan()`.
**`config.test.ts`** — Tests for `loadConfig()` with merge/defaults behavior.
**`gsd-tools.test.ts`** — Tests for `GSDTools.exec()`, `execRaw()`, `parseOutput()`, path resolution.
**`context-engine.test.ts`** — Tests for `ContextEngine.resolveContextFiles()` with mock file system.
**`context-truncation.test.ts`** — Tests for `truncateMarkdown()` and `extractCurrentMilestone()`.
**`event-stream.test.ts`** — Tests for `GSDEventStream.mapSDKMessage()` and transport delivery.
**`phase-runner.test.ts`** — Tests for `PhaseRunner.run()` with mock deps.
**`phase-runner-types.test.ts`** — Tests for type narrowing and enum values.
**`prompt-builder.test.ts`** — Tests for `buildExecutorPrompt()` and `parseAgentTools()`.
**`prompt-sanitizer.test.ts`** — Tests for `sanitizePrompt()` pattern removal.
**`research-gate.test.ts`** — Tests for `checkResearchGate()` with varied RESEARCH.md inputs.
**`tool-scoping.test.ts`** — Tests for `getToolsForPhase()` defaults and agent def override.
**`milestone-runner.test.ts`** — Tests for `GSD.run()` milestone loop (mocks `runPhase`).
**`init-runner.test.ts`** — Tests for `InitRunner.run()` step sequencing.
**`logger.test.ts`** — Tests for `GSDLogger` output format.
**`cli.test.ts`** — Tests for `parseCliArgs()` and `resolveInitInput()`.
**`cli-transport.test.ts`** — Tests for `CLITransport.onEvent()` formatting.
**`ws-transport.test.ts`** — Tests for `WSTransport` start/send/close lifecycle.
**`phase-prompt.test.ts`** — Tests for `PromptFactory.buildPrompt()` with mock files.
**`assembled-prompts.test.ts`** — Integration-style tests for full prompt assembly from real prompt files.
**`headless-prompts.test.ts`** — Tests for headless prompt sanitization correctness.

### Test files (integration)

Named `*.integration.test.ts`. Require live environment (Agent SDK, real file system). Timeout: 120s.

**`e2e.integration.test.ts`** — Runs a real `GSD.executePlan()` with `test-fixtures/sample-plan.md`.
**`phase-runner.integration.test.ts`** — Runs a real `PhaseRunner.run()` against a temp project.
**`init-e2e.integration.test.ts`** — Runs a real `InitRunner.run()` against a temp directory.
**`lifecycle-e2e.integration.test.ts`** — Full milestone lifecycle E2E test.

---

## Build Output Structure

TypeScript compiled by `tsc` with `tsconfig.json`:
- Source: `sdk/src/*.ts` (test files excluded via `tsconfig.json` exclude)
- Output: `sdk/dist/`
- Targets: ES2022, NodeNext modules
- Each `.ts` produces: `.js` + `.d.ts` + `.d.ts.map` + `.js.map`
- `sdk/dist/index.js` — main entry (package.json `"main"`)
- `sdk/dist/index.d.ts` — TypeScript types (package.json `"types"`)
- `sdk/dist/cli.js` — binary entry (package.json `"bin": { "gsd-sdk": "./dist/cli.js" }`)

**Published files** (from `package.json` `"files"` field):
- `dist/` — compiled JS + declarations
- `prompts/` — agent, workflow, and template files (required at runtime)

---

## Module Import Graph

```
cli.ts
  └─ index.ts
       ├─ plan-parser.ts ──────── types.ts
       ├─ config.ts
       ├─ gsd-tools.ts ─────────── types.ts
       ├─ session-runner.ts ─────── types.ts, config.ts, prompt-builder.ts,
       │                            event-stream.ts, tool-scoping.ts
       ├─ prompt-builder.ts ─────── types.ts
       ├─ event-stream.ts ───────── types.ts
       ├─ phase-runner.ts ───────── types.ts, config.ts, gsd-tools.ts,
       │                            event-stream.ts, phase-prompt.ts,
       │                            context-engine.ts, session-runner.ts,
       │                            research-gate.ts
       ├─ context-engine.ts ─────── types.ts, context-truncation.ts
       ├─ context-truncation.ts     (no SDK imports)
       ├─ phase-prompt.ts ───────── types.ts, prompt-builder.ts,
       │                            tool-scoping.ts, prompt-sanitizer.ts
       ├─ tool-scoping.ts ───────── types.ts, prompt-builder.ts
       ├─ research-gate.ts          (no SDK imports)
       ├─ logger.ts ──────────────── types.ts
       ├─ cli-transport.ts ──────── types.ts
       ├─ ws-transport.ts ──────── types.ts
       └─ init-runner.ts ────────── types.ts, gsd-tools.ts, event-stream.ts,
                                    config.ts, session-runner.ts, prompt-sanitizer.ts
```

**Leaf modules** (no SDK imports — pure logic):
- `context-truncation.ts`
- `research-gate.ts`
- `prompt-sanitizer.ts`
- `types.ts` (type-only, no runtime imports)

**Heaviest fan-in** (most dependents):
- `types.ts` — imported by every module
- `session-runner.ts` — imported by `phase-runner.ts`, `init-runner.ts`, `index.ts`
- `event-stream.ts` — imported by `session-runner.ts`, `phase-runner.ts`, `init-runner.ts`, `index.ts`

---

## Naming Conventions

**Source files:** kebab-case, no special prefix: `phase-runner.ts`, `context-engine.ts`

**Test files:** mirror source with suffix: `phase-runner.test.ts` (unit), `phase-runner.integration.test.ts` (integration)

**Prompts directory:** mirrors GSD-1 naming (kebab-case `.md` files)

**Export names:**
- Classes: PascalCase (`GSD`, `PhaseRunner`, `ContextEngine`, `GSDEventStream`)
- Functions: camelCase (`parsePlan`, `runPlanSession`, `checkResearchGate`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_ALLOWED_TOOLS`, `PHASE_FILE_MANIFEST`, `CONFIG_DEFAULTS`)
- Enums: PascalCase members (`PhaseType.Execute`, `GSDEventType.SessionInit`)

---

## Where to Add New Code

**New phase step type:** Add to `PhaseStepType` enum in `types.ts`, add case to `phase-runner.ts`
`run()` method and `stepToPhaseType()`, add tool set to `PHASE_DEFAULT_TOOLS` in `tool-scoping.ts`.

**New event type:** Add enum value to `GSDEventType` in `types.ts`, add event interface extending
`GSDEventBase`, add to `GSDEvent` union, add mapper case to `event-stream.ts` `mapSDKMessage()`,
add formatter to `CLITransport.formatEvent()` in `cli-transport.ts`.

**New gsd-tools command:** Add typed method to `GSDTools` class in `gsd-tools.ts` (use `exec()`
for JSON output, `execRaw()` for plain text). Add type to `types.ts` if needed.

**New context file per phase:** Add `FileSpec` entry to `PHASE_FILE_MANIFEST` in `context-engine.ts`,
add key to `ContextFiles` interface in `types.ts`, add label to `fileLabels` in
`PromptFactory.formatContextFiles()` in `phase-prompt.ts`.

**New transport:** Implement `TransportHandler` interface from `types.ts`, export from `index.ts`.

**New CLI command:** Add command handling in `cli.ts` `main()`, add to `USAGE` string,
add test in `cli.test.ts`.

**New SDK test:** Add `<module>.test.ts` co-located with source. Use Vitest. Mock heavy deps
(`session-runner.ts`, `gsd-tools.ts`, `config.ts`) with `vi.mock()` at top of file.

**New integration test:** Add `<name>.integration.test.ts` in `sdk/src/`. Will be picked up by
Vitest's `integration` project config automatically. Set 120s timeout via vitest config (already set globally).

---

## Special Directories

**`sdk/prompts/`**
- Purpose: Headless versions of GSD-1 workflow/agent/template files stripped of interactive patterns
- Runtime dependency: loaded by `PromptFactory` and `InitRunner` at execution time
- Committed: Yes (included in npm `"files"` field)
- Falls back to: `~/.claude/get-shit-done/` GSD-1 installations

**`sdk/test-fixtures/`**
- Purpose: Sample plan files for integration and E2E tests
- Contains: `sample-plan.md` — minimal two-field PLAN.md for smoke tests
- Committed: Yes

**`sdk/dist/`**
- Purpose: TypeScript compilation output
- Generated: Yes (`npm run build` / `tsc`)
- Committed: No (in `.gitignore`)

**`sdk/node_modules/`**
- Purpose: SDK-local dependencies
- Generated: Yes (`npm install`)
- Committed: No

---

*Structure analysis: 2026-04-07*
