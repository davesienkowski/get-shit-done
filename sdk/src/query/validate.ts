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

import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { parseMustHavesBlock } from './frontmatter.js';
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
