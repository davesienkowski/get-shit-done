# Thinking Models: Discuss Cluster

Structured reasoning models for the **discuss-phase** and **explore** workflows. Apply these at decision points when gray areas have genuine trade-offs, not on every question. Each model counters a specific documented failure mode.

Source: Curated from [thinking-partner](https://github.com/mattnowdev/thinking-partner) model catalog (150+ models). Selected for direct applicability to GSD discussion and decision-capture workflows.

## Conflict Resolution

Reversibility Test and Constraint Analysis both analyze decisions before discussion begins. Run Reversibility Test FIRST (classify each decision by cost to reverse). Then Constraint Analysis (identify which decision locks down the most other decisions -- discuss that one first). Pre-Mortem applies AFTER initial positions are surfaced, to stress-test the emerging direction.

## 1. Reversibility Test

**Counters:** Spending equal analysis time on decisions that cost little to change and decisions that lock in architecture or user commitments.

For each gray area under discussion, ask: "If we decide this one way and later change our minds, what does the reversal cost?" Classify each decision as REVERSIBLE (low cost to undo -- UI choices, copy, feature flags) or IRREVERSIBLE (high cost -- data model changes, API contracts, foundational library choices). Spend discussion depth proportional to irreversibility. Surface the IRREVERSIBLE decisions to the user explicitly.

## 2. Constraint Analysis

**Counters:** Discussing dependent decisions before the decision that constrains all of them.

Identify which single decision in this discussion locks down the most other decisions. That is the constraining decision -- discuss it first. When one option forecloses or constrains options in another gray area, those gray areas are coupled. Name the coupling explicitly before the user commits to either.

## 3. Pre-Mortem

**Counters:** Optimistic convergence that ignores regret scenarios before commitments are made.

Before finalizing the decisions from this discussion, assume the direction chosen turns out to be wrong six months from now. Name the 3 most likely reasons the user would regret the decision -- wrong assumption about usage, underestimated complexity to change later, dependency on something unstable. If any regret scenario is plausible, surface it before the user commits.

## 4. Inversion

**Counters:** Only considering what makes a decision right, without examining what would make it obviously wrong.

For each proposed direction, invert the question: "What would have to be true for this decision to be clearly wrong?" List those conditions. If any inversion condition is likely or already present, it is a signal to reconsider the direction before committing. Inversion surfaces hidden assumptions faster than direct analysis.

## 5. Second-Order Thinking

**Counters:** Evaluating decisions only by their immediate effects, missing downstream consequences that emerge over time.

For each option, ask: "If we choose this, what happens next?" -- then ask again about that result: "And then what happens?" First-order effects are obvious (e.g., "using library X saves setup time"). Second-order effects are the ones that matter (e.g., "library X's update cadence will force a major migration every 18 months"). Surface at least one second-order consequence for each direction before the user decides.
