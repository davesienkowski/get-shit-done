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

import { verifyKeyLinks } from './validate.js';

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
