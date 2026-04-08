/**
 * Unit tests for config mutation handlers.
 *
 * Tests: isValidConfigKey, parseConfigValue, configSet,
 * configSetModelProfile, configNewProject, configEnsureSection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';

// ─── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-cfgmut-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── isValidConfigKey ──────────────────────────────────────────────────────

describe('isValidConfigKey', () => {
  it('accepts known exact keys', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('model_profile').valid).toBe(true);
    expect(isValidConfigKey('commit_docs').valid).toBe(true);
    expect(isValidConfigKey('workflow.auto_advance').valid).toBe(true);
  });

  it('accepts wildcard agent_skills.* patterns', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('agent_skills.gsd-planner').valid).toBe(true);
    expect(isValidConfigKey('agent_skills.custom_agent').valid).toBe(true);
  });

  it('accepts wildcard features.* patterns', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('features.global_learnings').valid).toBe(true);
    expect(isValidConfigKey('features.thinking_partner').valid).toBe(true);
  });

  it('rejects unknown keys with suggestion', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    const result = isValidConfigKey('model_profle');
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBeDefined();
  });

  it('rejects completely invalid keys', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    const result = isValidConfigKey('totally_unknown_key');
    expect(result.valid).toBe(false);
  });
});

// ─── parseConfigValue ──────────────────────────────────────────────────────

describe('parseConfigValue', () => {
  it('converts "true" to boolean true', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('true')).toBe(true);
  });

  it('converts "false" to boolean false', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('false')).toBe(false);
  });

  it('converts numeric strings to numbers', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('42')).toBe(42);
    expect(parseConfigValue('3.14')).toBe(3.14);
  });

  it('parses JSON arrays', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('["a","b"]')).toEqual(['a', 'b']);
  });

  it('parses JSON objects', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('{"key":"val"}')).toEqual({ key: 'val' });
  });

  it('preserves plain strings', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('hello')).toBe('hello');
  });

  it('preserves empty string as empty string', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('')).toBe('');
  });
});

// ─── configSet ─────────────────────────────────────────────────────────────

describe('configSet', () => {
  it('writes value and round-trips through reading config.json', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configSet(['model_profile', 'quality'], tmpDir);
    expect(result.data).toEqual({ set: true, key: 'model_profile', value: 'quality' });

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
  });

  it('sets nested dot-notation keys', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { research: true } }),
    );
    const result = await configSet(['workflow.auto_advance', 'true'], tmpDir);
    expect(result.data).toEqual({ set: true, key: 'workflow.auto_advance', value: true });

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow.auto_advance).toBe(true);
    expect(raw.workflow.research).toBe(true);
  });

  it('rejects invalid key with GSDError', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await expect(configSet(['totally_bogus_key', 'value'], tmpDir)).rejects.toThrow(GSDError);
  });

  it('coerces values through parseConfigValue', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await configSet(['commit_docs', 'true'], tmpDir);
    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.commit_docs).toBe(true);
  });
});

// ─── configSetModelProfile ─────────────────────────────────────────────────

describe('configSetModelProfile', () => {
  it('writes valid profile', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configSetModelProfile(['quality'], tmpDir);
    expect((result.data as { set: boolean }).set).toBe(true);
    expect((result.data as { profile: string }).profile).toBe('quality');

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
  });

  it('rejects invalid profile with GSDError', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await expect(configSetModelProfile(['invalid_profile'], tmpDir)).rejects.toThrow(GSDError);
  });

  it('normalizes profile name to lowercase', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    const result = await configSetModelProfile(['Quality'], tmpDir);
    expect((result.data as { profile: string }).profile).toBe('quality');
  });
});

// ─── configNewProject ──────────────────────────────────────────────────────

describe('configNewProject', () => {
  it('creates config.json with defaults', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    const result = await configNewProject([], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('balanced');
    expect(raw.commit_docs).toBe(false);
  });

  it('merges user choices', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    const choices = JSON.stringify({ model_profile: 'quality', commit_docs: true });
    const result = await configNewProject([choices], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
    expect(raw.commit_docs).toBe(true);
  });

  it('does not overwrite existing config', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await configNewProject([], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(false);
  });
});

// ─── configEnsureSection ───────────────────────────────────────────────────

describe('configEnsureSection', () => {
  it('creates section if not present', async () => {
    const { configEnsureSection } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configEnsureSection(['workflow'], tmpDir);
    expect((result.data as { ensured: boolean }).ensured).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow).toEqual({});
  });

  it('is idempotent on existing section', async () => {
    const { configEnsureSection } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { research: true } }),
    );
    const result = await configEnsureSection(['workflow'], tmpDir);
    expect((result.data as { ensured: boolean }).ensured).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow).toEqual({ research: true });
  });
});
