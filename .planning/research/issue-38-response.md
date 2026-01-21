# Draft Response for Issue #38

---

Thanks for this feature request. It sparked a useful exploration.

## Quick note on `plan_mode_required`

After checking the official Claude Code changelog and GitHub repo, this parameter doesn't exist. The third-party sites reporting it appear to have AI-generated documentation that hallucinated the feature. No worries - it led to a better conversation.

## Reframing the problem

The original ask was "approval before subagent execution." But thinking through GSD's philosophy, I think the actual need is different:

**New users don't need approval gates - they need visibility.**

The PLAN.md files already contain everything the subagent will do. They're human-readable. But new users:
- Don't know where they are (`.planning/phases/XX-name/`)
- Don't realize they can read them
- Feel like being told "go read the file" is homework

What feels friendlier is Claude presenting a summary **in chat** before execution:

```
════════════════════════════════════════
EXECUTING: 02-01 User Authentication
════════════════════════════════════════

Building: JWT auth with refresh tokens
Tasks: 3 (create middleware, implement signing, add login endpoint)
Files: src/middleware/auth.ts, src/lib/jwt.ts, src/routes/login.ts

Full plan: .planning/phases/02-auth/02-01-PLAN.md
════════════════════════════════════════

Starting execution...
```

**Key differences from the original request:**
- No y/n prompt (not asking permission)
- No new commands
- No subagent prompt changes
- Just visibility before action
- Shows file path so users learn where artifacts live

**Behavior by mode:**
- `interactive`: Show summary, then execute
- `yolo`: Execute immediately, no summary

This is onboarding UX, not oversight. It teaches users how the system works, then gets out of the way when they switch to YOLO.

## Does this align with GSD?

I think yes:
- Complexity stays in the system (orchestrator handles it)
- No new commands to learn
- No config bloat
- Training wheels that disappear when ready
- "A few commands that just work" still holds

The insight: **the plan IS the approval.** If users want to review before execution, they're really asking for the plan to be surfaced in chat - not a deep "what will you do?" analysis.

## Next steps?

If this direction makes sense:
1. I can put together a PR that adds the friendly summary to `execute-plan.md` for interactive mode
2. Small change - just parse PLAN.md frontmatter and present before spawning
3. No subagent changes, no new config

Let me know if you want to explore this further or if the original approval-gate approach is still what you're after.

---

*Research doc: `.planning/research/subagent-plan-approval.md`*
