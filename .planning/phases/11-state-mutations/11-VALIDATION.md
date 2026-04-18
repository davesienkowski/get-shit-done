---
phase: 11
slug: state-mutations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.1 (SDK project config) |
| **Config file** | sdk/vitest.config.ts |
| **Quick run command** | `npx vitest run --project unit --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | MUTATE-01 | — | N/A | unit | `npx vitest run sdk/src/queries/__tests__/state-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | MUTATE-02 | — | N/A | unit | `npx vitest run sdk/src/queries/__tests__/frontmatter-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | MUTATE-03 | — | N/A | unit | `npx vitest run sdk/src/queries/__tests__/config-mutations.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | MUTATE-04 | — | N/A | unit | `npx vitest run sdk/src/queries/__tests__/commit.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | MUTATE-05 | — | N/A | unit | `npx vitest run sdk/src/queries/__tests__/template-fill.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | MUTATE-06 | — | N/A | integration | `npx vitest run sdk/src/queries/__tests__/mutation-events.integration.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for all MUTATE-0x requirements
- [ ] Shared fixtures for temp directory management (existing pattern from Phase 10)

*Existing infrastructure covers test framework — only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Git commit creates correct commit message | MUTATE-04 | Requires git repo state | Run `gsd-sdk query commit "test"` in test repo, verify with `git log --oneline -1` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
