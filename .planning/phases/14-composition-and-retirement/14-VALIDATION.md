---
phase: 14
slug: composition-and-retirement
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-08
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 (root), 3.1.1 (SDK) |
| **Config file** | `sdk/vitest.config.ts` (unit + integration projects) |
| **Quick run command** | `cd sdk && npx vitest run --project unit` |
| **Full suite command** | `cd sdk && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd sdk && npx vitest run --project unit`
- **After every plan wave:** Run `cd sdk && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | COMP-01 | — | N/A | unit (TDD) | `cd sdk && npx vitest run src/query/init.test.ts` | ✅ TDD | ⬜ pending |
| 14-01-02 | 01 | 1 | COMP-02 | — | N/A | unit | `cd sdk && npx vitest run src/query/registry.test.ts` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 1 | MIGR-03 | — | N/A | integration | `cd sdk && npx vitest run --project integration` | ✅ | ⬜ pending |
| 14-02-02 | 02 | 1 | MIGR-05 | — | N/A | unit | `cd sdk && npx vitest run` | ✅ | ⬜ pending |
| 14-03-01 | 03 | 2 | MIGR-04 | — | N/A | integration | `cd sdk && npx vitest run --project integration` | ✅ | ⬜ pending |
| 14-03-02 | 03 | 2 | MIGR-06 | — | N/A | integration | `cd sdk && npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `sdk/src/query/init.test.ts` — created via TDD-within-task in Plan 01 Task 1 (no separate Wave 0 needed)
- [x] Golden file fixtures for init commands — captured in Plan 01 Task 2 using Phase 9 golden harness

*Existing infrastructure (vitest, golden file harness from Phase 9) covers all requirements. Tests are created alongside implementation via TDD pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end GSD command execution | MIGR-03 | Requires full Claude Code runtime | Run `/gsd-plan-phase 9` and verify it works with SDK-only |
| Cross-platform CI | MIGR-06 | Requires CI runners | Push to PR branch, verify GitHub Actions pass |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
