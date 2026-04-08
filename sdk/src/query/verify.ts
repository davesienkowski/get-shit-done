/**
 * Verification query handlers — plan structure, phase completeness, artifact checks.
 *
 * Ported from get-shit-done/bin/lib/verify.cjs.
 * Provides plan validation, phase completeness checking, and artifact verification
 * as native TypeScript query handlers registered in the SDK query registry.
 *
 * @example
 * ```typescript
 * import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts } from './verify.js';
 *
 * const result = await verifyPlanStructure(['path/to/plan.md'], '/project');
 * // { data: { valid: true, errors: [], warnings: [], task_count: 2, ... } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter, parseMustHavesBlock } from './frontmatter.js';
import { normalizePhaseName, phaseTokenMatches, planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── verifyPlanStructure ───────────────────────────────────────────────────

/**
 * Validate plan structure against required schema.
 *
 * Port of `cmdVerifyPlanStructure` from `verify.cjs` lines 108-167.
 * Checks required frontmatter fields, task XML elements, wave/depends_on
 * consistency, and autonomous/checkpoint consistency.
 *
 * @param args - args[0]: file path (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { valid, errors, warnings, task_count, tasks, frontmatter_fields }
 * @throws GSDError with Validation classification if file path missing
 */
export const verifyPlanStructure: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError('file path required', ErrorClassification.Validation);
  }

  // T-12-01: Null byte rejection on file paths
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  const fullPath = isAbsolute(filePath) ? filePath : join(projectDir, filePath);

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  const fm = extractFrontmatter(content);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse and check task elements
  // T-12-03: Use non-greedy [\s\S]*? to avoid catastrophic backtracking
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks: Array<{ name: string; hasFiles: boolean; hasAction: boolean; hasVerify: boolean; hasDone: boolean }> = [];
  let taskMatch: RegExpExecArray | null;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);

    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);

    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  // Wave/depends_on consistency
  if (fm.wave && parseInt(String(fm.wave), 10) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  // Autonomous/checkpoint consistency
  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  return {
    data: {
      valid: errors.length === 0,
      errors,
      warnings,
      task_count: tasks.length,
      tasks,
      frontmatter_fields: Object.keys(fm),
    },
  };
};

// ─── verifyPhaseCompleteness ───────────────────────────────────────────────

/**
 * Check phase completeness by matching PLAN files to SUMMARY files.
 *
 * Port of `cmdVerifyPhaseCompleteness` from `verify.cjs` lines 169-213.
 * Scans a phase directory for PLAN and SUMMARY files, identifies incomplete
 * plans (no summary) and orphan summaries (no plan).
 *
 * @param args - args[0]: phase number (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { complete, phase, plan_count, summary_count, incomplete_plans, orphan_summaries, errors, warnings }
 * @throws GSDError with Validation classification if phase number missing
 */
export const verifyPhaseCompleteness: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }

  const phasesDir = planningPaths(projectDir).phases;
  const normalized = normalizePhaseName(phase);

  // Find phase directory (mirror findPhase pattern from phase.ts)
  let phaseDir: string | null = null;
  let phaseNumber: string = normalized;
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (match) {
      phaseDir = join(phasesDir, match);
      // Extract phase number from directory name
      const numMatch = match.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
      if (numMatch) phaseNumber = numMatch[1];
    }
  } catch { /* phases dir doesn't exist */ }

  if (!phaseDir) {
    return { data: { error: 'Phase not found', phase } };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // List plans and summaries
  let files: string[];
  try {
    files = await readdir(phaseDir);
  } catch {
    return { data: { error: 'Cannot read phase directory' } };
  }

  const plans = files.filter(f => /-PLAN\.md$/i.test(f));
  const summaries = files.filter(f => /-SUMMARY\.md$/i.test(f));

  // Extract plan IDs (everything before -PLAN.md / -SUMMARY.md)
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  // Plans without summaries
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

  // Summaries without plans (orphans)
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) {
    warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  }

  return {
    data: {
      complete: errors.length === 0,
      phase: phaseNumber,
      plan_count: plans.length,
      summary_count: summaries.length,
      incomplete_plans: incompletePlans,
      orphan_summaries: orphanSummaries,
      errors,
      warnings,
    },
  };
};

// ─── verifyArtifacts ───────────────────────────────────────────────────────

/**
 * Verify artifact file existence and content from must_haves.artifacts.
 *
 * Port of `cmdVerifyArtifacts` from `verify.cjs` lines 283-336.
 * Reads must_haves.artifacts from plan frontmatter and checks each artifact
 * for file existence, min_lines, contains, and exports.
 *
 * @param args - args[0]: plan file path (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { all_passed, passed, total, artifacts }
 * @throws GSDError with Validation classification if file path missing
 */
export const verifyArtifacts: QueryHandler = async (args, projectDir) => {
  const planFilePath = args[0];
  if (!planFilePath) {
    throw new GSDError('plan file path required', ErrorClassification.Validation);
  }

  // T-12-01: Null byte rejection on file paths
  if (planFilePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  const fullPath = isAbsolute(planFilePath) ? planFilePath : join(projectDir, planFilePath);

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: planFilePath } };
  }

  const { items: artifacts } = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) {
    return { data: { error: 'No must_haves.artifacts found in frontmatter', path: planFilePath } };
  }

  const results: Array<{ path: string; exists: boolean; issues: string[]; passed: boolean }> = [];

  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue; // skip simple string items
    const artObj = artifact as Record<string, unknown>;
    const artPath = artObj.path as string | undefined;
    if (!artPath) continue;

    const artFullPath = join(projectDir, artPath);
    let exists = false;
    let fileContent = '';

    try {
      fileContent = await readFile(artFullPath, 'utf-8');
      exists = true;
    } catch {
      // File doesn't exist
    }

    const check: { path: string; exists: boolean; issues: string[]; passed: boolean } = {
      path: artPath,
      exists,
      issues: [],
      passed: false,
    };

    if (exists) {
      const lineCount = fileContent.split('\n').length;

      if (artObj.min_lines && lineCount < (artObj.min_lines as number)) {
        check.issues.push(`Only ${lineCount} lines, need ${artObj.min_lines}`);
      }
      if (artObj.contains && !fileContent.includes(artObj.contains as string)) {
        check.issues.push(`Missing pattern: ${artObj.contains}`);
      }
      if (artObj.exports) {
        const exports = Array.isArray(artObj.exports) ? artObj.exports : [artObj.exports];
        for (const exp of exports) {
          if (!fileContent.includes(String(exp))) {
            check.issues.push(`Missing export: ${exp}`);
          }
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  return {
    data: {
      all_passed: passed === results.length,
      passed,
      total: results.length,
      artifacts: results,
    },
  };
};
