---
title: Automatic Claude Code transcript reference at GSD command start
trigger_condition: When implementing the observability / logging milestone after v3.0 SDK
planted_date: 2026-04-08
planted_during: /gsd-explore — logging and session traces
---

## Idea

When a GSD command runs (e.g. via `gsd-sdk query` or workflow entrypoints), **resolve and record** the current **Claude Code session transcript** identifier or filesystem path **automatically** — via a **Claude Code hook** (session/command lifecycle) and/or environment/workspace metadata — and store it **next to** the GSD `sessionId` in `.planning/` or in the **header** of the consolidated session trace.

## Why This Matters

Manual copy-paste of transcript paths breaks the debugging story. Automatic linkage lets post-mortems **join** “what GSD did” (orchestration, queries, errors) with “what the conversation was” (CC transcript) without merging megabytes of chat into GSD logs.

## Adoption Notes

- **Degrade gracefully:** If discovery fails (CC update, path change), continue without blocking; emit a single debug-level hint.
- **Complementary roles:** GSD trace = ordered operational story; CC transcript = full conversational record. Cross-reference by timestamp or id when investigating failures.
- **Alignment:** May overlap with `hooks/dist/` patterns and SDK “session start” hooks — keep one convention for “current transcript ref” once spiked.
