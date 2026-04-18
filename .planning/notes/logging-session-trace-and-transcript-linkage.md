---
title: Logging, session traces, and Claude Code transcript linkage
date: 2026-04-08
context: /gsd-explore — post–v3.0 SDK; terminal-first observability and debugging
---

## Summary

Exploration converged on a **dual-stream** logging story: **human-readable progress** for the terminal (Claude Code + GSD) alongside **structured logs** for grep, CI, and forensics. Debugging should favor **one consolidated trace per GSD `sessionId`** (everything in order in one place), with **levels**, **correlation IDs**, and clear **query/subcommand** boundaries in the structured stream.

## Decisions and intent

- **User-facing surface:** Mainly **terminal** use via Claude Code running GSD — output must stay scannable in scrollback (phase boundaries, errors, “where we are”).
- **Structured stream:** NDJSON or similar remains machine-readable; TTY stays human-oriented (not raw JSON dumps by default).
- **Session anchor:** Trace identity follows **`sessionId` in `.planning/`** as the canonical GSD lifecycle, not the whole Claude Code chat by default.
- **Claude Code chat / transcripts:** Treat as a **complementary** lens to the GSD trace — conversation and high-level decisions vs. orchestration and tooling. **Do not** duplicate full chat logs inside GSD files; prefer **references**.
- **Transcript linkage:** **Automatic** — GSD and/or a **Claude Code hook** should attempt to discover the **current transcript path or id** when a GSD command runs, and record that next to `sessionId`. **Graceful degradation** if discovery fails (log at debug, do not fail the command).
- **Agent visibility:** Where feasible, surface **tool use and high-signal decisions** from the Agent SDK pipeline into the same story for “what happened” debugging — exact wiring TBD in implementation.

## Open points (for a future milestone)

- Stable API for **append-ordered** events to the consolidated trace from `gsd-sdk query` and sub-steps.
- Hook contract for **transcript discovery** across CC versions.
- How much **agent** detail is default vs. behind a verbose/debug profile.
