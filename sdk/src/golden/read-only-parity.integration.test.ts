/**
 * Read-only subprocess golden checks (SDK vs gsd-tools.cjs JSON).
 * Row data: `read-only-golden-rows.ts`. Policy: `golden-policy.ts`, `QUERY-HANDLERS.md`.
 */
import { describe, it, expect } from 'vitest';
import { captureGsdToolsOutput, captureGsdToolsStdout } from './capture.js';
import { createRegistry } from '../query/index.js';
import { resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { READ_ONLY_JSON_PARITY_ROWS } from './read-only-golden-rows.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const EXTRACT_MESSAGES_SESSIONS_FIXTURE = resolve(
  REPO_ROOT,
  'sdk/src/golden/fixtures/extract-messages-sessions',
);

describe('Read-only golden parity (JSON toEqual)', () => {
  it.each(READ_ONLY_JSON_PARITY_ROWS)('$canonical matches gsd-tools.cjs JSON', async (row) => {
    const gsdOutput = await captureGsdToolsOutput(row.cjs, row.cjsArgs, REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch(row.canonical, row.sdkArgs, REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});

describe('config-path (plain stdout vs SDK { path })', () => {
  it('SDK path matches gsd-tools.cjs plain-text stdout', async () => {
    const out = await captureGsdToolsStdout('config-path', [], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('config-path', [], REPO_ROOT);
    const data = sdkResult.data as { path?: string };
    expect(data.path).toBeDefined();
    expect(normalize(data.path!.trim())).toBe(normalize(out.trim()));
  });
});

describe('state.load golden parity (excluding last_updated)', () => {
  it('SDK rebuilt frontmatter matches gsd-tools.cjs except volatile last_updated', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['json'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.load', [], REPO_ROOT);
    const strip = (d: unknown): Record<string, unknown> => {
      const o = { ...(d as Record<string, unknown>) };
      delete o.last_updated;
      return o;
    };
    expect(strip(sdkResult.data)).toEqual(strip(gsdOutput));
  });
});

describe('state.get golden parity', () => {
  it('matches full STATE.md when no field (same as `state get` with no section)', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['get'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.get', [], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });

  it('matches single frontmatter field when `state get <field>`', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['get', 'milestone'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.get', ['milestone'], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});

describe('extract-messages golden parity (excluding output_file path)', () => {
  it('SDK JSON matches gsd-tools.cjs; JSONL file contents match', async () => {
    const extra = ['my-project', '--path', EXTRACT_MESSAGES_SESSIONS_FIXTURE];
    const gsdOutput = (await captureGsdToolsOutput('extract-messages', extra, REPO_ROOT)) as Record<
      string,
      unknown
    >;
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('extract-messages', extra, REPO_ROOT);
    const sdkData = sdkResult.data as Record<string, unknown>;

    const stripPath = (d: Record<string, unknown>): Record<string, unknown> => {
      const o = { ...d };
      delete o.output_file;
      return o;
    };
    expect(stripPath(sdkData)).toEqual(stripPath(gsdOutput));

    const gsdPath = gsdOutput.output_file as string;
    const sdkPath = sdkData.output_file as string;
    expect(readFileSync(gsdPath, 'utf-8')).toBe(readFileSync(sdkPath, 'utf-8'));
  });
});

describe('verify.commits golden parity', () => {
  it('SDK output matches gsd-tools.cjs for two SHAs', async () => {
    let a = '';
    let b = '';
    try {
      a = execSync('git rev-parse HEAD~1', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
      b = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
    } catch {
      const h = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
      a = h;
      b = h;
    }
    const gsdOutput = await captureGsdToolsOutput('verify', ['commits', a, b], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('verify.commits', [a, b], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});
