/**
 * Query command registry — routes commands to native handlers with gsd-tools.cjs fallback.
 *
 * The registry is a flat `Map<string, QueryHandler>` that maps command names
 * to handler functions. Unknown commands fall back to `GSDTools.exec()` for
 * backwards compatibility during the SDK migration.
 *
 * Also exports `extractField` — a TypeScript port of the `--pick` field
 * extraction logic from gsd-tools.cjs (lines 365-382).
 *
 * @example
 * ```typescript
 * import { QueryRegistry, extractField } from './registry.js';
 *
 * const registry = new QueryRegistry();
 * registry.register('generate-slug', generateSlug);
 * const result = await registry.dispatch('generate-slug', ['My Phase'], '/project');
 * const slug = extractField(result.data, 'slug'); // 'my-phase'
 * ```
 */

import type { QueryResult, QueryHandler } from './utils.js';

// ─── extractField ──────────────────────────────────────────────────────────

/**
 * Extract a nested field from an object using dot-notation and bracket syntax.
 *
 * Direct port of `extractField()` from gsd-tools.cjs (lines 365-382).
 * Supports `a.b.c` dot paths, `items[0]` array indexing, and `items[-1]`
 * negative indexing.
 *
 * @param obj - The object to extract from
 * @param fieldPath - Dot-separated path with optional bracket notation
 * @returns The extracted value, or undefined if the path doesn't resolve
 */
export function extractField(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const bracketMatch = part.match(/^(.+?)\[(-?\d+)]$/);
    if (bracketMatch) {
      const key = bracketMatch[1];
      const index = parseInt(bracketMatch[2], 10);
      current = (current as Record<string, unknown>)[key];
      if (!Array.isArray(current)) return undefined;
      current = index < 0 ? current[current.length + index] : current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

// ─── QueryRegistry ─────────────────────────────────────────────────────────

/**
 * Flat command registry that routes query commands to native handlers.
 *
 * Commands not registered in the map fall back to `GSDTools.exec()`,
 * allowing incremental migration from gsd-tools.cjs to native TypeScript.
 */
export class QueryRegistry {
  private handlers = new Map<string, QueryHandler>();

  /**
   * Register a native handler for a command name.
   *
   * @param command - The command name (e.g., 'generate-slug', 'state.load')
   * @param handler - The handler function to invoke
   */
  register(command: string, handler: QueryHandler): void {
    this.handlers.set(command, handler);
  }

  /**
   * Check if a command has a registered native handler.
   *
   * @param command - The command name to check
   * @returns True if the command has a native handler
   */
  has(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * Get the handler for a command without dispatching.
   *
   * @param command - The command name to look up
   * @returns The handler function, or undefined if not registered
   */
  getHandler(command: string): QueryHandler | undefined {
    return this.handlers.get(command);
  }

  /**
   * Dispatch a command to its handler, falling back to gsd-tools.cjs.
   *
   * @param command - The command name to dispatch
   * @param args - Arguments to pass to the handler
   * @param projectDir - The project directory for context
   * @returns The query result from the handler or fallback
   */
  async dispatch(command: string, args: string[], projectDir: string): Promise<QueryResult> {
    const handler = this.handlers.get(command);
    if (!handler) {
      return this.fallbackToGsdTools(command, args, projectDir);
    }
    return handler(args, projectDir);
  }

  /**
   * Fall back to gsd-tools.cjs for commands without native handlers.
   * Uses dynamic import to avoid loading GSDTools until needed.
   */
  private async fallbackToGsdTools(command: string, args: string[], projectDir: string): Promise<QueryResult> {
    const { GSDTools } = await import('../gsd-tools.js');
    const tools = new GSDTools({ projectDir });
    const result = await tools.exec(command, args);
    return { data: result };
  }
}
