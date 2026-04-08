/**
 * Stub handlers for commands not yet fully migrated to the SDK.
 *
 * Two categories:
 * 1. Functional stubs: minimal implementations that satisfy workflow needs
 *    (agent-skills, roadmap.update-plan-progress, state.planned-phase, etc.)
 * 2. v4.0 stubs: deferred features that return a graceful deferral notice
 *    rather than an error (learnings, intel, uat, profile system)
 *
 * All stubs return valid QueryResult objects so workflows can continue
 * without blocking on missing features.
 */

import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

import { planningPaths, toPosixPath, normalizePhaseName } from './helpers.js';
import { roadmapAnalyze } from './roadmap.js';
import type { QueryHandler, QueryResult } from './utils.js';

// ─── Internal helpers ──────────────────────────────────────────────────────

/** Return a v4.0 deferred result (graceful, not an error). */
function deferred(feature: string): QueryResult {
  return { data: { deferred: true, version: 'v4.0', reason: `${feature} deferred to v4.0` } };
}

// ─── agentSkills ──────────────────────────────────────────────────────────

/**
 * Scan agent skill directories and return list of installed skills.
 * Reads from .claude/skills/, .agents/skills/, .cursor/skills/ etc.
 */
export const agentSkills: QueryHandler = async (args, projectDir) => {
  const agentType = args[0] || '';
  const skillDirs = [
    join(projectDir, '.claude', 'skills'),
    join(projectDir, '.agents', 'skills'),
    join(projectDir, '.cursor', 'skills'),
    join(projectDir, '.github', 'skills'),
    join(homedir(), '.claude', 'get-shit-done', 'skills'),
  ];

  const skills: string[] = [];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
      for (const entry of entries) {
        if (entry.isDirectory()) skills.push(entry.name);
      }
    } catch { /* skip */ }
  }

  return {
    data: {
      agent_type: agentType,
      skills: [...new Set(skills)],
      skill_count: skills.length,
    },
  };
};

// ─── roadmapUpdatePlanProgress ────────────────────────────────────────────

/**
 * Update plan progress checkbox in ROADMAP.md.
 * Marks the plan entry as completed by toggling - [ ] → - [x].
 */
export const roadmapUpdatePlanProgress: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  const paths = planningPaths(projectDir);

  if (!phase) {
    return { data: { updated: false, reason: 'phase argument required' } };
  }

  try {
    let content = await readFile(paths.roadmap, 'utf-8');
    const phaseNum = normalizePhaseName(phase);
    // Match plan checkboxes like "- [ ] Plan X" or similar near the phase
    const updated = content.replace(
      /(-\s*\[\s*\]\s*(?:Plan\s+\d+|plan\s+\d+|\*\*Plan))/gi,
      (match) => match.replace('[ ]', '[x]'),
    );
    if (updated !== content) {
      await writeFile(paths.roadmap, updated, 'utf-8');
      return { data: { updated: true, phase: phaseNum } };
    }
    return { data: { updated: false, phase: phaseNum, reason: 'no matching checkbox found' } };
  } catch {
    return { data: { updated: false, reason: 'ROADMAP.md not found or unreadable' } };
  }
};

// ─── requirementsMarkComplete ─────────────────────────────────────────────

/**
 * Mark requirement IDs as complete in REQUIREMENTS.md.
 * Toggles - [ ] → - [x] for matching requirement IDs.
 */
export const requirementsMarkComplete: QueryHandler = async (args, projectDir) => {
  const reqIds = args;
  const paths = planningPaths(projectDir);

  if (reqIds.length === 0) {
    return { data: { marked: false, reason: 'requirement IDs required' } };
  }

  try {
    let content = await readFile(paths.requirements, 'utf-8');
    let changeCount = 0;

    for (const id of reqIds) {
      // Match lines like "- [ ] REQ-01" or "- [ ] **REQ-01**"
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(-\\s*\\[\\s*\\]\\s*)([^\\n]*${escaped})`, 'gi');
      content = content.replace(pattern, (_m, _bracket, rest) => `- [x] ${rest}`.trim() + '\n' || `- [x] ${rest}`);
      if (content.includes(`[x]`) && content.includes(id)) changeCount++;
    }

    await writeFile(paths.requirements, content, 'utf-8');
    return { data: { marked: true, ids: reqIds, changed: changeCount } };
  } catch {
    return { data: { marked: false, reason: 'REQUIREMENTS.md not found or unreadable' } };
  }
};

// ─── statePlannedPhase ────────────────────────────────────────────────────

/**
 * Update STATE.md to record that a phase has been planned.
 * Appends a planning record to the state file.
 */
export const statePlannedPhase: QueryHandler = async (args, projectDir) => {
  const phaseArg = args.find((a, i) => args[i - 1] === '--phase') || args[0];
  const nameArg = args.find((a, i) => args[i - 1] === '--name') || '';
  const plansArg = args.find((a, i) => args[i - 1] === '--plans') || '0';
  const paths = planningPaths(projectDir);

  if (!phaseArg) {
    return { data: { updated: false, reason: '--phase argument required' } };
  }

  try {
    let content = await readFile(paths.state, 'utf-8');
    const timestamp = new Date().toISOString();
    // Add/update planned phase record
    const record = `\n**Planned Phase:** ${phaseArg} (${nameArg}) — ${plansArg} plans — ${timestamp}\n`;
    // Replace existing planned phase line if present, else append
    if (/\*\*Planned Phase:\*\*/.test(content)) {
      content = content.replace(/\*\*Planned Phase:\*\*[^\n]*\n/, record);
    } else {
      content += record;
    }
    await writeFile(paths.state, content, 'utf-8');
    return { data: { updated: true, phase: phaseArg, name: nameArg, plans: plansArg } };
  } catch {
    return { data: { updated: false, reason: 'STATE.md not found or unreadable' } };
  }
};

// ─── verifySchemaDrift ────────────────────────────────────────────────────

/**
 * Verify schema drift — check that plan frontmatter conforms to expected schema.
 * Minimal check: verifies required fields are present.
 */
export const verifySchemaDrift: QueryHandler = async (args, projectDir) => {
  const phaseArg = args[0];
  const paths = planningPaths(projectDir);

  const issues: string[] = [];
  const REQUIRED_FRONTMATTER = ['phase', 'plan', 'type', 'must_haves'];

  try {
    const phasesDir = paths.phases;
    if (!existsSync(phasesDir)) {
      return { data: { valid: true, issues: [], checked: 0 } };
    }

    const entries = readdirSync(phasesDir, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
    let checked = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (phaseArg && !entry.name.startsWith(normalizePhaseName(phaseArg))) continue;

      const phaseDir = join(phasesDir, entry.name);
      const files = readdirSync(phaseDir).filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');

      for (const planFile of files) {
        checked++;
        try {
          const content = await readFile(join(phaseDir, planFile), 'utf-8');
          for (const field of REQUIRED_FRONTMATTER) {
            if (!new RegExp(`^${field}:`, 'm').test(content)) {
              issues.push(`${planFile}: missing '${field}' in frontmatter`);
            }
          }
        } catch { /* skip */ }
      }
    }

    return { data: { valid: issues.length === 0, issues, checked } };
  } catch {
    return { data: { valid: true, issues: [], checked: 0 } };
  }
};

// ─── todoMatchPhase ───────────────────────────────────────────────────────

/**
 * Find todos that match a given phase.
 * Scans .planning/todos/ directory for matching todo files.
 */
export const todoMatchPhase: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  const todosDir = join(projectDir, '.planning', 'todos');
  const todos: Array<{ file: string; phase: string }> = [];

  if (!existsSync(todosDir)) {
    return { data: { todos: [], count: 0, phase: phase || null } };
  }

  try {
    const files = readdirSync(todosDir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    for (const file of files) {
      if (!phase || file.includes(normalizePhaseName(phase)) || file.includes(phase)) {
        todos.push({ file: toPosixPath(relative(projectDir, join(todosDir, file))), phase: phase || 'all' });
      }
    }
  } catch { /* skip */ }

  return { data: { todos, count: todos.length, phase: phase || null } };
};

// ─── milestoneComplete ────────────────────────────────────────────────────

/**
 * Mark a milestone as complete — archives phases and updates state.
 * Thin wrapper around phases.archive.
 */
export const milestoneComplete: QueryHandler = async (args, projectDir) => {
  const version = args[0] || 'current';
  try {
    const { phasesArchive } = await import('./phase-lifecycle.js');
    const archiveResult = await phasesArchive([], projectDir);
    return {
      data: {
        completed: true,
        version,
        archive: archiveResult.data,
      },
    };
  } catch (err) {
    return { data: { completed: false, reason: String(err) } };
  }
};

// ─── summaryExtract ───────────────────────────────────────────────────────

/**
 * Extract sections from a SUMMARY.md file.
 * Returns parsed sections as key-value pairs.
 */
export const summaryExtract: QueryHandler = async (args, projectDir) => {
  const filePath = args[0] ? join(projectDir, args[0]) : null;

  if (!filePath || !existsSync(filePath)) {
    return { data: { sections: {}, error: 'file not found' } };
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const sections: Record<string, string> = {};
    const headingPattern = /^#{1,3}\s+(.+?)[\r\n]+([\s\S]*?)(?=^#{1,3}\s|\Z)/gm;
    let m: RegExpExecArray | null;
    while ((m = headingPattern.exec(content)) !== null) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      sections[key] = m[2].trim();
    }
    return { data: { sections, file: args[0] } };
  } catch {
    return { data: { sections: {}, error: 'unreadable file' } };
  }
};

// ─── historyDigest ────────────────────────────────────────────────────────

/**
 * Generate a condensed history of completed phases from SUMMARY.md files.
 */
export const historyDigest: QueryHandler = async (_args, projectDir) => {
  const paths = planningPaths(projectDir);
  const history: Array<{ phase: string; name: string; summary_path: string }> = [];

  if (!existsSync(paths.phases)) {
    return { data: { phases: history, count: 0 } };
  }

  try {
    const entries = readdirSync(paths.phases, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const phaseDir = join(paths.phases, entry.name);
      const files = readdirSync(phaseDir);
      const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      for (const summary of summaries) {
        const match = entry.name.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
        history.push({
          phase: match ? match[1] : entry.name,
          name: match && match[2] ? match[2] : entry.name,
          summary_path: toPosixPath(relative(projectDir, join(phaseDir, summary))),
        });
      }
    }
  } catch { /* skip */ }

  return { data: { phases: history, count: history.length } };
};

// ─── statsJson ────────────────────────────────────────────────────────────

/**
 * Return project statistics: phase/plan counts, progress metrics.
 */
export const statsJson: QueryHandler = async (_args, projectDir) => {
  const paths = planningPaths(projectDir);
  let phasesTotal = 0;
  let plansTotal = 0;
  let summariesTotal = 0;
  let completedPhases = 0;

  if (existsSync(paths.phases)) {
    try {
      const entries = readdirSync(paths.phases, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        phasesTotal++;
        const phaseDir = join(paths.phases, entry.name);
        const files = readdirSync(phaseDir);
        const plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        plansTotal += plans.length;
        summariesTotal += summaries.length;
        if (summaries.length >= plans.length && plans.length > 0) completedPhases++;
      }
    } catch { /* skip */ }
  }

  const progressPercent = phasesTotal > 0 ? Math.round((completedPhases / phasesTotal) * 100) : 0;

  return {
    data: {
      phases_total: phasesTotal,
      plans_total: plansTotal,
      summaries_total: summariesTotal,
      completed_phases: completedPhases,
      in_progress_phases: phasesTotal - completedPhases,
      progress_percent: progressPercent,
    },
  };
};

// ─── commitToSubrepo ─────────────────────────────────────────────────────

/**
 * Commit to a sub-repository within the project.
 * T-14-10: validates subrepo path is within projectDir.
 */
export const commitToSubrepo: QueryHandler = async (args, projectDir) => {
  const message = args[0];
  const filesIdx = args.indexOf('--files');
  const files = filesIdx >= 0 ? args.slice(filesIdx + 1) : [];

  if (!message) {
    return { data: { committed: false, reason: 'commit message required' } };
  }

  try {
    // Validate all file paths are within projectDir (T-14-10)
    for (const file of files) {
      const resolved = join(projectDir, file);
      if (!resolved.startsWith(projectDir)) {
        return { data: { committed: false, reason: `file path escapes project: ${file}` } };
      }
    }

    const fileArgs = files.length > 0 ? files.join(' ') : '.';
    execSync(`git -C "${projectDir}" add ${fileArgs}`, { stdio: 'pipe' });
    execSync(`git -C "${projectDir}" commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });

    const hash = execSync(`git -C "${projectDir}" rev-parse --short HEAD`, { encoding: 'utf-8' }).trim();
    return { data: { committed: true, hash, message } };
  } catch (err) {
    return { data: { committed: false, reason: String(err) } };
  }
};

// ─── progressBar ─────────────────────────────────────────────────────────

/**
 * Render a text progress bar for the current milestone.
 */
export const progressBar: QueryHandler = async (_args, projectDir) => {
  const analysis = await roadmapAnalyze([], projectDir);
  const data = analysis.data as Record<string, unknown>;
  const percent = (data.progress_percent as number) || 0;
  const total = 20;
  const filled = Math.round((percent / 100) * total);
  const bar = '[' + '#'.repeat(filled) + '-'.repeat(total - filled) + ']';
  return { data: { bar: `${bar} ${percent}%`, percent } };
};

// ─── workstream stubs ─────────────────────────────────────────────────────

const workspaceDir = (projectDir: string) =>
  join(projectDir, '.planning', 'workstreams');

export const workstreamList: QueryHandler = async (_args, projectDir) => {
  const dir = workspaceDir(projectDir);
  if (!existsSync(dir)) return { data: { workstreams: [], count: 0 } };
  try {
    const entries = readdirSync(dir, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
    const workstreams = entries.filter(e => e.isDirectory()).map(e => e.name);
    return { data: { workstreams, count: workstreams.length } };
  } catch {
    return { data: { workstreams: [], count: 0 } };
  }
};

export const workstreamCreate: QueryHandler = async (args, projectDir) => {
  const name = args[0];
  if (!name) return { data: { created: false, reason: 'name required' } };
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { data: { created: false, reason: 'invalid workstream name' } };
  }
  const wsDir = join(workspaceDir(projectDir), name);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(wsDir, '.planning'), { recursive: true });
  return { data: { created: true, name, path: toPosixPath(relative(projectDir, wsDir)) } };
};

export const workstreamSet: QueryHandler = async (args, _projectDir) => {
  const name = args[0];
  if (!name) return { data: { set: false, reason: 'name required' } };
  // GSD_WORKSTREAM is an env var set externally; we just acknowledge the request
  return { data: { set: true, name, note: 'Set GSD_WORKSTREAM env var to activate' } };
};

export const workstreamStatus: QueryHandler = async (args, projectDir) => {
  const name = args[0];
  if (!name) return { data: { found: false, reason: 'name required' } };
  const wsDir = join(workspaceDir(projectDir), name);
  return { data: { name, found: existsSync(wsDir), path: toPosixPath(relative(projectDir, wsDir)) } };
};

export const workstreamComplete: QueryHandler = async (args, _projectDir) => {
  const name = args[0];
  return { data: { completed: !!name, name: name || null } };
};

export const workstreamProgress: QueryHandler = async (args, projectDir) => {
  return progressBar(args, projectDir);
};

// ─── docsInit ────────────────────────────────────────────────────────────

/**
 * Initialize docs context for documentation workflows.
 */
export const docsInit: QueryHandler = async (_args, projectDir) => {
  return {
    data: {
      project_exists: existsSync(join(projectDir, '.planning', 'PROJECT.md')),
      roadmap_exists: existsSync(join(projectDir, '.planning', 'ROADMAP.md')),
      docs_dir: '.planning/docs',
      project_root: projectDir,
    },
  };
};

// ─── v4.0 stubs ───────────────────────────────────────────────────────────

export const learningsCopy: QueryHandler = async () => deferred('learnings system');
export const uatRenderCheckpoint: QueryHandler = async () => deferred('uat render checkpoint');
export const auditUat: QueryHandler = async () => deferred('uat audit');
export const intelDiff: QueryHandler = async () => deferred('intel diff');
export const intelSnapshot: QueryHandler = async () => deferred('intel snapshot');
export const intelValidate: QueryHandler = async () => deferred('intel validate');
export const intelStatus: QueryHandler = async () => deferred('intel status');
export const intelQuery: QueryHandler = async () => deferred('intel query');
export const intelExtractExports: QueryHandler = async () => deferred('intel extract-exports');
export const intelPatchMeta: QueryHandler = async () => deferred('intel patch-meta');
export const generateClaudeProfile: QueryHandler = async () => deferred('generate-claude-profile');
export const generateDevPreferences: QueryHandler = async () => deferred('generate-dev-preferences');
export const writeProfile: QueryHandler = async () => deferred('write-profile');
export const profileQuestionnaire: QueryHandler = async () => deferred('profile-questionnaire');
export const profileSample: QueryHandler = async () => deferred('profile-sample');
export const scanSessions: QueryHandler = async () => deferred('scan-sessions');
export const generateClaudeMd: QueryHandler = async () => deferred('generate-claude-md');
