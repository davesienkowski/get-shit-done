/**
 * plan.task-structure — structured task / checkpoint / wave metadata from a PLAN.md file.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { parsePlan } from '../plan-parser.js';
import type { QueryHandler } from './utils.js';

/**
 * Args: `<path-to-PLAN.md>` (repo-relative or absolute under projectDir)
 */
export const planTaskStructure: QueryHandler = async (args, projectDir) => {
  const rel = args[0];
  if (!rel) {
    throw new GSDError('PLAN.md path required', ErrorClassification.Validation);
  }

  const path = rel.startsWith('/') || /^[A-Za-z]:\\/.test(rel)
    ? rel
    : resolve(projectDir, rel);

  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    throw new GSDError(`cannot read plan file: ${rel}`, ErrorClassification.Blocked);
  }

  const parsed = parsePlan(content);
  const fm = parsed.frontmatter;
  const checkpoints = parsed.tasks.filter((t) => t.type === 'checkpoint');

  return {
    data: {
      path: rel,
      plan: fm.plan || null,
      phase: fm.phase || null,
      wave: fm.wave ?? 1,
      depends_on: fm.depends_on ?? [],
      autonomous: fm.autonomous !== false,
      task_count: parsed.tasks.length,
      checkpoint_count: checkpoints.length,
      tasks: parsed.tasks.map((t, i) => ({
        index: i + 1,
        type: t.type,
        name: t.name,
        is_checkpoint: t.type === 'checkpoint',
      })),
      checkpoints: checkpoints.map((t, i) => ({
        index: i + 1,
        name: t.name,
      })),
    },
  };
};
