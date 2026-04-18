# Research Questions

## Q1: SDK vs Agent Boundary Criteria (2026-04-07)

**Question:** What's the right boundary between SDK-owned orchestration and agent-interpreted markdown?

**Context:** The SDK-first architecture decision moves deterministic logic into typed TypeScript. But there's a gray zone — some decisions are "mostly deterministic with edge cases that need judgment" (e.g., frontend detection via keyword grep is deterministic, but deciding whether a phase is "complex enough" for power-discuss mode involves judgment).

**Need criteria for:**
- When should logic be a typed SDK method? (Always deterministic? Deterministic >90% of the time?)
- When should logic stay as natural language the agent interprets? (Requires domain understanding? Requires reading file content for meaning?)
- How to handle the gray zone — hybrid calls where the SDK provides data and the agent makes the judgment?
- Should the SDK ever encode heuristics (e.g., "if phase description contains >3 UI keywords, classify as frontend"), or should all heuristics stay with the AI?

**Prior art:** The decision-routing-audit.md section 6 ("Anti-Patterns: Decisions That SHOULD Stay with the AI") lists 10 categories. The inline-computation-audit.md section 5 lists 5 more. These provide a starting point but need to be formalized into a decision framework.

## Q2: Staged Execution Pipeline Design (2026-04-07)

**Question:** What should the SDK's staged execution pipeline look like — and where do stage boundaries fall for different operation types?

**Context:** GSD-2's `pi-agent-core` uses preparation → execution → finalization → steering check stages. Adopting this for the GSD SDK means defining what "preparation" and "finalization" mean for each operation type (state queries, phase transitions, config mutations, etc.).

**Need answers for:**
- What validation belongs in preparation vs. runtime checks?
- Should finalization always emit events, or only for state-mutating operations?
- How does the steering check work when the SDK is called from markdown (no interactive loop)?
- Can we define a generic `StagedOperation<TInput, TOutput>` interface that all SDK methods implement?

## Q3: Error Classification Taxonomy (2026-04-07)

**Question:** What's the right error classification for the SDK — and how does it map to exit codes and caller behavior?

**Context:** GSD-2 distinguishes validation errors from execution errors. We want to go further with four classes: validation, execution, blocked, interruption. But the boundaries need definition.

**Need answers for:**
- Where does "phase dependency not met" fall — validation (precondition) or blocked (external)?
- How do classified errors interact with the existing `PhaseRunnerError` and `GSDToolsError` hierarchy?
- Should the SDK auto-retry validation errors, or always surface them to the caller?
- How do exit codes (0/1/10/11) map when the SDK is used as a library (no process exit) vs. CLI?

## Q4: Event Stream Control Flow (2026-04-07)

**Question:** Should the SDK's event stream support bidirectional control (listeners can request cancellation), or stay unidirectional (observe only)?

**Context:** GSD-2 uses event-driven state for cancellation and restart. Our SDK has `GSDEventType` and `WSTransport` but events are currently informational only. Adding control flow is powerful but complex.

**Need answers for:**
- What are the real use cases for cancellation mid-phase? (User abort? Budget limit? CI timeout?)
- Can we implement pause/resume without breaking the Agent SDK's `query()` model?
- Is bidirectional control worth the complexity, or should cancellation be a separate mechanism (e.g., abort signal)?
- How does this interact with Claude Code's existing Ctrl+C behavior?

## Q5: Context Engine Balance for Repair vs Execution (2026-04-09)

**Question:** What context should the context engine load during repair scenarios vs normal execution — and how do we balance token budget against repair accuracy?

**Context:** The context engine's `PHASE_FILE_MANIFEST` for `PhaseType.Execute` deliberately loads only `STATE.md` and `config.json` — no ROADMAP, REQUIREMENTS, or CONTEXT. This keeps token usage low during execution. But during repair, this starvation means the executor has zero visibility into cross-phase dependencies, requirement traceability, or broader project context. It's fixing blind.

**Need answers for:**
- Should repair get its own `PhaseType.Repair` manifest, or should Execute's manifest be conditionally expanded when repair is active?
- What's the minimal additional context that meaningfully improves repair accuracy? (Hypothesis: REQUIREMENTS.md for traceability + CONTEXT.md for decisions + SUMMARY.md from prior plans for integration awareness)
- How much token budget does loading this additional context consume? Is it viable under `balanced` (Sonnet) profile or only `quality` (Opus)?
- Should context loading be adaptive — load more context only when the first repair attempt fails (escalating context)?
- Does the existing `ContextEngine` truncation (headings + first paragraphs) apply well to repair-relevant files, or do they need different truncation strategies?

**Prior art:** The `diagnose-issues` workflow loads full VERIFICATION.md and spawns debugger agents with rich context. The gap-closure path (`plan-phase --gaps`) loads VERIFICATION.md gaps YAML. These demonstrate that repair-adjacent workflows already expect more context than execution.

## Q6: Consolidated logging, Agent SDK events, and CC transcripts (2026-04-08)

**Question:** What surfaces should feed a **single consolidated trace** per GSD `sessionId` — and how do we reliably **link** to the **Claude Code session transcript** automatically?

**Context:** Post–v3.0 SDK, we want terminal-first **human-readable** progress plus **structured** logs for debugging. The operational story should be **one chronological trace** anchored on `sessionId`. Separately, **CC transcripts** are a complementary debugging lens; linkage should be **automatic** (hook or discovery) with **graceful fallback**, not a second copy of the full chat inside GSD logs.

**Need answers for:**

- What does `@anthropic-ai/claude-agent-sdk` expose today (per-turn, tool calls, errors) that we can append in order without drowning the trace?
- Where does Claude Code store transcripts on disk (and under what stability guarantees across versions)? Is there an id or path we can resolve at GSD command start?
- What’s the minimal **reference** to store (path, uuid, timestamp window) for cross-reference vs. full export?
- How should **verbosity** be tiered (default vs. debug) for agent/tool detail?
