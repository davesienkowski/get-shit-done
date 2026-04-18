---
phase: 12
slug: verification-suite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 12 — Validation Strategy

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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-01 | 01 | 1 | VERIFY-01 | unit | `npx vitest run sdk/src/query/verify.test.ts` | ⬜ pending |
| 12-01-02 | 01 | 1 | VERIFY-02 | unit | `npx vitest run sdk/src/query/verify.test.ts` | ⬜ pending |
| 12-01-03 | 01 | 1 | VERIFY-03 | unit | `npx vitest run sdk/src/query/verify.test.ts` | ⬜ pending |
| 12-02-01 | 02 | 1 | VERIFY-04 | unit | `npx vitest run sdk/src/query/validate.test.ts` | ⬜ pending |
| 12-02-02 | 02 | 1 | VERIFY-05 | unit | `npx vitest run sdk/src/query/validate.test.ts` | ⬜ pending |
| 12-03-01 | 03 | 2 | VERIFY-06 | integration | `npx vitest run sdk/src/golden/golden.integration.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for all VERIFY-0x requirements
- [ ] Shared fixtures for temp .planning/ directory scaffolding

*Existing test infrastructure covers framework — only test files need creation.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] Sampling continuity maintained
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
