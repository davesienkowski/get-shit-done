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
import { commit, checkCommit } from './commit.js';
import { templateFill, templateSelect } from './template.js';
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts } from './verify.js';
import { verifyKeyLinks, validateConsistency, validateHealth } from './validate.js';
import { GSDEventStream } from '../event-stream.js';
import {
  GSDEventType,
  type GSDEvent,
  type GSDStateMutationEvent,
  type GSDConfigMutationEvent,
  type GSDFrontmatterMutationEvent,
  type GSDGitCommitEvent,
  type GSDTemplateFillEvent,
} from '../types.js';
import type { QueryHandler, QueryResult } from './utils.js';

// ─── Re-exports ────────────────────────────────────────────────────────────

export type { QueryResult, QueryHandler } from './utils.js';
export { extractField } from './registry.js';

// ─── Mutation commands set ────────────────────────────────────────────────

/**
 * Set of command names that represent mutation operations.
 * Used to wire event emission after successful dispatch.
 */
const MUTATION_COMMANDS = new Set([
  'state.update', 'state.patch', 'state.begin-phase', 'state.advance-plan',
  'state.record-metric', 'state.update-progress', 'state.add-decision',
  'state.add-blocker', 'state.resolve-blocker', 'state.record-session',
  'frontmatter.set', 'frontmatter.merge', 'frontmatter.validate',
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit',
  'template.fill', 'template.select',
  'validate.health', 'validate health',
]);

// ─── Event builder ────────────────────────────────────────────────────────

/**
 * Build a mutation event based on the command prefix and result.
 */
function buildMutationEvent(cmd: string, args: string[], result: QueryResult): GSDEvent {
  const base = {
    timestamp: new Date().toISOString(),
    sessionId: '',
  };

  if (cmd.startsWith('state.')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    } as GSDStateMutationEvent;
  }

  if (cmd.startsWith('config-')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  if (cmd.startsWith('frontmatter.')) {
    return {
      ...base,
      type: GSDEventType.FrontmatterMutation,
      command: cmd,
      file: args[0] ?? '',
      fields: args.slice(1),
      success: true,
    } as GSDFrontmatterMutationEvent;
  }

  if (cmd === 'commit' || cmd === 'check-commit') {
    const data = result.data as Record<string, unknown> | null;
    return {
      ...base,
      type: GSDEventType.GitCommit,
      hash: (data?.hash as string) ?? null,
      committed: (data?.committed as boolean) ?? false,
      reason: (data?.reason as string) ?? '',
    } as GSDGitCommitEvent;
  }

  if (cmd.startsWith('validate.') || cmd.startsWith('validate ')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  // template.fill / template.select
  const data = result.data as Record<string, unknown> | null;
  return {
    ...base,
    type: GSDEventType.TemplateFill,
    templateType: (data?.template as string) ?? args[0] ?? '',
    path: (data?.path as string) ?? args[1] ?? '',
    created: (data?.created as boolean) ?? false,
  } as GSDTemplateFillEvent;
}

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a fully-wired QueryRegistry with all native handlers registered.
 *
 * @param eventStream - Optional event stream for mutation event emission
 * @returns A QueryRegistry instance with all handlers registered
 */
export function createRegistry(eventStream?: GSDEventStream): QueryRegistry {
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

  // Git commit handlers
  registry.register('commit', commit);
  registry.register('check-commit', checkCommit);

  // Template handlers
  registry.register('template.fill', templateFill);
  registry.register('template.select', templateSelect);
  registry.register('template select', templateSelect);

  // Verification handlers
  registry.register('verify.plan-structure', verifyPlanStructure);
  registry.register('verify plan-structure', verifyPlanStructure);
  registry.register('verify.phase-completeness', verifyPhaseCompleteness);
  registry.register('verify phase-completeness', verifyPhaseCompleteness);
  registry.register('verify.artifacts', verifyArtifacts);
  registry.register('verify artifacts', verifyArtifacts);
  registry.register('verify.key-links', verifyKeyLinks);
  registry.register('verify key-links', verifyKeyLinks);
  registry.register('validate.consistency', validateConsistency);
  registry.register('validate consistency', validateConsistency);
  registry.register('validate.health', validateHealth);
  registry.register('validate health', validateHealth);

  // Wire event emission for mutation commands
  if (eventStream) {
    for (const cmd of MUTATION_COMMANDS) {
      const original = registry.getHandler(cmd);
      if (original) {
        registry.register(cmd, async (args: string[], projectDir: string) => {
          const result = await original(args, projectDir);
          try {
            const event = buildMutationEvent(cmd, args, result);
            eventStream.emitEvent(event);
          } catch {
            // T-11-12: Event emission is fire-and-forget; never block mutation success
          }
          return result;
        });
      }
    }
  }

  return registry;
}
