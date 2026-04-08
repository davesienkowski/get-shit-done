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
import { frontmatterGet } from './frontmatter.js';
import { configGet, resolveModel } from './config-query.js';
import { stateLoad, stateGet, stateSnapshot } from './state.js';
import { findPhase, phasePlanIndex } from './phase.js';
import { roadmapAnalyze, roadmapGetPhase } from './roadmap.js';
import { progressJson } from './progress.js';
import { frontmatterSet, frontmatterMerge, frontmatterValidate } from './frontmatter-mutation.js';
import {
  stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan,
  stateRecordMetric, stateUpdateProgress, stateAddDecision,
  stateAddBlocker, stateResolveBlocker, stateRecordSession,
} from './state-mutation.js';
import {
  configSet, configSetModelProfile, configNewProject, configEnsureSection,
} from './config-mutation.js';

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
  registry.register('frontmatter.get', frontmatterGet);
  registry.register('config-get', configGet);
  registry.register('resolve-model', resolveModel);
  registry.register('state.load', stateLoad);
  registry.register('state.json', stateLoad);
  registry.register('state.get', stateGet);
  registry.register('state-snapshot', stateSnapshot);
  registry.register('find-phase', findPhase);
  registry.register('phase-plan-index', phasePlanIndex);
  registry.register('roadmap.analyze', roadmapAnalyze);
  registry.register('roadmap.get-phase', roadmapGetPhase);
  registry.register('progress', progressJson);
  registry.register('progress.json', progressJson);

  // Frontmatter mutation handlers
  registry.register('frontmatter.set', frontmatterSet);
  registry.register('frontmatter.merge', frontmatterMerge);
  registry.register('frontmatter.validate', frontmatterValidate);
  registry.register('frontmatter validate', frontmatterValidate);

  // State mutation handlers
  registry.register('state.update', stateUpdate);
  registry.register('state.patch', statePatch);
  registry.register('state.begin-phase', stateBeginPhase);
  registry.register('state.advance-plan', stateAdvancePlan);
  registry.register('state.record-metric', stateRecordMetric);
  registry.register('state.update-progress', stateUpdateProgress);
  registry.register('state.add-decision', stateAddDecision);
  registry.register('state.add-blocker', stateAddBlocker);
  registry.register('state.resolve-blocker', stateResolveBlocker);
  registry.register('state.record-session', stateRecordSession);

  // Config mutation handlers
  registry.register('config-set', configSet);
  registry.register('config-set-model-profile', configSetModelProfile);
  registry.register('config-new-project', configNewProject);
  registry.register('config-ensure-section', configEnsureSection);

  return registry;
}
