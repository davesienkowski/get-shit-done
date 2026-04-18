# SDK Concerns — Technical Debt, Gaps & Migration Blockers

**Analysis Date:** 2026-04-07
**Scope:** `sdk/` directory — the `@gsd-build/sdk` package

---

## What the SDK CAN Do Today

The SDK is substantially implemented. These features are working:

**Project Init (`InitRunner`):**
- Bootstrap new project from PRD/description text, file (`@path`), or stdin
- Parallel 4-session research (STACK, FEATURES, ARCHITECTURE, PITFALLS)
- Synthesize research into SUMMARY.md
- Generate REQUIREMENTS.md and ROADMAP.md / STATE.md
- Auto git init, config.json creation, and optional commit-after-each-step
- Headless prompts in `sdk/prompts/` override GSD-1 originals when present

**Phase Lifecycle (`PhaseRunner`):**
- Full 7-step state machine: discuss → research → plan → plan-check → execute → verify → advance
- Config-driven step skipping (`skip_discuss`, `research`, `plan_check`, `verifier`)
- Auto-mode self-discuss (AI fills CONTEXT.md without a human)
- Wave-based parallel plan execution via `Promise.allSettled()`
- Sequential fallback when `config.parallelization === false`
- Gap closure cycle: verify detects gaps → plan → execute → re-verify (capped at `maxGapRetries`)
- Research gate: blocks planning if RESEARCH.md has unresolved `## Open Questions`
- Human gate callbacks (`onDiscussApproval`, `onVerificationReview`, `onBlockerDecision`)
- `retryOnce` on most steps (single retry on unexpected failure)

**Milestone Runner (`GSD.run()`):**
- Discover incomplete phases from roadmap, execute each, re-discover after each completion
- Catches dynamically inserted phases (e.g., phase 1.5 inserted after phase 1)
- Numeric phase sorting (1.5 < 2 < 10, not lexicographic)
- `onPhaseComplete` callback with stop signal

**Plan Execution (`GSD.executePlan()`):**
- Parse PLAN.md (YAML frontmatter + XML tasks), build executor prompt, run query()
- Loads `gsd-executor.md` agent definition from 4 fallback paths
- Per-execution overrides for model, budget, turns, tools, cwd

**State Management (`GSDTools`):**
- Shell bridge to `gsd-tools.cjs` for all `.planning/` state reads/writes
- Typed convenience methods: `initPhaseOp`, `phasePlanIndex`, `roadmapAnalyze`, `phaseComplete`, `commit`, `configGet`, `configSet`
- Handles `@file:` prefix pattern for large gsd-tools responses
- 30-second timeout with proper error classification (timeout vs. exit code vs. exec error)

**Context Engine (`ContextEngine`):**
- Phase-aware file manifest (different file sets per phase type)
- ROADMAP.md narrowed to current milestone via `extractCurrentMilestone()`
- Markdown truncation for oversized files (`truncateMarkdown()`)
- Context reduction to keep prompts cache-friendly

**Event System:**
- Full discriminated-union event type system (25+ event types)
- `GSDEventStream` maps raw SDK messages to typed GSD events
- `CLITransport` (stdout) and `WSTransport` (WebSocket on configurable port)
- Per-session cost bucketing, cumulative cost tracking

**CLI (`gsd-sdk`):**
- Three commands: `run <prompt>`, `auto`, `init [input]`
- `auto --init <source>` for fully headless bootstrap + execution
- `--ws-port` for WebSocket event streaming
- `--model`, `--max-budget`, `--project-dir` overrides

**Prompt sanitizer (`prompt-sanitizer.ts`):**
- Strips `@file:`, `/gsd-command`, `AskUserQuestion()`, `SlashCommand()`, `STOP` directives from GSD-1 workflow text before feeding to headless sessions

---

## What the SDK CANNOT Do Yet

### Critical Missing Features

**1. Plan-check output is not actually parsed**
- `sdk/src/phase-runner.ts` line 393: comment reads "real output parsing would check for VERIFICATION PASSED / ISSUES FOUND"
- Current implementation: plan-check `success` is determined solely by whether the SDK session itself succeeded (`planResult.success`), not by parsing the agent's textual output for pass/fail signals
- The GSD-1 workflow (`plan-phase.md`) parses explicit `VERIFICATION PASSED` / `ISSUES FOUND` signals from the checker agent
- Impact: plan-check step will always pass as long as the session doesn't crash; malformed plans will not be caught

**2. Verification outcome parsing is not implemented**
- `sdk/src/phase-runner.ts` line 1091–1094: `parseVerificationOutcome()` only maps `result.success` → `'passed'`/`'gaps_found'` and the special `error.subtype === 'human_review_needed'` case
- No parsing of the verifier agent's textual output for `VERIFICATION PASSED`, `GAPS FOUND:`, or `HUMAN REVIEW NEEDED:` signals
- The GSD-1 `verify-phase.md` workflow relies on the verifier writing structured output to `VERIFICATION.md` and returning explicit signals; the SDK does not read that file
- Impact: verification will always report `gaps_found` on any session failure, even if gaps were actually found vs. a transient error; `human_needed` path is unreachable in practice unless the SDK error subtype happens to match

**3. Execute step does not pass the PLAN.md content to the executor**
- `sdk/src/phase-runner.ts` `executeSinglePlan()` builds a generic context prompt from `ContextEngine.resolveContextFiles(PhaseType.Execute)` which loads `STATE.md` + `config.json` only
- The `ParsedPlan` is not loaded or passed for individual wave plans; the executor receives no structured task list
- GSD-1's `execute-plan.md` workflow explicitly passes the full PLAN.md with task breakdown, verification steps, acceptance criteria, and must-haves to the executor
- Impact: execute sessions run with context-only prompts, missing the specific task instructions the executor needs to know what to build

**4. No worktree isolation**
- GSD-1's `execute-phase.md` workflow uses `isolation="worktree"` for parallel executor agents, giving each plan its own git worktree to avoid conflicts
- SDK executes all plans in the same `cwd` concurrently via `Promise.allSettled()`
- Impact: parallel plan execution in the same directory risks git conflicts, file corruption, and non-deterministic merge ordering

**5. No Nyquist validation**
- `config.workflow.nyquist_validation` is loaded and present in `GSDConfig`, but there is no code that actually invokes a Nyquist audit step
- GSD-1 spawns a `gsd-nyquist-auditor` agent as part of the verify pipeline
- The `PHASE_AGENT_MAP` in `tool-scoping.ts` only maps 4 agents (executor, researcher, planner, verifier); Nyquist auditor is absent

**6. No UI phase support**
- `config.workflow.ui_phase` and `config.workflow.ui_safety_gate` are loaded but have no corresponding logic in `PhaseRunner`
- GSD-1 supports `gsd-ui-researcher`, `gsd-ui-checker`, and `gsd-ui-auditor` agents with specialized UI-phase workflows
- Impact: UI phases will run through the standard lifecycle and receive no UI-specific prompting or safety checks

**7. No node-repair step**
- `config.workflow.node_repair` and `node_repair_budget` are loaded but not used
- GSD-1 can invoke `gsd-debugger` for automated node module repair between phases

**8. No `discuss-mode` variants**
- `config.workflow.discuss_mode` is stored (default: `'discuss'`) but only a single discuss path exists
- GSD-1 supports `discuss_mode: 'power'` (spawns `gsd-discuss-power` for complex phases) and `discuss_mode: 'assumptions'`
- The workflows `discuss-phase-power.md` and `discuss-phase-assumptions.md` have no SDK equivalents

**9. No response language support**
- GSD-1 reads `response_language` from init JSON and injects it into all subagent prompts so non-English projects get output in the right language
- SDK has no equivalent; all sessions run in English

**10. No context-window adaptive enrichment**
- GSD-1 workflows check `CONTEXT_WINDOW >= 500000` and include richer context (prior wave summaries, cross-phase CONTEXT.md files) for 1M-token models
- SDK's `ContextEngine` uses a fixed truncation threshold (`DEFAULT_TRUNCATION_OPTIONS.maxContentLength`) with no model-aware expansion

**11. No agent-skills injection**
- GSD-1 fetches per-agent skill overrides via `gsd-tools.cjs agent-skills <agent-name>` and appends them to subagent prompts
- SDK loads agent definitions from disk but has no equivalent of `agent-skills` injection
- `GSDTools` has no `agentSkills()` method

**12. No standalone workflow commands**
- GSD has ~60 commands covering: `add-phase`, `remove-phase`, `insert-phase`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `complete-milestone`, `audit-milestone`, `pause-work`, `resume-work`, `workstreams`, `pr-branch`, `stats`, `progress`, `session-report`, `code-review`, `scan`, `health`, `forensics`, `intel`, `debug`, `quick`, `fast`, `do`, `ship`, `undo`, etc.
- SDK provides no equivalents for any of these; it covers only the core build loop (init → execute phases → advance)
- None of these are migration blockers for the core loop, but they are missing for full GSD workflow parity

---

## Gaps Between GSD-1 Workflows and SDK

### Plan Execution Gap

GSD-1 `execute-phase.md` workflow step: each plan is executed by a `gsd-executor` subagent that receives the full PLAN.md content as its task list. The `execute-plan.md` workflow file is loaded, and the plan's objective, tasks, must-haves, and context refs are all present in the agent's context.

SDK `runExecuteStep()` → `executeSinglePlan()`: calls `this.promptFactory.buildPrompt(PhaseType.Execute, null, contextFiles)` with `plan=null`. The execute prompt is built without a specific plan — it is a generic context-only prompt. This is the most critical gap for correct execution.

Files: `sdk/src/phase-runner.ts` lines 749–780, `sdk/src/phase-prompt.ts` lines 94–103

**Fix needed:** `executeSinglePlan` must resolve the PLAN.md file path from the `PlanInfo.id`, parse it with `parsePlanFile()`, and pass the `ParsedPlan` to `buildPrompt()`.

### Plan-Check Gap

GSD-1 `plan-phase.md` workflow spawns `gsd-plan-checker` and parses explicit `VERIFICATION PASSED` / `ISSUES FOUND` text from its output, using a revision loop (max 3 iterations).

SDK `runPlanCheckStep()` appends generic instructions asking the checker to output those signals, but never actually reads the session result text to check for them. Success is determined only by whether `query()` returned without error.

Files: `sdk/src/phase-runner.ts` lines 336–414

**Fix needed:** Parse the result text from the session (the `result` field on `SDKResultSuccess`) for `VERIFICATION PASSED` vs. `ISSUES FOUND` signals.

### Verification Gap

GSD-1 `verify-phase.md` workflow instructs the verifier to write `VERIFICATION.md` and produce structured output. The orchestrator reads that file and decides pass/fail/gaps.

SDK `parseVerificationOutcome()` maps `result.success` → `'passed'` with no text parsing. The `'human_needed'` branch requires `error.subtype === 'human_review_needed'` which the Agent SDK never emits naturally.

Files: `sdk/src/phase-runner.ts` lines 1086–1095

### GSDTools Coverage Gap

`GSDTools` exposes only a subset of `gsd-tools.cjs` commands:

| gsd-tools.cjs command | SDK method | Status |
|---|---|---|
| `init phase-op` | `initPhaseOp()` | Implemented |
| `init execute-phase` | `initExecutePhase()` | Implemented (unused in PhaseRunner) |
| `init plan-phase` | none | Missing |
| `init new-project` | `initNewProject()` | Implemented |
| `phase-plan-index` | `phasePlanIndex()` | Implemented |
| `roadmap analyze` | `roadmapAnalyze()` | Implemented |
| `phase complete` | `phaseComplete()` | Implemented |
| `commit` | `commit()` | Implemented |
| `config get` | `configGet()` | Implemented |
| `config-set` | `configSet()` | Implemented |
| `state load` | `stateLoad()` | Implemented |
| `state begin-phase` | `stateBeginPhase()` | Implemented |
| `verify-summary` | `verifySummary()` | Implemented |
| `agent-skills` | none | Missing |
| `roadmap get-phase` | none | Missing |
| `frontmatter get` | none | Missing |
| `add-todo` | none | Missing |
| `todo list` | none | Missing |

---

## Technical Debt

**Duplicate prompt in `runPhaseStepSession()`**

In `sdk/src/session-runner.ts` lines 279–296, both `prompt` (the positional arg to `query()`) and `systemPrompt.append` are set to the same `prompt` string:

```typescript
const queryStream = query({
  prompt: prompt,          // ← prompt appears twice
  options: {
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: prompt,      // ← same string again
    },
```

This differs from `runPlanSession()` which correctly uses `plan.objective` as the user prompt and the assembled executor prompt as the system prompt append. The duplication means every phase step session sends its instructions as both the user turn and the system prompt append, which wastes tokens and may cause unexpected behavior.

File: `sdk/src/session-runner.ts` lines 279–296

**`initExecutePhase` is implemented but unused**

`GSDTools.initExecutePhase()` calls `state begin-phase`, but `PhaseRunner` never calls it. The equivalent GSD-1 workflow calls `init execute-phase` at the start of the execute step to register execution state. Without it, `STATE.md` may not be updated to reflect that execution is in progress.

File: `sdk/src/gsd-tools.ts` line 233, `sdk/src/phase-runner.ts` entire `runExecuteStep()`

**sessionId is empty string on PhaseStart/PhaseStepStart events**

Multiple `emitEvent()` calls in `PhaseRunner` use `sessionId: ''` because there is no session running yet at those points. This is unavoidable for pre-session events, but consumers of the event stream will see empty session IDs on phase-level events while seeing real UUIDs on session-level events. No documentation warns about this inconsistency.

File: `sdk/src/phase-runner.ts` (multiple `emitEvent` calls)

**`stateBeginPhase()` and `initExecutePhase()` are duplicates**

Both call `gsd-tools.cjs state begin-phase --phase <N>`. `initExecutePhase` was probably added before `stateBeginPhase` was renamed. One should be removed.

File: `sdk/src/gsd-tools.ts` lines 233–235, 257–259

---

## Security Concerns

**`allowDangerouslySkipPermissions: true` is hardcoded**

Both `runPlanSession()` and `runPhaseStepSession()` set `allowDangerouslySkipPermissions: true` and `permissionMode: 'bypassPermissions'`. This is intentional for headless operation but means the agent can read, write, execute, or delete any file on the system without confirmation.

Files: `sdk/src/session-runner.ts` lines 88–89 and 288–290

There is no way for SDK consumers to opt into a more restrictive permission mode without forking the session-runner. The `SessionOptions.allowedTools` parameter restricts which tools are available, but it does not restrict what the agent can do with those tools.

**Prompt injection via `sanitizePrompt()` is incomplete**

`sdk/src/prompt-sanitizer.ts` strips known GSD-1 interactive patterns from prompts before headless use. However:
- It uses global regexes with `.replace()` called without resetting `lastIndex` first (though this is safe because `replace()` on strings auto-resets global regex state on each call, unlike `.test()` + `.replace()` pairs — currently not a bug)
- It does not sanitize arbitrary user input (e.g., in `InitRunner.buildProjectPrompt()`, the raw `input` string from the user is injected inside `<user_input>` tags with no escaping). A malicious PRD could contain content that overrides agent instructions.

File: `sdk/src/prompt-sanitizer.ts`, `sdk/src/init-runner.ts` lines 387–401

**GSD tools path resolution trusts filesystem**

`resolveGsdToolsPath()` probes three filesystem locations and uses the first that exists. If an attacker controls `<projectDir>/.claude/get-shit-done/bin/gsd-tools.cjs`, it will be executed as Node.js code with full filesystem access and the SDK's process credentials.

File: `sdk/src/gsd-tools.ts` lines 295–302

---

## Performance Considerations

**Config is loaded on every session call**

`GSD.runPhase()` calls `loadConfig()` each invocation, which reads and parses `.planning/config.json`. In a milestone run with 20 phases, this is 20 disk reads. The file rarely changes mid-run.

File: `sdk/src/index.ts` line 137

**GSD tools path is resolved at construction time but never cached**

`resolveGsdToolsPath()` calls `existsSync()` on up to 3 paths every time `GSD` is constructed. Since `GSDTools` constructor calls this, it is called for every `GSDTools` instance, including one per phase in a milestone run.

File: `sdk/src/gsd-tools.ts` lines 295–302

**Parallel wave execution has no concurrency cap**

`Promise.allSettled(wavePlans.map(...))` launches all plans in a wave simultaneously with no upper bound. A wave with 10 plans starts 10 concurrent Agent SDK sessions, each running a `query()` stream. This can exhaust Anthropic rate limits or system resources.

File: `sdk/src/phase-runner.ts` lines 682–683

**Context engine re-reads files on every step**

`ContextEngine.resolveContextFiles()` reads all phase files from disk on each call. A single phase run (discuss → research → plan → execute → verify) reads STATE.md and ROADMAP.md at least 5 times. No in-memory caching exists.

File: `sdk/src/context-engine.ts` lines 94–147

---

## Fragile Areas

**`parseVerificationOutcome()` maps all failures to `gaps_found`**

Any session failure — transient network error, budget exceeded, context overflow — produces `outcome = 'gaps_found'`. This triggers the gap closure cycle (plan → execute → re-verify) for errors that have nothing to do with gaps. A single rate-limit error will cause an unnecessary re-plan+re-execute cycle.

File: `sdk/src/phase-runner.ts` lines 1091–1094

**`sdk/prompts/` files are checked in but their content quality is unknown**

`sdk/prompts/workflows/` and `sdk/prompts/agents/` contain headless versions of the GSD-1 prompts. `PromptFactory` and `InitRunner` try SDK prompts first and fall back to GSD-1 originals from `~/.claude/get-shit-done/`. If the SDK prompts are out of sync with GSD-1's agent definitions (e.g., after an upstream update), results will silently differ between environments.

Files: `sdk/prompts/agents/*.md`, `sdk/prompts/workflows/*.md`

**Fallback path for GSD-1 originals is hardcoded to `~/.claude/`**

`PromptFactory` and `InitRunner` fall back to `join(homedir(), '.claude', 'get-shit-done')` for workflow and agent files. This assumes a standard GSD install location. CI environments or Docker containers without GSD-1 installed will silently receive `(Template not found: ...)` placeholder prompts.

Files: `sdk/src/phase-prompt.ts` lines 78–85, `sdk/src/init-runner.ts` lines 39–40

**`checkResearchGate()` is pure text parsing with brittle regex**

The regex for detecting question items (`/^(?:\d+[.)]\s*|\*\s+|-\s+)\*{0,2}([^*\n]+)\*{0,2}/`) requires specific list formatting. Prose-style questions (no list markers) will trigger a conservative fail, potentially blocking phases that have genuinely resolved their questions.

File: `sdk/src/research-gate.ts` lines 63–72

---

## Dependencies at Risk

**`@anthropic-ai/claude-agent-sdk` v0.2.84 is pinned but not locked**

The `package.json` uses `"^0.2.84"` (caret range). A breaking 0.x bump would be accepted by npm. The `SDKMessage` type union (especially `SDKResultSuccess`, `SDKResultError`) is consumed extensively in `event-stream.ts` and `session-runner.ts`. Any change to those message shapes would silently break event mapping without TypeScript catching it if the SDK exports `unknown`-typed fields.

File: `sdk/package.json`

**`ws` v8 WebSocket dependency is dev-only in reality but listed as production dependency**

`ws` is only used by `WSTransport`, which is optional (only started when `--ws-port` is passed). It is listed as a production `dependency` even though most SDK consumers will never use WebSocket transport. This adds ~70KB to the installed footprint unnecessarily.

File: `sdk/package.json`

---

## Missing Critical Features for Full GSD Workflow Support

**No `/gsd-plan-phase` equivalent**

GSD-1 `plan-phase.md` workflow supports many flags that have no SDK equivalent:
- `--research` / `--skip-research` — force/skip research before planning
- `--gaps` — create gap-closure plans only
- `--reviews` — incorporate code review feedback into plans
- `--prd <file>` — plan against an external PRD file
- Phase auto-detection (plan the next unplanned phase if no number given)

**No `/gsd-discuss-phase` standalone equivalent**

Discuss step in the SDK is only reachable as part of `PhaseRunner.run()`. There is no way to run just a discuss session for a phase and return the CONTEXT.md for human review before committing to execution.

**No milestone management operations**

`complete-milestone`, `audit-milestone`, `plan-milestone-gaps` workflows have no SDK equivalents.

**No interrupt/resume**

GSD-1 supports `pause-work` and `resume-work` to checkpoint and resume an in-progress phase. The SDK has no equivalent state serialization; if `PhaseRunner.run()` throws partway through a phase, there is no way to resume from the failed step.

**No TODOs or backlog integration**

`add-todo`, `check-todos`, `add-backlog`, `review-backlog` commands have no SDK equivalents.

---

## Test Coverage Gaps

**No unit tests for the execute step with a real plan**

`phase-runner.test.ts` mocks all session runners. The critical gap (execute step not passing PLAN.md to executor) has no test that would catch it.

**Integration tests require live Claude CLI**

All `*.integration.test.ts` files check for `which claude` and skip when unavailable. This means CI on most environments runs zero integration coverage.

File: `sdk/src/e2e.integration.test.ts` lines 22–26, `sdk/src/lifecycle-e2e.integration.test.ts` lines 37–41

**No test for `runPhaseStepSession()` double-prompt bug**

The duplicate prompt issue (`prompt` passed as both the query prompt and `systemPrompt.append`) is not covered by any test.

File: `sdk/src/session-runner.ts` lines 279–296

---

*Concerns audit: 2026-04-07*
