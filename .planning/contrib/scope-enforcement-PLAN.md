---
phase: contrib-scope-enforcement
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/templates/config.md
  - get-shit-done/templates/hooks/scope-check.py
  - get-shit-done/templates/hooks/scope-check.md
  - get-shit-done/workflows/execute-plan.md
  - get-shit-done/references/scope-enforcement.md
autonomous: true
---

<objective>
Implement PreToolUse hook for scope enforcement during plan execution.

Purpose: Leverage Claude Code's PreToolUse hooks to detect when subagents attempt to edit files outside their plan's declared `files_modified`. Prevents scope creep in parallel execution where undeclared file edits cause merge conflicts between concurrent plans.

Output:
- Python hook script for scope checking
- Hook documentation and setup guide
- Config schema for enforcement modes
- Reference documentation explaining the pattern
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/phase-prompt.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

**Feature rationale:**

Claude Code PreToolUse hooks run before any tool executes:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "type": "command",
      "command": "python .claude/hooks/scope-check.py"
    }]
  }
}
```

Current problem:
- Plan declares `files_modified: [src/auth.ts]`
- Subagent also edits `src/utils/helpers.ts` "while it's there"
- Parallel Plan 02 also touches `src/utils/helpers.ts`
- Merge conflict, manual resolution needed

Solution:
- Hook checks if target file matches plan's `files_modified`
- Three modes: off (no check), warn (log but allow), block (prevent)
- Exceptions for .md files, .planning/**, test files alongside source

**Claude Code hook capabilities:**
- PreToolUse receives tool input as JSON on stdin
- Returns decision: allow, block, or ask
- Can include message shown to agent on block
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create scope-check.py hook script</name>
  <files>get-shit-done/templates/hooks/scope-check.py</files>
  <action>Create Python hook script for scope enforcement.

Create directory if needed: `get-shit-done/templates/hooks/`

Script requirements:

```python
#!/usr/bin/env python3
"""
GSD Scope Enforcement Hook
Checks if file edits match plan's files_modified declaration.

Usage: Called by Claude Code PreToolUse hook for Edit/Write tools.
Input: JSON on stdin with tool_name, tool_input, session_id
Output: JSON on stdout with decision (allow/block) and optional message
"""

import json
import sys
import os
import re
import fnmatch

def get_config():
    """Load scope enforcement config from .planning/config.json"""
    config_path = ".planning/config.json"
    defaults = {
        "mode": "warn",  # off, warn, block
        "allow_new_files": True,
        "allow_test_files": True,
        "exceptions": ["*.md", ".planning/**", "*.test.*", "*.spec.*"]
    }

    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                config = json.load(f)
                return {**defaults, **config.get("scope_enforcement", {})}
        except:
            pass
    return defaults

def get_current_plan():
    """Find active plan from environment or agent-history.json"""
    # Check environment variable first (set by execute-plan)
    plan_path = os.environ.get("GSD_CURRENT_PLAN")
    if plan_path and os.path.exists(plan_path):
        return plan_path

    # Fall back to agent-history.json
    history_path = ".planning/agent-history.json"
    if os.path.exists(history_path):
        try:
            with open(history_path) as f:
                history = json.load(f)
                for agent in history.get("agents", []):
                    if agent.get("status") == "running":
                        return agent.get("plan_path")
        except:
            pass
    return None

def get_allowed_files(plan_path):
    """Extract files_modified from plan YAML frontmatter"""
    if not plan_path or not os.path.exists(plan_path):
        return None

    try:
        with open(plan_path, encoding='utf-8') as f:
            content = f.read()

        if not content.startswith("---"):
            return None

        # Extract frontmatter
        parts = content.split("---", 2)
        if len(parts) < 3:
            return None

        frontmatter = parts[1]

        # Parse files_modified (simple YAML parsing)
        # Look for files_modified: followed by list items
        match = re.search(r'files_modified:\s*\n((?:\s+-\s+.+\n?)+)', frontmatter)
        if match:
            items = re.findall(r'-\s+(.+)', match.group(1))
            return [item.strip().strip('"\'') for item in items]

        # Also check inline format: files_modified: [a, b, c]
        match = re.search(r'files_modified:\s*\[([^\]]+)\]', frontmatter)
        if match:
            items = match.group(1).split(',')
            return [item.strip().strip('"\'') for item in items]

        return []
    except:
        return None

def matches_pattern(file_path, patterns):
    """Check if file matches any glob pattern"""
    for pattern in patterns:
        # Direct match
        if file_path == pattern:
            return True
        # Glob match
        if fnmatch.fnmatch(file_path, pattern):
            return True
        # Directory prefix match (pattern ends with /**)
        if pattern.endswith("/**"):
            prefix = pattern[:-3]
            if file_path.startswith(prefix):
                return True
        # Directory prefix without glob
        if pattern.endswith("/") and file_path.startswith(pattern):
            return True
    return False

def check_scope(file_path, allowed_files, config):
    """Check if file edit is within scope"""
    rel_path = os.path.normpath(file_path).replace("\\", "/")
    if rel_path.startswith("./"):
        rel_path = rel_path[2:]

    # Check exceptions first (always allowed)
    if matches_pattern(rel_path, config.get("exceptions", [])):
        return True, "Exception match"

    # Check if it's a test file alongside allowed source
    if config.get("allow_test_files"):
        for allowed in (allowed_files or []):
            base = os.path.splitext(allowed)[0]
            if rel_path.startswith(base) and (".test." in rel_path or ".spec." in rel_path):
                return True, "Test file for allowed source"

    # Check if file is new and new files allowed
    if config.get("allow_new_files") and not os.path.exists(file_path):
        # Check if new file is in an allowed directory
        for allowed in (allowed_files or []):
            if allowed.endswith("/**") or allowed.endswith("/*"):
                dir_pattern = allowed.rsplit("/", 1)[0]
                if rel_path.startswith(dir_pattern + "/"):
                    return True, "New file in allowed directory"

    # Check against allowed files
    if allowed_files is None:
        return True, "No plan context"

    if matches_pattern(rel_path, allowed_files):
        return True, "Matches files_modified"

    return False, f"Not in files_modified: {allowed_files}"

def log_violation(file_path, allowed_files, config):
    """Log scope violation for orchestrator visibility"""
    log_path = ".planning/scope-violations.json"

    try:
        if os.path.exists(log_path):
            with open(log_path) as f:
                log = json.load(f)
        else:
            log = {"violations": []}

        from datetime import datetime
        log["violations"].append({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "file": file_path,
            "allowed": allowed_files,
            "mode": config.get("mode"),
            "plan": os.environ.get("GSD_CURRENT_PLAN", "unknown")
        })

        with open(log_path, "w") as f:
            json.dump(log, f, indent=2)
    except:
        pass  # Don't fail on logging errors

def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except:
        # Can't parse input, allow by default
        print(json.dumps({"decision": "allow"}))
        return

    tool_name = input_data.get("tool_name", "")

    # Only check file modification tools
    if tool_name not in ["Edit", "Write", "MultiEdit"]:
        print(json.dumps({"decision": "allow"}))
        return

    config = get_config()

    # Check if enforcement is off
    if config.get("mode") == "off":
        print(json.dumps({"decision": "allow"}))
        return

    # Get file path from tool input
    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if not file_path:
        print(json.dumps({"decision": "allow"}))
        return

    # Get plan context
    plan_path = get_current_plan()
    allowed_files = get_allowed_files(plan_path)

    # Check scope
    in_scope, reason = check_scope(file_path, allowed_files, config)

    if in_scope:
        print(json.dumps({"decision": "allow"}))
        return

    # Scope violation detected
    log_violation(file_path, allowed_files, config)

    if config.get("mode") == "warn":
        # Warn but allow
        message = f"[GSD Scope Warning] {file_path} not in plan's files_modified. Proceeding anyway."
        print(json.dumps({"decision": "allow", "message": message}))
    else:
        # Block
        message = (
            f"Scope violation: {file_path} not in plan's files_modified.\n"
            f"Allowed files: {allowed_files}\n"
            f"Options:\n"
            f"1. Add file to plan's files_modified frontmatter\n"
            f"2. Create separate plan for this file\n"
            f"3. Request scope expansion via checkpoint"
        )
        print(json.dumps({"decision": "block", "reason": message}))

if __name__ == "__main__":
    main()
```

Make script executable and include shebang for cross-platform use.</action>
  <verify>python get-shit-done/templates/hooks/scope-check.py < /dev/null exits cleanly (no syntax errors)</verify>
  <done>Scope check hook script created with warn/block modes, exception handling, and violation logging</done>
</task>

<task type="auto">
  <name>Task 2: Create hook setup documentation</name>
  <files>get-shit-done/templates/hooks/scope-check.md</files>
  <action>Create documentation for scope-check hook setup and configuration.

```markdown
# Scope Enforcement Hook

PreToolUse hook that enforces plan file boundaries during execution.

## Purpose

Prevents subagents from editing files outside their declared `files_modified` scope. Critical for parallel execution where undeclared edits cause merge conflicts.

## Installation

1. Copy hook to project:
   ```bash
   mkdir -p .claude/hooks
   cp ~/.claude/get-shit-done/templates/hooks/scope-check.py .claude/hooks/
   ```

2. Add to `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": "Edit|Write|MultiEdit",
         "type": "command",
         "command": "python .claude/hooks/scope-check.py"
       }]
     }
   }
   ```

3. Configure in `.planning/config.json`:
   ```json
   {
     "scope_enforcement": {
       "mode": "warn",
       "allow_new_files": true,
       "allow_test_files": true,
       "exceptions": ["*.md", ".planning/**"]
     }
   }
   ```

## Configuration

| Field | Values | Default | Description |
|-------|--------|---------|-------------|
| `mode` | `"off"`, `"warn"`, `"block"` | `"warn"` | Enforcement level |
| `allow_new_files` | `true`, `false` | `true` | Allow creating new files in allowed directories |
| `allow_test_files` | `true`, `false` | `true` | Allow test files alongside allowed source files |
| `exceptions` | glob patterns | `["*.md", ".planning/**"]` | Always-allowed patterns |

## Modes

### `off`
No scope checking. Use when:
- Exploratory work
- Plans intentionally underspecified
- Solo execution (no parallel conflict risk)

### `warn` (Recommended)
Log violations but allow edits. Use when:
- Introducing scope enforcement gradually
- Want visibility without blocking
- Trust agents to make reasonable decisions

Violations logged to `.planning/scope-violations.json`.

### `block`
Prevent out-of-scope edits. Use when:
- Parallel execution with strict file ownership
- High-confidence plans with accurate files_modified
- Zero tolerance for scope creep

Agent receives error message with options:
1. Add file to plan's files_modified
2. Create separate plan
3. Request scope expansion via checkpoint

## How It Works

1. Execute-plan sets `GSD_CURRENT_PLAN` environment variable
2. Hook reads plan's YAML frontmatter for `files_modified`
3. On Edit/Write, compares target file against allowed list
4. Decision: allow (in scope), warn (log + allow), or block

## Violation Log

Violations written to `.planning/scope-violations.json`:

```json
{
  "violations": [
    {
      "timestamp": "2026-01-13T22:45:00Z",
      "file": "src/utils/helpers.ts",
      "allowed": ["src/auth.ts", "src/routes/auth/**"],
      "mode": "warn",
      "plan": ".planning/phases/03-auth/03-01-PLAN.md"
    }
  ]
}
```

Review after phase execution to identify scope issues.

## Exception Patterns

Default exceptions (always allowed):
- `*.md` - Documentation
- `.planning/**` - GSD state files
- `*.test.*`, `*.spec.*` - Test files

Add project-specific exceptions:
```json
{
  "exceptions": [
    "*.md",
    ".planning/**",
    "package.json",
    "package-lock.json",
    ".env*"
  ]
}
```

## Troubleshooting

**Hook not running:**
- Verify `.claude/settings.json` hook configuration
- Check Python is in PATH
- Verify hook file is executable

**False positives:**
- Add legitimate files to `exceptions`
- Use glob patterns: `"src/shared/**"`
- Set `allow_test_files: true`

**Plan context not found:**
- Ensure execute-plan sets `GSD_CURRENT_PLAN` env var
- Check agent-history.json has running agent entry
```
</action>
  <verify>File exists with Installation, Configuration, and Modes sections</verify>
  <done>Hook documentation created with setup instructions and configuration guide</done>
</task>

<task type="auto">
  <name>Task 3: Add scope_enforcement to config schema</name>
  <files>get-shit-done/templates/config.md</files>
  <action>Add `scope_enforcement` section to config.json documentation.

Add after existing config sections:

```markdown
## Scope Enforcement Settings

```json
{
  "scope_enforcement": {
    "mode": "warn",
    "allow_new_files": true,
    "allow_test_files": true,
    "exceptions": ["*.md", ".planning/**"]
  }
}
```

| Field | Values | Default | Description |
|-------|--------|---------|-------------|
| `mode` | `"off"`, `"warn"`, `"block"` | `"warn"` | How to handle out-of-scope file edits |
| `allow_new_files` | `true`, `false` | `true` | Allow creating new files in allowed directories |
| `allow_test_files` | `true`, `false` | `true` | Allow test files (*.test.*, *.spec.*) alongside allowed source |
| `exceptions` | array of globs | `["*.md", ".planning/**"]` | File patterns always allowed regardless of scope |

**Mode behavior:**
- `"off"`: No scope checking (exploratory work)
- `"warn"`: Log to scope-violations.json but allow (visibility)
- `"block"`: Prevent edit, agent must request scope change (strict)

**Requires hook installation.** See `~/.claude/get-shit-done/templates/hooks/scope-check.md`.
```
</action>
  <verify>grep "scope_enforcement" get-shit-done/templates/config.md shows new section</verify>
  <done>Config template includes scope_enforcement schema</done>
</task>

<task type="auto">
  <name>Task 4: Update execute-plan to set environment variable</name>
  <files>get-shit-done/workflows/execute-plan.md</files>
  <action>Add step to set GSD_CURRENT_PLAN environment variable before spawning subagent.

Find the subagent spawn section (where Task tool is called). Add instruction:

```markdown
## Scope Enforcement Context

Before spawning subagent, set environment variable for scope hook:

```bash
export GSD_CURRENT_PLAN=".planning/phases/{phase}/{plan}-PLAN.md"
```

This enables the scope-check.py hook (if installed) to read plan's files_modified.

Note: If hook is not installed, this has no effect (graceful degradation).
```

This should be added as guidance in the spawn instruction, not as a separate step.

Also add note in the init section about scope enforcement being opt-in:

```markdown
**Optional: Scope Enforcement**
If `.claude/hooks/scope-check.py` is installed, file edits will be checked against plan's `files_modified`. See `~/.claude/get-shit-done/templates/hooks/scope-check.md` for setup.
```
</action>
  <verify>grep "GSD_CURRENT_PLAN" get-shit-done/workflows/execute-plan.md shows environment variable instruction</verify>
  <done>Execute-plan workflow sets environment variable for scope hook</done>
</task>

<task type="auto">
  <name>Task 5: Create scope enforcement reference documentation</name>
  <files>get-shit-done/references/scope-enforcement.md</files>
  <action>Create reference documentation explaining scope enforcement philosophy.

```markdown
# Scope Enforcement

## Philosophy

Plans declare what they touch. Subagents honor that declaration.

In parallel execution, file ownership matters:
- Plan 01: `files_modified: [src/auth.ts]`
- Plan 02: `files_modified: [src/users.ts]`
- Both run simultaneously in Wave 1

If Plan 01 also edits `src/utils/helpers.ts` (undeclared), and Plan 02 does too:
- Git merge conflict
- Manual resolution required
- Parallel benefit lost

Scope enforcement prevents this by catching undeclared edits before they happen.

## When to Use

**Use block mode when:**
- Running parallel execution (`/gsd:execute-phase`)
- High confidence in plan file boundaries
- Zero tolerance for scope creep
- Multiple agents touching related code

**Use warn mode when:**
- Solo execution (no conflict risk)
- Gradually introducing enforcement
- Want visibility without disruption
- Plans may need legitimate scope expansion

**Use off mode when:**
- Exploratory/spike work
- Plans intentionally vague
- Single-plan execution
- Debugging scope issues

## Handling Legitimate Scope Expansion

When an agent genuinely needs to edit an undeclared file:

### Option 1: Update Plan (Pre-execution)
Best when you know upfront:
```yaml
files_modified:
  - src/auth.ts
  - src/utils/helpers.ts  # Added
```

### Option 2: Checkpoint (Mid-execution)
When discovered during work:
```xml
<task type="checkpoint:scope-request">
  <what>Need to modify src/utils/helpers.ts</what>
  <why>Auth validation duplicates logic in helpers</why>
  <options>
    1. Expand this plan's scope
    2. Create follow-up plan for refactor
    3. Accept duplication for now
  </options>
</task>
```

### Option 3: Exception Pattern
When file should always be editable:
```json
{
  "scope_enforcement": {
    "exceptions": ["src/utils/helpers.ts"]
  }
}
```

## Integration with Parallel Execution

```
/gsd:execute-phase 3

Wave 1: [Plan 01] [Plan 02] [Plan 03]
         ↓         ↓         ↓
     auth.ts   users.ts  products.ts

Each plan owns its files. Scope hook enforces boundaries.
Wave 2 plans can depend on Wave 1 outputs safely.
```

If Plan 01 attempts `users.ts` (Plan 02's file):
- Block mode: Edit prevented, agent sees error
- Warn mode: Edit allowed, logged for review
- Off mode: No check

## Violation Review

After phase execution, review `.planning/scope-violations.json`:

```json
{
  "violations": [
    {
      "file": "src/utils/helpers.ts",
      "allowed": ["src/auth.ts"],
      "mode": "warn",
      "plan": "03-01-PLAN.md"
    }
  ]
}
```

Violations indicate:
- Plan boundaries need adjustment
- Shared code needs extraction
- File ownership unclear

## Best Practices

1. **Accurate files_modified**: List all files plan will touch
2. **Use directory patterns**: `src/features/auth/**` for flexibility
3. **Start with warn**: Get visibility before blocking
4. **Review violations**: Adjust plans based on actual patterns
5. **Extract shared code**: If multiple plans touch same file, extract to shared module

## Anti-Patterns

**Over-broad exceptions:**
```json
{ "exceptions": ["src/**"] }  // Defeats the purpose
```

**Under-specified plans:**
```yaml
files_modified: []  # No enforcement possible
```

**Ignoring warnings:**
Warn mode violations should inform future planning, not be ignored.
```
</action>
  <verify>File exists with Philosophy, When to Use, and Handling Legitimate Scope Expansion sections</verify>
  <done>Reference documentation explains scope enforcement philosophy and patterns</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] get-shit-done/templates/hooks/scope-check.py exists and is valid Python
- [ ] get-shit-done/templates/hooks/scope-check.md has installation instructions
- [ ] get-shit-done/templates/config.md includes scope_enforcement section
- [ ] get-shit-done/workflows/execute-plan.md sets GSD_CURRENT_PLAN env var
- [ ] get-shit-done/references/scope-enforcement.md explains the pattern
- [ ] Hook is opt-in with graceful degradation when not installed
</verification>

<success_criteria>
- All tasks completed
- Hook script handles all three modes (off/warn/block)
- Documentation clear for setup and configuration
- Integration with execute-plan is non-breaking
- Violations logged for orchestrator visibility
</success_criteria>

<output>
After completion:
1. Create `.planning/contrib/scope-enforcement-SUMMARY.md`
2. Ready for PR to glittercowboy/get-shit-done
</output>
