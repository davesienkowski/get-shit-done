<planning_config>

Configuration options for `.planning/` directory behavior.

<config_schema>
```json
"planning": {
  "commit_docs": true,
  "search_gitignored": false
},
"git": {
  "branching_strategy": "none",
  "base_branch": null,
  "phase_branch_template": "gsd/phase-{phase}-{slug}",
  "milestone_branch_template": "gsd/{milestone}-{slug}",
  "quick_branch_template": null
},
"manager": {
  "flags": {
    "discuss": "",
    "plan": "",
    "execute": ""
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `commit_docs` | `true` | Whether to commit planning artifacts to git |
| `search_gitignored` | `false` | Add `--no-ignore` to broad rg searches |
| `git.branching_strategy` | `"none"` | Git branching approach: `"none"`, `"phase"`, or `"milestone"` |
| `git.base_branch` | `null` (auto-detect) | Target branch for PRs and merges (e.g. `"master"`, `"develop"`). When `null`, auto-detects from `git symbolic-ref refs/remotes/origin/HEAD`, falling back to `"main"`. |
| `git.phase_branch_template` | `"gsd/phase-{phase}-{slug}"` | Branch template for phase strategy |
| `git.milestone_branch_template` | `"gsd/{milestone}-{slug}"` | Branch template for milestone strategy |
| `git.quick_branch_template` | `null` | Optional branch template for quick-task runs |
| `workflow.use_worktrees` | `true` | Whether executor agents run in isolated git worktrees. Set to `false` to disable worktrees — agents execute sequentially on the main working tree instead. Recommended for solo developers or when worktree merges cause issues. |
| `workflow.subagent_timeout` | `300000` | Timeout in milliseconds for parallel subagent tasks (e.g. codebase mapping). Increase for large codebases or slower models. Default: 300000 (5 minutes). |
| `manager.flags.discuss` | `""` | Flags passed to `/gsd-discuss-phase` when dispatched from manager (e.g. `"--auto --analyze"`) |
| `manager.flags.plan` | `""` | Flags passed to plan workflow when dispatched from manager |
| `manager.flags.execute` | `""` | Flags passed to execute workflow when dispatched from manager |
| `response_language` | `null` | Language for user-facing questions and prompts across all phases/subagents (e.g. `"Portuguese"`, `"Japanese"`, `"Spanish"`). When set, all spawned agents include a directive to respond in this language. |
</config_schema>

<complete_field_reference>

## Complete Field Reference

Every field recognized by `config.json`, sourced from `CONFIG_DEFAULTS` in `core.cjs` and `VALID_CONFIG_KEYS` in `config.cjs`. Fields can be set via `config-set` CLI or edited directly in `.planning/config.json`.

### Top-Level Fields

| Field | Type | Default | Allowed Values | Description |
|-------|------|---------|----------------|-------------|
| `model_profile` | string | `"balanced"` | `"quality"`, `"balanced"`, `"budget"` | Controls which Claude model each agent uses. `quality` = Opus everywhere, `balanced` = Opus for planner + Sonnet elsewhere, `budget` = Sonnet/Haiku. |
| `commit_docs` | boolean | `true` | `true`, `false` | Whether to commit `.planning/` artifacts to git. Auto-detected as `false` when `.planning/` is gitignored. |
| `search_gitignored` | boolean | `false` | `true`, `false` | Add `--no-ignore` to broad ripgrep searches so `.planning/` files are included. |
| `parallelization` | boolean | `true` | `true`, `false` | Enable parallel execution of independent phase plans (wave-based). Also accepts `{ "enabled": true }` object form. |
| `brave_search` | boolean | `false` | `true`, `false` | Auto-detected from `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file. Enables web search in research phases. |
| `firecrawl` | boolean | `false` | `true`, `false` | Auto-detected from `FIRECRAWL_API_KEY` env var or `~/.gsd/firecrawl_api_key` file. Enables web crawling. |
| `exa_search` | boolean | `false` | `true`, `false` | Auto-detected from `EXA_API_KEY` env var or `~/.gsd/exa_api_key` file. Enables Exa semantic search. |
| `project_code` | string or null | `null` | Any short string (e.g. `"CK"`) | Optional prefix for phase directories. When set, dirs are named `CK-01-foundation` instead of `01-foundation`. |
| `phase_naming` | string | `"sequential"` | `"sequential"`, `"custom"` | `sequential` auto-increments phase numbers. `custom` allows arbitrary string IDs for phases. |
| `context_window` | number | `200000` | Any positive integer | Context window size in tokens. Set to `1000000` for Opus/Sonnet 4.6 1M models. |
| `resolve_model_ids` | boolean or string | `false` | `true`, `false`, `"omit"` | `false`: return model alias as-is. `true`: map alias to full Claude model ID. `"omit"`: return empty string (runtime uses its default). |
| `response_language` | string or null | `null` | Any language name (e.g. `"Portuguese"`) | When set, all spawned agents respond in this language. |

### Workflow Fields

Set via `workflow.` prefix (e.g. `workflow.research`). In config.json, nest under `"workflow": { ... }` or use flat keys.

| Field | Type | Default | Allowed Values | Description |
|-------|------|---------|----------------|-------------|
| `workflow.research` | boolean | `true` | `true`, `false` | Run research phase before planning. Disable to skip research for well-understood domains. |
| `workflow.plan_check` | boolean | `true` | `true`, `false` | Run plan-checker agent after plan generation. Disable to skip automated plan review. |
| `workflow.verifier` | boolean | `true` | `true`, `false` | Run verifier agent after phase execution. Disable to skip automated verification. |
| `workflow.nyquist_validation` | boolean | `true` | `true`, `false` | Generate Nyquist validation criteria during planning. |
| `workflow.auto_advance` | boolean | `false` | `true`, `false` | Automatically advance to next phase after successful verification. |
| `workflow.node_repair` | boolean | `true` | `true`, `false` | Attempt automatic repair when executor encounters errors. |
| `workflow.node_repair_budget` | number | `2` | Any positive integer | Maximum repair attempts before failing the task. |
| `workflow.ui_phase` | boolean | `true` | `true`, `false` | Generate UI-SPEC.md for frontend phases. |
| `workflow.ui_safety_gate` | boolean | `true` | `true`, `false` | Require UI safety review before executing frontend phases. |
| `workflow.text_mode` | boolean | `false` | `true`, `false` | Use plain-text numbered lists instead of AskUserQuestion menus. Useful for terminals that don't support interactive prompts. |
| `workflow.research_before_questions` | boolean | `false` | `true`, `false` | Run codebase research before asking discuss-phase questions. Produces more informed questions but takes longer. |
| `workflow.discuss_mode` | string | `"discuss"` | `"discuss"` | Controls discuss-phase behavior. Currently only `"discuss"` is supported. |
| `workflow.skip_discuss` | boolean | `false` | `true`, `false` | Skip the discuss phase entirely. Use when phase requirements are already well-defined. |
| `workflow.use_worktrees` | boolean | `true` | `true`, `false` | Run executor agents in isolated git worktrees. Set `false` for solo developers or when worktree merges cause issues. |
| `workflow.subagent_timeout` | number | `300000` | Any positive integer (ms) | Timeout for parallel subagent tasks. Increase for large codebases or slower models. Default: 5 minutes. |
| `workflow._auto_chain_active` | boolean | (internal) | `true`, `false` | Internal flag set during `--chain` workflows. Do not set manually. |

### Git Fields

Set via `git.` prefix. In config.json, nest under `"git": { ... }` or use flat keys.

| Field | Type | Default | Allowed Values | Description |
|-------|------|---------|----------------|-------------|
| `git.branching_strategy` | string | `"none"` | `"none"`, `"phase"`, `"milestone"` | Controls branch creation during execution. See Branching Strategy Behavior section below. |
| `git.base_branch` | string or null | `null` | Any branch name | Target branch for PRs/merges. `null` auto-detects from `refs/remotes/origin/HEAD`, falls back to `"main"`. |
| `git.phase_branch_template` | string | `"gsd/phase-{phase}-{slug}"` | Template with `{phase}` and `{slug}` | Branch name template when `branching_strategy: "phase"`. |
| `git.milestone_branch_template` | string | `"gsd/{milestone}-{slug}"` | Template with `{milestone}` and `{slug}` | Branch name template when `branching_strategy: "milestone"`. |
| `git.quick_branch_template` | string or null | `null` | Template string or `null` | Optional branch template for `/gsd-quick` task runs. |

### Planning Fields

Set via `planning.` prefix. In config.json, nest under `"planning": { ... }`.

| Field | Type | Default | Allowed Values | Description |
|-------|------|---------|----------------|-------------|
| `planning.commit_docs` | boolean | `true` | `true`, `false` | Alias for top-level `commit_docs`. Nested form preferred in new configs. |
| `planning.search_gitignored` | boolean | `false` | `true`, `false` | Alias for top-level `search_gitignored`. Nested form preferred in new configs. |

### Manager Fields

Set via `manager.flags.` prefix. Controls flags passed to workflows when dispatched from `/gsd-manager`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `manager.flags.discuss` | string | `""` | Flags for `/gsd-discuss-phase` (e.g. `"--auto --analyze"`). |
| `manager.flags.plan` | string | `""` | Flags for plan workflow. |
| `manager.flags.execute` | string | `""` | Flags for execute workflow. |

### Hooks Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hooks.context_warnings` | boolean | `true` | Show context-size warnings when approaching token limits. |

### Agent Skills

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `agent_skills.<agent-type>` | any | `{}` | Per-agent skill configuration. The `<agent-type>` is freeform (e.g. `agent_skills.gsd-executor`). |

</complete_field_reference>

<validation_rules>

## Validation Rules

### Key Validation

The `config-set` command validates keys against `VALID_CONFIG_KEYS`. Unknown keys are rejected with an error listing all valid keys. Common misspellings are caught with suggestions:

| Mistyped Key | Suggested Correction |
|-------------|---------------------|
| `workflow.nyquist_validation_enabled` | `workflow.nyquist_validation` |
| `agents.nyquist_validation_enabled` | `workflow.nyquist_validation` |
| `nyquist.validation_enabled` | `workflow.nyquist_validation` |
| `hooks.research_questions` | `workflow.research_before_questions` |
| `workflow.research_questions` | `workflow.research_before_questions` |

### Value Parsing

Values passed to `config-set` are automatically parsed:

| Input | Parsed As | Type |
|-------|-----------|------|
| `"true"` | `true` | boolean |
| `"false"` | `false` | boolean |
| `"42"` | `42` | number |
| `"300000"` | `300000` | number |
| `"none"` | `"none"` | string |
| `'[1,2,3]'` | `[1,2,3]` | array (JSON-parsed) |
| `'{"a":1}'` | `{"a":1}` | object (JSON-parsed) |

### Unknown Key Warnings

When loading config, unrecognized top-level keys produce a stderr warning:

```
gsd-tools: warning: unknown config key(s) in .planning/config.json: myCustomKey — these will be ignored
```

Known top-level containers (`git`, `workflow`, `planning`, `hooks`, `agent_skills`) are always accepted. Deprecated keys (`depth`, `multiRepo`) are silently migrated.

### Deprecated Key Migration

| Deprecated Key | Migrated To | Value Mapping |
|---------------|-------------|---------------|
| `depth: "quick"` | `granularity: "coarse"` | `quick` -> `coarse`, `standard` -> `standard`, `comprehensive` -> `fine` |
| `multiRepo: true` | `sub_repos: [...]` | Auto-detects child directories with `.git` |

Migration is automatic on config load and persists the updated config.json.

### Flat vs Nested Keys

Both formats are accepted. `loadConfig()` checks flat keys first, then nested:

```json
// Flat (legacy, still supported)
{ "commit_docs": true, "branching_strategy": "phase" }

// Nested (preferred)
{ "planning": { "commit_docs": true }, "git": { "branching_strategy": "phase" } }
```

When both exist, the flat key takes precedence.

</validation_rules>

<field_interactions>

## Field Interactions

### commit_docs + .gitignore Auto-Detection

When `commit_docs` is not explicitly set in config.json and `.planning/` is listed in `.gitignore`, `commit_docs` automatically resolves to `false`. Explicit `true` in config overrides this auto-detection.

### branching_strategy + branch templates

Branch templates are only used when `branching_strategy` matches:
- `phase_branch_template` only applies when `branching_strategy: "phase"`
- `milestone_branch_template` only applies when `branching_strategy: "milestone"`
- `quick_branch_template` only applies to `/gsd-quick` runs regardless of strategy

### model_profile + model_overrides

`model_profile` sets the baseline model for all agents. `model_overrides` (object, not exposed via `config-set`) can override specific agents:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus"
  }
}
```

### brave_search + firecrawl + exa_search

These are auto-detected from environment variables or `~/.gsd/` key files during `config-new-project`. Setting them to `true` manually without the corresponding API key will not enable the feature — the research agents check for actual key availability at runtime.

### parallelization + use_worktrees

When `parallelization: true` and `use_worktrees: true` (both defaults), executor agents run in parallel git worktrees. Setting either to `false` forces sequential execution on the main working tree.

### context_window + model_profile

The `context_window` field should match your actual model's context limit. When using 1M context models (Opus/Sonnet 4.6 with 1M context), set to `1000000`. The default `200000` is for standard context models.

</field_interactions>

<example_configurations>

## Example Configurations

### Solo Developer with 1M Context

```json
{
  "model_profile": "quality",
  "context_window": 1000000,
  "parallelization": true,
  "commit_docs": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true,
    "use_worktrees": false,
    "skip_discuss": false
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

### Budget-Conscious Developer

```json
{
  "model_profile": "budget",
  "context_window": 200000,
  "parallelization": false,
  "commit_docs": true,
  "workflow": {
    "research": false,
    "plan_check": false,
    "verifier": true,
    "nyquist_validation": false,
    "ui_phase": false,
    "use_worktrees": false,
    "node_repair_budget": 1
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

### CI/CD Pipeline

```json
{
  "model_profile": "balanced",
  "context_window": 200000,
  "parallelization": true,
  "commit_docs": false,
  "search_gitignored": true,
  "workflow": {
    "research": false,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true,
    "skip_discuss": true,
    "text_mode": true,
    "use_worktrees": true,
    "subagent_timeout": 600000
  },
  "git": {
    "branching_strategy": "milestone",
    "base_branch": "main"
  }
}
```

### Team Collaboration with Phase Branches

```json
{
  "model_profile": "balanced",
  "commit_docs": true,
  "parallelization": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "ui_safety_gate": true,
    "use_worktrees": true
  },
  "git": {
    "branching_strategy": "phase",
    "base_branch": "develop",
    "phase_branch_template": "gsd/phase-{phase}-{slug}"
  },
  "manager": {
    "flags": {
      "discuss": "--auto",
      "plan": "",
      "execute": ""
    }
  }
}
```

### OSS Contribution (Private Planning)

```json
{
  "model_profile": "balanced",
  "commit_docs": false,
  "search_gitignored": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "use_worktrees": false
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

Pair with `.gitignore`:
```
.planning/
```

</example_configurations>

<commit_docs_behavior>

**When `commit_docs: true` (default):**
- Planning files committed normally
- SUMMARY.md, STATE.md, ROADMAP.md tracked in git
- Full history of planning decisions preserved

**When `commit_docs: false`:**
- Skip all `git add`/`git commit` for `.planning/` files
- User must add `.planning/` to `.gitignore`
- Useful for: OSS contributions, client projects, keeping planning private

**Using gsd-tools.cjs (preferred):**

```bash
# Commit with automatic commit_docs + gitignore checks:
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md

# Load config via state load (returns JSON):
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs is available in the JSON output

# Or use init commands which include commit_docs:
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# commit_docs is included in all init command outputs
```

**Auto-detection:** If `.planning/` is gitignored, `commit_docs` is automatically `false` regardless of config.json. This prevents git errors when users have `.planning/` in `.gitignore`.

**Commit via CLI (handles checks automatically):**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: update state" --files .planning/STATE.md
```

The CLI checks `commit_docs` config and gitignore status internally — no manual conditionals needed.

</commit_docs_behavior>

<search_behavior>

**When `search_gitignored: false` (default):**
- Standard rg behavior (respects .gitignore)
- Direct path searches work: `rg "pattern" .planning/` finds files
- Broad searches skip gitignored: `rg "pattern"` skips `.planning/`

**When `search_gitignored: true`:**
- Add `--no-ignore` to broad rg searches that should include `.planning/`
- Only needed when searching entire repo and expecting `.planning/` matches

**Note:** Most GSD operations use direct file reads or explicit paths, which work regardless of gitignore status.

</search_behavior>

<setup_uncommitted_mode>

To use uncommitted mode:

1. **Set config:**
   ```json
   "planning": {
     "commit_docs": false,
     "search_gitignored": true
   }
   ```

2. **Add to .gitignore:**
   ```
   .planning/
   ```

3. **Existing tracked files:** If `.planning/` was previously tracked:
   ```bash
   git rm -r --cached .planning/
   git commit -m "chore: stop tracking planning docs"
   ```

4. **Branch merges:** When using `branching_strategy: phase` or `milestone`, the `complete-milestone` workflow automatically strips `.planning/` files from staging before merge commits when `commit_docs: false`.

</setup_uncommitted_mode>

<branching_strategy_behavior>

**Branching Strategies:**

| Strategy | When branch created | Branch scope | Merge point |
|----------|---------------------|--------------|-------------|
| `none` | Never | N/A | N/A |
| `phase` | At `execute-phase` start | Single phase | User merges after phase |
| `milestone` | At first `execute-phase` of milestone | Entire milestone | At `complete-milestone` |

**When `git.branching_strategy: "none"` (default):**
- All work commits to current branch
- Standard GSD behavior

**When `git.branching_strategy: "phase"`:**
- `execute-phase` creates/switches to a branch before execution
- Branch name from `phase_branch_template` (e.g., `gsd/phase-03-authentication`)
- All plan commits go to that branch
- User merges branches manually after phase completion
- `complete-milestone` offers to merge all phase branches

**When `git.branching_strategy: "milestone"`:**
- First `execute-phase` of milestone creates the milestone branch
- Branch name from `milestone_branch_template` (e.g., `gsd/v1.0-mvp`)
- All phases in milestone commit to same branch
- `complete-milestone` offers to merge milestone branch to main

**Template variables:**

| Variable | Available in | Description |
|----------|--------------|-------------|
| `{phase}` | phase_branch_template | Zero-padded phase number (e.g., "03") |
| `{slug}` | Both | Lowercase, hyphenated name |
| `{milestone}` | milestone_branch_template | Milestone version (e.g., "v1.0") |

**Checking the config:**

Use `init execute-phase` which returns all config as JSON:
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# JSON output includes: branching_strategy, phase_branch_template, milestone_branch_template
```

Or use `state load` for the config values:
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Parse branching_strategy, phase_branch_template, milestone_branch_template from JSON
```

**Branch creation:**

```bash
# For phase strategy
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  PHASE_SLUG=$(echo "$PHASE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$PHASE_BRANCH_TEMPLATE" | sed "s/{phase}/$PADDED_PHASE/g" | sed "s/{slug}/$PHASE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi

# For milestone strategy
if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  MILESTONE_SLUG=$(echo "$MILESTONE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  BRANCH_NAME=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed "s/{milestone}/$MILESTONE_VERSION/g" | sed "s/{slug}/$MILESTONE_SLUG/g")
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
fi
```

**Merge options at complete-milestone:**

| Option | Git command | Result |
|--------|-------------|--------|
| Squash merge (recommended) | `git merge --squash` | Single clean commit per branch |
| Merge with history | `git merge --no-ff` | Preserves all individual commits |
| Delete without merging | `git branch -D` | Discard branch work |
| Keep branches | (none) | Manual handling later |

Squash merge is recommended — keeps main branch history clean while preserving the full development history in the branch (until deleted).

**Use cases:**

| Strategy | Best for |
|----------|----------|
| `none` | Solo development, simple projects |
| `phase` | Code review per phase, granular rollback, team collaboration |
| `milestone` | Release branches, staging environments, PR per version |

</branching_strategy_behavior>

</planning_config>
