# Architecture

**Analysis Date:** 2026-04-17

## Pattern Overview

**Overall:** Spec-driven, agent-centric workflow framework with a dual runtime: markdown-defined commands and workflows drive human/AI sessions, while a Node.js CLI (`get-shit-done/bin/gsd-tools.cjs`) and TypeScript SDK (`sdk/src/`) perform deterministic planning operations and programmatic plan execution.

**Key Characteristics:**
- **Separation of orchestration vs. execution:** Slash commands (`commands/gsd/*.md`) describe intent; workflows (`get-shit-done/workflows/*.md`) sequence steps; specialized agents (`agents/gsd-*.md`) hold role prompts; implementation work is encoded in per-project `PLAN.md` specs under the consumer’s `.planning/` tree (not shipped inside this repo’s root).
- **Single source of truth for tooling behavior:** The SDK query layer (`sdk/src/query/index.ts`) registers handlers that mirror `gsd-tools` semantics; `GSDTools` (`sdk/src/gsd-tools.ts`) dispatches to the in-process registry by default and can delegate to `get-shit-done/bin/gsd-tools.cjs` when workstream alignment requires the legacy CJS path.
- **Agent SDK at the core of automation:** `runPlanSession` in `sdk/src/session-runner.ts` calls `query()` from `@anthropic-ai/claude-agent-sdk` with prompts from `sdk/src/prompt-builder.ts`, scoped tools, and budget/turn limits.

## Layers

**User & packaging layer:**
- Purpose: Distribute the framework, install runtime hooks and copied assets into AI tool directories.
- Location: `bin/install.js`, root `package.json` (`get-shit-done-cc`).
- Contains: Multi-runtime installer logic, version discovery, file copies.
- Depends on: Node.js, filesystem layout under `get-shit-done/`, `commands/`, `agents/`, `hooks/`.
- Used by: End users via `npx get-shit-done-cc` or global install.

**Command & workflow layer:**
- Purpose: Stable `/gsd:*` entry points and step-by-step orchestration for humans and agents.
- Location: `commands/gsd/*.md`, `get-shit-done/workflows/*.md`, `get-shit-done/references/`, `get-shit-done/templates/`.
- Contains: Frontmatter metadata, orchestration instructions, links to `gsd-tools` invocations and agent names.
- Depends on: Project-local `.planning/` state, installed workflows in the user environment.
- Used by: IDE slash commands and documentation.

**Agent definition layer:**
- Purpose: Role-specific system prompts, tool policies, and task contracts for subagents.
- Location: `agents/gsd-*.md`, `sdk/prompts/agents/*.md`, `sdk/prompts/workflows/*.md`.
- Contains: Markdown agent specs consumed by installers and the SDK when loading executor/planner behavior.
- Depends on: Runtime (Claude Code / Copilot / etc.) capabilities.
- Used by: Workflows, `GSD` when loading agent definitions (`sdk/src/index.ts`).

**GSD Tools CLI (CommonJS):**
- Purpose: Atomic CLI for state, roadmap, commits, verification, templates, intel, and related operations.
- Location: `get-shit-done/bin/gsd-tools.cjs`, modular helpers in `get-shit-done/bin/lib/*.cjs` (e.g. `state.cjs`, `phase.cjs`, `roadmap.cjs`, `verify.cjs`, `config.cjs`, `init.cjs`).
- Contains: Argument parsing, file mutations under `.planning/`, git helpers, validation.
- Depends on: Node.js, git in `PATH`, project `.planning/` layout.
- Used by: Workflows via `node .../gsd-tools.cjs`, subprocess path from `GSDTools` when not using pure registry dispatch.

**TypeScript SDK:**
- Purpose: Typed programmatic API: plan parsing, config, session execution, phase lifecycle, event streaming, query registry.
- Location: `sdk/src/` with public barrel `sdk/src/index.ts`, CLI `sdk/src/cli.ts`.
- Contains: `GSD` class, `PhaseRunner` (`sdk/src/phase-runner.ts`), `ContextEngine` (`sdk/src/context-engine.ts`), `GSDEventStream` (`sdk/src/event-stream.ts`), query subsystem (`sdk/src/query/*.ts`), tests co-located as `*.test.ts` / `*.integration.test.ts`.
- Depends on: `@anthropic-ai/claude-agent-sdk`, `ws` (WebSocket transport), Node 20+ per `sdk/package.json`.
- Used by: External automation, `gsd-sdk` CLI, internal tests.

**Hooks & scripts:**
- Purpose: Build-time bundling of hook scripts, repo maintenance scripts, security scans.
- Location: `hooks/*.js`, `scripts/build-hooks.js`, `scripts/run-tests.cjs`, `scripts/*.sh`.
- Contains: IDE/agent lifecycle hooks; root test runner delegating to Vitest and CJS tests.
- Depends on: esbuild (`package.json` devDependencies).
- Used by: Install pipeline (`prepublishOnly` runs `build:hooks`).

## Data Flow

**Plan execution (SDK):**

1. Caller constructs `GSD` with `projectDir` (`sdk/src/index.ts`).
2. `executePlan(planPath)` reads and parses `PLAN.md` via `parsePlanFile` (`sdk/src/plan-parser.ts`).
3. `loadConfig` (`sdk/src/config.ts`) reads `.planning/config.json` (and workstream-aware paths when configured).
4. Optional agent markdown is loaded for tool restrictions.
5. `runPlanSession` (`sdk/src/session-runner.ts`) builds the executor prompt, calls `query()` from the Agent SDK, streams messages, and returns `PlanResult`.

**Phase lifecycle (SDK):**

1. `PhaseRunner` (`sdk/src/phase-runner.ts`) receives `PhaseRunnerDeps` (`tools`, `promptFactory`, `contextEngine`, `eventStream`, `config`).
2. Steps (discuss, research, plan, execute, verify, advance) invoke `runPhaseStepSession` / `runPlanSession` and `GSDTools` for state transitions.
3. Events emit through `GSDEventStream` for transports (e.g. `sdk/src/ws-transport.ts`, `sdk/src/cli-transport.ts`).

**Query / gsd-tools parity:**

1. `createRegistry()` (`sdk/src/query/index.ts`) wires `QueryRegistry` with handlers for state, config, phase, roadmap, verify, init composites, profile, intel, etc.
2. CLI `gsd-sdk query` (`sdk/src/cli.ts`) parses args and dispatches to the registry (see `normalizeQueryCommand` re-export).
3. `GSDTools` (`sdk/src/gsd-tools.ts`) uses `registry.dispatch()` for native query operations; formats stdout-compatible output for runner expectations; falls back to `execFile` on `gsd-tools.cjs` when workstream routing requires CJS.

**State Management:**
- Authoritative project state lives under the **consumer project’s** `.planning/` directory: `STATE.md`, `ROADMAP.md`, `config.json`, phase folders with `PLAN.md` / `SUMMARY.md`, optional `workstreams/` subtree.
- The repository documents and tools assume this layout; the mapper analyzes the framework repo, not a sample `.planning/` unless present.

## Key Abstractions

**`GSD`:**
- Purpose: Facade for `executePlan`, transports, `createTools()`, and higher-level runners exposed from `sdk/src/index.ts`.
- Pattern: Composition of parser, config, tools bridge, and session runner.

**`PhaseRunner`:**
- Purpose: State machine for full phase workflows with gates and verification loops.
- Examples: `sdk/src/phase-runner.ts`.
- Pattern: Dependency-injected `GSDTools`, `PromptFactory`, `ContextEngine`, optional `GSDLogger`.

**`ParsedPlan`:**
- Purpose: Structured representation of a plan file (frontmatter, tasks, objective).
- Examples: Produced by `sdk/src/plan-parser.ts`, consumed by `sdk/src/session-runner.ts` and prompts.

**`GSDTools`:**
- Purpose: Bridge from TypeScript to planning operations (registry or subprocess).
- Examples: `sdk/src/gsd-tools.ts`, path resolution via `resolveGsdToolsPath`.

**`QueryRegistry` / handlers:**
- Purpose: Named command dispatch matching CLI argv style used across workflows.
- Examples: `sdk/src/query/registry.ts`, factory `createRegistry` in `sdk/src/query/index.ts`.

**`GSDEventStream`:**
- Purpose: Typed event fan-out to logging and transports.
- Examples: `sdk/src/event-stream.ts`, consumed by `GSD`, `PhaseRunner`, CLI.

## Entry Points

**npm package installer:**
- Location: `bin/install.js`
- Triggers: `get-shit-done-cc` / `npx get-shit-done-cc` with runtime flags (`--claude`, `--cursor`, etc.).
- Responsibilities: Copy framework files, configure IDE-specific hooks and agent registrations.

**GSD Tools CLI:**
- Location: `get-shit-done/bin/gsd-tools.cjs`
- Triggers: Workflows and shell scripts invoking `node gsd-tools.cjs <command>`.
- Responsibilities: CRUD on planning artifacts, validation, commits, scaffolding.

**SDK library:**
- Location: `sdk/src/index.ts` (build output `sdk/dist/index.js`)
- Triggers: `import { GSD } from '@gsd-build/sdk'` in applications.
- Responsibilities: Programmatic plan and phase execution.

**SDK CLI:**
- Location: `sdk/src/cli.ts` (bin `gsd-sdk` in `sdk/package.json`)
- Triggers: `gsd-sdk run`, `gsd-sdk query`, etc.
- Responsibilities: Thin CLI over `GSD`, query registry, optional WebSocket port.

**Root tests:**
- Location: `scripts/run-tests.cjs` invoked by `npm test` from root `package.json`.
- Triggers: CI and local `npm test`.
- Responsibilities: Aggregate CJS tests under `tests/` and SDK Vitest projects.

## Error Handling

**Strategy:** Structured results for agent sessions (`PlanResult.success`, `error` payloads); domain errors as `GSDToolsError` / `PhaseRunnerError` extending `Error` with command context (`sdk/src/gsd-tools.ts`, `sdk/src/phase-runner.ts`).

**Patterns:**
- SDK catches Agent SDK failures and maps to `PlanResult` (`sdk/src/session-runner.ts`).
- Subprocess failures in `GSDTools` attach `exitCode` and `stderr` to `GSDToolsError`.

## Cross-Cutting Concerns

**Logging:** Optional `GSDLogger` (`sdk/src/logger.ts`) for runners; many modules prefer the event stream.

**Validation:** Plan frontmatter and task structure via `sdk/src/plan-parser.ts`; project health via query handlers wrapping `sdk/src/query/validate.ts` and CJS validators in `get-shit-done/bin/lib/verify.cjs`.

**Authentication:** No first-party auth in-repo; optional API keys for web search and external tools are environment-driven (see `gsd-tools.cjs` header comments for `websearch`).

---

*Architecture analysis: 2026-04-17*
