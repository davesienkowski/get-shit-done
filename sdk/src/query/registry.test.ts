/**
 * Unit tests for QueryRegistry, extractField, and createRegistry factory.
 */

import { describe, it, expect, vi } from 'vitest';
import { QueryRegistry, extractField } from './registry.js';
import { createRegistry } from './index.js';
import type { QueryResult } from './utils.js';

// ─── extractField ──────────────────────────────────────────────────────────

describe('extractField', () => {
  it('extracts nested value with dot notation', () => {
    expect(extractField({ a: { b: 1 } }, 'a.b')).toBe(1);
  });

  it('extracts top-level value', () => {
    expect(extractField({ slug: 'my-phase' }, 'slug')).toBe('my-phase');
  });

  it('extracts array element with bracket notation', () => {
    expect(extractField({ items: [10, 20, 30] }, 'items[1]')).toBe(20);
  });

  it('extracts array element with negative index', () => {
    expect(extractField({ items: [10, 20, 30] }, 'items[-1]')).toBe(30);
  });

  it('returns undefined for null input', () => {
    expect(extractField(null, 'a')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(extractField(undefined, 'a')).toBeUndefined();
  });

  it('returns undefined for missing nested path', () => {
    expect(extractField({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('returns undefined when bracket access targets non-array', () => {
    expect(extractField({ items: 'not-array' }, 'items[0]')).toBeUndefined();
  });

  it('handles deeply nested paths', () => {
    expect(extractField({ a: { b: { c: { d: 42 } } } }, 'a.b.c.d')).toBe(42);
  });

  it('handles mixed dot and bracket notation', () => {
    expect(extractField({ data: { items: [{ name: 'x' }] } }, 'data.items[0].name')).toBe('x');
  });
});

// ─── QueryRegistry ─────────────────────────────────────────────────────────

describe('QueryRegistry', () => {
  it('register makes has() return true', () => {
    const registry = new QueryRegistry();
    const handler = async () => ({ data: 'test' });
    registry.register('test-cmd', handler);

    expect(registry.has('test-cmd')).toBe(true);
  });

  it('has() returns false for unregistered command', () => {
    const registry = new QueryRegistry();

    expect(registry.has('nonexistent')).toBe(false);
  });

  it('dispatch calls registered handler', async () => {
    const registry = new QueryRegistry();
    const handler = vi.fn(async (args: string[], _projectDir: string): Promise<QueryResult> => {
      return { data: { value: args[0] } };
    });
    registry.register('test-cmd', handler);

    const result = await registry.dispatch('test-cmd', ['arg1'], '/tmp');

    expect(handler).toHaveBeenCalledWith(['arg1'], '/tmp');
    expect(result).toEqual({ data: { value: 'arg1' } });
  });

  it('dispatch falls back to GSDTools for unregistered command', async () => {
    const registry = new QueryRegistry();

    // Mock GSDTools by replacing the fallback path with a spy
    // We test the fallback contract: unregistered commands produce { data: result }
    const mockResult = { some: 'data' };
    const mockExec = vi.fn().mockResolvedValue(mockResult);

    // Intercept the dynamic import by mocking at the module level
    vi.doMock('../gsd-tools.js', () => ({
      GSDTools: vi.fn().mockImplementation(() => ({
        exec: mockExec,
      })),
    }));

    // Re-import to pick up the mock
    const { QueryRegistry: MockedRegistry } = await import('./registry.js');
    const mockedRegistry = new MockedRegistry();

    const result = await mockedRegistry.dispatch('unknown-cmd', ['arg1'], '/tmp/project');

    expect(result).toEqual({ data: { some: 'data' } });

    vi.restoreAllMocks();
  });
});

// ─── createRegistry ────────────────────────────────────────────────────────

describe('createRegistry', () => {
  it('returns a QueryRegistry instance', () => {
    const registry = createRegistry();

    expect(registry).toBeInstanceOf(QueryRegistry);
  });

  it('has generate-slug registered', () => {
    const registry = createRegistry();

    expect(registry.has('generate-slug')).toBe(true);
  });

  it('has current-timestamp registered', () => {
    const registry = createRegistry();

    expect(registry.has('current-timestamp')).toBe(true);
  });

  it('can dispatch generate-slug', async () => {
    const registry = createRegistry();
    const result = await registry.dispatch('generate-slug', ['My Phase'], '/tmp');

    expect(result).toEqual({ data: { slug: 'my-phase' } });
  });
});
