/**
 * Unit tests for verification query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';
import { verifyPlanStructure } from './verify.js';

// ─── verifyPlanStructure ───────────────────────────────────────────────────

describe('verifyPlanStructure', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-verify-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns valid for plan with all required fields and task elements', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.ts
autonomous: true
must_haves:
  truths:
    - something works
---

<task type="auto">
  <name>Task 1: Do something</name>
  <files>src/foo.ts</files>
  <action>Implement foo</action>
  <verify>Run tests</verify>
  <done>Foo works</done>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(true);
    expect(data.errors).toEqual([]);
    expect(data.task_count).toBe(1);
    expect(data.frontmatter_fields).toContain('phase');
  });

  it('returns invalid when required frontmatter field wave is missing', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - something
---

<task type="auto">
  <name>Task 1</name>
  <action>Do it</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Missing required frontmatter field: wave');
  });

  it('returns error when task missing <name> element', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <action>Do something</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Task missing <name> element');
  });

  it('returns error when task missing <action> element', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <name>Task 1</name>
  <done>Done</done>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect((data.errors as string[])).toContainEqual(expect.stringContaining("missing <action>"));
  });

  it('returns warning when wave > 1 but depends_on is empty', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 2
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <name>Task 1</name>
  <action>Do it</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.warnings).toContain('Wave > 1 but depends_on is empty');
  });

  it('returns error when checkpoint task present but autonomous is not false', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="checkpoint:human-verify">
  <name>Check it</name>
  <action>Verify</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Has checkpoint tasks but autonomous is not false');
  });

  it('returns warning when no tasks found', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

No tasks here.
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.warnings).toContain('No <task> elements found');
  });

  it('returns error for missing file', async () => {
    const result = await verifyPlanStructure(['nonexistent.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('File not found');
  });

  it('throws GSDError with Validation classification when no args', async () => {
    await expect(verifyPlanStructure([], tmpDir)).rejects.toThrow(GSDError);
    try {
      await verifyPlanStructure([], tmpDir);
    } catch (err) {
      expect((err as GSDError).classification).toBe('validation');
    }
  });
});
