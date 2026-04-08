/**
 * Phase lifecycle handlers — add, insert, scaffold operations.
 *
 * Ported from get-shit-done/bin/lib/phase.cjs and commands.cjs.
 * Provides phaseAdd (append phase), phaseInsert (decimal phase insertion),
 * and phaseScaffold (template file/directory creation).
 *
 * Shared helpers replaceInCurrentMilestone and readModifyWriteRoadmapMd
 * are exported for use by downstream handlers (phaseComplete in Plan 03).
 *
 * @example
 * ```typescript
 * import { phaseAdd, phaseInsert, phaseScaffold } from './phase-lifecycle.js';
 *
 * await phaseAdd(['New Feature'], '/project');
 * await phaseInsert(['10', 'Urgent Fix'], '/project');
 * await phaseScaffold(['context', '9'], '/project');
 * ```
 */

import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import {
  escapeRegex,
  normalizePhaseName,
  phaseTokenMatches,
  toPosixPath,
  planningPaths,
  stateExtractField,
} from './helpers.js';
import { extractCurrentMilestone } from './roadmap.js';
import { acquireStateLock, releaseStateLock, stateReplaceField } from './state-mutation.js';
import type { QueryHandler } from './utils.js';

// ─── Null byte validation ────────────────────────────────────────────────

/** Reject strings containing null bytes (path traversal defense). */
function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}

// ─── Slug generation (inline) ────────────────────────────────────────────

/** Generate kebab-case slug from description. Port of generateSlugInternal. */
function generateSlugInternal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

// ─── replaceInCurrentMilestone ──────────────────────────────────────────

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs line 1197-1206.
 * If no `</details>` blocks exist, replaces in the entire content.
 * Otherwise, only replaces in content after the last `</details>` close tag.
 *
 * @param content - Full ROADMAP.md content
 * @param pattern - Regex or string pattern to match
 * @param replacement - Replacement string
 * @returns Modified content
 */
export function replaceInCurrentMilestone(
  content: string,
  pattern: string | RegExp,
  replacement: string,
): string {
  const lastDetailsClose = content.lastIndexOf('</details>');
  if (lastDetailsClose === -1) {
    return content.replace(pattern, replacement);
  }
  const offset = lastDetailsClose + '</details>'.length;
  const before = content.slice(0, offset);
  const after = content.slice(offset);
  return before + after.replace(pattern, replacement);
}

// ─── readModifyWriteRoadmapMd ───────────────────────────────────────────

/**
 * Atomic read-modify-write for ROADMAP.md.
 *
 * Holds a lockfile across the entire read -> transform -> write cycle.
 * Uses the same acquireStateLock/releaseStateLock mechanism as STATE.md
 * but with a ROADMAP.md-specific lock path.
 *
 * @param projectDir - Project root directory
 * @param modifier - Function to transform ROADMAP.md content
 * @returns The final written content
 */
export async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
): Promise<string> {
  const roadmapPath = planningPaths(projectDir).roadmap;
  const lockPath = await acquireStateLock(roadmapPath);
  try {
    let content: string;
    try {
      content = await readFile(roadmapPath, 'utf-8');
    } catch {
      content = '';
    }
    const modified = await modifier(content);
    await writeFile(roadmapPath, modified, 'utf-8');
    return modified;
  } finally {
    await releaseStateLock(lockPath);
  }
}

// ─── phaseAdd handler ───────────────────────────────────────────────────

/**
 * Query handler for phase.add.
 *
 * Port of cmdPhaseAdd from phase.cjs lines 312-392.
 * Creates a new phase directory with .gitkeep, appends a phase section
 * to ROADMAP.md before the last "---" separator.
 *
 * @param args - args[0]: description (required), args[1]: customId (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, padded, name, slug, directory, naming_mode }
 */
export const phaseAdd: QueryHandler = async (args, projectDir) => {
  const description = args[0];
  if (!description) {
    throw new GSDError('description required for phase add', ErrorClassification.Validation);
  }
  assertNoNullBytes(description, 'description');

  const configPath = planningPaths(projectDir).config;
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8'));
  } catch { /* use defaults */ }

  const slug = generateSlugInternal(description);
  const customId = args[1] || null;

  // Optional project code prefix (e.g., 'CK' -> 'CK-01-foundation')
  const projectCode = (config.project_code as string) || '';
  const prefix = projectCode ? `${projectCode}-` : '';

  let newPhaseId: number | string;
  let dirName: string;

  await readModifyWriteRoadmapMd(projectDir, async (rawContent) => {
    const content = await extractCurrentMilestone(rawContent, projectDir);

    if (customId || config.phase_naming === 'custom') {
      // Custom phase naming
      newPhaseId = customId || slug.toUpperCase().replace(/-/g, '-');
      if (!newPhaseId) {
        throw new GSDError('--id required when phase_naming is "custom"', ErrorClassification.Validation);
      }
      dirName = `${prefix}${newPhaseId}-${slug}`;
    } else {
      // Sequential mode: find highest integer phase number (in current milestone only)
      // Skip 999.x backlog phases — they live outside the active sequence
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
      let maxPhase = 0;
      let m: RegExpExecArray | null;
      while ((m = phasePattern.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num >= 999) continue; // backlog phases use 999.x numbering
        if (num > maxPhase) maxPhase = num;
      }

      newPhaseId = maxPhase + 1;
      const paddedNum = String(newPhaseId).padStart(2, '0');
      dirName = `${prefix}${paddedNum}-${slug}`;
    }

    const dirPath = join(planningPaths(projectDir).phases, dirName);

    // Create directory with .gitkeep so git tracks empty folders
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');

    // Build phase entry
    const dependsOn = config.phase_naming === 'custom'
      ? ''
      : `\n**Depends on:** Phase ${typeof newPhaseId === 'number' ? newPhaseId - 1 : 'TBD'}`;
    const phaseEntry = `\n### Phase ${newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)\n`;

    // Find insertion point: before last "---" or at end
    const lastSeparator = rawContent.lastIndexOf('\n---');
    if (lastSeparator > 0) {
      return rawContent.slice(0, lastSeparator) + phaseEntry + rawContent.slice(lastSeparator);
    }
    return rawContent + phaseEntry;
  });

  const result = {
    phase_number: typeof newPhaseId! === 'number' ? newPhaseId! : String(newPhaseId!),
    padded: typeof newPhaseId! === 'number' ? String(newPhaseId!).padStart(2, '0') : String(newPhaseId!),
    name: description,
    slug,
    directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir).phases, dirName!))),
    naming_mode: config.phase_naming || 'sequential',
  };

  return { data: result };
};

// ─── phaseInsert handler ────────────────────────────────────────────────

/**
 * Query handler for phase.insert.
 *
 * Port of cmdPhaseInsert from phase.cjs lines 394-492.
 * Creates a decimal phase directory after a target phase, inserting
 * the phase section in ROADMAP.md after the target.
 *
 * @param args - args[0]: afterPhase (required), args[1]: description (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, after_phase, name, slug, directory }
 */
export const phaseInsert: QueryHandler = async (args, projectDir) => {
  const afterPhase = args[0];
  const description = args[1];

  if (!afterPhase || !description) {
    throw new GSDError('after-phase and description required for phase insert', ErrorClassification.Validation);
  }
  assertNoNullBytes(afterPhase, 'afterPhase');
  assertNoNullBytes(description, 'description');

  const slug = generateSlugInternal(description);
  let decimalPhase: string;
  let dirName: string;

  await readModifyWriteRoadmapMd(projectDir, async (rawContent) => {
    const content = await extractCurrentMilestone(rawContent, projectDir);

    // Normalize input then strip leading zeros for flexible matching
    const normalizedAfter = normalizePhaseName(afterPhase);
    const unpadded = normalizedAfter.replace(/^0+/, '');
    const afterPhaseEscaped = unpadded.replace(/\./g, '\\.');
    const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
    if (!targetPattern.test(content)) {
      throw new GSDError(`Phase ${afterPhase} not found in ROADMAP.md`, ErrorClassification.Validation);
    }

    // Calculate next decimal by scanning both directories AND ROADMAP.md entries
    const phasesDir = planningPaths(projectDir).phases;
    const normalizedBase = normalizePhaseName(afterPhase);
    const decimalSet = new Set<number>();

    try {
      const entries = await readdir(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const decimalPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalizedBase)}\\.(\\d+)`);
      for (const dir of dirs) {
        const dm = dir.match(decimalPattern);
        if (dm) decimalSet.add(parseInt(dm[1], 10));
      }
    } catch { /* intentionally empty */ }

    // Also scan ROADMAP.md content for decimal entries
    const rmPhasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalizedBase)}\\.(\\d+)\\s*:`, 'gi'
    );
    let rmMatch: RegExpExecArray | null;
    while ((rmMatch = rmPhasePattern.exec(rawContent)) !== null) {
      decimalSet.add(parseInt(rmMatch[1], 10));
    }

    const nextDecimal = decimalSet.size === 0 ? 1 : Math.max(...decimalSet) + 1;
    decimalPhase = `${normalizedBase}.${nextDecimal}`;

    // Optional project code prefix
    let insertConfig: Record<string, unknown> = {};
    try {
      insertConfig = JSON.parse(await readFile(planningPaths(projectDir).config, 'utf-8'));
    } catch { /* use defaults */ }
    const projectCode = (insertConfig.project_code as string) || '';
    const pfx = projectCode ? `${projectCode}-` : '';
    dirName = `${pfx}${decimalPhase}-${slug}`;
    const dirPath = join(phasesDir, dirName);

    // Create directory with .gitkeep
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');

    // Build phase entry
    const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Requirements**: TBD\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${decimalPhase} to break down)\n`;

    // Insert after the target phase section
    const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
    const headerMatch = rawContent.match(headerPattern);
    if (!headerMatch) {
      throw new GSDError(`Could not find Phase ${afterPhase} header`, ErrorClassification.Execution);
    }

    const headerIdx = rawContent.indexOf(headerMatch[0]);
    const afterHeader = rawContent.slice(headerIdx + headerMatch[0].length);
    const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);

    let insertIdx: number;
    if (nextPhaseMatch && nextPhaseMatch.index !== undefined) {
      insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
    } else {
      insertIdx = rawContent.length;
    }

    return rawContent.slice(0, insertIdx) + phaseEntry + rawContent.slice(insertIdx);
  });

  const result = {
    phase_number: decimalPhase!,
    after_phase: afterPhase,
    name: description,
    slug,
    directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir).phases, dirName!))),
  };

  return { data: result };
};

// ─── phaseScaffold handler ──────────────────────────────────────────────

/**
 * Internal helper: find phase directory matching a phase identifier.
 *
 * Reuses the same logic as findPhase handler but returns just the directory info.
 */
async function findPhaseDir(
  projectDir: string,
  phase: string,
): Promise<{ dirPath: string; dirName: string; phaseName: string | null } | null> {
  const phasesDir = planningPaths(projectDir).phases;
  const normalized = normalizePhaseName(phase);

  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) return null;

    // Extract phase name from directory
    const dirMatch = match.match(/^(?:[A-Z]{1,6}-)?\d+[A-Z]?(?:\.\d+)*-(.+)/i);
    const phaseName = dirMatch ? dirMatch[1] : null;

    return {
      dirPath: join(phasesDir, match),
      dirName: match,
      phaseName,
    };
  } catch {
    return null;
  }
}

/**
 * Query handler for phase.scaffold.
 *
 * Port of cmdScaffold from commands.cjs lines 750-806.
 * Creates template files (context, uat, verification) or phase directories.
 *
 * @param args - args[0]: type (required), args[1]: phase (required), args[2]: name (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { created, path } or { created: false, reason: 'already_exists' }
 */
export const phaseScaffold: QueryHandler = async (args, projectDir) => {
  const type = args[0];
  const phase = args[1];
  const name = args[2] || undefined;

  if (!type) {
    throw new GSDError('type required for scaffold', ErrorClassification.Validation);
  }

  const validTypes = new Set(['context', 'uat', 'verification', 'phase-dir']);
  if (!validTypes.has(type)) {
    throw new GSDError(
      `Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`,
      ErrorClassification.Validation,
    );
  }

  if (phase) {
    assertNoNullBytes(phase, 'phase');
  }
  if (name) {
    assertNoNullBytes(name, 'name');
  }

  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Handle phase-dir type separately
  if (type === 'phase-dir') {
    if (!phase || !name) {
      throw new GSDError('phase and name required for phase-dir scaffold', ErrorClassification.Validation);
    }
    const slug = generateSlugInternal(name);
    const dirNameNew = `${padded}-${slug}`;
    const phasesParent = planningPaths(projectDir).phases;
    await mkdir(phasesParent, { recursive: true });
    const dirPath = join(phasesParent, dirNameNew);
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');
    return {
      data: {
        created: true,
        directory: toPosixPath(relative(projectDir, dirPath)),
        path: dirPath,
      },
    };
  }

  // For context/uat/verification types, find the phase directory
  const phaseInfo = phase ? await findPhaseDir(projectDir, phase) : null;
  if (phase && !phaseInfo) {
    throw new GSDError(`Phase ${phase} directory not found`, ErrorClassification.Blocked);
  }

  const phaseDir = phaseInfo!.dirPath;
  const phaseName = name || phaseInfo?.phaseName || 'Unnamed';

  let filePath: string;
  let content: string;

  switch (type) {
    case 'context': {
      filePath = join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${phaseName} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd-discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    default:
      throw new GSDError(`Unknown scaffold type: ${type}`, ErrorClassification.Validation);
  }

  // Check if file already exists
  if (existsSync(filePath)) {
    return {
      data: {
        created: false,
        reason: 'already_exists',
        path: filePath,
      },
    };
  }

  await writeFile(filePath, content, 'utf-8');
  const relPath = toPosixPath(relative(projectDir, filePath));
  return { data: { created: true, path: relPath } };
};

// ─── renameDecimalPhases ───────────────────────────────────────────────

/**
 * Renumber sibling decimal phases after a decimal phase is removed.
 *
 * Port of renameDecimalPhases from phase.cjs lines 499-524.
 * e.g. removing 06.2 -> 06.3 becomes 06.2, 06.4 becomes 06.3, etc.
 * Renames directories AND files inside them that contain the old phase ID.
 *
 * CRITICAL: Sorted in DESCENDING order to avoid rename conflicts.
 *
 * @param phasesDir - Path to the phases directory
 * @param baseInt - The integer part of the decimal phase (e.g. "06")
 * @param removedDecimal - The decimal part that was removed (e.g. 2 for 06.2)
 * @returns { renamedDirs, renamedFiles }
 */
async function renameDecimalPhases(
  phasesDir: string,
  baseInt: string,
  removedDecimal: number,
): Promise<{ renamedDirs: Array<{ from: string; to: string }>; renamedFiles: Array<{ from: string; to: string }> }> {
  const renamedDirs: Array<{ from: string; to: string }> = [];
  const renamedFiles: Array<{ from: string; to: string }> = [];

  const decPattern = new RegExp(`^${escapeRegex(baseInt)}\\.(\\d+)-(.+)$`);
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const toRename = dirs
    .map(dir => {
      const m = dir.match(decPattern);
      return m ? { dir, oldDecimal: parseInt(m[1], 10), slug: m[2] } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.oldDecimal > removedDecimal)
    .sort((a, b) => b.oldDecimal - a.oldDecimal); // DESCENDING to avoid conflicts

  for (const item of toRename) {
    const newDecimal = item.oldDecimal - 1;
    const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
    const newPhaseId = `${baseInt}.${newDecimal}`;
    const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;

    await rename(join(phasesDir, item.dir), join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });

    // Rename files inside that contain the old phase ID
    const files = await readdir(join(phasesDir, newDirName));
    for (const f of files) {
      if (f.includes(oldPhaseId)) {
        const newFileName = f.replace(oldPhaseId, newPhaseId);
        await rename(join(phasesDir, newDirName, f), join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }

  return { renamedDirs, renamedFiles };
}

// ─── renameIntegerPhases ───────────────────────────────────────────────

/**
 * Renumber all integer phases after a removed integer phase.
 *
 * Port of renameIntegerPhases from phase.cjs lines 531-564.
 * e.g. removing phase 5 -> phase 6 becomes 5, phase 7 becomes 6, etc.
 * Handles letter suffixes (12A) and decimals (6.1).
 *
 * CRITICAL: Sorted in DESCENDING order to avoid rename conflicts.
 *
 * @param phasesDir - Path to the phases directory
 * @param removedInt - The integer phase number that was removed
 * @returns { renamedDirs, renamedFiles }
 */
async function renameIntegerPhases(
  phasesDir: string,
  removedInt: number,
): Promise<{ renamedDirs: Array<{ from: string; to: string }>; renamedFiles: Array<{ from: string; to: string }> }> {
  const renamedDirs: Array<{ from: string; to: string }> = [];
  const renamedFiles: Array<{ from: string; to: string }> = [];

  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const toRename = dirs
    .map(dir => {
      const m = dir.match(/^(\d+)([A-Z])?(?:\.(\d+))?-(.+)$/i);
      if (!m) return null;
      const dirInt = parseInt(m[1], 10);
      if (dirInt <= removedInt) return null;
      return {
        dir,
        oldInt: dirInt,
        letter: m[2] ? m[2].toUpperCase() : '',
        decimal: m[3] !== undefined ? parseInt(m[3], 10) : null,
        slug: m[4],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.oldInt !== b.oldInt
      ? b.oldInt - a.oldInt
      : (b.decimal ?? 0) - (a.decimal ?? 0)); // DESCENDING

  for (const item of toRename) {
    const newInt = item.oldInt - 1;
    const newPadded = String(newInt).padStart(2, '0');
    const oldPadded = String(item.oldInt).padStart(2, '0');
    const letterSuffix = item.letter || '';
    const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
    const oldPrefix = `${oldPadded}${letterSuffix}${decimalSuffix}`;
    const newPrefix = `${newPadded}${letterSuffix}${decimalSuffix}`;
    const newDirName = `${newPrefix}-${item.slug}`;

    await rename(join(phasesDir, item.dir), join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });

    // Rename files that start with the old prefix
    const files = await readdir(join(phasesDir, newDirName));
    for (const f of files) {
      if (f.startsWith(oldPrefix)) {
        const newFileName = newPrefix + f.slice(oldPrefix.length);
        await rename(join(phasesDir, newDirName, f), join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }

  return { renamedDirs, renamedFiles };
}

// ─── updateRoadmapAfterPhaseRemoval ────────────────────────────────────

/**
 * Remove a phase section from ROADMAP.md and renumber subsequent integer phases.
 *
 * Port of updateRoadmapAfterPhaseRemoval from phase.cjs lines 569-595.
 * Uses readModifyWriteRoadmapMd for atomic writes.
 *
 * @param projectDir - Project root directory
 * @param targetPhase - Phase identifier that was removed
 * @param isDecimal - Whether the removed phase was a decimal phase
 * @param removedInt - The integer part of the removed phase
 */
async function updateRoadmapAfterPhaseRemoval(
  projectDir: string,
  targetPhase: string,
  isDecimal: boolean,
  removedInt: number,
): Promise<void> {
  await readModifyWriteRoadmapMd(projectDir, (content) => {
    const escaped = escapeRegex(targetPhase);

    // Remove the phase section (header + body until next phase header or end)
    content = content.replace(
      new RegExp(`\\n?#{2,4}\\s*Phase\\s+${escaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`, 'i'),
      '',
    );

    // Remove checkbox lines referencing the phase
    content = content.replace(
      new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${escaped}[:\\s][^\\n]*`, 'gi'),
      '',
    );

    // Remove table rows referencing the phase
    content = content.replace(
      new RegExp(`\\n?\\|\\s*${escaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi'),
      '',
    );

    // For integer phase removal, renumber all subsequent phases in ROADMAP text
    if (!isDecimal) {
      const MAX_PHASE = 99;
      for (let oldNum = MAX_PHASE; oldNum > removedInt; oldNum--) {
        const newNum = oldNum - 1;
        const oldStr = String(oldNum);
        const newStr = String(newNum);
        const oldPad = oldStr.padStart(2, '0');
        const newPad = newStr.padStart(2, '0');

        // Renumber phase headers: ### Phase N:
        content = content.replace(
          new RegExp(`(#{2,4}\\s*Phase\\s+)${escapeRegex(oldStr)}(\\s*:)`, 'gi'),
          `$1${newStr}$2`,
        );

        // Renumber inline Phase N references
        content = content.replace(
          new RegExp(`(Phase\\s+)${escapeRegex(oldStr)}([:\\s])`, 'g'),
          `$1${newStr}$2`,
        );

        // Renumber padded plan references: 07-01 -> 06-01
        content = content.replace(
          new RegExp(`${escapeRegex(oldPad)}-(\\d{2})`, 'g'),
          `${newPad}-$1`,
        );

        // Renumber table row phase numbers: | 7. -> | 6.
        content = content.replace(
          new RegExp(`(\\|\\s*)${escapeRegex(oldStr)}\\.\\s`, 'g'),
          `$1${newStr}. `,
        );

        // Renumber depends-on references
        content = content.replace(
          new RegExp(`(Depends on:\\*\\*\\s*Phase\\s+)${escapeRegex(oldStr)}\\b`, 'gi'),
          `$1${newStr}`,
        );
      }
    }

    return content;
  });
}

// ─── phaseRemove handler ───────────────────────────────────────────────

/**
 * Query handler for phase.remove.
 *
 * Port of cmdPhaseRemove from phase.cjs lines 597-661.
 * Deletes phase directory, renumbers subsequent phases on disk,
 * updates ROADMAP.md (removes section + renumbers), and decrements
 * STATE.md total_phases count.
 *
 * @param args - args[0]: targetPhase (required), args[1]: '--force' (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { removed, directory_deleted, renamed_directories, renamed_files, roadmap_updated, state_updated }
 */
export const phaseRemove: QueryHandler = async (args, projectDir) => {
  const targetPhase = args[0];
  if (!targetPhase) {
    throw new GSDError('phase number required for phase remove', ErrorClassification.Validation);
  }
  assertNoNullBytes(targetPhase, 'targetPhase');

  const paths = planningPaths(projectDir);
  const phasesDir = paths.phases;

  if (!existsSync(paths.roadmap)) {
    throw new GSDError('ROADMAP.md not found', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');
  const force = args[1] === '--force';

  // Find target directory
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  const targetDir = dirs.find(d => phaseTokenMatches(d, normalized)) ?? null;

  // Guard against removing executed work
  if (targetDir && !force) {
    const files = await readdir(join(phasesDir, targetDir));
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) {
      throw new GSDError(
        `Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`,
        ErrorClassification.Validation,
      );
    }
  }

  // Delete directory
  if (targetDir) {
    await rm(join(phasesDir, targetDir), { recursive: true, force: true });
  }

  // Renumber subsequent phases on disk
  let renamedDirs: Array<{ from: string; to: string }> = [];
  let renamedFiles: Array<{ from: string; to: string }> = [];
  try {
    const renamed = isDecimal
      ? await renameDecimalPhases(phasesDir, normalized.split('.')[0], parseInt(normalized.split('.')[1], 10))
      : await renameIntegerPhases(phasesDir, parseInt(normalized, 10));
    renamedDirs = renamed.renamedDirs;
    renamedFiles = renamed.renamedFiles;
  } catch { /* intentionally empty — renaming is best-effort */ }

  // Update ROADMAP.md
  await updateRoadmapAfterPhaseRemoval(projectDir, targetPhase, isDecimal, parseInt(normalized, 10));

  // Update STATE.md: decrement total_phases
  let stateUpdated = false;
  const statePath = paths.state;
  if (existsSync(statePath)) {
    const lockPath = await acquireStateLock(statePath);
    try {
      let stateContent = await readFile(statePath, 'utf-8');

      // Decrement total_phases in frontmatter
      const totalPhasesMatch = stateContent.match(/total_phases:\s*(\d+)/);
      if (totalPhasesMatch) {
        const oldTotal = parseInt(totalPhasesMatch[1], 10);
        stateContent = stateContent.replace(
          /total_phases:\s*\d+/,
          `total_phases: ${oldTotal - 1}`,
        );
      }

      // Decrement "of N" pattern in body (e.g., "Plan: 2 of 3")
      const ofMatch = stateContent.match(/(\bof\s+)(\d+)(\s*(?:\(|phases?))/i);
      if (ofMatch) {
        stateContent = stateContent.replace(
          /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i,
          `$1${parseInt(ofMatch[2], 10) - 1}$3`,
        );
      }

      // Also try stateReplaceField for "Total Phases" field
      const totalRaw = stateExtractField(stateContent, 'Total Phases');
      if (totalRaw) {
        const replaced = stateReplaceField(stateContent, 'Total Phases', String(parseInt(totalRaw, 10) - 1));
        if (replaced) stateContent = replaced;
      }

      await writeFile(statePath, stateContent, 'utf-8');
      stateUpdated = true;
    } finally {
      await releaseStateLock(lockPath);
    }
  }

  return {
    data: {
      removed: targetPhase,
      directory_deleted: targetDir,
      renamed_directories: renamedDirs,
      renamed_files: renamedFiles,
      roadmap_updated: true,
      state_updated: stateUpdated,
    },
  };
};
