/**
 * Unit tests for shared query helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeRegex,
  normalizePhaseName,
  comparePhaseNum,
  extractPhaseToken,
  phaseTokenMatches,
  toPosixPath,
  stateExtractField,
  planningPaths,
} from './helpers.js';

// ─── escapeRegex ────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
  it('escapes dots', () => {
    expect(escapeRegex('foo.bar')).toBe('foo\\.bar');
  });

  it('escapes brackets', () => {
    expect(escapeRegex('test[0]')).toBe('test\\[0\\]');
  });

  it('escapes all regex special characters', () => {
    expect(escapeRegex('a.*+?^${}()|[]\\')).toBe('a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('returns plain strings unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello');
  });
});

// ─── normalizePhaseName ─────────────────────────────────────────────────────

describe('normalizePhaseName', () => {
  it('pads single digit to 2 digits', () => {
    expect(normalizePhaseName('9')).toBe('09');
  });

  it('strips project code prefix', () => {
    expect(normalizePhaseName('CK-01')).toBe('01');
  });

  it('preserves letter suffix', () => {
    expect(normalizePhaseName('12A')).toBe('12A');
  });

  it('preserves decimal parts', () => {
    expect(normalizePhaseName('12.1')).toBe('12.1');
  });

  it('returns custom IDs as-is', () => {
    expect(normalizePhaseName('PROJ-42')).toBe('PROJ-42');
  });

  it('handles already-padded numbers', () => {
    expect(normalizePhaseName('01')).toBe('01');
  });
});

// ─── comparePhaseNum ────────────────────────────────────────────────────────

describe('comparePhaseNum', () => {
  it('compares numeric phases', () => {
    expect(comparePhaseNum('01-foo', '02-bar')).toBeLessThan(0);
  });

  it('compares letter suffixes', () => {
    expect(comparePhaseNum('12A-foo', '12B-bar')).toBeLessThan(0);
  });

  it('sorts no-decimal before decimal', () => {
    expect(comparePhaseNum('12-foo', '12.1-bar')).toBeLessThan(0);
  });

  it('returns 0 for equal phases', () => {
    expect(comparePhaseNum('01-name', '01-other')).toBe(0);
  });

  it('falls back to string comparison for custom IDs', () => {
    const result = comparePhaseNum('AUTH-name', 'PROJ-name');
    expect(typeof result).toBe('number');
  });
});

// ─── extractPhaseToken ──────────────────────────────────────────────────────

describe('extractPhaseToken', () => {
  it('extracts plain numeric token', () => {
    expect(extractPhaseToken('01-foundation')).toBe('01');
  });

  it('extracts project-code-prefixed token', () => {
    expect(extractPhaseToken('CK-01-name')).toBe('CK-01');
  });

  it('extracts letter suffix token', () => {
    expect(extractPhaseToken('12A-name')).toBe('12A');
  });

  it('extracts decimal token', () => {
    expect(extractPhaseToken('999.6-name')).toBe('999.6');
  });
});

// ─── phaseTokenMatches ──────────────────────────────────────────────────────

describe('phaseTokenMatches', () => {
  it('matches normalized numeric phase', () => {
    expect(phaseTokenMatches('09-foundation', '09')).toBe(true);
  });

  it('matches after stripping project code', () => {
    expect(phaseTokenMatches('CK-01-name', '01')).toBe(true);
  });

  it('does not match different phases', () => {
    expect(phaseTokenMatches('09-foundation', '10')).toBe(false);
  });
});

// ─── toPosixPath ────────────────────────────────────────────────────────────

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toPosixPath('a\\b\\c')).toBe('a/b/c');
  });

  it('preserves already-posix paths', () => {
    expect(toPosixPath('a/b/c')).toBe('a/b/c');
  });
});

// ─── stateExtractField ──────────────────────────────────────────────────────

describe('stateExtractField', () => {
  it('extracts bold field value', () => {
    const content = '**Phase:** 10\n**Plan:** 1';
    expect(stateExtractField(content, 'Phase')).toBe('10');
  });

  it('extracts plain field value', () => {
    const content = 'Status: executing\nPlan: 1';
    expect(stateExtractField(content, 'Status')).toBe('executing');
  });

  it('returns null for missing field', () => {
    expect(stateExtractField('no fields here', 'Missing')).toBeNull();
  });

  it('is case-insensitive', () => {
    const content = '**phase:** 10';
    expect(stateExtractField(content, 'Phase')).toBe('10');
  });
});

// ─── planningPaths ──────────────────────────────────────────────────────────

describe('planningPaths', () => {
  it('returns all expected keys', () => {
    const paths = planningPaths('/proj');
    expect(paths).toHaveProperty('planning');
    expect(paths).toHaveProperty('state');
    expect(paths).toHaveProperty('roadmap');
    expect(paths).toHaveProperty('project');
    expect(paths).toHaveProperty('config');
    expect(paths).toHaveProperty('phases');
    expect(paths).toHaveProperty('requirements');
  });

  it('uses posix paths', () => {
    const paths = planningPaths('/proj');
    expect(paths.state).toContain('.planning/STATE.md');
    expect(paths.config).toContain('.planning/config.json');
  });
});
