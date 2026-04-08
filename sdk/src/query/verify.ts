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
import { extractFrontmatter } from './frontmatter.js';
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
