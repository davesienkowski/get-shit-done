# External Integrations

**Analysis Date:** 2026-02-13

## APIs & External Services

**Search:**
- Brave Search API - Web search and discovery
  - SDK/Client: Built-in Node.js fetch() API
  - Auth: Environment variable `BRAVE_API_KEY` or `~/.gsd/brave_api_key` (file)
  - Endpoint: `https://api.search.brave.com/res/v1/web/search`
  - Implementation: `get-shit-done/bin/gsd-tools.js` - `websearch` command
  - Configuration: Optional flag in `.planning/config.json` - `brave_search: true/false`
  - Features: Query parameter support with `--limit` and `--freshness` filters

**Context7 (MCP Server):**
- MCP tools: `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`
- Purpose: Query live library documentation during phase research
- Implementation: `agents/gsd-phase-researcher.md`, `agents/gsd-planner.md`
- Usage: Researchers use Context7 for HIGH-trust source (S1) on library APIs and features
- Trust Level: HIGHEST - live docs integrated via MCP

## Data Storage

**Databases:**
- None - GSD is stateless/file-based

**File Storage:**
- Local filesystem only
  - Project planning state: `.planning/` directory
  - Phase directories: `.planning/phases/{N}/`
  - Planning documents: ROADMAP.md, STATE.md, CONTEXT.md, PLAN.md, SUMMARY.md
  - Logs: `.planning/logs/`
  - Notes/todos: `.planning/notes/`, `.planning/todos/`

**Caching:**
- None - All data regenerated from scratch on each run

## Version Control

**Git Integration:**
- Implementation: Native git CLI via `child_process.execSync`
- Location: `get-shit-done/bin/gsd-tools.js` - `execGit()` and `execGitRetry()` functions
- Operations:
  - `git add <files>` - Stage planning documents
  - `git commit -m <message>` - Create commits with structured messages
  - `git rev-parse --short HEAD` - Get commit hashes
  - `git cat-file -t <hash>` - Verify commit objects
- Retry Logic: Handles git lock contention with exponential backoff (max 3 retries)
- Safety Hooks: Pre-Bash hook blocks `git reset --hard` and `git push --force` to main/master

## Authentication & Identity

**Auth Provider:**
- None - GSD itself is auth-agnostic
- The AI runtimes (Claude Code, Cursor/OpenCode, Gemini) handle authentication
- Brave Search auth: API key only (no session/OAuth)

## Monitoring & Observability

**Error Tracking:**
- None - Built-in logging only

**Logs:**
- Approach:
  - Event logging: `.planning/logs/events.jsonl` (structured events)
  - Session tracking: `.planning/logs/sessions.jsonl`
  - Audit: `.planning/logs/hooks.log` (hook execution log)
  - Progress: `.PROGRESS-{plan_id}` breadcrumb files
- Implementation: `get-shit-done/bin/gsd-tools.js` - `event log`, `event session-start/end`
- Hook Logs: Hooks output to hook-logger (PreToolUse/PostToolUse dispatch)

## CI/CD & Deployment

**Hosting:**
- npm package registry (npmjs.org)

**Installation Channels:**
- npm: `npm install -g get-shit-done-cc` (global)
- npm: `npm install --save-dev get-shit-done-cc` (project-local)

**CI Pipeline:**
- GitHub Actions (if configured in `.github/workflows/`)
- Manual: `npm run build:hooks` before `npm publish`

**Pre-Publish Hook:**
- Ensures hooks are bundled to `hooks/dist/` before package is published

## Environment Configuration

**Required env vars:**
- None (all optional)

**Optional env vars:**
- `BRAVE_API_KEY` - Brave Search API key for web search
- `OPENCODE_CONFIG_DIR` - Cursor/OpenCode config directory
- `OPENCODE_CONFIG` - Cursor/OpenCode config file path
- `GEMINI_CONFIG_DIR` - Google Gemini CLI config directory
- `CLAUDE_CONFIG_DIR` - Claude Code config directory (for non-standard installs)
- `XDG_CONFIG_HOME` - Linux/macOS XDG Base Directory location

**Secrets location:**
- `~/.gsd/brave_api_key` - Brave API key (file-based fallback if env var not set)
- Never committed to repo (`.gitignore` excludes `.env`, `.gsd/`)

## Webhooks & Callbacks

**Incoming:**
- None - GSD is not a server

**Outgoing:**
- Pre-Bash dispatch hooks - Intercepts bash commands before execution
- Pre-Write dispatch hooks - Intercepts file writes before execution
- Post-Write dispatch hooks - Validates files after writing
- Hook implementation: Hooks run in subprocess, communicate via JSON on stdin/stdout
- Hook list: ~18 hooks for safety, validation, and workflow enforcement

## AI Model Integrations

**Runtimes (Targets for Installation):**
- Claude Code - Primary target
- Cursor/OpenCode - Secondary target
- Google Gemini CLI - Secondary target

**Model Resolution:**
- Configuration: `.planning/config.json` - `model_profile` (quality|balanced|budget)
- Profile Table in `gsd-tools.js` - Maps agent name to model selection
- Example mapping:
  - `gsd-planner`: quality→opus, balanced→opus, budget→sonnet
  - `gsd-codebase-mapper`: quality→sonnet, balanced→haiku, budget→haiku

**MCP Server Integration:**
- Context7 (live documentation lookup) via MCP
- Brave Search (optional, via API)
- Agents use WebFetch and WebSearch tools for doc retrieval

## Tool Ecosystem Integration

**Installed as Plugin/Extension:**
- Agents: `.claude/agents/` (or `.opencode/agents/`, `.gemini/agents/`)
- Hooks: `.claude/hooks/` (or equivalents) - auto-activated by Claude Code/Cursor/Gemini
- Commands: `.claude/commands/` (or equivalents) - CLI tools available in chat

**Hook System:**
- PreToolUse - Validates/blocks dangerous bash commands, enforces workflow order
- PostToolUse - Validates written files (PLAN.md, SUMMARY.md format)
- Hooks communicate via JSON stdin/stdout

**Command System:**
- ~20+ commands under `/gsd/` namespace
- Examples: `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:map-codebase`, `/gsd:verify-work`

## Third-Party Documentation Sources

**Integration Points:**
- Context7 MCP server - Live library documentation
- WebFetch tool - Official docs, READMEs, changelogs
- WebSearch tool - Ecosystem discovery, community patterns
- Brave Search API (optional) - Independent search index for higher-quality results

**Trust Hierarchy (in RESEARCH.md):**
- S1: Context7 / MCP Docs (HIGHEST)
- S2: Official docs via WebFetch (HIGH)
- S4: WebSearch Verified (MEDIUM)
- S5: WebSearch Unverified (LOW)
- S6: Training knowledge (LOWEST - requires disclaimer)

---

*Integration audit: 2026-02-13*
