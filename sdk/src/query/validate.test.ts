/**
 * Tests for validation query handlers — verifyKeyLinks and validateConsistency.
 *
 * Uses temp directories with fixture files to test verification logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';

import { verifyKeyLinks, validateConsistency } from './validate.js';

// ─── verifyKeyLinks ────────────────────────────────────────────────────────

describe('verifyKeyLinks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-validate-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws GSDError Validation when no args', async () => {
    await expect(verifyKeyLinks([], tmpDir)).rejects.toThrow(GSDError);
    try {
      await verifyKeyLinks([], tmpDir);
    } catch (err) {
      expect((err as GSDError).classification).toBe('validation');
    }
  });

  it('returns all_verified true when pattern found in source', async () => {
    // Create source file with an import statement
    await writeFile(join(tmpDir, 'source.ts'), "import { foo } from './target.js';");
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    // Create plan with key_links
    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo.*from.*target"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_verified).toBe(true);
    expect(data.verified).toBe(1);
    expect(data.total).toBe(1);
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].detail).toBe('Pattern found in source');
  });

  it('returns verified true with "Pattern found in target" when not in source but in target', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), "import { foo } from './other.js';");

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(true);
    expect(links[0].detail).toBe('Pattern found in target');
  });

  it('returns verified false when pattern not found in source or target', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), 'const y = 2;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_verified).toBe(false);
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(false);
  });

  it('returns Source file not found when source missing', async () => {
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: missing.ts
      to: target.ts
      via: "import"
      pattern: "import"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].detail).toBe('Source file not found');
    expect(links[0].verified).toBe(false);
  });

  it('checks target reference in source when no pattern specified', async () => {
    await writeFile(join(tmpDir, 'source.ts'), "import { foo } from './target.ts';");
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(true);
    expect(links[0].detail).toBe('Target referenced in source');
  });

  it('returns Invalid regex pattern for bad regex', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), 'const y = 2;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "bad regex"
      pattern: "[invalid"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(false);
    expect((links[0].detail as string).startsWith('Invalid regex pattern')).toBe(true);
  });

  it('returns error when no must_haves.key_links in plan', async () => {
    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('No must_haves.key_links found in frontmatter');
  });
});

// ─── validateConsistency ──────────────────────────────────────────────────

describe('validateConsistency', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-consistency-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /** Helper: create a .planning directory structure */
  async function createPlanning(opts: {
    roadmap?: string;
    phases?: Array<{ dir: string; plans?: string[]; summaries?: string[]; planContents?: Record<string, string> }>;
    config?: Record<string, unknown>;
  }): Promise<void> {
    const planning = join(tmpDir, '.planning');
    await mkdir(planning, { recursive: true });

    if (opts.roadmap !== undefined) {
      await writeFile(join(planning, 'ROADMAP.md'), opts.roadmap);
    }

    if (opts.config) {
      await writeFile(join(planning, 'config.json'), JSON.stringify(opts.config));
    }

    if (opts.phases) {
      const phasesDir = join(planning, 'phases');
      await mkdir(phasesDir, { recursive: true });
      for (const phase of opts.phases) {
        const phaseDir = join(phasesDir, phase.dir);
        await mkdir(phaseDir, { recursive: true });
        if (phase.plans) {
          for (const plan of phase.plans) {
            const content = phase.planContents?.[plan] ?? `---\nphase: ${phase.dir}\nplan: 01\ntype: execute\nwave: 1\ndepends_on: []\nfiles_modified: []\nautonomous: true\n---\n\n# Plan\n`;
            await writeFile(join(phaseDir, plan), content);
          }
        }
        if (phase.summaries) {
          for (const summary of phase.summaries) {
            await writeFile(join(phaseDir, summary), '# Summary\n');
          }
        }
      }
    }
  }

  it('returns passed true when ROADMAP phases match disk', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\nGoal here.\n\n## Phase 2: Features\n\nMore goals.\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], summaries: ['01-01-SUMMARY.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'], summaries: ['02-01-SUMMARY.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.passed).toBe(true);
    expect((data.errors as string[]).length).toBe(0);
    expect((data.warnings as string[]).length).toBe(0);
  });

  it('warns when phase in ROADMAP but not on disk', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\n## Phase 2: Features\n\n## Phase 3: Polish\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Phase 3') && w.includes('ROADMAP') && w.includes('no directory'))).toBe(true);
  });

  it('warns when phase on disk but not in ROADMAP', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('02') && w.includes('disk') && w.includes('not in ROADMAP'))).toBe(true);
  });

  it('warns on gap in sequential phase numbering', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\n## Phase 3: Polish\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '03-polish', plans: ['03-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Gap in phase numbering'))).toBe(true);
  });

  it('warns on plan numbering gap within phase', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md', '01-03-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Gap in plan numbering'))).toBe(true);
  });

  it('warns on summary without matching plan', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], summaries: ['01-01-SUMMARY.md', '01-02-SUMMARY.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Summary') && w.includes('no matching PLAN'))).toBe(true);
  });

  it('warns when plan missing wave in frontmatter', async () => {
    const noWavePlan = `---\nphase: 01\nplan: 01\ntype: execute\ndepends_on: []\nfiles_modified: []\nautonomous: true\n---\n\n# Plan\n`;
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], planContents: { '01-01-PLAN.md': noWavePlan } },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('wave') && w.includes('frontmatter'))).toBe(true);
  });

  it('returns passed false with error when ROADMAP.md missing', async () => {
    await createPlanning({
      phases: [{ dir: '01-foundation', plans: ['01-01-PLAN.md'] }],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.passed).toBe(false);
    expect((data.errors as string[])).toContain('ROADMAP.md not found');
  });
});
