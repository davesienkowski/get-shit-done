---
name: gsd:audit-fix
description: Autonomous audit-to-fix pipeline — runs audit, classifies findings, auto-fixes what it can
argument-hint: "[--source audit-uat|validate-phase] [--dry-run] [--max N] [--severity high]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---
<objective>
Run an audit source (default: /gsd-audit-uat), classify each finding as auto-fixable or manual-only, then fix auto-fixable items one at a time with test verification and atomic commits. Stops on first test failure.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/audit-fix.md
</execution_context>

<context>
Arguments: $ARGUMENTS

**Flags:**
- `--source audit-uat` (default) — use /gsd-audit-uat as finding source
- `--source validate-phase` — use /gsd-validate-phase as finding source
- `--dry-run` — classify findings and show table, but do not execute fixes
- `--max N` — limit fix attempts to N (default: unlimited)
- `--severity high` — only process Critical and High severity findings

**Scope:**
Glob: .planning/phases/*/*-UAT.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
Execute @~/.claude/get-shit-done/workflows/audit-fix.md.
Preserve all workflow gates.
</process>
