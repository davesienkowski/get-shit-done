# Spec: `verify.key-links` on ESCALATE (node repair)

**Status:** Design note — not yet implemented in workflows.  
**Scope:** `get-shit-done/workflows/node-repair.md` + `get-shit-done/workflows/execute-plan.md` (`verification_failure_gate`).  
**Related:** `execute-phase.md` already runs `gsd-sdk query verify.key-links` between waves; this spec adds a **repair-escalation** signal only.

---

## 1. Problem

When task-level repair exhausts `REPAIR_BUDGET`, the orchestrator **ESCALATE**s to the user with history of RETRY/DECOMPOSE attempts. At that moment, the user still lacks a **deterministic, machine-readable** picture of whether **plan key-links** (must-have wiring) are satisfied for the **current** PLAN file. Running `verify.key-links` only at ESCALATE adds **signal without spamming** RETRY/DECOMPOSE/PRUNE loops.

---

## 2. Current behavior (as coded today)

### 2.1 `node-repair.md`

- Inputs: `FAILED_TASK`, `ERROR`, `PLAN_CONTEXT`, `REPAIR_BUDGET`.
- Strategies: **RETRY**, **DECOMPOSE**, **PRUNE**, **ESCALATE** — no `gsd-sdk query` / `verify.*` calls.
- **execute_escalate** step: surface to user via `verification_failure_gate` with repair history; wait for user direction.

### 2.2 `execute-plan.md` — `verification_failure_gate`

- Reads `workflow.node_repair` (default on).
- Invokes `node-repair.md` with the four inputs.
- If repair returns **ESCALATE** (or `NODE_REPAIR` is false): **STOP**, present failure summary and options (Retry | Skip | Stop).
- **No** `verify.key-links` (or other `verify.*`) in this gate today.

---

## 3. Proposed behavior

### 3.1 When

Run **`verify.key-links` once** when the repair path resolves to **ESCALATE** — i.e. immediately **before** presenting the final “Verification failed…” user gate (same gate block, expanded content).

Do **not** run on **RETRY**, **DECOMPOSE**, or **PRUNE** success paths (keeps latency and noise down; aligns with “only when giving up on autonomous repair”).

### 3.2 Command and inputs

```bash
gsd-sdk query verify.key-links "${PLAN_FILE_PATH}"
```

- **`PLAN_FILE_PATH`**: Absolute or repo-relative path to the active plan file, e.g.  
  `.planning/phases/<phase-dir>/<phase>-<plan>-PLAN.md`  
  The execute-plan orchestrator already knows this path when executing a plan.

### 3.3 Interpreting output

- Use existing JSON/text contract from `verify.key-links` (same as `execute-phase` / `gsd-verifier`): surface **broken or missing links** in the user-facing ESCALATE box.
- If the query fails (non-zero exit, parse error): show a **non-fatal** line: “Key-link check unavailable: …” and still present the ESCALATE summary (do not block the user on tooling failure).

### 3.4 Presentation

Extend the ESCALATE / `verification_failure_gate` message to include:

1. Existing: task name, expected vs actual, repair history.
2. **New:** “Key-link check (at escalation):” + summarized failures or “No key-link issues reported.”

---

## 4. Configuration (optional)

| Key | Default | Meaning |
|-----|---------|---------|
| `workflow.repair_escalate_key_links` | `true` | When `false`, skip the extra query (restore today’s behavior). |

If omitted, treat as `true` when `workflow.node_repair` is `true`.

---

## 5. Non-goals

- Replacing full **verify-phase** or **gsd-verifier** with this check.
- Running `verify.artifacts` or other subcommands in the same hook (can be a follow-up spec).
- Changing **SDK** `PhaseRunner` / `node-repair` CJS — this remains **workflow-orchestrator** behavior (markdown + bash snippets).

---

## 6. Implementation checklist (for a future PR)

1. [ ] `execute-plan.md` — in `verification_failure_gate`, after repair returns ESCALATE (or when about to show final failure with repair history), run `verify.key-links` when config allows; merge output into the user message.
2. [ ] `node-repair.md` — optional one-line note under **execute_escalate** that the parent workflow may run `verify.key-links` before the user gate (keeps single source of truth in execute-plan).
3. [ ] `config` schema / docs — document `workflow.repair_escalate_key_links` if implemented.
4. [ ] Manual test: failing task → ESCALATE → confirm key-link section appears.

---

## 7. Headless / SDK prompts copy

`sdk/prompts/workflows/execute-plan.md` uses a shortened `verification_failure_gate`. If this feature is implemented for Claude Code, decide separately whether the headless template should mention the same hook or stay minimal.
