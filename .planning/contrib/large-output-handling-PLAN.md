---
phase: contrib-large-output
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/templates/summary.md
  - get-shit-done/workflows/execute-plan.md
autonomous: true
---

<objective>
Implement structured output handling — persist verification outputs to disk with frontmatter references.

Purpose:
1. **Prevent context bloat** — Explicit guidance to NOT inline verbose build/test output
2. **Enable debugging** — Full outputs available on disk without re-running
3. **Structured tracking** — Frontmatter documents what ran, status, and where to find details
4. **Handle failure cases** — Build failures produce verbose output that shouldn't bloat summaries

Context impact:
- Well-disciplined projects: Minimal change (adds ~50 tokens for outputs frontmatter)
- Projects with inline output: Saves 30-60% per summary read
- Failing builds: Prevents 1000+ token bloat from error dumps

Output:
- Modified summary template with outputs frontmatter schema
- Modified execute-plan workflow to save outputs to disk
- Backwards compatible with existing summaries (no migration required)
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

**Feature rationale:**

Claude Code v2.1.2 introduced automatic persistence of large bash outputs to disk:
> "Large bash command outputs now saved to disk instead of truncated"

GSD can adopt this pattern explicitly. Reality check:
- Current GSD summaries are already lean (~800 tokens each)
- The discipline exists implicitly but isn't codified
- Projects with verbose test suites or build failures could bloat summaries
- No structured way to track what verification ran and where outputs live

This enhancement:
- Codifies lean summary practice with explicit guidance
- Adds structured `outputs:` frontmatter for tracking
- Provides debugging access without re-running commands
- Prevents worst-case bloat from verbose/failing builds

**Backwards compatibility:**
- Existing SUMMARYs without `outputs:` frontmatter work unchanged
- plan-phase handles missing field gracefully (no outputs to reference)
- No config.json changes required — sensible defaults built-in
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add outputs frontmatter schema to summary template</name>
  <files>get-shit-done/templates/summary.md</files>
  <action>Add `outputs` field to SUMMARY.md frontmatter schema. Use `outputs` (not `verification`) for clarity — these are output artifacts, not the verification section itself.

In the File Template section, add to frontmatter after `issues-created`:

```yaml
# Output artifacts (paths relative to this file's directory)
outputs:
  build:
    status: success|failed|skipped
    summary: "Build succeeded in 12s"     # One-line result (REQUIRED)
    file: "./03-01-outputs/build.log"     # Full output (optional, if saved)
  tests:
    status: success|failed|skipped
    passed: 47
    failed: 0
    summary: "47 passed, 0 failed"
    file: "./03-01-outputs/test-results.txt"
  lint:
    status: success|failed|skipped
    warnings: 3
    errors: 0
    summary: "3 warnings, 0 errors"
    file: "./03-01-outputs/lint-report.txt"
```

Add `<outputs_guidance>` section after frontmatter_guidance:

```markdown
<outputs_guidance>
**Purpose:** Keep SUMMARY.md lean by storing verbose command outputs on disk. Frontmatter contains one-line summaries; full logs available via file reference when needed.

**Directory convention:** `{phase}-{plan}-outputs/` alongside SUMMARY.md
- Example: `.planning/phases/03-auth/03-01-outputs/`

**When to save to disk:**
- Build/test/lint outputs (almost always verbose)
- Any command output you'd want for debugging
- Claude decides contextually — no strict threshold

**When to skip:**
- Command produced no meaningful output
- Output is trivial (e.g., "OK")

**Required fields:**
- `status`: success, failed, or skipped
- `summary`: One-line human-readable result

**Optional fields:**
- `file`: Relative path to full output
- `passed`/`failed`/`warnings`/`errors`: Numeric counts when applicable

**Backwards compatibility:** Existing SUMMARYs without `outputs:` work unchanged. plan-phase handles missing field gracefully.
</outputs_guidance>
```

Update the example SUMMARY.md to show outputs frontmatter. Remove inline verification output from example body — replace with reference to outputs directory.

In the Verification Results section of the example, change from inline output to:

```markdown
## Verification
All checks passed. Full outputs in `03-01-outputs/`.
```
</action>
  <verify>grep -A 15 "^outputs:" get-shit-done/templates/summary.md shows new schema</verify>
  <done>Summary template includes outputs frontmatter schema with file reference pattern and backwards compatibility note</done>
</task>

<task type="auto">
  <name>Task 2: Update execute-plan workflow to capture outputs</name>
  <files>get-shit-done/workflows/execute-plan.md</files>
  <action>Modify the verification and summary creation steps in execute-plan.md.

Find the verification step (where build/test/lint commands run). Add output capture guidance:

```markdown
## Output Capture

Save verification outputs to disk for lean summaries:

1. Create outputs directory:
   ```bash
   mkdir -p .planning/phases/{phase}/{plan}-outputs/
   ```

2. Run commands with tee:
   ```bash
   npm run build 2>&1 | tee .planning/phases/{phase}/{plan}-outputs/build.log
   npm test 2>&1 | tee .planning/phases/{phase}/{plan}-outputs/test-results.txt
   ```

3. Extract one-line summary for frontmatter:
   - Build: "Build succeeded in Xs" or "Build failed: [first error]"
   - Tests: "N passed, M failed"
   - Lint: "N warnings, M errors"

Outputs directory is cleaned up automatically when milestone completes.
```

In the summary creation step (create_summary or equivalent), add:

```markdown
## Outputs Frontmatter

Populate outputs section from verification results:

```yaml
outputs:
  build:
    status: success  # Based on exit code
    summary: "Build succeeded in 8s"
    file: "./03-01-outputs/build.log"
  tests:
    status: success
    passed: 47
    failed: 0
    summary: "47 passed, 0 failed"
    file: "./03-01-outputs/test-results.txt"
```

**Do NOT inline verbose output in summary body.** Reference the outputs directory instead:

```markdown
## Verification
All checks passed. Full outputs in `{plan}-outputs/`.
```
```

Keep existing verification section structure but note that verbose output goes to disk, not inline.</action>
  <verify>grep -B 2 -A 8 "Output Capture" get-shit-done/workflows/execute-plan.md shows new guidance</verify>
  <done>Execute-plan workflow captures outputs to disk and populates frontmatter references</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] get-shit-done/templates/summary.md has `outputs:` frontmatter schema
- [ ] get-shit-done/templates/summary.md has `<outputs_guidance>` section
- [ ] get-shit-done/workflows/execute-plan.md has output capture instructions
- [ ] Example SUMMARY.md shows outputs frontmatter, not inline logs
- [ ] Backwards compatibility explicitly documented
</verification>

<success_criteria>
- All tasks completed
- Summary template shows outputs frontmatter pattern
- Execute-plan workflow includes output capture guidance
- No config.json changes required (sensible defaults)
- Backwards compatible — existing summaries work unchanged
</success_criteria>

<output>
After completion:
1. Create `.planning/contrib/large-output-handling-SUMMARY.md`
2. Ready for PR to glittercowboy/get-shit-done
</output>
