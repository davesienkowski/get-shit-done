/**
 * Advanced feature handlers — full SDK implementations of intel, learnings,
 * UAT audit, and profile commands.
 *
 * These replace the v4.0-deferred stubs in stubs.ts with real implementations
 * ported from the CJS modules (intel.cjs, learnings.cjs, uat.cjs,
 * profile-pipeline.cjs, profile-output.cjs).
 *
 * Per the Phase 14 locked decision: "No CJS shim — migrate everything now.
 * For v4.0 features (intel, learnings, uat, security, profile) fully migrate."
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, basename, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';

import { planningPaths, toPosixPath, normalizePhaseName } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── Intel — .planning/intel/ file management ─────────────────────────────

const INTEL_FILES: Record<string, string> = {
  files: 'files.json',
  apis: 'apis.json',
  deps: 'deps.json',
  arch: 'arch.md',
  stack: 'stack.json',
};

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function intelDir(projectDir: string): string {
  return join(projectDir, '.planning', 'intel');
}

function isIntelEnabled(projectDir: string): boolean {
  try {
    const cfg = JSON.parse(readFileSync(planningPaths(projectDir).config, 'utf-8'));
    return cfg?.intel?.enabled === true;
  } catch {
    return false;
  }
}

function intelFilePath(projectDir: string, filename: string): string {
  return join(intelDir(projectDir), filename);
}

function safeReadJson(filePath: string): unknown {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function hashFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

function searchJsonEntries(data: unknown, term: string): unknown[] {
  const lowerTerm = term.toLowerCase();
  const results: unknown[] = [];
  if (!data || typeof data !== 'object') return results;

  function matchesInValue(value: unknown): boolean {
    if (typeof value === 'string') return value.toLowerCase().includes(lowerTerm);
    if (Array.isArray(value)) return value.some(v => matchesInValue(v));
    if (value && typeof value === 'object') return Object.values(value as object).some(v => matchesInValue(v));
    return false;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (matchesInValue(entry)) results.push(entry);
    }
  } else {
    for (const [, value] of Object.entries(data as object)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (matchesInValue(entry)) results.push(entry);
        }
      }
    }
  }
  return results;
}

function searchArchMd(filePath: string, term: string): string[] {
  if (!existsSync(filePath)) return [];
  const lowerTerm = term.toLowerCase();
  const content = readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.toLowerCase().includes(lowerTerm));
}

export const intelStatus: QueryHandler = async (_args, projectDir) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: 'Intel system disabled. Set intel.enabled=true in config.json to activate.' } };
  }
  const now = Date.now();
  const files: Record<string, unknown> = {};
  let overallStale = false;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    if (!existsSync(filePath)) {
      files[filename] = { exists: false, updated_at: null, stale: true };
      overallStale = true;
      continue;
    }
    let updatedAt: string | null = null;
    if (filename.endsWith('.md')) {
      try { updatedAt = statSync(filePath).mtime.toISOString(); } catch { /* skip */ }
    } else {
      const data = safeReadJson(filePath) as Record<string, unknown> | null;
      if (data?._meta) {
        updatedAt = (data._meta as Record<string, unknown>).updated_at as string | null;
      }
    }
    const stale = !updatedAt || (now - new Date(updatedAt).getTime()) > STALE_MS;
    if (stale) overallStale = true;
    files[filename] = { exists: true, updated_at: updatedAt, stale };
  }
  return { data: { files, overall_stale: overallStale } };
};

export const intelDiff: QueryHandler = async (_args, projectDir) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: 'Intel system disabled.' } };
  }
  const snapshotPath = intelFilePath(projectDir, '.last-refresh.json');
  const snapshot = safeReadJson(snapshotPath) as Record<string, unknown> | null;
  if (!snapshot) return { data: { no_baseline: true } };

  const prevHashes = (snapshot.hashes as Record<string, string>) || {};
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    const currentHash = hashFile(filePath);
    if (currentHash && !prevHashes[filename]) added.push(filename);
    else if (currentHash && prevHashes[filename] && currentHash !== prevHashes[filename]) changed.push(filename);
    else if (!currentHash && prevHashes[filename]) removed.push(filename);
  }
  return { data: { changed, added, removed } };
};

export const intelSnapshot: QueryHandler = async (_args, projectDir) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: 'Intel system disabled.' } };
  }
  const dir = intelDir(projectDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const hashes: Record<string, string> = {};
  let fileCount = 0;
  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = join(dir, filename);
    const hash = hashFile(filePath);
    if (hash) { hashes[filename] = hash; fileCount++; }
  }

  const timestamp = new Date().toISOString();
  writeFileSync(join(dir, '.last-refresh.json'), JSON.stringify({ hashes, timestamp, version: 1 }, null, 2), 'utf-8');
  return { data: { saved: true, timestamp, files: fileCount } };
};

export const intelValidate: QueryHandler = async (_args, projectDir) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: 'Intel system disabled.' } };
  }
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    if (!existsSync(filePath)) {
      errors.push(`Missing intel file: ${filename}`);
      continue;
    }
    if (!filename.endsWith('.md')) {
      const data = safeReadJson(filePath) as Record<string, unknown> | null;
      if (!data) { errors.push(`Invalid JSON in: ${filename}`); continue; }
      const meta = data._meta as Record<string, unknown> | undefined;
      if (!meta?.updated_at) warnings.push(`${filename}: missing _meta.updated_at`);
      else {
        const age = Date.now() - new Date(meta.updated_at as string).getTime();
        if (age > STALE_MS) warnings.push(`${filename}: stale (${Math.round(age / 3600000)}h old)`);
      }
    }
  }
  return { data: { valid: errors.length === 0, errors, warnings } };
};

export const intelQuery: QueryHandler = async (args, projectDir) => {
  const term = args[0] || '';
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: 'Intel system disabled.' } };
  }
  const matches: unknown[] = [];
  let total = 0;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    if (filename.endsWith('.md')) {
      const filePath = intelFilePath(projectDir, filename);
      const archMatches = searchArchMd(filePath, term);
      if (archMatches.length > 0) { matches.push({ source: filename, entries: archMatches }); total += archMatches.length; }
    } else {
      const filePath = intelFilePath(projectDir, filename);
      const data = safeReadJson(filePath);
      if (!data) continue;
      const found = searchJsonEntries(data, term);
      if (found.length > 0) { matches.push({ source: filename, entries: found }); total += found.length; }
    }
  }
  return { data: { matches, term, total } };
};

export const intelExtractExports: QueryHandler = async (args, projectDir) => {
  const filePath = args[0] ? resolve(projectDir, args[0]) : '';
  if (!filePath || !existsSync(filePath)) {
    return { data: { file: filePath, exports: [], method: 'none' } };
  }

  const content = readFileSync(filePath, 'utf-8');
  const exports: string[] = [];
  let method = 'none';

  // CJS: module.exports = { ... }
  const allMatches = [...content.matchAll(/module\.exports\s*=\s*\{/g)];
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1];
    const startIdx = lastMatch.index! + lastMatch[0].length;
    let depth = 1; let endIdx = startIdx;
    while (endIdx < content.length && depth > 0) {
      if (content[endIdx] === '{') depth++;
      else if (content[endIdx] === '}') depth--;
      if (depth > 0) endIdx++;
    }
    const block = content.substring(startIdx, endIdx);
    method = 'module.exports';
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('*')) continue;
      const k = t.match(/^(\w+)\s*[,}:]/) || t.match(/^(\w+)$/);
      if (k) exports.push(k[1]);
    }
  }
  // CJS: exports.X =
  for (const m of content.matchAll(/^exports\.(\w+)\s*=/gm)) {
    if (!exports.includes(m[1])) { exports.push(m[1]); if (method === 'none') method = 'exports.X'; }
  }
  // ESM
  const esmExports: string[] = [];
  for (const m of content.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/gm)) {
    if (!esmExports.includes(m[1])) esmExports.push(m[1]);
  }
  for (const m of content.matchAll(/^export\s+(?:const|let|var)\s+(\w+)\s*=/gm)) {
    if (!esmExports.includes(m[1])) esmExports.push(m[1]);
  }
  for (const m of content.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const item of m[1].split(',')) {
      const name = item.trim().split(/\s+as\s+/)[0].trim();
      if (name && !esmExports.includes(name)) esmExports.push(name);
    }
  }
  for (const e of esmExports) {
    if (!exports.includes(e)) exports.push(e);
  }
  if (esmExports.length > 0 && exports.length > esmExports.length) method = 'mixed';
  else if (esmExports.length > 0 && method === 'none') method = 'esm';

  return { data: { file: args[0], exports, method } };
};

export const intelPatchMeta: QueryHandler = async (args, projectDir) => {
  const filePath = args[0] ? resolve(projectDir, args[0]) : '';
  if (!filePath || !existsSync(filePath)) {
    return { data: { patched: false, error: `File not found: ${filePath}` } };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data._meta) data._meta = {};
    const meta = data._meta as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    meta.updated_at = timestamp;
    meta.version = ((meta.version as number) || 0) + 1;
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return { data: { patched: true, file: args[0], timestamp } };
  } catch (err) {
    return { data: { patched: false, error: String(err) } };
  }
};

// ─── Learnings — ~/.gsd/knowledge/ knowledge store ───────────────────────

const STORE_DIR = join(homedir(), '.gsd', 'knowledge');

function ensureStore(): void {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
}

function learningsWrite(entry: { source_project: string; learning: string; context?: string; tags?: string[] }): { created: boolean; id: string } {
  ensureStore();
  const hash = createHash('sha256').update(entry.learning + '\n' + entry.source_project).digest('hex');
  // Check for duplicates
  for (const file of readdirSync(STORE_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const r = JSON.parse(readFileSync(join(STORE_DIR, file), 'utf-8'));
      if (r.content_hash === hash) return { created: false, id: r.id };
    } catch { /* skip */ }
  }
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const record = { id, source_project: entry.source_project, date: new Date().toISOString(), context: entry.context ?? '', learning: entry.learning, tags: entry.tags ?? [], content_hash: hash };
  writeFileSync(join(STORE_DIR, `${id}.json`), JSON.stringify(record, null, 2), 'utf-8');
  return { created: true, id };
}

export const learningsCopy: QueryHandler = async (_args, projectDir) => {
  const planningDir = join(projectDir, '.planning');
  const learningsPath = join(planningDir, 'LEARNINGS.md');
  if (!existsSync(learningsPath)) {
    return { data: { copied: false, total: 0, created: 0, skipped: 0, reason: 'No LEARNINGS.md found' } };
  }
  const content = readFileSync(learningsPath, 'utf-8');
  const sourceProject = basename(resolve(projectDir));
  const sections = content.split(/^## /m).slice(1);
  let created = 0; let skipped = 0;

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    if (!body) continue;
    const tags = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const result = learningsWrite({ source_project: sourceProject, learning: body, context: title, tags });
    if (result.created) created++; else skipped++;
  }
  return { data: { copied: true, total: created + skipped, created, skipped } };
};

// ─── UAT Audit — scan UAT/VERIFICATION files ──────────────────────────────

function parseUatItems(content: string): string[] {
  const items: string[] = [];
  for (const line of content.split('\n')) {
    if (/^-\s*\[\s*\]/.test(line) || /^-\s*\[[ ]\]/.test(line)) {
      items.push(line.trim());
    }
  }
  return items;
}

function parseVerificationItems(content: string): string[] {
  const items: string[] = [];
  const gapSection = /## gaps?|## issues?|## failures?/i;
  let inGapSection = false;
  for (const line of content.split('\n')) {
    if (/^##/.test(line)) { inGapSection = gapSection.test(line); continue; }
    if (inGapSection && line.trim().startsWith('-')) items.push(line.trim());
  }
  return items;
}

function extractFrontmatterStatus(content: string): string {
  const match = content.match(/^---[\s\S]*?^status:\s*(.+?)[\r\n]/m);
  return match ? match[1].trim() : 'unknown';
}

export const auditUat: QueryHandler = async (_args, projectDir) => {
  const paths = planningPaths(projectDir);
  if (!existsSync(paths.phases)) {
    return { data: { results: [], summary: { total_files: 0, total_items: 0 } } };
  }

  const results: Record<string, unknown>[] = [];
  const entries = readdirSync(paths.phases, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;

  for (const entry of entries.filter(e => e.isDirectory())) {
    const phaseMatch = entry.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : entry.name;
    const phaseDir = join(paths.phases, entry.name);
    const files = readdirSync(phaseDir);

    for (const file of files.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const content = readFileSync(join(phaseDir, file), 'utf-8');
      const items = parseUatItems(content);
      if (items.length > 0) {
        results.push({ phase: phaseNum, phase_dir: entry.name, file, file_path: toPosixPath(relative(projectDir, join(phaseDir, file))), type: 'uat', status: extractFrontmatterStatus(content), items });
      }
    }

    for (const file of files.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const content = readFileSync(join(phaseDir, file), 'utf-8');
      const status = extractFrontmatterStatus(content);
      if (status === 'human_needed' || status === 'gaps_found') {
        const items = parseVerificationItems(content);
        if (items.length > 0) {
          results.push({ phase: phaseNum, phase_dir: entry.name, file, file_path: toPosixPath(relative(projectDir, join(phaseDir, file))), type: 'verification', status, items });
        }
      }
    }
  }

  const totalItems = results.reduce((sum, r) => sum + ((r.items as unknown[]).length), 0);
  return { data: { results, summary: { total_files: results.length, total_items: totalItems } } };
};

// ─── Profile — session scanning and profile generation ────────────────────

const SESSIONS_DIR = join(homedir(), '.claude', 'projects');

export const scanSessions: QueryHandler = async (_args, _projectDir) => {
  if (!existsSync(SESSIONS_DIR)) {
    return { data: { projects: [], project_count: 0, session_count: 0 } };
  }

  const projects: Record<string, unknown>[] = [];
  let sessionCount = 0;

  try {
    const projectDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
    for (const pDir of projectDirs.filter(e => e.isDirectory())) {
      const pPath = join(SESSIONS_DIR, pDir.name);
      const sessions = readdirSync(pPath).filter(f => f.endsWith('.jsonl'));
      sessionCount += sessions.length;
      projects.push({ name: pDir.name, path: toPosixPath(pPath), session_count: sessions.length });
    }
  } catch { /* skip */ }

  return { data: { projects, project_count: projects.length, session_count: sessionCount } };
};

export const profileSample: QueryHandler = async (_args, _projectDir) => {
  if (!existsSync(SESSIONS_DIR)) {
    return { data: { messages: [], total: 0, projects_sampled: 0 } };
  }
  // Sample user messages from recent sessions (read-only, max 50 messages)
  const messages: string[] = [];
  let projectsSampled = 0;

  try {
    const projectDirs = readdirSync(SESSIONS_DIR, { withFileTypes: true }) as unknown as Array<{ isDirectory(): boolean; name: string }>;
    for (const pDir of projectDirs.filter(e => e.isDirectory()).slice(0, 5)) {
      const pPath = join(SESSIONS_DIR, pDir.name);
      const sessions = readdirSync(pPath).filter(f => f.endsWith('.jsonl')).slice(0, 3);
      for (const session of sessions) {
        try {
          const content = readFileSync(join(pPath, session), 'utf-8');
          for (const line of content.split('\n').filter(Boolean)) {
            try {
              const record = JSON.parse(line);
              if (record.type === 'user' && typeof record.message?.content === 'string') {
                messages.push(record.message.content.slice(0, 500));
                if (messages.length >= 50) break;
              }
            } catch { /* skip malformed */ }
          }
        } catch { /* skip */ }
        if (messages.length >= 50) break;
      }
      projectsSampled++;
      if (messages.length >= 50) break;
    }
  } catch { /* skip */ }

  return { data: { messages, total: messages.length, projects_sampled: projectsSampled } };
};

// Questionnaire data (from profile-output.cjs PROFILING_QUESTIONS)
const PROFILING_QUESTIONS = [
  { dimension: 'communication_style', header: 'Communication Style', question: 'When you ask Claude to build something, how much context do you typically provide?', options: [{ label: 'Minimal', value: 'a', rating: 'terse-direct' }, { label: 'Some context', value: 'b', rating: 'conversational' }, { label: 'Detailed specs', value: 'c', rating: 'detailed-structured' }, { label: 'It depends', value: 'd', rating: 'mixed' }] },
  { dimension: 'decision_speed', header: 'Decision Making', question: 'When Claude presents you with options, how do you typically decide?', options: [{ label: 'Pick quickly', value: 'a', rating: 'fast-intuitive' }, { label: 'Ask for comparison', value: 'b', rating: 'deliberate-informed' }, { label: 'Research independently', value: 'c', rating: 'research-first' }, { label: 'Let Claude recommend', value: 'd', rating: 'delegator' }] },
  { dimension: 'explanation_depth', header: 'Explanation Preferences', question: 'When Claude explains something, how much detail do you want?', options: [{ label: 'Just the code', value: 'a', rating: 'code-only' }, { label: 'Brief explanation', value: 'b', rating: 'concise' }, { label: 'Detailed walkthrough', value: 'c', rating: 'detailed' }, { label: 'Deep dive', value: 'd', rating: 'educational' }] },
];

export const profileQuestionnaire: QueryHandler = async (args, _projectDir) => {
  const answersFlag = args.indexOf('--answers');
  if (answersFlag >= 0 && args[answersFlag + 1]) {
    // Read and validate provided answers
    try {
      const answers = JSON.parse(readFileSync(resolve(args[answersFlag + 1]), 'utf-8')) as Record<string, string>;
      const analysis: Record<string, string> = {};
      for (const q of PROFILING_QUESTIONS) {
        const answer = answers[q.dimension];
        const option = q.options.find(o => o.value === answer);
        analysis[q.dimension] = option?.rating ?? 'unknown';
      }
      return { data: { analysis, answered: Object.keys(answers).length, questions_total: PROFILING_QUESTIONS.length } };
    } catch {
      return { data: { error: 'Failed to read answers file', path: args[answersFlag + 1] } };
    }
  }
  return { data: { questions: PROFILING_QUESTIONS, total: PROFILING_QUESTIONS.length } };
};

export const writeProfile: QueryHandler = async (args, projectDir) => {
  const inputFlag = args.indexOf('--input');
  const inputPath = inputFlag >= 0 ? args[inputFlag + 1] : null;
  if (!inputPath || !existsSync(resolve(inputPath))) {
    return { data: { written: false, reason: 'No --input analysis file provided' } };
  }
  try {
    const analysis = JSON.parse(readFileSync(resolve(inputPath), 'utf-8')) as Record<string, unknown>;
    const profilePath = join(projectDir, '.planning', 'USER-PROFILE.md');
    const lines = ['# User Developer Profile', '', `*Generated: ${new Date().toISOString()}*`, ''];
    for (const [key, value] of Object.entries(analysis)) {
      lines.push(`## ${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
      lines.push('');
      lines.push(String(value));
      lines.push('');
    }
    await writeFile(profilePath, lines.join('\n'), 'utf-8');
    return { data: { written: true, path: toPosixPath(relative(projectDir, profilePath)) } };
  } catch (err) {
    return { data: { written: false, reason: String(err) } };
  }
};

export const generateClaudeProfile: QueryHandler = async (args, projectDir) => {
  const analysisFlag = args.indexOf('--analysis');
  const analysisPath = analysisFlag >= 0 ? args[analysisFlag + 1] : null;
  let profile = '> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.\n> This section is managed by `generate-claude-profile` -- do not edit manually.';

  if (analysisPath && existsSync(resolve(analysisPath))) {
    try {
      const analysis = JSON.parse(readFileSync(resolve(analysisPath), 'utf-8')) as Record<string, unknown>;
      const lines = ['## Developer Profile', ''];
      for (const [key, value] of Object.entries(analysis)) {
        lines.push(`- **${key.replace(/_/g, ' ')}**: ${value}`);
      }
      profile = lines.join('\n');
    } catch { /* use fallback */ }
  }

  return { data: { profile, generated: true } };
};

export const generateDevPreferences: QueryHandler = async (args, projectDir) => {
  const analysisFlag = args.indexOf('--analysis');
  const analysisPath = analysisFlag >= 0 ? args[analysisFlag + 1] : null;
  const prefs: Record<string, unknown> = {};

  if (analysisPath && existsSync(resolve(analysisPath))) {
    try {
      const analysis = JSON.parse(readFileSync(resolve(analysisPath), 'utf-8')) as Record<string, unknown>;
      Object.assign(prefs, analysis);
    } catch { /* use empty */ }
  }

  const prefsPath = join(projectDir, '.planning', 'dev-preferences.md');
  const lines = ['# Developer Preferences', '', `*Generated: ${new Date().toISOString()}*`, ''];
  for (const [key, value] of Object.entries(prefs)) {
    lines.push(`- **${key}**: ${value}`);
  }
  await writeFile(prefsPath, lines.join('\n'), 'utf-8');
  return { data: { written: true, path: toPosixPath(relative(projectDir, prefsPath)), preferences: prefs } };
};

export const generateClaudeMd: QueryHandler = async (_args, projectDir) => {
  // Generate CLAUDE.md sections from .planning/ files
  const safeRead = (path: string): string | null => {
    try { return existsSync(path) ? readFileSync(path, 'utf-8') : null; } catch { return null; }
  };

  const sections: string[] = [];

  const projectContent = safeRead(join(projectDir, '.planning', 'PROJECT.md'));
  if (projectContent) {
    const h1 = projectContent.match(/^# (.+)$/m);
    if (h1) sections.push(`## Project\n\n${h1[1]}\n`);
  }

  const stackContent = safeRead(join(projectDir, '.planning', 'codebase', 'STACK.md')) ?? safeRead(join(projectDir, '.planning', 'research', 'STACK.md'));
  if (stackContent) sections.push(`## Technology Stack\n\n${stackContent.slice(0, 1000)}\n`);

  return { data: { sections, generated: true, section_count: sections.length } };
};
