# SDK Architecture

**Analysis Date:** 2026-04-07
**Package:** `@gsd-build/sdk` — `sdk/` subdirectory of `get-shit-done`

---

## Pattern Overview

The SDK is a **headless TypeScript execution engine** for GSD projects. It drives the same
discuss → research → plan → execute → verify → advance workflow as the CLI-based GSD commands,
but via programmatic API and Agent SDK `query()` calls — with no Claude Code slash commands,
no user prompting, and no interactive gates unless the caller provides callbacks.

**Key Characteristics:**
- Three public entry points: `GSD.executePlan()` (single plan), `GSD.runPhase()` (full lifecycle), `GSD.run()` (milestone/multi-phase)
- State stored in `.planning/` directory — same on-disk format as GSD-1 CLI
- All Claude sessions created via Agent SDK `query()` with `preset: 'claude_code'`
- Events emitted as typed `GSDEvent` objects via `GSDEventStream` → zero or more transports
- `GSDTools` shells out to `gsd-tools.cjs` for all `.planning/` state mutations

---

## Public API — The GSD Class

**Location:** `sdk/src/index.ts`

The `GSD` class is the primary entry point. It composes all internal modules.

```typescript
const gsd = new GSD({
  projectDir: '/path/to/project',  // required
  gsdToolsPath?: string,           // override gsd-tools.cjs path
  model?: string,                   // model ID override
  maxBudgetUsd?: number,            // default: 5.0
  maxTurns?: number,                // default: 50
  autoMode?: boolean,               // sets auto_advance=true, skip_discuss=false
});
```

**Public methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `executePlan(planPath, opts?)` | Execute a single PLAN.md file | `Promise<PlanResult>` |
| `runPhase(phaseNumber, opts?)` | Run full phase lifecycle (discuss→advance) | `Promise<PhaseRunnerResult>` |
| `run(prompt, opts?)` | Run all incomplete phases in a milestone loop | `Promise<MilestoneRunnerResult>` |
| `createTools()` | Create a `GSDTools` instance for state queries | `GSDTools` |
| `onEvent(handler)` | Subscribe to all events as a plain function | `void` |
| `addTransport(handler)` | Subscribe a `TransportHandler` with close lifecycle | `void` |
| `eventStream` | Direct access to the `GSDEventStream` instance | `GSDEventStream` |

---

## Layers

**Public API Layer:**
- Purpose: Single entry point composing all internal services
- Location: `sdk/src/index.ts`
- Depends on: All internal modules
- Used by: External code, CLI entry point `sdk/src/cli.ts`

**Session Execution Layer:**
- Purpose: Translate parsed plans or raw prompts into Agent SDK `query()` calls
- Location: `sdk/src/session-runner.ts`
- Contains: `runPlanSession()`, `runPhaseStepSession()`, model resolution
- Depends on: `@anthropic-ai/claude-agent-sdk`, `event-stream.ts`, `tool-scoping.ts`
- Used by: `GSD.executePlan()`, `PhaseRunner` step methods, `InitRunner`

**Phase Lifecycle Layer:**
- Purpose: Full state machine: discuss → research → plan → plan-check → execute → verify → advance
- Location: `sdk/src/phase-runner.ts`
- Depends on: `session-runner.ts`, `context-engine.ts`, `phase-prompt.ts`, `gsd-tools.ts`, `research-gate.ts`
- Used by: `GSD.runPhase()`

**Context Resolution Layer:**
- Purpose: Load and truncate `.planning/` files appropriate to each phase type
- Location: `sdk/src/context-engine.ts`, `sdk/src/context-truncation.ts`
- Depends on: Node.js `fs` — no other SDK modules
- Used by: `PhaseRunner` before each step session

**Prompt Assembly Layer:**
- Purpose: Build system prompt strings from agent defs, workflow files, and context
- Location: `sdk/src/phase-prompt.ts` (phase-aware), `sdk/src/prompt-builder.ts` (executor only)
- Depends on: `context-engine.ts`, `tool-scoping.ts`, `prompt-sanitizer.ts`
- Used by: `PhaseRunner`, `GSD.executePlan()`

**State Bridge Layer:**
- Purpose: Shell out to `gsd-tools.cjs` for all `.planning/` mutations
- Location: `sdk/src/gsd-tools.ts`
- Depends on: Node.js `child_process.execFile`
- Used by: `PhaseRunner`, `GSD.run()`, `InitRunner`

**Event System Layer:**
- Purpose: Typed event bus mapping `SDKMessage` variants to domain events
- Location: `sdk/src/event-stream.ts`, `sdk/src/types.ts`, `sdk/src/cli-transport.ts`, `sdk/src/ws-transport.ts`
- Depends on: Node.js `EventEmitter`, `ws` package
- Used by: `GSD`, `PhaseRunner`, `InitRunner`, `session-runner.ts`

**Config Layer:**
- Purpose: Load and deep-merge `.planning/config.json` with defaults
- Location: `sdk/src/config.ts`
- Depends on: Node.js `fs` only
- Used by: `GSD`, `PhaseRunner`, `session-runner.ts`

**Plan Parsing Layer:**
- Purpose: Parse YAML frontmatter + XML task bodies from PLAN.md content strings
- Location: `sdk/src/plan-parser.ts`
- Depends on: `sdk/src/types.ts` only
- Used by: `GSD.executePlan()`, tests

---

## PhaseRunner State Machine and Lifecycle

**Location:** `sdk/src/phase-runner.ts`

`PhaseRunner` is constructed with dependency-injected collaborators (`PhaseRunnerDeps`) and
exposes a single public method: `run(phaseNumber, options?)`.

### State machine steps (in order):

```
Discuss → Research → Research Gate → Plan → Plan Check → Execute → Verify → Advance
```

Each step is conditional:

| Step | Skip condition |
|------|---------------|
| Discuss | `phaseOp.has_context === true` OR `config.workflow.skip_discuss === true` |
| Self-discuss | Only runs if `config.workflow.auto_advance === true` AND no context exists |
| Research | `config.workflow.research === false` |
| Research Gate | Skipped if `phaseOp.has_research === false` |
| Plan Check | `config.workflow.plan_check === false` |
| Execute | Never skipped; skips individual plans with `has_summary: true` |
| Verify | `config.workflow.verifier === false` |
| Advance | Only runs when verify passed; skipped if gaps were found |

### Per-step lifecycle:
1. Emit `PhaseStepStart` event
2. Call `contextEngine.resolveContextFiles(phaseType)`
3. Call `promptFactory.buildPrompt(phaseType, plan, contextFiles)`
4. Call `runPhaseStepSession(prompt, step, config, opts, eventStream, context)`
5. Emit `PhaseStepComplete` event with success/failure and duration
6. Return `PhaseStepResult`

### Retry logic:
- Each step (except verify) is wrapped in `retryOnce()` — fails → logs warning → retries once
- Verify has its own gap-closure retry loop (capped at `options.maxGapRetries`, default 1):
  - `passed` → proceed to advance
  - `human_needed` → invoke `callbacks.onVerificationReview`
  - `gaps_found` → run plan step → run execute step → re-verify

### Plan-check re-planning (D023):
If plan-check fails: re-run plan step → re-run plan-check once. If second check also fails, log warning and proceed.

### Execute step — wave-parallel execution:
Execute uses `tools.phasePlanIndex(phaseNumber)` to get wave groupings. Plans with `has_summary: true` are skipped (already done). Plans in the same wave run via `Promise.allSettled()` (concurrent). Waves run sequentially. Falls back to sequential when `config.parallelization === false`.

---

## Session Runner and Plan Execution Flow

**Location:** `sdk/src/session-runner.ts`

Two exported functions:

### `runPlanSession(plan, config, options?, agentDef?, eventStream?, streamContext?)`

Used for `GSD.executePlan()`. Takes a `ParsedPlan`, builds the executor prompt via
`buildExecutorPrompt()`, then calls `query()`. Returns `Promise<PlanResult>`.

### `runPhaseStepSession(prompt, phaseStep, config, options?, eventStream?, streamContext?)`

Used by `PhaseRunner` for every step. Takes a raw prompt string and `PhaseStepType`.
Tools are scoped by phase type via `getToolsForPhase()`. Returns `Promise<PlanResult>`.

### Common `query()` configuration:
```typescript
query({
  prompt: prompt,
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code', append: prompt },
    settingSources: ['project'],
    allowedTools,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns,
    maxBudgetUsd,
    cwd,
    model?,  // injected when model is resolved
  },
})
```

### Model resolution priority:
1. `options.model` (per-call explicit)
2. `config.model_profile` → mapped to model ID (`balanced` → `claude-sonnet-4-6`, `quality` → `claude-opus-4-6`, `speed` → `claude-haiku-4-5`)
3. SDK default (let Agent SDK decide)

### Stream processing (`processQueryStream`):
Iterates `AsyncIterable<SDKMessage>`, calls `eventStream.mapAndEmit()` per message, captures the `result` message, extracts `PlanResult`, emits `CostUpdate` event.

---

## Full Data Flow: `GSD.executePlan()` to Completion

```
GSD.executePlan(planPath)
  │
  ├─ parsePlanFile(absolutePlanPath)          → ParsedPlan
  ├─ loadConfig(projectDir)                   → GSDConfig
  ├─ loadAgentDefinition()                    → string | undefined
  │   └─ probes: .claude/get-shit-done/agents/, .claude/agents/, ~/.claude/agents/, agents/
  │
  └─ runPlanSession(plan, config, opts, agentDef, eventStream, context)
      │
      ├─ buildExecutorPrompt(plan, agentDef)  → prompt string
      │   ├─ parseAgentRole(agentDef)         → role block
      │   └─ formatTask() per task            → task blocks
      │
      ├─ resolveModel(opts, config)           → model string | undefined
      │
      └─ query({ prompt, options: { preset, tools, budget, turns, cwd } })
          │
          └─ AsyncIterable<SDKMessage>
              ├─ each message → eventStream.mapAndEmit() → GSDEvent → transports
              └─ result message → extractResult() → PlanResult
```

---

## Full Data Flow: `GSD.runPhase()` to Completion

```
GSD.runPhase(phaseNumber, options?)
  │
  ├─ createTools()           → GSDTools
  ├─ new PromptFactory()     → PromptFactory
  ├─ new ContextEngine()     → ContextEngine
  ├─ loadConfig()            → GSDConfig
  │   (auto mode: config.workflow.auto_advance = true)
  │
  └─ PhaseRunner.run(phaseNumber, options)
      │
      ├─ tools.initPhaseOp(phaseNumber)       → PhaseOpInfo
      │   └─ shells out to: gsd-tools.cjs init phase-op <N>
      │
      ├─ emit PhaseStart event
      │
      ├─ [conditional] Discuss step
      │   ├─ contextEngine.resolveContextFiles(Discuss)  → ContextFiles
      │   ├─ promptFactory.buildPrompt(Discuss, null, ctx) → prompt
      │   └─ runPhaseStepSession(prompt, Discuss, config, opts, stream)
      │
      ├─ [conditional] Research step
      │   └─ (same pattern as Discuss with Research phase type)
      │
      ├─ [conditional] Research Gate
      │   └─ checkResearchGate(phaseOp.research_path)   → ResearchGateResult
      │
      ├─ Plan step
      │   └─ (same pattern)
      │
      ├─ [conditional] Plan Check step
      │   └─ runPlanCheckStep() — loads gsd-plan-checker, runs Verify-scoped session
      │
      ├─ Execute step
      │   ├─ tools.phasePlanIndex(phaseNumber)           → PhasePlanIndex
      │   └─ per wave: Promise.allSettled(plans.map(executeSinglePlan))
      │       └─ each plan: contextEngine + promptFactory + runPhaseStepSession
      │
      ├─ [conditional] Verify step
      │   ├─ runPhaseStepSession(verifyPrompt, Verify, ...)
      │   └─ gap closure loop: plan → execute → re-verify (up to maxGapRetries)
      │
      ├─ [conditional] Advance step
      │   └─ tools.phaseComplete(phaseNumber)            → marks phase done in state
      │
      └─ emit PhaseComplete event → return PhaseRunnerResult
```

---

## Full Data Flow: `GSD.run()` (Milestone)

```
GSD.run(prompt, options?)
  │
  ├─ createTools()
  ├─ emit MilestoneStart
  │
  └─ loop while incomplete phases remain:
      ├─ tools.roadmapAnalyze()              → RoadmapAnalysis
      │   └─ shells out to: gsd-tools.cjs roadmap analyze
      │
      ├─ filter to roadmap_complete === false, sort numerically (parseFloat)
      │
      ├─ runPhase(phase.number, options)     → PhaseRunnerResult
      │
      ├─ [if options.onPhaseComplete] → await callback → 'stop' breaks loop
      │
      ├─ tools.roadmapAnalyze() again        (re-discover dynamically inserted phases)
      │
      └─ if phase failed → set success=false, break
  │
  ├─ emit MilestoneComplete
  └─ return MilestoneRunnerResult
```

---

## Context Engine

**Location:** `sdk/src/context-engine.ts`

`ContextEngine` resolves which `.planning/` files to load per phase type, reads them,
applies context reduction, and returns `ContextFiles`.

### Phase file manifest (`PHASE_FILE_MANIFEST`):

| Phase | Files loaded |
|-------|-------------|
| Execute | `STATE.md` (required), `config.json` (optional) |
| Research | `STATE.md` (required), `ROADMAP.md` (required), `CONTEXT.md` (required), `REQUIREMENTS.md` (optional) |
| Plan | `STATE.md` (required), `ROADMAP.md` (required), `CONTEXT.md` (required), `RESEARCH.md` (optional), `REQUIREMENTS.md` (optional) |
| Verify | `STATE.md` (required), `ROADMAP.md` (required), `REQUIREMENTS.md` (optional), `PLAN.md` (optional), `SUMMARY.md` (optional) |
| Discuss | `STATE.md` (required), `ROADMAP.md` (optional), `CONTEXT.md` (optional) |

### Context reduction pipeline (applied in order):
1. **Milestone extraction** (`extractCurrentMilestone`): Parses STATE.md for current milestone name, extracts only that section from ROADMAP.md. Other milestones replaced with `[N other milestone(s) omitted]`.
2. **Markdown-aware truncation** (`truncateMarkdown`): Files exceeding `maxContentLength` (default 8192 chars) are reduced to: YAML frontmatter + headings + first paragraph per section + `[... N lines omitted]` markers.

`config.json` is never truncated (structured data, not markdown).

---

## Event System

**Location:** `sdk/src/event-stream.ts`, `sdk/src/types.ts`

### GSDEventStream

Extends Node.js `EventEmitter`. Holds a `Set<TransportHandler>` and a `CostTracker`.

**Emission flow:**
1. `emitEvent(event)` called with typed `GSDEvent`
2. Fires `this.emit('event', event)` (all `on('event', ...)` listeners)
3. Fires `this.emit(event.type, event)` (per-type listeners)
4. Iterates all transports: `transport.onEvent(event)` (wrapped in try/catch)

**SDKMessage mapping** (`mapSDKMessage` / `mapAndEmit`):
Called per message from the `query()` stream. Produces one `GSDEvent` per SDK message (or null for non-actionable types). Multi-block assistant messages (text + tool_use in same message) produce multiple events — extras are emitted directly, last one returned.

| SDK message type | GSD event type(s) |
|-----------------|------------------|
| `system/init` | `SessionInit` |
| `system/api_retry` | `APIRetry` |
| `system/status` | `StatusChange` |
| `system/compact_boundary` | `CompactBoundary` |
| `system/task_started` | `TaskStarted` |
| `system/task_progress` | `TaskProgress` |
| `system/task_notification` | `TaskNotification` |
| `assistant` (text block) | `AssistantText` |
| `assistant` (tool_use block) | `ToolCall` |
| `result/success` | `SessionComplete` |
| `result/error` | `SessionError` |
| `tool_progress` | `ToolProgress` |
| `tool_use_summary` | `ToolUseSummary` |
| `rate_limit_event` | `RateLimit` |
| `stream_event` | `StreamEvent` |
| `user`, `auth_status`, `prompt_suggestion` | null (ignored) |

**Cost tracking:** Per-session buckets keyed by `session_id`. Delta tracking prevents double-counting when a session emits multiple cost updates.

### GSDEventType enum — complete list:
`SessionInit`, `SessionComplete`, `SessionError`, `AssistantText`, `ToolCall`, `ToolProgress`,
`ToolUseSummary`, `TaskStarted`, `TaskProgress`, `TaskNotification`, `CostUpdate`, `APIRetry`,
`RateLimit`, `StatusChange`, `CompactBoundary`, `StreamEvent`, `PhaseStart`, `PhaseStepStart`,
`PhaseStepComplete`, `PhaseComplete`, `WaveStart`, `WaveComplete`, `MilestoneStart`,
`MilestoneComplete`, `InitStart`, `InitStepStart`, `InitStepComplete`, `InitComplete`,
`InitResearchSpawn`

### Transports

**`CLITransport`** (`sdk/src/cli-transport.ts`): Renders events as ANSI-colored terminal output.
No external dependencies — ANSI codes inline. Writes to configurable `Writable` (default: `process.stdout`).

**`WSTransport`** (`sdk/src/ws-transport.ts`): Starts a `WebSocketServer` on a configured port,
JSON-serializes each event, broadcasts to all `OPEN` clients. Requires `await transport.start()` before connecting to eventStream.

Both transports implement `TransportHandler`:
```typescript
interface TransportHandler {
  onEvent(event: GSDEvent): void;  // must never throw
  close(): void;
}
```

---

## Dependency Injection Pattern

`PhaseRunner` receives all collaborators via `PhaseRunnerDeps`:

```typescript
interface PhaseRunnerDeps {
  projectDir: string;
  tools: GSDTools;           // state management
  promptFactory: PromptFactory;  // prompt assembly
  contextEngine: ContextEngine;  // context loading
  eventStream: GSDEventStream;   // event emission
  config: GSDConfig;             // workflow configuration
  logger?: GSDLogger;            // optional debug logger
}
```

`GSD.runPhase()` constructs all deps and passes them in. Tests mock individual deps.

`InitRunner` uses a similar pattern (`InitRunnerDeps`) with `tools`, `eventStream`, `config`, and optional `sdkPromptsDir`.

---

## Plan Parsing

**Location:** `sdk/src/plan-parser.ts`

### PLAN.md format:
```
---                              ← YAML frontmatter start
phase: '01-auth'
plan: '01'
wave: 1
depends_on: []
must_haves:
  truths:
    - some invariant
  artifacts:
    - path: src/foo.ts
      provides: export Foo
  key_links: []
---

<objective>
What this plan achieves.
</objective>

<execution_context>
@path/to/file
</execution_context>

<context>
@path/to/ref
</context>

<tasks>
<task type="auto">
  <name>Task name</name>
  <files>src/foo.ts, src/bar.ts</files>
  <read_first>src/existing.ts</read_first>
  <action>What to do</action>
  <verify>How to verify it</verify>
  <done>Done criteria</done>
  <acceptance_criteria>
  - criterion one
  - criterion two
  </acceptance_criteria>
</task>
</tasks>
```

### Parsing pipeline (`parsePlan(content)`):
1. `extractFrontmatter(content)` — stack-based YAML parser (no YAML library). Handles nested objects, inline arrays, boolean/number coercion, leading-zero string preservation.
2. `parseMustHaves(raw)` — normalizes `must_haves` into typed `MustHaves` structure.
3. `parseTasks(content)` — regex-based `<task>...</task>` extraction. Handles nested XML, multiline action blocks, comma-separated file lists.
4. `extractSection(content, name)` — extracts `<objective>`, `<execution_context>`, `<context>` blocks.
5. Returns `ParsedPlan` with all structured data plus `raw` string.

`parsePlanFile(filePath)` is a convenience wrapper that reads the file first.

---

## Prompt Assembly

**Location:** `sdk/src/phase-prompt.ts` (PromptFactory), `sdk/src/prompt-builder.ts` (executor only)

### PromptFactory.buildPrompt(phaseType, plan, contextFiles):

Cache-optimized ordering (stable prefix → variable suffix):
1. **Stable (cacheable):** Agent role from agent definition file
2. **Stable (cacheable):** Workflow purpose + process steps from workflow file
3. **Stable (cacheable):** Hardcoded phase-specific instructions
4. **Variable (uncacheable):** Context files (`STATE.md`, `ROADMAP.md`, etc.)

For Execute phase with a plan: delegates entirely to `buildExecutorPrompt()`.

### File resolution (both try SDK prompts dir first):
- Workflow files: `sdk/prompts/workflows/{filename}` → fallback to `~/.claude/get-shit-done/workflows/`
- Agent files: `sdk/prompts/agents/{filename}` → fallback to `~/.claude/agents/`

### `PHASE_AGENT_MAP` (in `tool-scoping.ts`):

| Phase | Agent file |
|-------|-----------|
| Execute | `gsd-executor.md` |
| Research | `gsd-phase-researcher.md` |
| Plan | `gsd-planner.md` |
| Verify | `gsd-verifier.md` |
| Discuss | `null` (no dedicated agent) |

### Prompt sanitizer (`sdk/src/prompt-sanitizer.ts`):
Strips interactive GSD-1 patterns before passing prompts to headless sessions:
- `@file:...` references
- `/gsd-...` and `/gsd:...` skill commands
- `AskUserQuestion(...)` calls
- `SlashCommand()` calls
- STOP directives, "wait for user", "ask the user" instructions

---

## Tool Scoping

**Location:** `sdk/src/tool-scoping.ts`

`getToolsForPhase(phaseType, agentDef?)` returns allowed tools per phase:

| Phase | Default tools |
|-------|--------------|
| Research | `Read, Grep, Glob, Bash, WebSearch` |
| Execute | `Read, Write, Edit, Bash, Grep, Glob` |
| Verify | `Read, Bash, Grep, Glob` |
| Discuss | `Read, Bash, Grep, Glob` |
| Plan | `Read, Write, Bash, Glob, Grep, WebFetch` |

If an agent definition file is provided, tools are parsed from its YAML frontmatter instead.

---

## GSDTools State Bridge

**Location:** `sdk/src/gsd-tools.ts`

All `.planning/` state mutations go through `GSDTools`, which shells out to `gsd-tools.cjs` via `execFile`. This avoids reimplementing 12K+ lines of CJS logic in TypeScript.

### Key methods:

| Method | gsd-tools.cjs command | Returns |
|--------|----------------------|---------|
| `initPhaseOp(phaseNumber)` | `init phase-op <N>` | `PhaseOpInfo` |
| `initNewProject()` | `init new-project` | `InitNewProjectInfo` |
| `roadmapAnalyze()` | `roadmap analyze` | `RoadmapAnalysis` |
| `phasePlanIndex(phaseNumber)` | `phase-plan-index <N>` | `PhasePlanIndex` |
| `phaseComplete(phase)` | `phase complete <N>` | `string` |
| `configSet(key, value)` | `config-set <key> <value>` | `string` |
| `stateLoad()` | `state load` | `string` |
| `commit(message, files?)` | `commit <msg> [--files ...]` | `string` |

### `@file:` prefix support:
When gsd-tools output is too large for a buffer, it writes to a temp file and returns `@file:/path/to/result`. `GSDTools.parseOutput()` detects this prefix and reads the file instead.

### Path resolution (`resolveGsdToolsPath`):
Probes in order:
1. `<projectDir>/.claude/get-shit-done/bin/gsd-tools.cjs` (project-local install)
2. Bundled path: `../../get-shit-done/bin/gsd-tools.cjs` relative to SDK dist
3. `~/.claude/get-shit-done/bin/gsd-tools.cjs` (global install)

---

## InitRunner

**Location:** `sdk/src/init-runner.ts`

Orchestrates new-project initialization. Steps run sequentially (stopping on failure) except research (4 parallel sessions):

```
setup → config → project → [parallel: research-stack, research-features,
                             research-architecture, research-pitfalls]
      → synthesis → requirements → roadmap
```

All sessions use `runPhaseStepSession(..., PhaseStepType.Research, ...)` to get broad tool access.

Research sessions run via `Promise.allSettled()` — partial failures don't stop synthesis.

File lookup uses the same two-tier pattern as `PromptFactory`: SDK prompts dir first, then GSD-1 originals.

---

## Config

**Location:** `sdk/src/config.ts`

`loadConfig(projectDir)` reads `.planning/config.json`, performs a three-level deep merge with `CONFIG_DEFAULTS`, and returns typed `GSDConfig`.

Key `workflow` fields consumed by `PhaseRunner`:

| Field | Default | Effect |
|-------|---------|--------|
| `research` | `true` | Run research step |
| `plan_check` | `true` | Run plan-check step |
| `verifier` | `true` | Run verify step |
| `auto_advance` | `false` | AI self-discuss mode |
| `skip_discuss` | `false` | Skip discuss step entirely |
| `max_discuss_passes` | `3` | Cap on self-discuss passes |
| `parallelization` | `true` | Wave-parallel plan execution |

---

## Research Gate

**Location:** `sdk/src/research-gate.ts`

Pure function `checkResearchGate(researchContent)` inspects `RESEARCH.md` for an `## Open Questions` section. Returns `pass: false` with unresolved question list if any unresolved questions are found. Logic:
- No `## Open Questions` section → pass
- Section has `(RESOLVED)` suffix → pass
- Section is empty → pass
- All listed questions contain "resolved" keyword → pass
- Otherwise → fail with list

---

## Missing or Incomplete Areas

**No MilestoneRunner class:** The milestone loop lives directly in `GSD.run()` — there is no standalone `MilestoneRunner` class for injection/testing. The test for it (`milestone-runner.test.ts`) tests `GSD.run()` directly by mocking `runPhase`.

**Plan-check outcome parsing is stub-level:** `runPlanCheckStep()` determines success solely from `planResult.success` (whether the session ran without error). The "VERIFICATION PASSED" / "ISSUES FOUND" text signals in the agent output are documented but not yet parsed programmatically. This is a known gap.

**`executeSinglePlan()` doesn't read the actual PLAN.md:** It calls `contextEngine.resolveContextFiles(Execute)` and `promptFactory.buildPrompt(Execute, null, ctx)` but passes `null` for the plan — the plan ID is passed as `planName` in the stream context for observability only. The agent reads the plan file itself via `Read` tool at runtime.

**No `@gsd/sdk` CLI integration with `gsd-tools` commands:** The `gsd-sdk auto` and `gsd-sdk run` CLI commands drive `GSD.run()` but there is no direct CLI for individual `gsd-tools.cjs` operations.

**`ws` dependency:** `WSTransport` requires `npm install ws` in the consuming package if used. It's a production dependency in the SDK itself.

---

*Architecture analysis: 2026-04-07*
