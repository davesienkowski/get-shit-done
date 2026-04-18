# SDK External Integrations

**Analysis Date:** 2026-04-07
**Scope:** `sdk/` directory — the `@gsd-build/sdk` package

## Core: Claude Agent SDK

**Package:** `@anthropic-ai/claude-agent-sdk` v0.2.84
**Import:** `import { query } from '@anthropic-ai/claude-agent-sdk'`

### What the Agent SDK Provides

The SDK wraps all Anthropic API interaction. The GSD SDK does not call the Anthropic API directly.

**Primary export used:**
```typescript
query({
  prompt: string,
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code', append: string },
    settingSources: ['project'],
    allowedTools: string[],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    maxTurns: number,
    maxBudgetUsd: number,
    cwd: string,
    model?: string,
  }
}): AsyncIterable<SDKMessage>
```

**Key aspects of `query()` usage:**
- Always uses `preset: 'claude_code'` system prompt with `append` for GSD-specific instructions
- `settingSources: ['project']` — reads tool permissions from the project's `.claude/settings.json`
- `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` — full autonomous execution
- Returns an `AsyncIterable<SDKMessage>` consumed in `sdk/src/session-runner.ts`

### SDK Message Types Consumed

All imported from `@anthropic-ai/claude-agent-sdk` and mapped in `sdk/src/event-stream.ts`:

| SDK Message Type | Maps to GSD Event |
|-----------------|-------------------|
| `SDKSystemMessage` (subtype: `init`) | `GSDSessionInitEvent` |
| `SDKAPIRetryMessage` (subtype: `api_retry`) | `GSDAPIRetryEvent` |
| `SDKStatusMessage` (subtype: `status`) | `GSDStatusChangeEvent` |
| `SDKCompactBoundaryMessage` (subtype: `compact_boundary`) | `GSDCompactBoundaryEvent` |
| `SDKTaskStartedMessage` (subtype: `task_started`) | `GSDTaskStartedEvent` |
| `SDKTaskProgressMessage` (subtype: `task_progress`) | `GSDTaskProgressEvent` |
| `SDKTaskNotificationMessage` (subtype: `task_notification`) | `GSDTaskNotificationEvent` |
| `SDKAssistantMessage` | `GSDAssistantTextEvent` + `GSDToolCallEvent` |
| `SDKResultSuccess` | `GSDSessionCompleteEvent` |
| `SDKResultError` | `GSDSessionErrorEvent` |
| `SDKToolProgressMessage` | `GSDToolProgressEvent` |
| `SDKToolUseSummaryMessage` | `GSDToolUseSummaryEvent` |
| `SDKRateLimitEvent` | `GSDRateLimitEvent` |
| `SDKPartialAssistantMessage` | `GSDStreamEvent` |

**Non-actionable SDK messages silently ignored:**
`user`, `auth_status`, `prompt_suggestion`, `hook_started`, `hook_progress`, `hook_response`, `local_command_output`, `session_state_changed`, `files_persisted`, `elicitation_complete`

### What the GSD SDK Adds on Top

The Agent SDK provides the raw `query()` execution loop. The GSD SDK adds:

1. **Plan parsing** (`sdk/src/plan-parser.ts`) — YAML frontmatter + XML task extraction from PLAN.md files
2. **Prompt assembly** (`sdk/src/prompt-builder.ts`, `sdk/src/phase-prompt.ts`) — converts parsed plans + context files into structured prompts
3. **Context engineering** (`sdk/src/context-engine.ts`, `sdk/src/context-truncation.ts`) — loads only phase-relevant `.planning/` files, truncates at 8192 chars
4. **Phase lifecycle state machine** (`sdk/src/phase-runner.ts`) — discuss → research → plan → plan_check → execute → verify → advance
5. **Milestone orchestration** (`sdk/src/index.ts` `GSD.run()`) — discovers phases from roadmap, runs each in sequence, re-discovers after completion
6. **Event mapping** (`sdk/src/event-stream.ts`) — translates SDK messages into domain-meaningful GSD events with cost tracking
7. **State management bridge** (`sdk/src/gsd-tools.ts`) — shells out to `gsd-tools.cjs` for all `.planning/` state reads/writes
8. **Init workflow** (`sdk/src/init-runner.ts`) — 7-step new project bootstrap with 4 parallel research sessions

---

## GSD Tools Bridge

**File:** `sdk/src/gsd-tools.ts`
**Mechanism:** `execFile(process.execPath, [gsdToolsPath, command, ...args], ...)` via Node.js `child_process`

The GSD SDK shells out to `gsd-tools.cjs` rather than reimplementing its 12K+ lines of state management logic.

### Path Resolution

`resolveGsdToolsPath(projectDir)` probes these paths in order:
1. `{projectDir}/.claude/get-shit-done/bin/gsd-tools.cjs` — project-local install
2. `../../get-shit-done/bin/gsd-tools.cjs` relative to `sdk/dist/` — repo-bundled (dev)
3. `~/.claude/get-shit-done/bin/gsd-tools.cjs` — global user install

### Commands Invoked

| Method | Command | Args | Returns |
|--------|---------|------|---------|
| `stateLoad()` | `state load` | — | Raw string (STATE.md content) |
| `roadmapAnalyze()` | `roadmap analyze` | — | `RoadmapAnalysis` JSON |
| `phaseComplete(phase)` | `phase complete` | `[phase]` | Raw string |
| `commit(msg, files?)` | `commit` | `[msg, --files, ...]` | Raw string |
| `verifySummary(path)` | `verify-summary` | `[path]` | Raw string |
| `initPhaseOp(phase)` | `init phase-op` | `[phase]` | `PhaseOpInfo` JSON |
| `configGet(key)` | `config get` | `[key]` | JSON value |
| `configSet(key, val)` | `config-set` | `[key, val]` | Raw string |
| `stateBeginPhase(phase)` | `state begin-phase` | `[--phase, phase]` | Raw string |
| `phasePlanIndex(phase)` | `phase-plan-index` | `[phase]` | `PhasePlanIndex` JSON |
| `initNewProject()` | `init new-project` | — | `InitNewProjectInfo` JSON |

**Large output handling:** gsd-tools may write output to a temp file and return `@file:/path/to/file`. `GSDTools.parseOutput()` handles this by reading the referenced file before JSON parsing.

**Timeout:** 30 seconds (`DEFAULT_TIMEOUT_MS`). Timeout errors distinguished from other errors via `error.killed` or `ETIMEDOUT` code.

---

## File System Access

**Direct file reads (no gsd-tools):**
- `.planning/config.json` — via `sdk/src/config.ts` `loadConfig()`
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/CONTEXT.md`, etc. — via `sdk/src/context-engine.ts`
- Phase plan files (PLAN.md) — via `sdk/src/plan-parser.ts` `parsePlanFile()`
- Agent definition files (`gsd-executor.md`, etc.) — via `sdk/src/index.ts` `loadAgentDefinition()`
- Workflow + template files — via `sdk/src/phase-prompt.ts` `PromptFactory.loadWorkflowFile()`

**Agent definition lookup paths (in order):**
1. `{projectDir}/.claude/get-shit-done/agents/gsd-executor.md`
2. `{projectDir}/.claude/agents/gsd-executor.md`
3. `~/.claude/agents/gsd-executor.md`
4. `{projectDir}/agents/gsd-executor.md`

**Workflow/agent file lookup (PromptFactory):**
1. `sdk/prompts/workflows/{file}` or `sdk/prompts/agents/{file}` — SDK packaged headless versions
2. `~/.claude/get-shit-done/workflows/{file}` or `~/.claude/agents/{file}` — GSD-1 originals

---

## Event System Architecture

**File:** `sdk/src/event-stream.ts`
**Class:** `GSDEventStream extends EventEmitter`

### Design

```
query() AsyncIterable<SDKMessage>
         ↓
  session-runner.ts: for await (message of queryStream)
         ↓
  eventStream.mapAndEmit(message, context)
         ↓
  GSDEventStream.mapSDKMessage() → GSDEvent | null
         ↓
  GSDEventStream.emitEvent(event)
    ├── EventEmitter.emit('event', event)    ← listener-based consumers
    ├── EventEmitter.emit(event.type, event) ← per-type listeners
    └── for (transport of this.transports)   ← transport-based consumers
           transport.onEvent(event)
```

### Event Types

Defined as `GSDEventType` enum in `sdk/src/types.ts` — 29 event types total:

**Session-level:** `session_init`, `session_complete`, `session_error`
**Content:** `assistant_text`, `tool_call`, `tool_progress`, `tool_use_summary`
**Subagent:** `task_started`, `task_progress`, `task_notification`
**System:** `cost_update`, `api_retry`, `rate_limit`, `status_change`, `compact_boundary`, `stream_event`
**Phase lifecycle:** `phase_start`, `phase_step_start`, `phase_step_complete`, `phase_complete`
**Wave execution:** `wave_start`, `wave_complete`
**Milestone:** `milestone_start`, `milestone_complete`
**Init workflow:** `init_start`, `init_step_start`, `init_step_complete`, `init_complete`, `init_research_spawn`

### Cost Tracking

`GSDEventStream` maintains a `CostTracker` with per-session `Map<sessionId, CostBucket>` for thread-safe tracking during parallel wave execution. Cumulative cost is updated via delta on each session completion.

### Transport Interface

```typescript
interface TransportHandler {
  onEvent(event: GSDEvent): void;  // Must not throw
  close(): void;                   // Clean up resources
}
```

**Built-in transports:**
- `CLITransport` (`sdk/src/cli-transport.ts`) — ANSI-colored stdout, no external deps
- `WSTransport` (`sdk/src/ws-transport.ts`) — WebSocket server using `ws` package

---

## WebSocket Transport

**File:** `sdk/src/ws-transport.ts`
**Package:** `ws` v8.20.0
**Pattern:**

```typescript
const ws = new WSTransport({ port: 8080 });
await ws.start();           // Starts WebSocketServer, returns when listening
gsd.addTransport(ws);       // Registers with GSDEventStream

// Each GSD event → JSON.stringify(event) → sent to all connected clients
// On close(): terminates all clients, closes server
```

Events are broadcast as JSON to all connected WebSocket clients. Sending errors per-client are silently ignored to prevent one bad client from disrupting execution.

---

## Optional External Search APIs

The SDK itself has no direct integration with search APIs. These are passed as tool names in `allowedTools` and resolved by the Agent SDK runtime:

| Service | Config key | Tool name |
|---------|-----------|-----------|
| Brave Search | `config.brave_search` | `WebSearch` |
| Firecrawl | `config.firecrawl` | `WebFetch` |
| Exa Search | `config.exa_search` | (not mapped in tool-scoping) |

**Research phase tool set** (from `sdk/src/tool-scoping.ts`):
```typescript
[PhaseType.Research]: ['Read', 'Grep', 'Glob', 'Bash', 'WebSearch'],
[PhaseType.Plan]:     ['Read', 'Write', 'Bash', 'Glob', 'Grep', 'WebFetch'],
```

Whether these tools actually work at runtime depends on the Agent SDK and whether API keys are configured in the environment — the GSD SDK does not manage these keys.

---

## Git Integration

**Indirect via gsd-tools:** All git operations (commit, branch creation, phase completion) go through `GSDTools.commit()` which calls `gsd-tools.cjs commit`.

**Direct git usage (init workflow only):**
```typescript
// sdk/src/init-runner.ts
private execGit(args: string[]): Promise<string> {
  execFile('git', args, { cwd: this.projectDir }, ...)
}
// Called only to `git init` when no .git directory exists
```

Git must be installed and available in `PATH` for init workflow and commit operations.

---

## Authentication

No authentication is handled by the GSD SDK. The Agent SDK manages Anthropic API authentication via:
- `ANTHROPIC_API_KEY` environment variable
- Claude Code OAuth login
- AWS Bedrock / Google Vertex credentials (via Agent SDK's `apiProvider` detection)

The GSD SDK assumes authentication is already configured in the execution environment.

---

## Missing Integrations (Not Yet Implemented)

These are referenced in config schema but not yet wired into the SDK:

1. **Parallelization** — `config.parallelization: true` is read but `GSD.run()` executes phases sequentially. The `PhasePlanIndex.waves` structure for parallel plan execution within a phase is defined in types but `PhaseRunner` does not yet implement concurrent wave execution.

2. **Node repair** — `config.workflow.node_repair` and `node_repair_budget` are in config defaults but no repair loop is present in `phase-runner.ts`.

3. **Nyquist validation** — `config.workflow.nyquist_validation` is in config but no validation step is wired.

4. **Exa Search** — Config key `exa_search` exists but no tool name is mapped in `tool-scoping.ts`.

5. **SDK prompts are stubs** — `sdk/prompts/` directory exists and is consulted first, but the actual headless-adapted agent/workflow files may be incomplete. When files are missing, falls back to `~/.claude/get-shit-done/` originals which contain interactive directives that `prompt-sanitizer.ts` must strip.

---

*Integration audit: 2026-04-07*
