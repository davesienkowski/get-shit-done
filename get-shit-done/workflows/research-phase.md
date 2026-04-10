<purpose>
Research how to implement a phase. Spawns gsd-phase-researcher with phase context.

Standalone research command. For most workflows, use `/gsd-plan-phase` which integrates research automatically.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-phase-researcher — Researches technical approaches for a phase
</available_agent_types>

<process>

## Step 0: Resolve Model Profile

@~/.claude/get-shit-done/references/model-profile-resolution.md

Resolve model for:
- `gsd-phase-researcher`

## Step 1: Normalize and Validate Phase

@~/.claude/get-shit-done/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null || true
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Extract: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-researcher 2>/dev/null)
```

## Step 3.5: Surface Seeds and Research Questions

**Surface relevant seeds:**
```bash
ls .planning/seeds/*.md 2>/dev/null || true
```

If seeds exist: read each seed's `trigger_condition` from frontmatter, match against the current phase name and description. Include matching seed content in the researcher prompt's `<additional_context>` so the researcher can investigate ideas that were planted earlier.

**Surface open research questions:**
```bash
cat .planning/research/questions.md 2>/dev/null || true
```

If `questions.md` exists: scan for open questions (those without a `**Resolved:**` annotation) that are relevant to the current phase domain. Include matching questions in the researcher prompt's `<additional_context>` as additional investigation targets.

**If no seeds or questions match:** Skip silently.

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /gsd-discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
Phase description: {description}
{If matching seeds were found: include seed content here}
{If matching research questions were found: include questions here}
</additional_context>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Display summary, offer: Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

## Step 6: Mark Addressed Research Questions

**Skip if:** No research questions were included from Step 3.5.

If open research questions from `.planning/research/questions.md` were folded into the researcher prompt, check the RESEARCH.md output to see which questions were addressed. For each addressed question, append a resolution annotation:

```
**Resolved:** Phase {X} research (2026-XX-XX) — see {PHASE}-RESEARCH.md
```

This prevents future phases from re-investigating questions that have already been answered.

</process>
