/**
 * Progress query handlers — milestone progress rendering in JSON format.
 *
 * Ported from get-shit-done/bin/lib/commands.cjs (cmdProgressRender, determinePhaseStatus).
 * Provides progress handler that scans disk for plan/summary counts per phase
 * and determines status via VERIFICATION.md inspection.
 *
 * @example
 * ```typescript
 * import { progressJson } from './progress.js';
 *
 * const result = await progressJson([], '/project');
 * // { data: { milestone_version: 'v3.0', phases: [...], total_plans: 6, percent: 83 } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { comparePhaseNum, planningPaths } from './helpers.js';
import { getMilestoneInfo } from './roadmap.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ─────────────────────────────────────────────────────

/**
 * Determine the status of a phase based on plan/summary counts and verification state.
 *
 * Port of determinePhaseStatus from commands.cjs lines 15-36.
 *
 * @param plans - Number of PLAN.md files in the phase directory
 * @param summaries - Number of SUMMARY.md files in the phase directory
 * @param phaseDir - Absolute path to the phase directory
 * @returns Status string: Pending, Planned, In Progress, Executed, Complete, Needs Review
 */
export async function determinePhaseStatus(plans: number, summaries: number, phaseDir: string): Promise<string> {
  if (plans === 0) return 'Pending';
  if (summaries < plans && summaries > 0) return 'In Progress';
  if (summaries < plans) return 'Planned';

  // summaries >= plans — check verification
  try {
    const files = await readdir(phaseDir);
    const verificationFile = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
    if (verificationFile) {
      const content = await readFile(join(phaseDir, verificationFile), 'utf-8');
      if (/status:\s*passed/i.test(content)) return 'Complete';
      if (/status:\s*human_needed/i.test(content)) return 'Needs Review';
      if (/status:\s*gaps_found/i.test(content)) return 'Executed';
      // Verification exists but unrecognized status — treat as executed
      return 'Executed';
    }
  } catch { /* directory read failed — fall through */ }

  // No verification file — executed but not verified
  return 'Executed';
}

// ─── Exported handlers ────────────────────────────────────────────────────

/**
 * Query handler for progress / progress.json.
 *
 * Port of cmdProgressRender (JSON format) from commands.cjs lines 535-597.
 * Scans phases directory, counts plans/summaries, determines status per phase.
 *
 * @param args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with milestone progress data
 */
export const progressJson: QueryHandler = async (_args, projectDir) => {
  const phasesDir = planningPaths(projectDir).phases;
  const milestone = await getMilestoneInfo(projectDir);

  const phases: Array<Record<string, unknown>> = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = await readdir(join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      const status = await determinePhaseStatus(plans, summaries, join(phasesDir, dir));

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch { /* intentionally empty */ }

  const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;

  return {
    data: {
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    },
  };
};
