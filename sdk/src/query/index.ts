/**
 * Query module entry point — factory and re-exports.
 *
 * The `createRegistry()` factory creates a fully-wired `QueryRegistry`
 * with all native handlers registered. New handlers are added here
 * as they are migrated from gsd-tools.cjs.
 *
 * @example
 * ```typescript
 * import { createRegistry } from './query/index.js';
 *
 * const registry = createRegistry();
 * const result = await registry.dispatch('generate-slug', ['My Phase'], projectDir);
 * ```
 */

import { QueryRegistry } from './registry.js';
import { generateSlug, currentTimestamp } from './utils.js';

// ─── Re-exports ────────────────────────────────────────────────────────────

export type { QueryResult, QueryHandler } from './utils.js';
export { extractField } from './registry.js';

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a fully-wired QueryRegistry with all native handlers registered.
 *
 * @returns A QueryRegistry instance with generate-slug and current-timestamp handlers
 */
export function createRegistry(): QueryRegistry {
  const registry = new QueryRegistry();

  registry.register('generate-slug', generateSlug);
  registry.register('current-timestamp', currentTimestamp);

  return registry;
}
