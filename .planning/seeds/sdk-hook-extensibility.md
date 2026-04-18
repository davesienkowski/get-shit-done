---
title: Hook-based extensibility for SDK
trigger_condition: After core SDK migration is stable — not during initial build
planted_date: 2026-04-07
planted_during: SDK architecture exploration — GSD-2 research
---

## Idea

Add `beforeToolCall` / `afterToolCall` hook points in the SDK execution pipeline, allowing consumers to inject validation, logging, security policies, and state capture without modifying core orchestration code.

## Why This Matters

GSD-2's `pi-agent-core` uses pre/post-execution hooks to decouple cross-cutting concerns. This is cleaner than scattering validation and logging throughout the codebase. It also enables pending message support for mid-turn interruptions (useful for user steering).

## Adoption Notes

- Low priority until core migration is done — premature abstraction risk
- Start with just `beforeQuery` / `afterQuery` hooks on `gsd-sdk query` commands
- Could replace some of the ad-hoc validation currently in workflow markdown
- GSD already has a hook system for Claude Code (hooks/dist/) — consider aligning patterns
