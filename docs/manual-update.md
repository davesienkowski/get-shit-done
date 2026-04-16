# Manual Update (Non-npm Install)

Use this procedure when `npx get-shit-done-cc@latest` is unavailable — e.g. during a publish outage or if you are working directly from the source repo.

## Prerequisites

- Node.js installed
- This repo cloned locally (`git clone https://github.com/gsd-build/get-shit-done`)

## Steps

```bash
# 1. Pull latest code
git pull --rebase origin main

# 2. Build the hooks dist (required — hooks/dist/ is generated, not checked in as source)
node scripts/build-hooks.js

# 3. Run the installer directly (also builds and installs @gsd-build/sdk / gsd-sdk globally when sdk/ is present)
node bin/install.js --claude --global

# 4. Clear the update cache so the statusline indicator resets
rm -f ~/.cache/gsd/gsd-update-check.json
```

**Step 5 — Restart your runtime** to pick up the new commands and agents.

### `@gsd-build/sdk` (`gsd-sdk`) — required for workflows

Slash-command workflows read project settings with `gsd-sdk query …` (for example `gsd-sdk query config-get`). The main `get-shit-done-cc` package does not ship the SDK; you need the `gsd-sdk` CLI on your `PATH`.

**After a manual update from this repo**, `node bin/install.js` runs `npm install`, `npm run build`, and `npm install -g` inside `sdk/` when that directory exists, so `gsd-sdk` matches the workflows you just installed.

**If you skip the installer** or need to refresh the SDK only:

```bash
cd sdk
npm install
npm run build
npm install -g .
# or: npm link
```

**After an npm release**, you can instead run `npm install -g @gsd-build/sdk@latest`.

Set `GSD_SKIP_SDK_INSTALL=1` when invoking `node bin/install.js` if you must skip the automatic SDK global install (CI or air-gapped environments).

### Loud config reads

Workflows use `get-shit-done/bin/gsd-config-get.cjs` for `config-get` so a missing or outdated `gsd-sdk` fails with a clear message instead of silently falling back to defaults (see issue #2309).

## Runtime flags

Replace `--claude` with the flag for your runtime:

| Runtime | Flag |
|---|---|
| Claude Code | `--claude` |
| Gemini CLI | `--gemini` |
| OpenCode | `--opencode` |
| Kilo | `--kilo` |
| Codex | `--codex` |
| Copilot | `--copilot` |
| Cursor | `--cursor` |
| Windsurf | `--windsurf` |
| Augment | `--augment` |
| All runtimes | `--all` |

Use `--local` instead of `--global` for a project-scoped install.

## What the installer replaces

The installer performs a clean wipe-and-replace of GSD-managed directories only:

- `~/.claude/get-shit-done/` — workflows, references, templates (includes `bin/gsd-config-get.cjs`)
- `~/.claude/commands/gsd/` — slash commands
- `~/.claude/agents/gsd-*.md` — GSD agents
- `~/.claude/hooks/dist/` — compiled hooks

It also installs the **`gsd-sdk`** CLI globally from `sdk/` when you run the installer from a repository checkout (see **`@gsd-build/sdk`** above).

**What is preserved:**
- Custom agents not prefixed with `gsd-`
- Custom commands outside `commands/gsd/`
- Your `CLAUDE.md` files
- Custom hooks

Locally modified GSD files are automatically backed up to `gsd-local-patches/` before the install. Run `/gsd-reapply-patches` after updating to merge your modifications back in.
