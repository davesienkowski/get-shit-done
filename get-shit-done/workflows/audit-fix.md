<purpose>
Autonomous audit-to-fix pipeline. Runs an audit source, classifies each finding as auto-fixable or manual-only, then fixes auto-fixable items one at a time. Each fix is followed by `npm test`; passes get an atomic commit. Pipeline stops on first test failure.
</purpose>

<process>

<step name="parse_arguments">
Parse flags from $ARGUMENTS:

- `--source`: `audit-uat` (default) or `validate-phase`
- `--dry-run`: boolean, default false
- `--max N`: integer, default unlimited
- `--severity high`: boolean, default false (when true, only Critical and High)

Validate:
- `--source` must be `audit-uat` or `validate-phase`
- `--max` must be a positive integer if provided
</step>

<step name="run_audit">
Run the selected audit source and capture findings.

**If source is `audit-uat` (default):**

```bash
AUDIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" audit-uat --raw)
```

Parse JSON for `results` array. Each item has: `phase`, `test_name`, `description`, `status`, `severity`.

**If source is `validate-phase`:**

Run validation across completed phases and collect gap items from VERIFICATION.md files:

```bash
for VFILE in .planning/phases/*/*-VERIFICATION.md; do
  cat "$VFILE" 2>/dev/null
done
```

Parse frontmatter `gaps:` arrays from each VERIFICATION.md. Each gap has: `truth`, `status`, `reason`, `artifacts`, `missing`.

If no findings from either source:
```
## All Clear

No audit findings to process. All items are passing or resolved.
```
Stop here.
</step>

<step name="filter_severity">
If `--severity high` is set, filter findings to only those with severity `critical` or `high`.

For audit-uat findings: use the `severity` field directly.
For validate-phase gaps: treat `failed` status as high severity, `partial` as medium.

If filtering removes all findings:
```
## No Matching Findings

No Critical or High severity findings found. {total_before_filter} findings exist at lower severities.
```
Stop here.
</step>

<step name="classify_findings">
For each finding, classify as **auto-fixable** or **manual-only**.

**Auto-fixable criteria** (ALL must be true):
- The issue is in code that exists in the repository (not missing external dependencies)
- The fix is mechanical (add missing import, fix typo, update config value, wire existing component)
- The expected behavior is unambiguous from the finding description
- No user judgment needed (not a design decision, UX choice, or architecture question)

**Manual-only criteria** (ANY makes it manual):
- Requires new feature implementation (not just wiring)
- Requires external service setup or credentials
- Requires user decision (design choice, naming, architecture)
- Requires hardware or environment changes
- Finding is stale (references code that no longer exists)
- Fix could have unintended side effects that need human review
- Uncertainty about the correct fix approach

**IMPORTANT:** When in doubt, classify as manual-only. False auto-fixes are worse than missed auto-fixes.

For each finding, record:
- `id`: Sequential identifier (F-001, F-002, ...)
- `source`: Which audit produced it
- `phase`: Phase number
- `description`: What the finding says
- `severity`: critical | high | medium | low
- `classification`: auto-fixable | manual-only
- `reason`: Why classified this way
- `fix_approach`: Brief description of intended fix (auto-fixable only)
</step>

<step name="present_classification">
Present the classification table:

```
## Audit-Fix Classification

**Source:** {audit-uat | validate-phase}
**Total findings:** {count}
**Auto-fixable:** {count}
**Manual-only:** {count}

### Auto-Fixable ({count})

| ID | Phase | Finding | Severity | Fix Approach |
|----|-------|---------|----------|--------------|
| F-001 | {phase} | {description} | {severity} | {fix_approach} |
...

### Manual-Only ({count})

| ID | Phase | Finding | Severity | Reason |
|----|-------|---------|----------|--------|
| F-010 | {phase} | {description} | {severity} | {reason} |
...
```

If `--dry-run` is set:
```
---
**Dry run complete.** No fixes were attempted. Review the table above and re-run without `--dry-run` to execute auto-fixes.
```
Stop here.
</step>

<step name="execute_fixes">
Process auto-fixable findings one at a time, ordered by severity (critical first, then high, medium, low).

If `--max N` is set, stop after N fix attempts regardless of success.

For each auto-fixable finding:

1. **Announce:**
   ```
   ### Fixing F-{id}: {description}
   ```

2. **Read context:** Load the relevant files identified in the finding.

3. **Apply fix:** Make the minimal code change to address the finding. Use Edit tool for surgical changes.

4. **Run tests:**
   ```bash
   npm test 2>&1
   ```

5. **Evaluate test result:**

   **If tests pass:**
   ```bash
   git add -A
   git commit -m "fix: {description} [F-{id}]"
   ```
   Record as `fixed`.

   **If tests fail:**
   ```
   ### Pipeline Stopped

   Fix for F-{id} caused test failure. Reverting change.
   ```
   ```bash
   git checkout -- .
   ```
   Record as `failed`. **Stop the pipeline.** Do not attempt further fixes.

6. **Update progress:** Track processed count against `--max N` limit.
</step>

<step name="final_report">
Present the final report:

```
## Audit-Fix Report

**Source:** {audit-uat | validate-phase}
**Total findings:** {total}
**Processed:** {processed_count}
**Fixed:** {fixed_count}
**Failed:** {failed_count} {if > 0: "(pipeline stopped)"}
**Skipped (manual-only):** {manual_count}
**Remaining (not attempted):** {remaining_count}

### Fixed Items

| ID | Phase | Finding | Commit |
|----|-------|---------|--------|
| F-001 | {phase} | {description} | {short_hash} |
...

### Failed (pipeline stopped)

| ID | Phase | Finding | Error |
|----|-------|---------|-------|
| F-005 | {phase} | {description} | {test failure summary} |

### Manual Items (requires human attention)

| ID | Phase | Finding | Severity | Reason |
|----|-------|---------|----------|--------|
| F-010 | {phase} | {description} | {severity} | {reason} |
...

### Not Attempted

| ID | Phase | Finding | Severity |
|----|-------|---------|----------|
| F-006 | {phase} | {description} | {severity} |
...
```

If all auto-fixable items were fixed successfully:
```
---
All auto-fixable findings resolved. {manual_count} items require manual attention (see table above).
```
</step>

</process>
