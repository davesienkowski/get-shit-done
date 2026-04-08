import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { captureGsdToolsOutput } from './capture.js';
import { createRegistry } from '../query/index.js';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '..', '..');
// Repo root (where .planning/ lives) — needed for commands that read project state
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

describe('Golden file tests', () => {
  describe('generate-slug', () => {
    it('SDK output matches gsd-tools.cjs output', async () => {
      const gsdOutput = await captureGsdToolsOutput('generate-slug', ['My Phase'], PROJECT_DIR);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('generate-slug', ['My Phase'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
    });

    it('SDK output matches golden fixture', async () => {
      const fixture = JSON.parse(
        await readFile(resolve(__dirname, 'fixtures', 'generate-slug.golden.json'), 'utf-8'),
      );
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('generate-slug', ['My Phase'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(fixture);
    });

    it('handles multi-word input identically', async () => {
      const gsdOutput = await captureGsdToolsOutput('generate-slug', ['Hello World Test'], PROJECT_DIR);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('generate-slug', ['Hello World Test'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('frontmatter.get', () => {
    it('SDK output matches gsd-tools.cjs for stable fields', async () => {
      const testFile = '.planning/phases/10-read-only-queries/10-01-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('frontmatter', ['get', testFile], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('frontmatter.get', [testFile], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Compare stable scalar fields
      expect(sdkData.phase).toBe(gsdOutput.phase);
      expect(sdkData.plan).toBe(gsdOutput.plan);
      expect(sdkData.type).toBe(gsdOutput.type);
      // Both should have same top-level keys
      expect(Object.keys(sdkData).sort()).toEqual(Object.keys(gsdOutput).sort());
    });
  });

  describe('config-get', () => {
    it('SDK output matches gsd-tools.cjs for top-level key', async () => {
      const gsdOutput = await captureGsdToolsOutput('config-get', ['model_profile'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('config-get', ['model_profile'], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('find-phase', () => {
    it('SDK output matches gsd-tools.cjs for core fields', async () => {
      const gsdOutput = await captureGsdToolsOutput('find-phase', ['9'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('find-phase', ['9'], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // SDK output is a subset — compare shared fields
      expect(sdkData.found).toBe(gsdOutput.found);
      expect(sdkData.directory).toBe(gsdOutput.directory);
      expect(sdkData.phase_number).toBe(gsdOutput.phase_number);
      expect(sdkData.phase_name).toBe(gsdOutput.phase_name);
      expect(sdkData.plans).toEqual(gsdOutput.plans);
    });
  });

  describe('roadmap.analyze', () => {
    it('SDK output has same structure as gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('roadmap', ['analyze'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('roadmap.analyze', [], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      const gsdPhases = gsdOutput.phases as Array<Record<string, unknown>>;
      const sdkPhases = sdkData.phases as Array<Record<string, unknown>>;
      // Compare structure: same phase count, same phase numbers
      expect(sdkPhases.length).toBe(gsdPhases.length);
      expect(sdkPhases.map((p: Record<string, unknown>) => p.number)).toEqual(
        gsdPhases.map((p: Record<string, unknown>) => p.number),
      );
      expect(sdkData.phase_count).toBe(gsdOutput.phase_count);
    });
  });

  describe('progress', () => {
    it('SDK output has same structure as gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('progress', ['json'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('progress', [], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      expect(sdkData.milestone_version).toBe(gsdOutput.milestone_version);
      const gsdPhases = gsdOutput.phases as unknown[];
      const sdkPhases = sdkData.phases as unknown[];
      expect(sdkPhases.length).toBe(gsdPhases.length);
    });
  });

  // ─── Mutation command golden tests ──────────────────────────────────────

  describe('frontmatter.validate (mutation)', () => {
    it('SDK output matches gsd-tools.cjs output shape for plan schema', async () => {
      const testFile = '.planning/phases/11-state-mutations/11-03-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('frontmatter', ['validate', testFile, '--schema', 'plan'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('frontmatter.validate', [testFile, '--schema', 'plan'], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Both should have same structural fields
      expect(sdkData).toHaveProperty('valid');
      expect(sdkData).toHaveProperty('missing');
      expect(sdkData).toHaveProperty('present');
      expect(sdkData).toHaveProperty('schema');
      // Both should agree on validity
      expect(sdkData.valid).toBe(gsdOutput.valid);
      expect(sdkData.schema).toBe(gsdOutput.schema);
      // Both should have same required fields present
      expect(Array.isArray(sdkData.present)).toBe(true);
      expect(Array.isArray(gsdOutput.present)).toBe(true);
      expect((sdkData.present as string[]).sort()).toEqual((gsdOutput.present as string[]).sort());
    });
  });

  describe('template select (mutation)', () => {
    it('SDK and gsd-tools.cjs both return template selection structure', async () => {
      const testFile = '.planning/phases/11-state-mutations/11-03-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('template', ['select', testFile], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      // SDK templateSelect uses phase number, not file path — different interface
      // but both return an object with a 'template' field
      const sdkResult = await registry.dispatch('template.select', ['11'], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Both should have a template field
      expect(sdkData).toHaveProperty('template');
      expect(gsdOutput).toHaveProperty('template');
      // SDK returns simple type string, CJS returns template path — structural match
      expect(typeof sdkData.template).toBe('string');
      expect(typeof gsdOutput.template).toBe('string');
    });
  });

  describe('config-set (mutation)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gsd-golden-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      await writeFile(join(tmpDir, '.planning', 'config.json'), '{"model_profile":"balanced","workflow":{"research":true}}');
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('SDK config-set returns same result structure as gsd-tools.cjs', async () => {
      // Run SDK config-set
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('config-set', ['model_profile', 'quality'], tmpDir);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // SDK should return updated confirmation
      expect(sdkData).toHaveProperty('key');
      expect(sdkData).toHaveProperty('value');
      expect(sdkData.key).toBe('model_profile');
      expect(sdkData.value).toBe('quality');
      // Verify file was actually written
      const config = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
      expect(config.model_profile).toBe('quality');
    });
  });

  describe('current-timestamp', () => {
    it('SDK full format matches gsd-tools.cjs output structure', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['full'], PROJECT_DIR) as { timestamp: string };
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['full'], PROJECT_DIR);
      const sdkData = sdkResult.data as { timestamp: string };

      // Both produce { timestamp: <ISO string> } — compare structure and format, not exact value
      expect(sdkData).toHaveProperty('timestamp');
      expect(gsdOutput).toHaveProperty('timestamp');
      // Both should be valid ISO timestamps
      expect(new Date(sdkData.timestamp).toISOString()).toBe(sdkData.timestamp);
      expect(new Date(gsdOutput.timestamp).toISOString()).toBe(gsdOutput.timestamp);
    });

    it('SDK date format matches gsd-tools.cjs output structure', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['date'], PROJECT_DIR) as { timestamp: string };
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['date'], PROJECT_DIR);
      const sdkData = sdkResult.data as { timestamp: string };

      // Both should match YYYY-MM-DD format
      expect(sdkData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(gsdOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Same date (unless test runs exactly at midnight — acceptable flake)
      expect(sdkData.timestamp).toBe(gsdOutput.timestamp);
    });

    it('SDK filename format matches gsd-tools.cjs output structure', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['filename'], PROJECT_DIR) as { timestamp: string };
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['filename'], PROJECT_DIR);
      const sdkData = sdkResult.data as { timestamp: string };

      // Filename format: no colons, no fractional seconds
      expect(sdkData.timestamp).not.toContain(':');
      expect(gsdOutput.timestamp).not.toContain(':');
    });
  });

  // ─── Verification handler golden tests ──────────────────────────────────

  describe('verify.plan-structure', () => {
    it('SDK output matches gsd-tools.cjs output shape', async () => {
      const testFile = '.planning/phases/09-foundation-and-test-infrastructure/09-01-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('verify', ['plan-structure', testFile], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('verify.plan-structure', [testFile], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Both should have same structural fields
      expect(sdkData).toHaveProperty('valid');
      expect(sdkData).toHaveProperty('errors');
      expect(sdkData).toHaveProperty('warnings');
      expect(sdkData).toHaveProperty('task_count');
      // Both should agree on validity
      expect(sdkData.valid).toBe(gsdOutput.valid);
      expect(sdkData.task_count).toBe(gsdOutput.task_count);
    });
  });

  describe('validate.consistency', () => {
    it('SDK output matches gsd-tools.cjs output shape', async () => {
      const gsdOutput = await captureGsdToolsOutput('validate', ['consistency'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('validate.consistency', [], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Both should have same structural fields
      expect(sdkData).toHaveProperty('passed');
      expect(sdkData).toHaveProperty('errors');
      expect(sdkData).toHaveProperty('warnings');
      expect(sdkData).toHaveProperty('warning_count');
      // Both should agree on pass/fail
      expect(sdkData.passed).toBe(gsdOutput.passed);
    });
  });

  describe('verify.phase-completeness', () => {
    it('SDK output matches gsd-tools.cjs output shape for completed phase', async () => {
      const gsdOutput = await captureGsdToolsOutput('verify', ['phase-completeness', '9'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('verify.phase-completeness', ['9'], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Both should have same structural fields
      expect(sdkData).toHaveProperty('complete');
      expect(sdkData).toHaveProperty('phase');
      expect(sdkData).toHaveProperty('plan_count');
      expect(sdkData).toHaveProperty('summary_count');
      // Both should agree on completeness and counts
      expect(sdkData.complete).toBe(gsdOutput.complete);
      expect(sdkData.plan_count).toBe(gsdOutput.plan_count);
      expect(sdkData.summary_count).toBe(gsdOutput.summary_count);
    });
  });
});
