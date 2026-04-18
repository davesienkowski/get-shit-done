# Inline Computation Audit — GSD Framework

**Date:** 2026-04-07
**Scope:** 24 agents, 67 workflows, 67 commands (158 files total)
**Objective:** Identify repetitive inline computation that AI agents perform but could be offloaded to deterministic `gsd-tools.cjs` commands

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Distinct pattern types found | 12 |
| Total inline occurrences across all files | ~145+ |
| Files affected | ~55 of 158 (~35%) |
| Estimated new gsd-tools commands needed | 8-10 |
| Patterns already partially served by gsd-tools | 4 |
| Patterns that should NOT be offloaded | 3 |

The heaviest offenders are **frontmatter status extraction** (~25 occurrences across 8+ files using inline `node -e` or `grep|cut|sed` chains), **file listing/counting** (~30 occurrences of `ls *-PLAN.md | wc -l` patterns), and **requirement ID collection from plan frontmatter** (~15 occurrences of `grep requirements: | tr | sed` chains). These three patterns alone account for roughly half of all inline computation.

gsd-tools already has strong coverage for frontmatter CRUD (`frontmatter get/set/merge/validate`), summary extraction (`summary-extract`), and phase lookup (`find-phase`, `phase-plan-index`). However, workflows and agents frequently re-implement these capabilities inline because:
1. They need a specific field in a specific format (e.g., just the status string, not full JSON)
2. They need batch operations (e.g., extract status from ALL verification files)
3. The existing command doesn't cover the exact artifact type (e.g., REVIEW.md, UAT.md, SECURITY.md)

---

## 2. Pattern Catalog

### Pattern 1: Frontmatter Status Extraction via Shell Pipelines
**Frequency:** ~25 occurrences in ~10 files
**Token cost:** HIGH (each inline `node -e` block is 5-15 lines of JavaScript)

Workflows use inline Node.js or grep/cut/sed chains to extract a single frontmatter field (usually `status:`) from various artifact types.

**Files:**
- `workflows/code-review-fix.md` (6 occurrences) — parses REVIEW.md status, depth, files_reviewed_list via inline `node -e` blocks (lines 109-175, 286, 351, 408)
- `workflows/code-review.md` (3 occurrences) — validates frontmatter status, extracts finding counts (lines 387-434)
- `workflows/execute-phase.md` (3 occurrences) — extracts REVIEW_STATUS, VERIFICATION status, SECURITY threats_open (lines 705, 762, 990)
- `workflows/autonomous.md` (3 occurrences) — extracts VERIFICATION status, AUDIT status (lines 387, 456, 889)
- `workflows/quick.md` (1 occurrence) — extracts VERIFICATION status (line 746)
- `workflows/verify-work.md` (1 occurrence) — reads UAT status from frontmatter (line 51)
- `workflows/diagnose-issues.md` (1 occurrence) — updates status to "diagnosed" (line 176)

**Example (code-review-fix.md:109-118):**
```bash
REVIEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /status:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/status:\s*(\S+)/)[1]);
  } else {
    console.log('unknown');
  }
" 2>/dev/null)
```

**What gsd-tools could return:**
```bash
# Already exists but not used for non-PLAN/SUMMARY/VERIFICATION files:
node gsd-tools.cjs frontmatter get "$REVIEW_PATH" --field status --raw
# Output: "findings_found"
```

**Gap:** `frontmatter get` already exists and handles this. The issue is that workflows don't use it — possibly because they were written before `frontmatter get` was added, or because they don't trust it for non-standard files. No new command needed; adoption is the fix.

---

### Pattern 2: File Listing and Counting in Phase Directories
**Frequency:** ~30 occurrences in ~15 files
**Token cost:** MEDIUM (each is 1-3 lines, but repeated many times)

Workflows repeatedly use `ls` + `wc -l` to count PLANs, SUMMARYs, UATs, etc. in phase directories.

**Files:**
- `workflows/progress.md` (3 occurrences) — counts PLANs, SUMMARYs, UATs (lines 146-148)
- `workflows/execute-plan.md` (4 occurrences) — lists/counts PLANs and SUMMARYs (lines 35-36, 489-490)
- `workflows/transition.md` (2 occurrences) — lists PLANs and SUMMARYs (lines 58-59)
- `workflows/code-review.md` (1 occurrence) — lists SUMMARYs (line 157)
- `workflows/verify-phase.md` (1 occurrence) — lists SUMMARYs and PLANs (line 42)
- `workflows/verify-work.md` (1 occurrence) — lists SUMMARYs (line 131)
- `workflows/secure-phase.md` (2 occurrences) — lists PLANs and SUMMARYs (lines 39-40)
- `workflows/validate-phase.md` (1 occurrence) — lists SUMMARYs (line 39)
- `workflows/ui-review.md` (1 occurrence) — lists SUMMARYs (line 40)
- `workflows/plan-phase.md` (2 occurrences) — lists PLANs, checks VALIDATION (lines 533, 568)
- `workflows/plant-seed.md` (1 occurrence) — counts SEED files (line 89)
- `workflows/pause-work.md` (3 occurrences) — finds active phase/spike/deliberation (lines 18-24)

**Example (progress.md:146-148):**
```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true) | wc -l
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs phase-artifact-counts <phase>
# Output: {"plans": 3, "summaries": 2, "uats": 1, "verifications": 1, "contexts": 1, "reviews": 0, "research": 1}
```

**Note:** `phase-plan-index` already returns plan-level detail with `has_summary` per plan, but workflows still use raw `ls | wc -l` because they want simple counts, not full plan metadata. A lightweight `phase-artifact-counts` command would eliminate ~30 inline shell commands.

---

### Pattern 3: Requirement ID Collection from Plan Frontmatter
**Frequency:** ~15 occurrences in ~8 files
**Token cost:** HIGH (multi-step grep/sed/tr pipelines or AI reading + extracting)

Agents and workflows extract requirement IDs from PLAN frontmatter, then cross-reference against ROADMAP or REQUIREMENTS.md.

**Files:**
- `workflows/plan-phase.md` (2 occurrences) — collects req IDs from plan frontmatter, cross-refs with phase_req_ids (lines 873-883)
- `workflows/execute-plan.md` (1 occurrence) — extracts req IDs for `requirements mark-complete` (line 459)
- `workflows/execute-phase.md` (1 occurrence) — cross-references req IDs from PLAN against REQUIREMENTS.md (line 968)
- `workflows/verify-phase.md` (1 occurrence) — extracts phase goal and requirements (line 50)
- `workflows/audit-milestone.md` (3 occurrences) — extracts milestone REQ-IDs, cross-references (lines 67, 101-108, 112-117)
- `agents/gsd-verifier.md` (2 occurrences) — extracts req IDs from PLAN frontmatter (lines 365-376)
- `agents/gsd-executor.md` (2 occurrences) — extracts req IDs for mark-complete (lines 471-475)
- `agents/gsd-plan-checker.md` (2 occurrences) — extracts and verifies req coverage (lines 95-100)
- `agents/gsd-planner.md` (1 occurrence) — distributes req IDs across plans (line 647)

**Example (plan-phase.md:875-876):**
```bash
PLAN_REQS=$(grep -h "requirements_addressed\|requirements:" ${PHASE_DIR}/*-PLAN.md 2>/dev/null | tr -d '[]' | tr ',' '\n' | sed 's/^[[:space:]]*//' | sort -u)
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs phase-requirements <phase>
# Output: {"plan_reqs": ["AUTH-01", "AUTH-02", "DB-01"], "roadmap_reqs": ["AUTH-01", "AUTH-02", "DB-01", "DB-02"], "coverage": {"covered": ["AUTH-01", "AUTH-02", "DB-01"], "uncovered": ["DB-02"]}, "percent": 75}
```

---

### Pattern 4: SUMMARY.md Key-File Extraction (Inline YAML Parsing)
**Frequency:** ~8 occurrences in ~5 files
**Token cost:** VERY HIGH (15-20 line inline Node.js blocks)

Workflows extract `key_files.created` and `key_files.modified` from SUMMARY.md frontmatter using inline JavaScript YAML parsers.

**Files:**
- `workflows/code-review.md` (1 occurrence) — 18-line inline Node.js to extract key_files (lines 164-181)
- `workflows/verify-phase.md` (1 occurrence) — extracts files modified from SUMMARY (line 187)
- `workflows/add-tests.md` (1 occurrence) — extracts files modified from SUMMARY (line 70)
- `workflows/verify-work.md` (1 occurrence) — extracts testable deliverables from SUMMARY (line 138)
- `agents/gsd-verifier.md` (1 occurrence) — extracts key-files via summary-extract (line 397)
- `agents/gsd-integration-checker.md` (1 occurrence) — extracts from SUMMARYs (line 65)

**Example (code-review.md:164-181):**
A full inline Node.js YAML parser that reads frontmatter, finds `created:` and `modified:` sections, and outputs file paths.

**What gsd-tools could return:**
```bash
# Already partially exists:
node gsd-tools.cjs summary-extract "$SUMMARY" --fields key-files --pick key_files
# But some workflows don't use it — likely because the output format doesn't match their needs
# Could add: --flat flag to output one file per line for shell consumption
node gsd-tools.cjs summary-extract "$SUMMARY" --fields key-files --flat
# Output: src/auth.ts\nsrc/middleware.ts\nsrc/types.ts
```

---

### Pattern 5: Inline Frontmatter Multi-Field Extraction
**Frequency:** ~12 occurrences in ~6 files
**Token cost:** HIGH (5-10 line grep/cut/xargs chains per field)

Workflows extract multiple frontmatter fields individually using grep+cut chains.

**Files:**
- `workflows/code-review.md` (5 fields) — status, files_reviewed, critical, warning, info, total (lines 428-433)
- `workflows/code-review-fix.md` (5 fields) — status, fixed, skipped, failed, partial (lines 408-420)
- `workflows/execute-phase.md` (1 field) — threats_open from SECURITY.md (line 705)
- `workflows/autonomous.md` (1 field) — status from VERIFICATION.md (lines 387, 456)
- `workflows/audit-milestone.md` (2 fields) — nyquist_compliant, wave_0_complete from VALIDATION.md (line 149)
- `workflows/verify-work.md` (2 fields) — status, phase from UAT.md (line 51)

**Example (code-review.md:428-433):**
```bash
STATUS=$(echo "$FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FILES_REVIEWED=$(echo "$FRONTMATTER" | grep "^files_reviewed:" | cut -d: -f2 | xargs)
CRITICAL=$(echo "$FRONTMATTER" | grep "critical:" | head -1 | cut -d: -f2 | xargs)
WARNING=$(echo "$FRONTMATTER" | grep "warning:" | head -1 | cut -d: -f2 | xargs)
```

**What gsd-tools could return:**
```bash
# Already exists — frontmatter get returns all fields as JSON:
node gsd-tools.cjs frontmatter get "$REVIEW_PATH" --raw
# Output: {"status":"findings_found","files_reviewed":5,"findings":{"critical":1,"warning":3,"info":2,"total":6}}
# Then use --pick for specific fields:
node gsd-tools.cjs frontmatter get "$REVIEW_PATH" --pick status --raw
```

**Gap:** Same as Pattern 1 — `frontmatter get` already handles this. Adoption gap, not feature gap.

---

### Pattern 6: Cross-Phase File Discovery
**Frequency:** ~15 occurrences in ~10 files
**Token cost:** MEDIUM (1-3 lines each, but repeated and error-prone)

Workflows use `find` or `ls` with glob patterns to discover files across all phase directories.

**Files:**
- `workflows/discuss-phase.md` (1 occurrence) — finds all CONTEXT.md files (line 285)
- `workflows/discuss-phase-assumptions.md` (1 occurrence) — finds all CONTEXT.md files (line 155)
- `workflows/autonomous.md` (2 occurrences) — finds CONTEXT.md files, lists codebase maps (lines 546, 580)
- `workflows/execute-phase.md` (1 occurrence) — finds VERIFICATION.md in other phases (line 834)
- `workflows/verify-work.md` (1 occurrence) — finds UAT files across phases (line 46)
- `workflows/forensics.md` (1 occurrence) — lists all phase directories (line 67)
- `workflows/import.md` (1 occurrence) — finds CONTEXT.md files (line 83)
- `workflows/resume-project.md` (2 occurrences) — finds continue-here files, CONTEXT files (lines 70, 219)
- `workflows/cleanup.md` (3 occurrences) — lists/matches phase directories (lines 55-58)
- `agents/gsd-assumptions-analyzer.md` (1 occurrence) — finds prior CONTEXT.md (line 52)

**Example (discuss-phase.md:285):**
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs list-artifacts --type context
# Output: [".planning/phases/01-auth/01-CONTEXT.md", ".planning/phases/02-api/02-CONTEXT.md"]

node gsd-tools.cjs list-artifacts --type uat --status diagnosed
# Output: [".planning/phases/03-ui/03-UAT.md"]
```

---

### Pattern 7: Verification Status Extraction (grep + cut Chains)
**Frequency:** ~8 occurrences in ~5 files
**Token cost:** MEDIUM (single-line chains, but fragile and repeated)

Extracting status from VERIFICATION.md specifically, outside frontmatter get.

**Files:**
- `workflows/execute-phase.md` (2 occurrences) — grep status from VERIFICATION, REVIEW (lines 762, 990)
- `workflows/autonomous.md` (3 occurrences) — grep status from VERIFICATION, AUDIT (lines 387, 456, 889)
- `workflows/quick.md` (1 occurrence) — grep status from VERIFICATION (line 746)
- `workflows/transition.md` (1 occurrence) — grep for pending/blocked items across UAT+VERIFICATION (lines 80-85)

**Example (execute-phase.md:762):**
```bash
REVIEW_STATUS=$(sed -n '/^---$/,/^---$/p' "$REVIEW_FILE" | grep "^status:" | head -1 | cut -d: -f2 | tr -d ' ')
```

**Proposed gsd-tools command:** Same as Pattern 1/5 — `frontmatter get <file> --field status --raw` already handles this.

---

### Pattern 8: Git History Queries for Phase Commits
**Frequency:** ~12 occurrences in ~6 files
**Token cost:** MEDIUM (git commands are cheap but the AI spends tokens parsing output)

Workflows search git history for phase-specific commits, compute diff bases, and check for commit existence.

**Files:**
- `workflows/code-review.md` (2 occurrences) — finds phase commits for diff base (lines 206, 323)
- `workflows/execute-plan.md` (3 occurrences) — verifies commits exist, computes first task commit (lines 112, 474-475)
- `workflows/execute-phase.md` (1 occurrence) — checks for commits from parallel agents (line 450)
- `workflows/quick.md` (2 occurrences) — finds quick task commits for diff base (lines 677-681)
- `workflows/forensics.md` (4 occurrences) — git log, hot files, failure patterns (lines 32-42, 102, 152)
- `workflows/complete-milestone.md` (3 occurrences) — milestone commit stats (lines 130-134)
- `workflows/milestone-summary.md` (3 occurrences) — commit counts, timeline (lines 80-93)

**Example (quick.md:677-681):**
```bash
QUICK_COMMITS=$(git log --oneline --format="%H" --grep="${quick_id}" 2>/dev/null)
DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)^
git rev-parse "${DIFF_BASE}" >/dev/null 2>&1 || DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs git phase-diff-base <phase>
# Output: {"diff_base": "abc1234", "commit_count": 5, "files_changed": ["src/auth.ts", "src/types.ts"]}

node gsd-tools.cjs git commit-stats --grep "phase-03"
# Output: {"count": 12, "first": "2026-03-15", "last": "2026-03-17", "files_changed": 8, "insertions": 450, "deletions": 120}
```

---

### Pattern 9: ROADMAP.md Section Parsing for UI Detection
**Frequency:** ~5 occurrences in ~3 files
**Token cost:** MEDIUM (grep for "UI hint" patterns)

Workflows grep the ROADMAP phase section to detect if a phase has UI work.

**Files:**
- `workflows/plan-phase.md` (2 occurrences) — checks for UI indicators (lines 412, 420)
- `workflows/progress.md` (2 occurrences) — checks UI hint for routing (lines 235, 381)
- `workflows/new-project.md` (1 occurrence) — checks Phase 1 for UI (line 1185)
- `workflows/autonomous.md` (1 occurrence) — checks if phase has frontend indicators (line 283)

**Example (progress.md:235):**
```bash
PHASE_HAS_UI=$(echo "$PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs roadmap get-phase <N> --pick has_ui --raw
# Output: true
```

**Gap:** `roadmap get-phase` already returns the section text, but doesn't parse structured fields like `UI hint: yes`. Adding parsed fields to the JSON output would eliminate this pattern.

---

### Pattern 10: Decisions Extraction from CONTEXT.md / SUMMARY.md
**Frequency:** ~6 occurrences in ~4 files
**Token cost:** HIGH (AI reads full file and extracts structured data)

Agents and workflows read CONTEXT.md `<decisions>` sections or SUMMARY.md "Decisions Made" sections and extract individual decisions.

**Files:**
- `agents/gsd-executor.md` (1 occurrence) — extracts decisions from SUMMARY for `state add-decision` (line 486)
- `agents/gsd-plan-checker.md` (1 occurrence) — extracts numbered decisions from CONTEXT `<decisions>` (line 286)
- `workflows/milestone-summary.md` (1 occurrence) — extracts decisions from all CONTEXT.md (line 63)
- `workflows/transition.md` (1 occurrence) — extracts decisions from SUMMARY files (line 212)
- `workflows/complete-milestone.md` (1 occurrence) — extracts key deliverables from SUMMARYs (line 459)

**Example (gsd-executor.md:486):**
> "Extract decisions from SUMMARY.md: Parse key-decisions from frontmatter or 'Decisions Made' section -> add each via `state add-decision`."

**What gsd-tools could return:**
```bash
node gsd-tools.cjs summary-extract "$SUMMARY" --fields decisions
# Output: [{"id":"D-01","summary":"Use OAuth 2.0 + PKCE","rationale":"Social login requirement"}]

node gsd-tools.cjs context-extract "$CONTEXT" --section decisions
# Output: [{"id":"D-01","text":"Use NextAuth for authentication","status":"locked"}]
```

---

### Pattern 11: Outstanding Verification Debt Scanning
**Frequency:** ~5 occurrences in ~3 files
**Token cost:** MEDIUM (multi-file grep for status patterns)

Workflows scan for unresolved items across UAT, VERIFICATION, and debug files.

**Files:**
- `workflows/transition.md` (1 occurrence) — scans current phase for outstanding items (lines 80-85)
- `workflows/progress.md` (2 occurrences) — checks for diagnosed UAT gaps, active debug sessions (lines 88, 159)
- `workflows/execute-phase.md` (1 occurrence) — finds prior verifications (line 834)
- `agents/gsd-debugger.md` (1 occurrence) — lists active debug sessions (line 914)

**Example (transition.md:80-85):**
```bash
for f in .planning/phases/XX-current/*-UAT.md .planning/phases/XX-current/*-VERIFICATION.md; do
  [ -f "$f" ] || continue
  grep -q "result: pending\|result: blocked\|status: partial\|status: human_needed\|status: diagnosed" "$f" && OUTSTANDING="$OUTSTANDING\n$(basename $f)"
done
```

**What gsd-tools could return:**
```bash
# Already exists:
node gsd-tools.cjs audit-uat --raw
# But workflows don't always use it — some only need phase-scoped results
node gsd-tools.cjs audit-uat --phase <N> --raw
# Output: {"total_items": 3, "files": [{"file": "03-UAT.md", "pending": 2, "blocked": 1}]}
```

---

### Pattern 12: Active Debug Session / Note / Seed Counting
**Frequency:** ~5 occurrences in ~4 files
**Token cost:** LOW (simple ls/wc chains)

Workflows count files in `.planning/debug/`, `.planning/notes/`, `.planning/seeds/`.

**Files:**
- `workflows/progress.md` (1 occurrence) — counts active debug sessions (line 88)
- `workflows/plant-seed.md` (1 occurrence) — counts existing seeds (line 89)
- `workflows/pause-work.md` (1 occurrence) — finds active deliberation (line 24)
- `agents/gsd-debugger.md` (1 occurrence) — lists unresolved debug files (line 914)
- `workflows/resume-project.md` (1 occurrence) — counts pending todos (line 296)

**Example (plant-seed.md:89):**
```bash
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
```

**What gsd-tools could return:**
```bash
node gsd-tools.cjs planning-counts
# Output: {"seeds": 3, "notes": 7, "debug_active": 1, "debug_resolved": 4, "todos_pending": 5, "todos_completed": 12, "deliberations": 0}
```

---

## 3. Proposed New gsd-tools Commands

### Priority 1: High frequency, high token savings

#### `phase-artifact-counts <phase>`
- **Replaces:** ~30 inline `ls | wc -l` patterns
- **Input:** Phase number
- **Output:** `{"plans": 3, "summaries": 2, "uats": 1, "verifications": 1, "contexts": 1, "reviews": 0, "research": 1, "validations": 0, "security": 0, "ui_specs": 0}`
- **Files affected:** progress.md, execute-plan.md, transition.md, code-review.md, verify-phase.md, verify-work.md, secure-phase.md, validate-phase.md, ui-review.md, plan-phase.md (10 files)

#### `phase-requirements <phase>`
- **Replaces:** ~15 inline grep/sed/tr chains for requirement ID extraction
- **Input:** Phase number
- **Output:** `{"plan_reqs": ["AUTH-01"], "roadmap_reqs": ["AUTH-01", "AUTH-02"], "covered": ["AUTH-01"], "uncovered": ["AUTH-02"], "coverage_percent": 50}`
- **Files affected:** plan-phase.md, execute-plan.md, execute-phase.md, verify-phase.md, audit-milestone.md, gsd-verifier.md, gsd-executor.md, gsd-plan-checker.md (8 files)

#### `list-artifacts [--type TYPE] [--phase N] [--status STATUS]`
- **Replaces:** ~15 `find .planning/phases -name "*-TYPE.md"` patterns
- **Input:** Optional type filter (context, uat, verification, summary, plan, review, research, security, validation), optional phase, optional status filter
- **Output:** Array of file paths
- **Files affected:** discuss-phase.md, autonomous.md, execute-phase.md, verify-work.md, forensics.md, import.md, resume-project.md, cleanup.md (8 files)

### Priority 2: Medium frequency, medium token savings

#### `git phase-diff-base <phase|quick-id>`
- **Replaces:** ~8 inline git log/rev-parse chains for computing diff bases
- **Input:** Phase number or quick task ID
- **Output:** `{"diff_base": "abc1234", "commit_count": 5, "oldest_commit": "def5678", "files_changed": ["src/auth.ts"]}`
- **Files affected:** code-review.md, execute-plan.md, quick.md, execute-phase.md (4 files)

#### `git commit-stats [--grep PATTERN] [--phase N]`
- **Replaces:** ~5 inline git log counting/timeline queries
- **Input:** Grep pattern or phase number
- **Output:** `{"count": 12, "first_date": "2026-03-15", "last_date": "2026-03-17", "files_changed": 8, "insertions": 450, "deletions": 120}`
- **Files affected:** complete-milestone.md, milestone-summary.md, forensics.md (3 files)

#### `planning-counts`
- **Replaces:** ~5 inline ls/wc patterns for seeds, notes, debug sessions, todos
- **Input:** None
- **Output:** `{"seeds": 3, "notes": 7, "debug_active": 1, "debug_resolved": 4, "todos_pending": 5, "todos_completed": 12, "deliberations": 0}`
- **Files affected:** progress.md, plant-seed.md, pause-work.md, gsd-debugger.md, resume-project.md (5 files)

### Priority 3: Lower frequency, but high token savings per occurrence

#### `summary-extract --flat` (enhancement to existing command)
- **Replaces:** ~5 inline 15-line Node.js YAML parsing blocks
- **Enhancement:** Add `--flat` flag to output one value per line for shell consumption (e.g., key-files as one file path per line)
- **Files affected:** code-review.md, verify-phase.md, add-tests.md, verify-work.md (4 files)

#### `roadmap get-phase --pick has_ui` (enhancement to existing command)
- **Replaces:** ~5 inline `grep -qi "UI hint"` patterns
- **Enhancement:** Parse structured fields from phase section (UI hint, canonical refs, requirements) into JSON
- **Files affected:** plan-phase.md, progress.md, new-project.md, autonomous.md (4 files)

---

## 4. Priority Ranking by Frequency x Token Savings

| Rank | Pattern | Freq | Token Cost | New Command | Estimated Savings |
|------|---------|------|------------|-------------|-------------------|
| 1 | File listing/counting | ~30 | Medium | `phase-artifact-counts` | ~150 lines of shell removed |
| 2 | Frontmatter status extraction | ~25 | High | Adoption of existing `frontmatter get` | ~250 lines of inline JS/shell |
| 3 | Requirement ID collection | ~15 | High | `phase-requirements` | ~100 lines of grep/sed chains |
| 4 | Cross-phase file discovery | ~15 | Medium | `list-artifacts` | ~45 lines of find/ls |
| 5 | Git diff base computation | ~12 | Medium | `git phase-diff-base` | ~80 lines of git chains |
| 6 | Multi-field frontmatter extraction | ~12 | High | Adoption of existing `frontmatter get` | ~60 lines of grep/cut |
| 7 | SUMMARY key-file extraction | ~8 | Very High | `summary-extract --flat` | ~100 lines of inline JS |
| 8 | Verification debt scanning | ~5 | Medium | `audit-uat --phase` | ~30 lines of grep loops |
| 9 | UI detection from roadmap | ~5 | Medium | `roadmap get-phase` enhancement | ~15 lines |
| 10 | Planning directory counts | ~5 | Low | `planning-counts` | ~15 lines |
| 11 | Decisions extraction | ~6 | High | `context-extract --section` | ~30 lines of AI parsing |
| 12 | Git commit stats | ~5 | Medium | `git commit-stats` | ~25 lines |

**Total estimated savings:** ~900 lines of inline computation across 158 files

---

## 5. Patterns That Should NOT Be Offloaded

### 1. Codebase-Specific Verification (gsd-verifier.md, gsd-integration-checker.md)
The verifier and integration checker use project-specific `grep` commands to check if artifacts exist, are imported, are wired correctly (e.g., `grep -r "import.*$artifact_name" src/`). These are inherently project-dependent and cannot be deterministic across all projects.

### 2. Contextual Decision Extraction (AI-interpreted)
When the AI reads a CONTEXT.md `<decisions>` section and determines which decisions are "locked" vs "deferred" vs "discretion", this requires semantic understanding. The XML structure helps, but the classification of what counts as a "decision" is judgment-based.

### 3. Complex Multi-File Aggregation with Judgment
Patterns like "aggregate issues encountered from all SUMMARYs" (execute-phase.md line 687) or "extract key deliverables" (complete-milestone.md line 459) require the AI to read, understand, and synthesize information. The extraction is straightforward but the summarization is not.

### 4. Template Generation (Beyond Simple Fill)
Agent instructions that say "create SUMMARY.md with these sections" involve judgment about what to include. The `template fill` command handles the structure, but populating it with accurate content requires AI understanding of what was accomplished.

### 5. Forensic Analysis (forensics.md)
The forensics workflow's git analysis (hot files, failure patterns, gap analysis) is inherently investigative. While individual git commands could be wrapped, the analysis of what those results mean requires AI judgment.

---

## 6. Key Finding: Adoption Gap vs Feature Gap

The most important finding is that **roughly 40% of inline computation (Patterns 1, 5, 7) could be eliminated today** by adopting existing `frontmatter get` and `summary-extract` commands. These commands already exist in gsd-tools but workflows don't use them — instead they inline Node.js or grep/cut chains.

**Root causes for the adoption gap:**
1. **Chronological:** Many workflows were written before these commands existed
2. **Format mismatch:** Workflows need a single raw string value; `frontmatter get` returns JSON by default (though `--raw` and `--pick` flags exist)
3. **Trust/visibility:** Developers may not know these commands exist — the gsd-tools help is comprehensive but the 130+ command surface area is hard to scan
4. **Non-PLAN/SUMMARY files:** Workflows may not realize `frontmatter get` works on ANY file with YAML frontmatter, not just PLANs and SUMMARYs

**Recommendation:** Before building new commands, audit and document the existing `frontmatter get`, `summary-extract`, and `phase-plan-index` commands, then systematically replace inline patterns in the top 10 most-affected files. This alone would eliminate ~250 lines of inline computation.
