import { describe, it, expect } from 'vitest';
import { captureGsdToolsOutput } from './capture.js';
import { createRegistry } from '../query/index.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '..', '..');

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
