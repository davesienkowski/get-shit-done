---
title: Context compaction for long-running phases
trigger_condition: When addressing context window limits in phase execution
planted_date: 2026-04-07
planted_during: SDK architecture exploration — GSD-2 research
---

## Idea

Implement intelligent conversation summarization for long-running SDK sessions. When a phase generates lots of output (large diffs, verbose test results, multi-file changes), compact earlier context to preserve token budget for the work that matters.

## Why This Matters

GSD-2's `pi-coding-agent` includes context compaction to optimize token usage. The current GSD SDK's `ContextEngine` does file truncation (headings + first paragraphs) but doesn't compact *conversation history* during execution. Long phases can hit context limits, especially with the `balanced` (Sonnet) profile.

## Adoption Notes

- Medium priority — current GSD handles this via the AI runtime's built-in compression
- SDK could add explicit compaction points between task groups in a plan
- Consider whether this belongs in the SDK or the runtime — may be redundant with Claude Code's auto-compression
