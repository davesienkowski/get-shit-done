---
title: Event stream extensions for cancellation and restart
trigger_condition: When extending SDK event system beyond current GSDEventType
planted_date: 2026-04-07
planted_during: SDK architecture exploration — GSD-2 research
---

## Idea

Extend the SDK's existing event stream (`GSDEventType`) to support cancellation, restart, and pause semantics. Currently events are informational (PhaseStart, PhaseComplete, etc.) — they should also enable control flow.

## Why This Matters

GSD-2 uses event-driven state instead of synchronous returns, enabling proper cancellation, streaming, and restart. Our SDK already has `GSDEventType` and `WSTransport` for event broadcasting — extending rather than replacing is natural.

## Adoption Notes

- New event types: `PhaseCancel`, `PhasePause`, `PhaseResume`, `SessionRestart`
- Listeners should be able to request cancellation via the event stream (not just observe)
- Pairs with hook extensibility — hooks could emit events
- Medium priority — useful but not blocking for core migration
