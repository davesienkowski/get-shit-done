# Plan: GSD Command Routing Rules File

## Summary

Create an always-loaded rules file that teaches Claude about GSD commands so it can proactively route users to the right `/gsd:*` command based on project state and user intent.

## GSD Alignment

**Core philosophy match: "Solo developer + Claude workflow"**
GSD's value proposition is that one person with Claude builds software systematically. But right now, the user must already know the command system to use it. A new user faces 28 commands with no guidance until they run `/gsd:help`. This rules file makes Claude the guide — the user describes intent in natural language and Claude routes them. The complexity stays in the system, not the user's workflow.

**Context engineering**
The rules file is ~60 lines. It loads into every conversation but stays compact — well within the "0-30% peak quality" zone from GSD-STYLE.md. It condenses the 480-line help reference into a scannable decision tree Claude can act on without consuming user-facing context.

**Progressive disclosure**
The rules file is the lightest layer — just routing awareness. It points to commands, which delegate to workflows, which reference templates. Matches the GSD hierarchy: "Command: should I use this? -> Workflow: what happens? -> Template: what does output look like?"

**No enterprise patterns**
No onboarding flow, no wizard, no tutorial system. Just a compact routing table that makes Claude aware of what exists. Users describe what they want; Claude suggests one command with one reason.

**Plans as prompts**
The rules file IS a prompt — it teaches Claude behavior. Same pattern as every other GSD file: the file is both implementation and specification.

## Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `rules/gsd-routing.md` | Routing rules content (~60 lines) |
| MODIFY | `bin/install.js` | Install rules to `.claude/rules/`, uninstall cleanup |
| MODIFY | `package.json` | Add `"rules"` to `files` array for npm publish |

## Step 1: Create `rules/gsd-routing.md`

New top-level `rules/` directory (parallel to `commands/`, `agents/`, `get-shit-done/`).

Content has 4 sections:
1. **Activation guard** — Only activate when `.planning/` exists or user asks about project planning
2. **State detection table** — Map filesystem state to correct command (no `.planning/` -> `new-project`, has plans without summaries -> `execute-phase`, etc.)
3. **Intent routing table** — Map natural language ("debug", "what's next", "quick fix") to commands
4. **Behavioral guidance** — Suggest one command with one reason, recommend `/clear` before heavy commands, default to `/gsd:progress` when ambiguous

Target: ~60 content lines. Concise because it loads into every conversation.

## Step 2: Update `package.json`

Add `"rules"` to the `files` array (line 14, after `"scripts"`).

## Step 3: Update `bin/install.js` — Install

Insert after agents block (~line 1182), before CHANGELOG copy. Claude-only (skip OpenCode/Gemini).

Key behavior:
- Create `rules/` dir if missing (`fs.mkdirSync recursive`)
- Remove only `gsd-*.md` files (preserve user's own rules)
- Copy new rules with path replacement and attribution processing
- Log: `Installed N rules`

## Step 4: Update `bin/install.js` — Uninstall

Insert after agents uninstall (~line 849). Same `gsd-*.md` only pattern.
Remove gsd-*.md only, preserve user files.

## Safety

- Never delete the `rules/` directory itself — users may have their own rules
- Only touch `gsd-*.md` files (same convention as agents with `gsd-*.md`)
- OpenCode/Gemini skip — no rules concept in those runtimes
- Idempotent — re-running install replaces GSD rules cleanly

## Verification

1. Run `node bin/install.js --claude --global` — check `~/.claude/rules/gsd-routing.md` exists
2. Create a dummy `~/.claude/rules/my-rule.md` — re-install — verify it survives
3. Run `node bin/install.js --claude --global --uninstall` — verify `gsd-routing.md` removed, `my-rule.md` preserved
4. Run `node bin/install.js --opencode --global` — verify no `rules/` created
