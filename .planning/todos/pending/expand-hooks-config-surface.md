---
title: Expand HooksConfig to surface all hook toggles
date: 2026-04-09
priority: medium
---

## Task

Expand the `HooksConfig` interface in `sdk/src/config.ts` to include typed toggles for all hook behaviors, not just `context_warnings`.

## Current State

```typescript
export interface HooksConfig {
  context_warnings: boolean;  // only toggle
}
```

## Target State

```typescript
export interface HooksConfig {
  context_warnings: boolean;
  workflow_guard: boolean;     // gsd-workflow-guard.js (default: false)
  read_guard: boolean;         // gsd-read-guard.js (default: true)
  prompt_guard: boolean;       // gsd-prompt-guard.js (default: true)
  community: boolean;          // bash hooks: validate-commit, phase-boundary, session-state (default: false)
}
```

## Why

- Hooks already check these config keys at runtime (e.g., `config.hooks?.workflow_guard`, `config.hooks?.community`) but they're not in the typed interface
- SDK consumers can't programmatically toggle hooks without knowing the undocumented key names
- Config validation won't catch typos in hook toggle names
- `loadConfig()` deep-merge won't provide defaults for untyped keys

## Files to Change

1. `sdk/src/config.ts` — expand `HooksConfig` interface and `CONFIG_DEFAULTS.hooks`
2. `sdk/src/query/config-mutation.ts` — add new keys to `VALID_KEYS` array
3. `sdk/src/config.test.ts` — add tests for new defaults and override behavior
