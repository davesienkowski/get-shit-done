---
title: Staged tool execution pattern
trigger_condition: When building SDK tool/query execution pipeline
planted_date: 2026-04-07
planted_during: SDK architecture exploration — GSD-2 research
---

## Idea

Implement a staged execution model for SDK operations: **preparation (validation) → execution → finalization → steering check**. Each stage is a discrete step that can fail independently.

## Why This Matters

GSD-2's `pi-agent-core` separates preparation errors (schema validation, missing inputs) from execution errors (runtime failures). This prevents premature termination — a validation error means "retry with corrected input," while an execution error means "continue with error context."

Currently gsd-tools.cjs throws errors uniformly with no stage distinction. The SDK should know *where* in the pipeline something failed.

## Adoption Notes

- Preparation stage: validate inputs, check preconditions (phase exists, config loaded, dependencies met)
- Execution stage: perform the actual operation
- Finalization stage: update state, emit events, write artifacts
- Steering check: post-operation assessment (should we continue, pause, or redirect?)
