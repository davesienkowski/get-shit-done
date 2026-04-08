/**
 * Unit tests for phase lifecycle handlers.
 *
 * Tests phaseAdd, phaseInsert, phaseScaffold, replaceInCurrentMilestone,
 * and readModifyWriteRoadmapMd.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MINIMAL_ROADMAP = `# Roadmap

## Current Milestone: v3.0 SDK-First Migration

### Phase 9: Foundation

**Goal:** Build foundation
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 3 plans

Plans:
- [x] 09-01 (Foundation setup)

### Phase 10: Read-Only Queries

**Goal:** Port queries.
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 3 plans

Plans:
- [x] 10-01 (Query setup)

---
*Last updated: 2026-04-08*
`;

const ROADMAP_WITH_DETAILS = `# Roadmap

<details>
<summary>v1.0 (shipped)</summary>

### Phase 1: Old Phase

**Goal:** Shipped already
**Plans:** 2 plans

</details>

## Current Milestone: v3.0 SDK-First Migration

### Phase 9: Foundation

**Goal:** Build foundation
**Requirements**: TBD
**Plans:** 3 plans

### Phase 10: Read-Only Queries

**Goal:** Port queries.
**Requirements**: TBD
**Plans:** 3 plans

---
*Last updated: 2026-04-08*
`;

const MINIMAL_STATE = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
---

# Project State

## Current Position

Phase: 10 (Read-Only Queries) — EXECUTING
Plan: 2 of 3
Status: Executing Phase 10

## Session Continuity

Last session: 2026-04-07T10:00:00.000Z
Stopped at: Completed 10-02-PLAN.md
`;

/** Create a test project with .planning structure. */
async function setupTestProject(
  tmpDir: string,
  opts?: { roadmap?: string; state?: string; config?: Record<string, unknown>; phases?: string[] }
): Promise<string> {
  const planningDir = join(tmpDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  const phasesDir = join(planningDir, 'phases');
  await mkdir(phasesDir, { recursive: true });
  await writeFile(join(planningDir, 'ROADMAP.md'), opts?.roadmap || MINIMAL_ROADMAP, 'utf-8');
  await writeFile(join(planningDir, 'STATE.md'), opts?.state || MINIMAL_STATE, 'utf-8');
  await writeFile(
    join(planningDir, 'config.json'),
    JSON.stringify(opts?.config || { model_profile: 'balanced', phase_naming: 'sequential' }),
    'utf-8'
  );
  // Create phase directories if requested
  if (opts?.phases) {
    for (const phase of opts.phases) {
      await mkdir(join(phasesDir, phase), { recursive: true });
      await writeFile(join(phasesDir, phase, '.gitkeep'), '', 'utf-8');
    }
  }
  return tmpDir;
}

// ─── Tests ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-lifecycle-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── replaceInCurrentMilestone ──────────────────────────────────────────

describe('replaceInCurrentMilestone', () => {
  it('replaces in full content when no details blocks', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    const content = '### Phase 9: Foundation\n**Plans:** 3 plans\n';
    const result = replaceInCurrentMilestone(content, /3 plans/, '4 plans');
    expect(result).toContain('4 plans');
  });

  it('only replaces after last </details> block', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    const content = '<details>\n### Phase 1: Old\n**Plans:** 3 plans\n</details>\n\n### Phase 9: Current\n**Plans:** 3 plans\n';
    const result = replaceInCurrentMilestone(content, /3 plans/, '4 plans');
    // Should only replace in the current milestone section (after </details>)
    const before = result.slice(0, result.indexOf('</details>') + '</details>'.length);
    const after = result.slice(result.indexOf('</details>') + '</details>'.length);
    expect(before).toContain('3 plans'); // old milestone untouched
    expect(after).toContain('4 plans'); // current milestone updated
  });
});

// ─── readModifyWriteRoadmapMd ───────────────────────────────────────────

describe('readModifyWriteRoadmapMd', () => {
  it('reads, modifies, and writes ROADMAP.md atomically', async () => {
    const { readModifyWriteRoadmapMd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);
    const result = await readModifyWriteRoadmapMd(tmpDir, (content) => {
      return content.replace('Port queries.', 'Port all queries.');
    });
    expect(result).toContain('Port all queries.');
    const ondisk = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(ondisk).toContain('Port all queries.');
  });

  it('creates and releases lockfile', async () => {
    const { readModifyWriteRoadmapMd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);
    await readModifyWriteRoadmapMd(tmpDir, (c) => c);
    // Lock should be released after operation
    const lockPath = join(tmpDir, '.planning', 'ROADMAP.md.lock');
    expect(existsSync(lockPath)).toBe(false);
  });
});

// ─── phaseAdd ──────────────────────────────────────────────────────────

describe('phaseAdd', () => {
  it('creates directory and updates ROADMAP.md for sequential phase', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phaseAdd(['New Feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe(11);
    expect(data.padded).toBe('11');
    expect(data.name).toBe('New Feature');
    expect(data.slug).toBe('new-feature');
    expect(data.naming_mode).toBe('sequential');

    // Verify directory was created
    const dir = data.directory as string;
    expect(dir).toContain('11-new-feature');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const newDir = entries.find(e => e.isDirectory() && e.name.includes('11-new-feature'));
    expect(newDir).toBeTruthy();

    // Verify .gitkeep
    expect(existsSync(join(phasesDir, newDir!.name, '.gitkeep'))).toBe(true);

    // Verify ROADMAP.md updated
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(roadmap).toContain('### Phase 11: New Feature');
    expect(roadmap).toContain('**Goal:** [To be planned]');
  });

  it('skips phases >= 999 when calculating next number (backlog exclusion)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    const roadmapWith999 = MINIMAL_ROADMAP.replace(
      '---\n*Last updated',
      '### Phase 999: Backlog\n\n**Goal:** Backlog items\n**Plans:** 0 plans\n\n---\n*Last updated'
    );
    await setupTestProject(tmpDir, { roadmap: roadmapWith999 });

    const result = await phaseAdd(['After Ten'], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Should be 11, not 1000
    expect(data.phase_number).toBe(11);
  });

  it('throws GSDError with Validation for empty description', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseAdd([], tmpDir)).rejects.toThrow('description required');
  });

  it('inserts phase entry before last --- separator', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await phaseAdd(['Inserted Phase'], tmpDir);
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // The new phase should appear before the trailing ---
    const phaseIdx = roadmap.indexOf('### Phase 11: Inserted Phase');
    const sepIdx = roadmap.lastIndexOf('\n---');
    expect(phaseIdx).toBeLessThan(sepIdx);
    expect(phaseIdx).toBeGreaterThan(0);
  });
});

// ─── phaseInsert ────────────────────────────────────────────────────────

describe('phaseInsert', () => {
  it('creates decimal phase directory after target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phaseInsert(['10', 'Urgent Fix'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe('10.1');
    expect(data.after_phase).toBe('10');
    expect(data.name).toBe('Urgent Fix');
    expect(data.slug).toBe('urgent-fix');

    // Verify directory created
    const dir = data.directory as string;
    expect(dir).toContain('10.1-urgent-fix');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const newDir = entries.find(e => e.isDirectory() && e.name.includes('10.1-urgent-fix'));
    expect(newDir).toBeTruthy();
  });

  it('scans both directories and ROADMAP.md for existing decimals to avoid collisions', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries', '10.1-hotfix'],
    });

    const result = await phaseInsert(['10', 'Another Fix'], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Should be 10.2 since 10.1 already exists on disk
    expect(data.phase_number).toBe('10.2');
  });

  it('inserts section in ROADMAP.md after target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await phaseInsert(['10', 'Urgent Fix'], tmpDir);
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    expect(roadmap).toContain('### Phase 10.1: Urgent Fix (INSERTED)');
    // Should appear after Phase 10 section
    const phase10Idx = roadmap.indexOf('### Phase 10:');
    const insertedIdx = roadmap.indexOf('### Phase 10.1:');
    expect(insertedIdx).toBeGreaterThan(phase10Idx);
  });

  it('throws GSDError for missing target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseInsert(['99', 'Missing'], tmpDir)).rejects.toThrow('Phase 99 not found');
  });

  it('throws GSDError with Validation for missing args', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseInsert([], tmpDir)).rejects.toThrow('after-phase and description required');
  });
});

// ─── phaseScaffold ──────────────────────────────────────────────────────

describe('phaseScaffold', () => {
  it('creates context template for a phase', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['context', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const filePath = data.path as string;
    expect(filePath).toContain('09-CONTEXT.md');

    // Check content
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-CONTEXT.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('phase: "09"');
    expect(content).toContain('Context');
  });

  it('creates uat template', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['uat', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-UAT.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('User Acceptance Testing');
  });

  it('creates verification template', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['verification', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-VERIFICATION.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('Verification');
  });

  it('creates phase-dir under phases/', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    const result = await phaseScaffold(['phase-dir', '15', 'New Module'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const dir = data.directory as string;
    expect(dir).toContain('15-new-module');
  });

  it('returns already_exists for existing file', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    // Create first
    await phaseScaffold(['context', '9'], tmpDir);
    // Second call should return already_exists
    const result = await phaseScaffold(['context', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(false);
    expect(data.reason).toBe('already_exists');
  });

  it('throws GSDError for unknown type', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    await expect(phaseScaffold(['badtype', '9'], tmpDir)).rejects.toThrow('Unknown scaffold type');
  });
});
