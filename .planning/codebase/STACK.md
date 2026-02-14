# Technology Stack

**Analysis Date:** 2026-02-13

## Languages

**Primary:**
- JavaScript/Node.js - Entire project, CLIs, hooks, tools
- Bash - Workflows, scripts, command execution
- Markdown - Documentation, templates, planning files

**Secondary:**
- JSON - Configuration, data serialization

## Runtime

**Environment:**
- Node.js >= 16.7.0

**Package Manager:**
- npm (version >=7)
- Lockfile: `package-lock.json` present

## Frameworks & Core Libraries

**Build/Dev:**
- esbuild ^0.24.0 - Bundling for distributed hooks

**CLI Framework:**
- Native Node.js (no external framework) - Custom argument parsing and command dispatch

**Testing:**
- Node.js built-in test runner (`node --test`) - No external test framework dependency

**Runtime/Execution:**
- Child process: `child_process.execSync` - Git operations, bash command execution
- Native fs/path modules - File I/O, path manipulation

## Key Dependencies

**Critical:**
- esbuild ^0.24.0 - Only production dependency; bundles hooks for distribution

**Zero External Runtime Dependencies:**
- The entire GSD tooling operates with Node.js built-ins only
- No npm packages required at runtime after installation
- All tooling uses fs, path, child_process, readline, crypto (Node.js built-ins)

## Configuration

**Environment:**
- `.planning/config.json` - Primary project configuration
- `~/.gsd/brave_api_key` - Optional Brave Search API key (file-based)
- Environment variables:
  - `BRAVE_API_KEY` - Optional Brave Search API key
  - `OPENCODE_CONFIG_DIR` / `OPENCODE_CONFIG` - OpenCode config paths
  - `GEMINI_CONFIG_DIR` - Gemini CLI config location
  - `CLAUDE_CONFIG_DIR` - Claude Code config location
  - `XDG_CONFIG_HOME` - XDG Base Directory standard

**Build:**
- `scripts/build-hooks.js` - Copies hooks to `hooks/dist/` for installation

## Installation Targets

**Three AI Runtimes Supported:**
- Claude Code (`~/.claude/`)
- Cursor/OpenCode (`~/.config/opencode/` or env-specified)
- Google Gemini (`~/.gemini/`)

**Installation Methods:**
- Global: Copies to AI runtime global config directory
- Local: Copies to project `.claude/`, `.opencode/`, `.gemini/`
- Flags: `--global`, `--local`, `--claude`, `--opencode`, `--gemini`, `--all`, `--both`

## File Structure for Distribution

**Bin Directory:**
- `bin/install.js` - CLI entry point for `get-shit-done-cc` npm command

**Core Tool:**
- `get-shit-done/bin/gsd-tools.js` - Main CLI utility (~5000+ lines); provides 50+ subcommands

**Hooks (PreToolUse, PostToolUse):**
- `hooks/*.js` - Pre/post-write, pre/post-bash dispatch, validation hooks
- `hooks/dist/*.js` - Compiled/copied hooks for distribution

**Agents:**
- `agents/*.md` - Agent role definitions with inline instructions

**Templates:**
- `get-shit-done/templates/` - Reference project structures, config examples

**Schemas:**
- `get-shit-done/schemas/` - JSON Schema validation definitions

## Platform Requirements

**Development:**
- Node.js >= 16.7.0
- npm or compatible package manager
- Git (for commit operations)
- Bash-compatible shell
- Any OS: Linux, macOS, Windows (WSL or native bash)

**Installation Target:**
- Requires existing Claude Code, Cursor/OpenCode, or Gemini CLI installation
- Hooks installed into AI runtime config directories for automatic activation

**Runtime Execution:**
- Runs within Claude Code, Cursor/OpenCode, or Gemini CLI contexts
- Spawns bash subprocesses for git operations and external commands
- Uses fetch() API for Brave Search (requires Node.js 18+)

## Build & Distribution

**Publishing:**
- npm package: `get-shit-done-cc`
- Registry: npmjs.org
- Bin command: `get-shit-done-cc` → `bin/install.js`

**Pre-Publish Hook:**
- `prepublishOnly` script runs `npm run build:hooks`
- Copies hooks from `hooks/` to `hooks/dist/` for bundling

**Node Module Footprint:**
- Only esbuild in node_modules (dev dependency)
- Runtime has zero npm dependencies

---

*Stack analysis: 2026-02-13*
