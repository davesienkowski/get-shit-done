/**
 * STATE.md mutation handlers — write operations with lockfile atomicity.
 *
 * Ported from get-shit-done/bin/lib/state.cjs.
 * Provides all STATE.md mutation commands: update, patch, begin-phase,
 * advance-plan, record-metric, update-progress, add-decision, add-blocker,
 * resolve-blocker, record-session.
 *
 * All writes go through readModifyWriteStateMd which acquires a lockfile,
 * applies the modifier, syncs frontmatter, normalizes markdown, and writes.
 *
 * @example
 * ```typescript
 * import { stateUpdate, stateBeginPhase } from './state-mutation.js';
 *
 * await stateUpdate(['Status', 'executing'], '/project');
 * await stateBeginPhase(['11', 'State Mutations', '3'], '/project');
 * ```
 */

import { open, unlink, stat, readFile, writeFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter, stripFrontmatter } from './frontmatter.js';
import { reconstructFrontmatter, spliceFrontmatter } from './frontmatter-mutation.js';
import { escapeRegex, stateExtractField, planningPaths, normalizeMd } from './helpers.js';
import { buildStateFrontmatter, getMilestonePhaseFilter } from './state.js';
import type { QueryHandler } from './utils.js';

// ─── stateReplaceField ────────────────────────────────────────────────────

/**
 * Replace a field value in STATE.md content.
 *
 * Uses separate regex instances (no g flag) to avoid lastIndex persistence.
 * Supports both **bold:** and plain: formats.
 *
 * @param content - STATE.md content
 * @param fieldName - Field name to replace
 * @param newValue - New value to set
 * @returns Updated content, or null if field not found
 */
export function stateReplaceField(content: string, fieldName: string, newValue: string): string | null {
  const escaped = escapeRegex(fieldName);
  // Try **Field:** bold format first
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i'), (_match, prefix: string) => `${prefix}${newValue}`);
  }
  // Try plain Field: format
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(new RegExp(`(^${escaped}:\\s*)(.*)`, 'im'), (_match, prefix: string) => `${prefix}${newValue}`);
  }
  return null;
}

/**
 * Replace a field with fallback field name support.
 *
 * Tries primary first, then fallback. Returns content unchanged if neither matches.
 */
function stateReplaceFieldWithFallback(content: string, primary: string, fallback: string | null, value: string): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

/**
 * Update fields within the ## Current Position section.
 *
 * Only updates fields that already exist in the section.
 */
function updateCurrentPositionFields(content: string, fields: Record<string, string | undefined>): string {
  const posPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
  const posMatch = content.match(posPattern);
  if (!posMatch) return content;

  let posBody = posMatch[2];

  if (fields.status && /^Status:/m.test(posBody)) {
    posBody = posBody.replace(/^Status:.*$/m, `Status: ${fields.status}`);
  }
  if (fields.lastActivity && /^Last activity:/im.test(posBody)) {
    posBody = posBody.replace(/^Last activity:.*$/im, `Last activity: ${fields.lastActivity}`);
  }
  if (fields.plan && /^Plan:/m.test(posBody)) {
    posBody = posBody.replace(/^Plan:.*$/m, `Plan: ${fields.plan}`);
  }

  return content.replace(posPattern, `${posMatch[1]}${posBody}`);
}

// ─── Lockfile helpers ─────────────────────────────────────────────────────

/**
 * Acquire a lockfile for STATE.md operations.
 *
 * Uses O_CREAT|O_EXCL for atomic creation. Retries up to 10 times with
 * 200ms + jitter delay. Cleans stale locks older than 10 seconds.
 *
 * @param statePath - Path to STATE.md
 * @returns Path to the lockfile
 */
export async function acquireStateLock(statePath: string): Promise<string> {
  const lockPath = statePath + '.lock';
  const maxRetries = 10;
  const retryDelay = 200;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.writeFile(String(process.pid));
      await fd.close();
      return lockPath;
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        try {
          const s = await stat(lockPath);
          if (Date.now() - s.mtimeMs > 10000) {
            await unlink(lockPath);
            continue;
          }
        } catch { /* lock released between check */ }

        if (i === maxRetries - 1) {
          try { await unlink(lockPath); } catch { /* ignore */ }
          return lockPath;
        }
        await new Promise<void>(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
      } else {
        throw err;
      }
    }
  }
  return lockPath;
}

/**
 * Release a lockfile.
 *
 * @param lockPath - Path to the lockfile to release
 */
export async function releaseStateLock(lockPath: string): Promise<void> {
  try { await unlink(lockPath); } catch { /* already gone */ }
}

// ─── Frontmatter sync + write helpers ─────────────────────────────────────

/**
 * Sync STATE.md content with rebuilt YAML frontmatter.
 *
 * Strips existing frontmatter, rebuilds from body + disk, and splices back.
 * Preserves existing status when body-derived status is 'unknown'.
 */
async function syncStateFrontmatter(content: string, projectDir: string): Promise<string> {
  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const derivedFm = await buildStateFrontmatter(body, projectDir);

  // Preserve existing status when body-derived is 'unknown'
  if (derivedFm.status === 'unknown' && existingFm.status && existingFm.status !== 'unknown') {
    derivedFm.status = existingFm.status;
  }

  const yamlStr = reconstructFrontmatter(derivedFm);
  return `---\n${yamlStr}\n---\n\n${body}`;
}

/**
 * Atomic read-modify-write for STATE.md.
 *
 * Holds lock across the entire read -> transform -> write cycle.
 *
 * @param projectDir - Project root directory
 * @param modifier - Function to transform STATE.md content
 * @returns The final written content
 */
async function readModifyWriteStateMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>
): Promise<string> {
  const statePath = planningPaths(projectDir).state;
  const lockPath = await acquireStateLock(statePath);
  try {
    let content: string;
    try {
      content = await readFile(statePath, 'utf-8');
    } catch {
      content = '';
    }
    // Strip frontmatter before passing to modifier so that regex replacements
    // operate on body fields only (not on YAML frontmatter keys like 'status:').
    // syncStateFrontmatter rebuilds frontmatter from the modified body + disk.
    const body = stripFrontmatter(content);
    const modified = await modifier(body);
    const synced = await syncStateFrontmatter(modified, projectDir);
    const normalized = normalizeMd(synced);
    await writeFile(statePath, normalized, 'utf-8');
    return normalized;
  } finally {
    await releaseStateLock(lockPath);
  }
}

// ─── Exported handlers ────────────────────────────────────────────────────

/**
 * Query handler for state.update command.
 *
 * Replaces a single field in STATE.md.
 *
 * @param args - args[0]: field name, args[1]: new value
 * @param projectDir - Project root directory
 * @returns QueryResult with { updated: true/false, field, value }
 */
export const stateUpdate: QueryHandler = async (args, projectDir) => {
  const field = args[0];
  const value = args[1];

  if (!field || value === undefined) {
    throw new GSDError('field and value required for state update', ErrorClassification.Validation);
  }

  let updated = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const result = stateReplaceField(content, field, value);
    if (result) {
      updated = true;
      return result;
    }
    return content;
  });

  return { data: { updated, field, value: updated ? value : undefined } };
};

/**
 * Query handler for state.patch command.
 *
 * Replaces multiple fields atomically in one lock cycle.
 *
 * @param args - args[0]: JSON string of { field: value } pairs
 * @param projectDir - Project root directory
 * @returns QueryResult with { patched: true, fields: [...] }
 */
export const statePatch: QueryHandler = async (args, projectDir) => {
  const jsonString = args[0];
  if (!jsonString) {
    throw new GSDError('JSON patches required', ErrorClassification.Validation);
  }

  let patches: Record<string, string>;
  try {
    patches = JSON.parse(jsonString) as Record<string, string>;
  } catch {
    throw new GSDError('Invalid JSON for patches', ErrorClassification.Validation);
  }

  const updatedFields: string[] = [];
  await readModifyWriteStateMd(projectDir, (content) => {
    for (const [field, value] of Object.entries(patches)) {
      const result = stateReplaceField(content, field, String(value));
      if (result) {
        content = result;
        updatedFields.push(field);
      }
    }
    return content;
  });

  return { data: { patched: updatedFields.length > 0, fields: updatedFields } };
};

/**
 * Query handler for state.begin-phase command.
 *
 * Sets phase, plan, status, progress, and current focus fields.
 * Rewrites the Current Position section.
 *
 * @param args - args[0]: phase number, args[1]: phase name, args[2]: plan count
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase, name, plan_count }
 */
export const stateBeginPhase: QueryHandler = async (args, projectDir) => {
  const phaseNumber = args[0];
  const phaseName = args[1] || '';
  const planCount = args[2] || '?';

  if (!phaseNumber) {
    throw new GSDError('phase number required', ErrorClassification.Validation);
  }

  const today = new Date().toISOString().split('T')[0];

  await readModifyWriteStateMd(projectDir, (content) => {
    // Update bold/plain fields
    const statusValue = `Executing Phase ${phaseNumber}`;
    content = stateReplaceField(content, 'Status', statusValue) || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;

    const activityDesc = `Phase ${phaseNumber} execution started`;
    content = stateReplaceField(content, 'Last Activity Description', activityDesc) || content;
    content = stateReplaceField(content, 'Current Phase', String(phaseNumber)) || content;

    if (phaseName) {
      content = stateReplaceField(content, 'Current Phase Name', phaseName) || content;
    }

    content = stateReplaceField(content, 'Current Plan', '1') || content;

    if (planCount !== '?') {
      content = stateReplaceField(content, 'Total Plans in Phase', String(planCount)) || content;
    }

    // Update **Current focus:**
    const focusLabel = phaseName ? `Phase ${phaseNumber} — ${phaseName}` : `Phase ${phaseNumber}`;
    const focusPattern = /(\*\*Current focus:\*\*\s*).*/i;
    if (focusPattern.test(content)) {
      content = content.replace(focusPattern, (_match, prefix: string) => `${prefix}${focusLabel}`);
    }

    // Update ## Current Position section
    const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const positionMatch = content.match(positionPattern);
    if (positionMatch) {
      const header = positionMatch[1];
      let posBody = positionMatch[2];

      const newPhase = `Phase: ${phaseNumber}${phaseName ? ` (${phaseName})` : ''} — EXECUTING`;
      if (/^Phase:/m.test(posBody)) {
        posBody = posBody.replace(/^Phase:.*$/m, newPhase);
      } else {
        posBody = newPhase + '\n' + posBody;
      }

      const newPlan = `Plan: 1 of ${planCount}`;
      if (/^Plan:/m.test(posBody)) {
        posBody = posBody.replace(/^Plan:.*$/m, newPlan);
      } else {
        posBody = posBody.replace(/^(Phase:.*$)/m, `$1\n${newPlan}`);
      }

      const newStatus = `Status: Executing Phase ${phaseNumber}`;
      if (/^Status:/m.test(posBody)) {
        posBody = posBody.replace(/^Status:.*$/m, newStatus);
      }

      const newActivity = `Last activity: ${today} -- Phase ${phaseNumber} execution started`;
      if (/^Last activity:/im.test(posBody)) {
        posBody = posBody.replace(/^Last activity:.*$/im, newActivity);
      }

      content = content.replace(positionPattern, `${header}${posBody}`);
    }

    return content;
  });

  return { data: { phase: phaseNumber, name: phaseName || null, plan_count: planCount } };
};

/**
 * Query handler for state.advance-plan command.
 *
 * Increments plan counter. Detects phase completion when at last plan.
 *
 * @param args - unused
 * @param projectDir - Project root directory
 * @returns QueryResult with { advanced, current_plan, total_plans }
 */
export const stateAdvancePlan: QueryHandler = async (_args, projectDir) => {
  const statePath = planningPaths(projectDir).state;

  let fileContent: string;
  try {
    fileContent = await readFile(statePath, 'utf-8');
  } catch {
    return { data: { error: 'STATE.md not found' } };
  }

  const today = new Date().toISOString().split('T')[0];

  // Parse current plan info
  const legacyPlan = stateExtractField(fileContent, 'Current Plan');
  const legacyTotal = stateExtractField(fileContent, 'Total Plans in Phase');
  const planField = stateExtractField(fileContent, 'Plan');

  let currentPlan: number;
  let totalPlans: number;
  let useCompoundFormat = false;
  let compoundPlanField: string | null = null;

  if (legacyPlan && legacyTotal) {
    currentPlan = parseInt(legacyPlan, 10);
    totalPlans = parseInt(legacyTotal, 10);
  } else if (planField) {
    currentPlan = parseInt(planField, 10);
    const ofMatch = planField.match(/of\s+(\d+)/);
    totalPlans = ofMatch ? parseInt(ofMatch[1], 10) : NaN;
    useCompoundFormat = true;
    compoundPlanField = planField;
  } else {
    return { data: { error: 'Cannot parse Current Plan or Total Plans from STATE.md' } };
  }

  if (isNaN(currentPlan) || isNaN(totalPlans)) {
    return { data: { error: 'Cannot parse Current Plan or Total Plans from STATE.md' } };
  }

  if (currentPlan >= totalPlans) {
    // Phase complete
    await readModifyWriteStateMd(projectDir, (content) => {
      content = stateReplaceFieldWithFallback(content, 'Status', null, 'Phase complete — ready for verification');
      content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
      content = updateCurrentPositionFields(content, {
        status: 'Phase complete — ready for verification',
        lastActivity: today,
      });
      return content;
    });
    return { data: { advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans } };
  }

  // Advance to next plan
  const newPlan = currentPlan + 1;
  await readModifyWriteStateMd(projectDir, (content) => {
    let planDisplayValue: string;
    if (useCompoundFormat && compoundPlanField) {
      planDisplayValue = compoundPlanField.replace(/^\d+/, String(newPlan));
      content = stateReplaceField(content, 'Plan', planDisplayValue) || content;
    } else {
      planDisplayValue = `${newPlan} of ${totalPlans}`;
      content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    }
    content = stateReplaceFieldWithFallback(content, 'Status', null, 'Ready to execute');
    content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
    content = updateCurrentPositionFields(content, {
      status: 'Ready to execute',
      lastActivity: today,
      plan: planDisplayValue,
    });
    return content;
  });

  return { data: { advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans } };
};

/**
 * Query handler for state.record-metric command.
 *
 * Appends a row to the Performance Metrics table.
 *
 * @param args - args[0]: phase, args[1]: plan, args[2]: duration, args[3]: tasks, args[4]: files
 * @param projectDir - Project root directory
 * @returns QueryResult with { recorded: true/false }
 */
export const stateRecordMetric: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  const plan = args[1];
  const duration = args[2];
  const tasks = args[3] || '-';
  const files = args[4] || '-';

  if (!phase || !plan || !duration) {
    throw new GSDError('phase, plan, and duration required', ErrorClassification.Validation);
  }

  let recorded = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
    const metricsMatch = content.match(metricsPattern);

    if (metricsMatch) {
      let tableBody = metricsMatch[2].trimEnd();
      const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks} tasks | ${files} files |`;

      if (tableBody.trim() === '' || tableBody.includes('None yet')) {
        tableBody = newRow;
      } else {
        tableBody = tableBody + '\n' + newRow;
      }

      content = content.replace(metricsPattern, (_match, header: string) => `${header}${tableBody}\n`);
      recorded = true;
    }
    return content;
  });

  return { data: { recorded } };
};

/**
 * Query handler for state.update-progress command.
 *
 * Scans disk to count completed/total plans and updates progress bar.
 *
 * @param args - unused
 * @param projectDir - Project root directory
 * @returns QueryResult with { updated, percent, completed, total }
 */
export const stateUpdateProgress: QueryHandler = async (_args, projectDir) => {
  const phasesDir = planningPaths(projectDir).phases;
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const isDirInMilestone = await getMilestonePhaseFilter(projectDir);
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const phaseDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(isDirInMilestone);

    for (const dir of phaseDirs) {
      const files = await readdir(join(phasesDir, dir));
      totalPlans += files.filter(f => /-PLAN\.md$/i.test(f)).length;
      totalSummaries += files.filter(f => /-SUMMARY\.md$/i.test(f)).length;
    }
  } catch { /* phases dir may not exist */ }

  const percent = totalPlans > 0 ? Math.min(100, Math.round(totalSummaries / totalPlans * 100)) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  let updated = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const result = stateReplaceField(content, 'Progress', progressStr);
    if (result) {
      updated = true;
      return result;
    }
    return content;
  });

  return { data: { updated, percent, completed: totalSummaries, total: totalPlans, bar: progressStr } };
};

/**
 * Query handler for state.add-decision command.
 *
 * Appends a decision to the Decisions section. Removes placeholder text.
 *
 * @param args - args[0]: decision text (e.g., "[Phase 10]: Use lockfile atomicity")
 * @param projectDir - Project root directory
 * @returns QueryResult with { added: true/false }
 */
export const stateAddDecision: QueryHandler = async (args, projectDir) => {
  const decisionText = args[0];
  if (!decisionText) {
    throw new GSDError('decision text required', ErrorClassification.Validation);
  }

  const entry = `- ${decisionText}`;
  let added = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      // Remove placeholders
      sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      content = content.replace(sectionPattern, (_match, header: string) => `${header}${sectionBody}`);
      added = true;
    }
    return content;
  });

  return { data: { added, decision: added ? entry : undefined } };
};

/**
 * Query handler for state.add-blocker command.
 *
 * Appends a blocker to the Blockers section.
 *
 * @param args - args[0]: blocker text
 * @param projectDir - Project root directory
 * @returns QueryResult with { added: true/false }
 */
export const stateAddBlocker: QueryHandler = async (args, projectDir) => {
  const blockerText = args[0];
  if (!blockerText) {
    throw new GSDError('blocker text required', ErrorClassification.Validation);
  }

  const entry = `- ${blockerText}`;
  let added = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      content = content.replace(sectionPattern, (_match, header: string) => `${header}${sectionBody}`);
      added = true;
    }
    return content;
  });

  return { data: { added, blocker: added ? blockerText : undefined } };
};

/**
 * Query handler for state.resolve-blocker command.
 *
 * Removes the first blocker line matching the search text.
 *
 * @param args - args[0]: search text to match against blocker lines
 * @param projectDir - Project root directory
 * @returns QueryResult with { resolved: true/false }
 */
export const stateResolveBlocker: QueryHandler = async (args, projectDir) => {
  const searchText = args[0];
  if (!searchText) {
    throw new GSDError('search text required', ErrorClassification.Validation);
  }

  let resolved = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      const sectionBody = match[2];
      const lines = sectionBody.split('\n');
      const filtered = lines.filter(line => {
        if (!line.startsWith('- ')) return true;
        return !line.toLowerCase().includes(searchText.toLowerCase());
      });

      let newBody = filtered.join('\n');
      if (!newBody.trim() || !newBody.includes('- ')) {
        newBody = 'None\n';
      }

      content = content.replace(sectionPattern, (_match, header: string) => `${header}${newBody}`);
      resolved = true;
    }
    return content;
  });

  return { data: { resolved } };
};

/**
 * Query handler for state.record-session command.
 *
 * Updates Session Continuity fields: Last session, Stopped at, Resume file.
 *
 * @param args - args[0]: timestamp (optional), args[1]: stopped-at text, args[2]: resume file
 * @param projectDir - Project root directory
 * @returns QueryResult with { recorded: true/false }
 */
export const stateRecordSession: QueryHandler = async (args, projectDir) => {
  const timestamp = args[0] || new Date().toISOString();
  const stoppedAt = args[1];
  const resumeFile = args[2] || 'None';

  const updated: string[] = [];

  await readModifyWriteStateMd(projectDir, (content) => {
    // Update Last session / Last Date
    let result = stateReplaceField(content, 'Last session', timestamp);
    if (result) { content = result; updated.push('Last session'); }
    result = stateReplaceField(content, 'Last Date', timestamp);
    if (result) { content = result; updated.push('Last Date'); }

    // Update Stopped at
    if (stoppedAt) {
      result = stateReplaceField(content, 'Stopped At', stoppedAt);
      if (!result) result = stateReplaceField(content, 'Stopped at', stoppedAt);
      if (result) { content = result; updated.push('Stopped At'); }
    }

    // Update Resume file
    result = stateReplaceField(content, 'Resume File', resumeFile);
    if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
    if (result) { content = result; updated.push('Resume File'); }

    return content;
  });

  return { data: { recorded: updated.length > 0, updated } };
};
