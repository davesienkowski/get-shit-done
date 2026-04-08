/**
 * Validation query handlers — key-link verification and consistency checking.
 *
 * Ported from get-shit-done/bin/lib/verify.cjs.
 * Provides key-link integration point verification and cross-file consistency
 * detection as native TypeScript query handlers registered in the SDK query registry.
 *
 * @example
 * ```typescript
 * import { verifyKeyLinks, validateConsistency } from './validate.js';
 *
 * const result = await verifyKeyLinks(['path/to/plan.md'], '/project');
 * // { data: { all_verified: true, verified: 1, total: 1, links: [...] } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter, parseMustHavesBlock } from './frontmatter.js';
import { normalizePhaseName, planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── verifyKeyLinks ───────────────────────────────────────────────────────

/**
 * Verify key-link integration points from must_haves.key_links.
 *
 * Port of `cmdVerifyKeyLinks` from `verify.cjs` lines 338-396.
 * Reads must_haves.key_links from plan frontmatter, checks source/target
 * files for pattern matching or target reference presence.
 *
 * @param args - args[0]: plan file path (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { all_verified, verified, total, links }
 * @throws GSDError with Validation classification if file path missing
 */
export const verifyKeyLinks: QueryHandler = async (args, projectDir) => {
  const planFilePath = args[0];
  if (!planFilePath) {
    throw new GSDError('plan file path required', ErrorClassification.Validation);
  }

  // T-12-07: Null byte check on plan file path
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

  const { items: keyLinks } = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    return { data: { error: 'No must_haves.key_links found in frontmatter', path: planFilePath } };
  }

  const results: Array<{ from: string; to: string; via: string; verified: boolean; detail: string }> = [];

  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const linkObj = link as Record<string, unknown>;
    const check = {
      from: (linkObj.from as string) || '',
      to: (linkObj.to as string) || '',
      via: (linkObj.via as string) || '',
      verified: false,
      detail: '',
    };

    let sourceContent: string | null = null;
    try {
      sourceContent = await readFile(join(projectDir, check.from), 'utf-8');
    } catch {
      // Source file not found
    }

    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (linkObj.pattern) {
      // T-12-05: Wrap new RegExp in try/catch
      try {
        const regex = new RegExp(linkObj.pattern as string);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          // Try target file
          let targetContent: string | null = null;
          try {
            targetContent = await readFile(join(projectDir, check.to), 'utf-8');
          } catch {
            // Target file not found
          }
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${linkObj.pattern}" not found in source or target`;
          }
        }
      } catch {
        check.detail = `Invalid regex pattern: ${linkObj.pattern}`;
      }
    } else {
      // No pattern: check if target path is referenced in source content
      if (sourceContent.includes(check.to)) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  return {
    data: {
      all_verified: verified === results.length,
      verified,
      total: results.length,
      links: results,
    },
  };
};

// ─── validateConsistency ─────────────────────────────────────────────────

/**
 * Validate consistency between ROADMAP.md, disk phases, and plan frontmatter.
 *
 * Port of `cmdValidateConsistency` from `verify.cjs` lines 398-519.
 * Checks ROADMAP/disk phase sync, sequential numbering, plan numbering gaps,
 * summary/plan orphans, and frontmatter completeness.
 *
 * @param _args - No required args (operates on projectDir)
 * @param projectDir - Project root directory
 * @returns QueryResult with { passed, errors, warnings, warning_count }
 */
export const validateConsistency: QueryHandler = async (_args, projectDir) => {
  const paths = planningPaths(projectDir);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Read ROADMAP.md
  let roadmapContent: string;
  try {
    roadmapContent = await readFile(paths.roadmap, 'utf-8');
  } catch {
    return { data: { passed: false, errors: ['ROADMAP.md not found'], warnings: [], warning_count: 0 } };
  }

  // Strip shipped milestone <details> blocks
  const activeContent = roadmapContent.replace(/<details>[\s\S]*?<\/details>/gi, '');

  // Extract phase numbers from ROADMAP headings
  const roadmapPhases = new Set<string>();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = phasePattern.exec(activeContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk
  const diskPhases = new Set<string>();
  let diskDirs: string[] = [];
  try {
    const entries = await readdir(paths.phases, { withFileTypes: true });
    diskDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const dir of diskDirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
      if (dm) diskPhases.add(dm[1]);
    }
  } catch {
    // phases directory doesn't exist
  }

  // Check: phases in ROADMAP but not on disk
  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  // Check: phases on disk but not in ROADMAP
  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  // Check sequential phase numbering (skip in custom naming mode)
  let config: Record<string, unknown> = {};
  try {
    const configContent = await readFile(paths.config, 'utf-8');
    config = JSON.parse(configContent) as Record<string, unknown>;
  } catch {
    // config not found or invalid — proceed with defaults
  }

  if (config.phase_naming !== 'custom') {
    const integerPhases = [...diskPhases]
      .filter(p => !p.includes('.'))
      .map(p => parseInt(p, 10))
      .sort((a, b) => a - b);

    for (let i = 1; i < integerPhases.length; i++) {
      if (integerPhases[i] !== integerPhases[i - 1] + 1) {
        warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} \u2192 ${integerPhases[i]}`);
      }
    }
  }

  // Check plan numbering and summaries within each phase
  for (const dir of diskDirs) {
    let phaseFiles: string[];
    try {
      phaseFiles = await readdir(join(paths.phases, dir));
    } catch {
      continue;
    }

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md')).sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));

    // Extract plan numbers and check for gaps
    const planNums = plans.map(p => {
      const pm = p.match(/-(\d{2})-PLAN\.md$/);
      return pm ? parseInt(pm[1], 10) : null;
    }).filter((n): n is number => n !== null);

    for (let i = 1; i < planNums.length; i++) {
      if (planNums[i] !== planNums[i - 1] + 1) {
        warnings.push(`Gap in plan numbering in ${dir}: plan ${planNums[i - 1]} \u2192 ${planNums[i]}`);
      }
    }

    // Check: summaries without matching plans
    const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
    const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));

    for (const sid of summaryIds) {
      if (!planIds.has(sid)) {
        warnings.push(`Summary ${sid}-SUMMARY.md in ${dir} has no matching PLAN.md`);
      }
    }
  }

  // Check frontmatter completeness in plans
  for (const dir of diskDirs) {
    let phaseFiles: string[];
    try {
      phaseFiles = await readdir(join(paths.phases, dir));
    } catch {
      continue;
    }

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));
    for (const plan of plans) {
      try {
        const content = await readFile(join(paths.phases, dir, plan), 'utf-8');
        const fm = extractFrontmatter(content);
        if (!fm.wave) {
          warnings.push(`${dir}/${plan}: missing 'wave' in frontmatter`);
        }
      } catch {
        // Cannot read plan file
      }
    }
  }

  const passed = errors.length === 0;
  return {
    data: {
      passed,
      errors,
      warnings,
      warning_count: warnings.length,
    },
  };
};
