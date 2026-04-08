/**
 * Unit tests for frontmatter parser and query handler.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  splitInlineArray,
  extractFrontmatter,
  stripFrontmatter,
  frontmatterGet,
} from './frontmatter.js';

// ─── splitInlineArray ───────────────────────────────────────────────────────

describe('splitInlineArray', () => {
  it('splits simple CSV', () => {
    expect(splitInlineArray('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted strings with commas', () => {
    expect(splitInlineArray('"a, b", c')).toEqual(['a, b', 'c']);
  });

  it('handles single-quoted strings', () => {
    expect(splitInlineArray("'a, b', c")).toEqual(['a, b', 'c']);
  });

  it('trims whitespace', () => {
    expect(splitInlineArray('  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('returns empty array for empty string', () => {
    expect(splitInlineArray('')).toEqual([]);
  });
});

// ─── extractFrontmatter ─────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('parses simple key-value pairs', () => {
    const content = '---\nkey: value\n---\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'value' });
  });

  it('parses nested objects', () => {
    const content = '---\nparent:\n  child: value\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ parent: { child: 'value' } });
  });

  it('parses inline arrays', () => {
    const content = '---\ntags: [a, b, c]\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('parses dash arrays', () => {
    const content = '---\nitems:\n  - one\n  - two\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ items: ['one', 'two'] });
  });

  it('uses the LAST block when multiple stacked blocks exist', () => {
    const content = '---\nold: data\n---\n---\nnew: data\n---\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ new: 'data' });
  });

  it('handles empty-object-to-array conversion', () => {
    const content = '---\nlist:\n  - item1\n  - item2\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ list: ['item1', 'item2'] });
  });

  it('returns empty object when no frontmatter', () => {
    const result = extractFrontmatter('no frontmatter here');
    expect(result).toEqual({});
  });

  it('strips surrounding quotes from values', () => {
    const content = '---\nkey: "quoted"\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'quoted' });
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\nkey: value\r\n---\r\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'value' });
  });
});

// ─── stripFrontmatter ───────────────────────────────────────────────────────

describe('stripFrontmatter', () => {
  it('strips single frontmatter block', () => {
    const result = stripFrontmatter('---\nk: v\n---\nbody');
    expect(result).toBe('body');
  });

  it('strips multiple stacked blocks', () => {
    const result = stripFrontmatter('---\na: 1\n---\n---\nb: 2\n---\nbody');
    expect(result).toBe('body');
  });

  it('returns content unchanged when no frontmatter', () => {
    expect(stripFrontmatter('just body')).toBe('just body');
  });

  it('handles leading whitespace after strip', () => {
    const result = stripFrontmatter('---\nk: v\n---\n\nbody');
    // After stripping, leading whitespace/newlines may remain
    expect(result.trim()).toBe('body');
  });
});

// ─── frontmatterGet ─────────────────────────────────────────────────────────

describe('frontmatterGet', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fm-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns parsed frontmatter from a file', async () => {
    await writeFile(join(tmpDir, 'test.md'), '---\nkey: value\n---\nbody');
    const result = await frontmatterGet(['test.md'], tmpDir);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns single field when field arg provided', async () => {
    await writeFile(join(tmpDir, 'test.md'), '---\nkey: value\n---\nbody');
    const result = await frontmatterGet(['test.md', 'key'], tmpDir);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns error for missing file', async () => {
    const result = await frontmatterGet(['missing.md'], tmpDir);
    expect(result.data).toEqual({ error: 'File not found', path: 'missing.md' });
  });

  it('throws GSDError for null bytes in path', async () => {
    const { GSDError } = await import('../errors.js');
    await expect(frontmatterGet(['bad\0path.md'], tmpDir)).rejects.toThrow(GSDError);
  });
});
