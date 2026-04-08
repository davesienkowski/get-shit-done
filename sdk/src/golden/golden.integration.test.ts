import { describe, it, expect } from 'vitest';
import { captureGsdToolsOutput } from './capture.js';
import { createRegistry } from '../query/index.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
});
