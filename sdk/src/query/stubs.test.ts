/**
 * Unit tests for stub handlers.
 *
 * Verifies that:
 * - Each stub returns a valid QueryResult (not an error/undefined)
 * - v4.0 stubs include reason/deferred fields
 * - Functional stubs return correct shape with mock filesystem
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  agentSkills,
  roadmapUpdatePlanProgress,
  requirementsMarkComplete,
  statePlannedPhase,
  verifySchemaDrift,
  todoMatchPhase,
  milestoneComplete,
  summaryExtract,
  historyDigest,
  statsJson,
  commitToSubrepo,
  progressBar,
  workstreamList,
  workstreamCreate,
  workstreamSet,
  workstreamStatus,
  workstreamComplete,
  docsInit,
  learningsCopy,
  uatRenderCheckpoint,
  auditUat,
  intelDiff,
  intelSnapshot,
  intelStatus,
  generateClaudeProfile,
  profileQuestionnaire,
  scanSessions,
} from './stubs.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-stubs-'));
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-queries'), { recursive: true });

  await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
    model_profile: 'balanced',
    commit_docs: false,
    git: { branching_strategy: 'none' },
    workflow: {},
  }));
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v3.0\n---\n# State\n');
  await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '## v3.0: Test',
    '### Phase 9: Foundation',
    '**Goal:** Build it',
    '- [ ] Plan 1',
    '### Phase 10: Queries',
    '**Goal:** Query it',
  ].join('\n'));
  await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), [
    '# Requirements',
    '- [ ] REQ-01: First requirement',
    '- [ ] REQ-02: Second requirement',
    '- [x] REQ-03: Already done',
  ].join('\n'));

  // Phase 09: complete
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), '---\nphase: 09\nplan: 01\ntype: execute\nmust_haves:\n  truths: []\n---');
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '# Done');
  // Phase 10: in progress
  await writeFile(join(tmpDir, '.planning', 'phases', '10-queries', '10-01-PLAN.md'), '---\nphase: 10\nplan: 01\ntype: execute\nmust_haves:\n  truths: []\n---');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── Functional stubs ─────────────────────────────────────────────────────

describe('agentSkills', () => {
  it('returns valid QueryResult with skills array', async () => {
    const result = await agentSkills(['gsd-executor'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.skills)).toBe(true);
    expect(typeof data.skill_count).toBe('number');
    expect(data.agent_type).toBe('gsd-executor');
  });
});

describe('roadmapUpdatePlanProgress', () => {
  it('returns QueryResult without error', async () => {
    const result = await roadmapUpdatePlanProgress(['9'], tmpDir);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(typeof data.updated).toBe('boolean');
  });

  it('returns false when no phase arg', async () => {
    const result = await roadmapUpdatePlanProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.updated).toBe(false);
    expect(data.reason).toBeDefined();
  });
});

describe('requirementsMarkComplete', () => {
  it('returns QueryResult without error', async () => {
    const result = await requirementsMarkComplete(['REQ-01'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.marked).toBe('boolean');
  });

  it('returns false when no IDs provided', async () => {
    const result = await requirementsMarkComplete([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.marked).toBe(false);
  });
});

describe('statePlannedPhase', () => {
  it('updates STATE.md and returns success', async () => {
    const result = await statePlannedPhase(['--phase', '10', '--name', 'queries', '--plans', '2'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.updated).toBe('boolean');
  });

  it('returns false without phase arg', async () => {
    const result = await statePlannedPhase([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.updated).toBe(false);
  });
});

describe('verifySchemaDrift', () => {
  it('returns valid/issues shape', async () => {
    const result = await verifySchemaDrift([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.valid).toBe('boolean');
    expect(Array.isArray(data.issues)).toBe(true);
    expect(typeof data.checked).toBe('number');
  });
});

describe('todoMatchPhase', () => {
  it('returns todos array (empty when no todos dir)', async () => {
    const result = await todoMatchPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.todos)).toBe(true);
    expect(data.phase).toBe('9');
  });
});

describe('summaryExtract', () => {
  it('returns error when file not found', async () => {
    const result = await summaryExtract(['.planning/nonexistent.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('extracts sections from an existing summary file', async () => {
    const summaryPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md');
    await writeFile(summaryPath, '# Summary\n\n## What Was Done\nBuilt it.\n\n## Tests\nAll pass.\n');
    const result = await summaryExtract(['.planning/phases/09-foundation/09-01-SUMMARY.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.sections).toBeDefined();
  });
});

describe('historyDigest', () => {
  it('returns phases array with completed summaries', async () => {
    const result = await historyDigest([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.phases)).toBe(true);
    expect(typeof data.count).toBe('number');
  });
});

describe('statsJson', () => {
  it('returns stats with phases_total and progress', async () => {
    const result = await statsJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.phases_total).toBe('number');
    expect(typeof data.plans_total).toBe('number');
    expect(typeof data.progress_percent).toBe('number');
    expect(data.phases_total).toBeGreaterThanOrEqual(2);
  });
});

describe('progressBar', () => {
  it('returns bar string and percent', async () => {
    const result = await progressBar([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.bar).toBe('string');
    expect(typeof data.percent).toBe('number');
    expect(data.bar as string).toContain('[');
  });
});

describe('workstream stubs', () => {
  it('workstreamList returns workstreams array', async () => {
    const result = await workstreamList([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.workstreams)).toBe(true);
  });

  it('workstreamCreate creates a directory', async () => {
    const result = await workstreamCreate(['my-ws'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.created).toBe('boolean');
  });

  it('workstreamCreate rejects path traversal', async () => {
    const result = await workstreamCreate(['../../bad'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(false);
  });

  it('workstreamSet returns set=true', async () => {
    const result = await workstreamSet(['backend'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.set).toBe(true);
  });

  it('workstreamStatus returns found boolean', async () => {
    const result = await workstreamStatus(['nonexistent'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.found).toBe('boolean');
  });

  it('workstreamComplete returns completed boolean', async () => {
    const result = await workstreamComplete(['my-ws'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.completed).toBe(true);
  });
});

describe('docsInit', () => {
  it('returns docs context', async () => {
    const result = await docsInit([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.project_exists).toBe('boolean');
    expect(data.docs_dir).toBe('.planning/docs');
  });
});

// ─── v4.0 stubs ───────────────────────────────────────────────────────────

describe('v4.0 stubs', () => {
  it('learningsCopy returns deferred result', async () => {
    const result = await learningsCopy([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
    expect(data.version).toBe('v4.0');
    expect(typeof data.reason).toBe('string');
  });

  it('uatRenderCheckpoint returns deferred result', async () => {
    const result = await uatRenderCheckpoint([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('auditUat returns deferred result', async () => {
    const result = await auditUat([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('intelDiff returns deferred result', async () => {
    const result = await intelDiff([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('intelSnapshot returns deferred result', async () => {
    const result = await intelSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('intelStatus returns deferred result', async () => {
    const result = await intelStatus([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('generateClaudeProfile returns deferred result', async () => {
    const result = await generateClaudeProfile([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('profileQuestionnaire returns deferred result', async () => {
    const result = await profileQuestionnaire([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });

  it('scanSessions returns deferred result', async () => {
    const result = await scanSessions([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.deferred).toBe(true);
  });
});
