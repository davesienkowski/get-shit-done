/**
 * Batch workflow config for orchestration decisions (`check.config-gates`).
 *
 * Replaces many repeated `config-get workflow.*` calls with one JSON object.
 * See `.planning/research/decision-routing-audit.md` §3.3.
 */

import { CONFIG_DEFAULTS, loadConfig } from '../config.js';
import type { QueryHandler } from './utils.js';

/**
 * Merge workflow defaults with project config, then expose stable keys for workflows.
 */
export const checkConfigGates: QueryHandler = async (args, projectDir) => {
  const config = await loadConfig(projectDir);
  const wf: Record<string, unknown> = {
    ...CONFIG_DEFAULTS.workflow,
    ...(config.workflow as unknown as Record<string, unknown>),
  };
  const root = config as Record<string, unknown>;
  const contextWindow =
    typeof root.context_window === 'number' ? root.context_window : 200000;

  const data: Record<string, unknown> = {
    workflow: args[0] ?? null,
    research_enabled: Boolean(wf.research ?? true),
    plan_checker_enabled: Boolean(wf.plan_check ?? true),
    nyquist_validation: Boolean(wf.nyquist_validation ?? true),
    security_enforcement: wf.security_enforcement ?? true,
    security_asvs_level: wf.security_asvs_level ?? 1,
    security_block_on: wf.security_block_on ?? 'high',
    ui_phase: Boolean(wf.ui_phase ?? true),
    ui_safety_gate: Boolean(wf.ui_safety_gate ?? true),
    ui_review: wf.ui_review ?? true,
    text_mode: Boolean(wf.text_mode ?? false),
    auto_advance: Boolean(wf.auto_advance ?? false),
    auto_chain_active: Boolean(wf._auto_chain_active ?? false),
    code_review: wf.code_review ?? true,
    code_review_depth: wf.code_review_depth ?? 'standard',
    context_window: contextWindow,
    discuss_mode: String(wf.discuss_mode ?? 'discuss'),
    use_worktrees: wf.use_worktrees ?? true,
    skip_discuss: Boolean(wf.skip_discuss ?? false),
    max_discuss_passes: wf.max_discuss_passes ?? 3,
    node_repair: wf.node_repair ?? true,
    research_before_questions: Boolean(wf.research_before_questions ?? false),
    verifier: Boolean(wf.verifier ?? true),
    plan_check: Boolean(wf.plan_check ?? true),
    subagent_timeout: wf.subagent_timeout ?? CONFIG_DEFAULTS.workflow.subagent_timeout,
  };

  return { data };
};
