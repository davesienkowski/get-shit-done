/**
 * Config mutation handlers — write operations for .planning/config.json.
 *
 * Ported from get-shit-done/bin/lib/config.cjs.
 * Provides config-set (with key validation and value coercion),
 * config-set-model-profile, config-new-project, and config-ensure-section.
 *
 * @example
 * ```typescript
 * import { configSet, configNewProject } from './config-mutation.js';
 *
 * await configSet(['model_profile', 'quality'], '/project');
 * // { data: { set: true, key: 'model_profile', value: 'quality' } }
 *
 * await configNewProject([], '/project');
 * // { data: { created: true, path: '.planning/config.json' } }
 * ```
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { MODEL_PROFILES, VALID_PROFILES } from './config-query.js';
import { planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── VALID_CONFIG_KEYS ────────────────────────────────────────────────────

/**
 * Allowlist of valid config key paths.
 *
 * Ported from config.cjs lines 14-37.
 * Dynamic patterns (agent_skills.*, features.*) are handled
 * separately in isValidConfigKey.
 */
const VALID_CONFIG_KEYS = new Set([
  'mode', 'granularity', 'parallelization', 'commit_docs', 'model_profile',
  'search_gitignored', 'brave_search', 'firecrawl', 'exa_search',
  'workflow.research', 'workflow.plan_check', 'workflow.verifier',
  'workflow.nyquist_validation', 'workflow.ui_phase', 'workflow.ui_safety_gate',
  'workflow.auto_advance', 'workflow.node_repair', 'workflow.node_repair_budget',
  'workflow.text_mode',
  'workflow.research_before_questions',
  'workflow.discuss_mode',
  'workflow.skip_discuss',
  'workflow._auto_chain_active',
  'workflow.use_worktrees',
  'workflow.code_review',
  'workflow.code_review_depth',
  'git.branching_strategy', 'git.base_branch', 'git.phase_branch_template',
  'git.milestone_branch_template', 'git.quick_branch_template',
  'planning.commit_docs', 'planning.search_gitignored',
  'workflow.subagent_timeout',
  'hooks.context_warnings',
  'features.thinking_partner',
  'context',
  'project_code', 'phase_naming',
  'manager.flags.discuss', 'manager.flags.plan', 'manager.flags.execute',
  'response_language',
]);

// ─── isValidConfigKey ─────────────────────────────────────────────────────

/**
 * Check whether a config key path is valid.
 *
 * Supports exact matches from VALID_CONFIG_KEYS plus dynamic patterns
 * like `agent_skills.<agent-type>` and `features.<feature_name>`.
 *
 * @param keyPath - Dot-notation config key path
 * @returns Object with valid flag and optional suggestion for typos
 */
export function isValidConfigKey(keyPath: string): { valid: boolean; suggestion?: string } {
  if (VALID_CONFIG_KEYS.has(keyPath)) return { valid: true };

  // Dynamic patterns: agent_skills.<agent-type>
  if (/^agent_skills\.[a-zA-Z0-9_-]+$/.test(keyPath)) return { valid: true };

  // Dynamic patterns: features.<feature_name>
  if (/^features\.[a-zA-Z0-9_]+$/.test(keyPath)) return { valid: true };

  // Find closest suggestion using longest common prefix
  const keys = [...VALID_CONFIG_KEYS];
  let bestMatch = '';
  let bestScore = 0;

  for (const candidate of keys) {
    let shared = 0;
    const maxLen = Math.min(keyPath.length, candidate.length);
    for (let i = 0; i < maxLen; i++) {
      if (keyPath[i] === candidate[i]) shared++;
      else break;
    }
    if (shared > bestScore) {
      bestScore = shared;
      bestMatch = candidate;
    }
  }

  return { valid: false, suggestion: bestScore > 2 ? bestMatch : undefined };
}

// ─── parseConfigValue ─────────────────────────────────────────────────────

/**
 * Coerce a CLI string value to its native type.
 *
 * Ported from config.cjs lines 344-351.
 *
 * @param value - String value from CLI
 * @returns Coerced value: boolean, number, parsed JSON, or original string
 */
export function parseConfigValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !isNaN(Number(value))) return Number(value);
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}

// ─── setConfigValue ───────────────────────────────────────────────────────

/**
 * Set a value at a dot-notation path in a config object.
 *
 * Creates nested objects as needed along the path.
 *
 * @param obj - Config object to mutate
 * @param dotPath - Dot-notation key path (e.g., 'workflow.auto_advance')
 * @param value - Value to set
 */
function setConfigValue(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

// ─── configSet ────────────────────────────────────────────────────────────

/**
 * Write a validated key-value pair to config.json.
 *
 * Validates key against VALID_CONFIG_KEYS allowlist, coerces value
 * from CLI string to native type, and writes config.json.
 *
 * @param args - args[0]=key, args[1]=value
 * @param projectDir - Project root directory
 * @returns QueryResult with { set: true, key, value }
 * @throws GSDError with Validation if key is invalid or args missing
 */
export const configSet: QueryHandler = async (args, projectDir) => {
  const keyPath = args[0];
  const rawValue = args[1];
  if (!keyPath) {
    throw new GSDError('Usage: config-set <key.path> <value>', ErrorClassification.Validation);
  }

  const validation = isValidConfigKey(keyPath);
  if (!validation.valid) {
    const suggestion = validation.suggestion ? `. Did you mean: ${validation.suggestion}?` : '';
    throw new GSDError(
      `Unknown config key: "${keyPath}"${suggestion}`,
      ErrorClassification.Validation,
    );
  }

  const parsedValue = rawValue !== undefined ? parseConfigValue(rawValue) : rawValue;

  const paths = planningPaths(projectDir);
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(paths.config, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Start with empty config if file doesn't exist or is malformed
  }

  setConfigValue(config, keyPath, parsedValue);
  await writeFile(paths.config, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return { data: { set: true, key: keyPath, value: parsedValue } };
};

// ─── configSetModelProfile ────────────────────────────────────────────────

/**
 * Validate and set the model profile in config.json.
 *
 * @param args - args[0]=profileName
 * @param projectDir - Project root directory
 * @returns QueryResult with { set: true, profile, agents }
 * @throws GSDError with Validation if profile is invalid
 */
export const configSetModelProfile: QueryHandler = async (args, projectDir) => {
  const profileName = args[0];
  if (!profileName) {
    throw new GSDError(
      `Usage: config-set-model-profile <${VALID_PROFILES.join('|')}>`,
      ErrorClassification.Validation,
    );
  }

  const normalized = profileName.toLowerCase().trim();
  if (!VALID_PROFILES.includes(normalized)) {
    throw new GSDError(
      `Invalid profile '${profileName}'. Valid profiles: ${VALID_PROFILES.join(', ')}`,
      ErrorClassification.Validation,
    );
  }

  const paths = planningPaths(projectDir);
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(paths.config, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Start with empty config
  }

  config.model_profile = normalized;
  await writeFile(paths.config, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return { data: { set: true, profile: normalized, agents: MODEL_PROFILES } };
};

// ─── configNewProject ─────────────────────────────────────────────────────

/**
 * Create config.json with defaults and optional user choices.
 *
 * Idempotent: if config.json already exists, returns { created: false }.
 * Detects API key availability from environment variables.
 *
 * @param args - args[0]=optional JSON string of user choices
 * @param projectDir - Project root directory
 * @returns QueryResult with { created: true, path } or { created: false, reason }
 */
export const configNewProject: QueryHandler = async (args, projectDir) => {
  const paths = planningPaths(projectDir);

  // Idempotent: don't overwrite existing config
  if (existsSync(paths.config)) {
    return { data: { created: false, reason: 'already_exists' } };
  }

  // Parse user choices
  let userChoices: Record<string, unknown> = {};
  if (args[0] && args[0].trim() !== '') {
    try {
      userChoices = JSON.parse(args[0]) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new GSDError(`Invalid JSON for config-new-project: ${msg}`, ErrorClassification.Validation);
    }
  }

  // Ensure .planning directory exists
  const planningDir = paths.planning;
  if (!existsSync(planningDir)) {
    await mkdir(planningDir, { recursive: true });
  }

  // Detect API key availability (boolean only, never store keys)
  const homeDir = homedir();
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || existsSync(join(homeDir, '.gsd', 'brave_api_key')));
  const hasFirecrawl = !!(process.env.FIRECRAWL_API_KEY || existsSync(join(homeDir, '.gsd', 'firecrawl_api_key')));
  const hasExaSearch = !!(process.env.EXA_API_KEY || existsSync(join(homeDir, '.gsd', 'exa_api_key')));

  // Build default config
  const defaults: Record<string, unknown> = {
    model_profile: 'balanced',
    commit_docs: false,
    parallelization: 1,
    search_gitignored: false,
    brave_search: hasBraveSearch,
    firecrawl: hasFirecrawl,
    exa_search: hasExaSearch,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gsd/phase-{phase}-{slug}',
      milestone_branch_template: 'gsd/{milestone}-{slug}',
      quick_branch_template: null,
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: false,
      node_repair: true,
      node_repair_budget: 2,
      ui_phase: true,
      ui_safety_gate: true,
      text_mode: false,
      research_before_questions: false,
      discuss_mode: 'discuss',
      skip_discuss: false,
      code_review: true,
      code_review_depth: 'standard',
    },
    hooks: {
      context_warnings: true,
    },
    project_code: null,
    phase_naming: 'sequential',
    agent_skills: {},
    features: {},
  };

  // Deep merge user choices over defaults (nested objects get merged)
  const config: Record<string, unknown> = {
    ...defaults,
    ...userChoices,
    git: {
      ...(defaults.git as Record<string, unknown>),
      ...((userChoices.git as Record<string, unknown>) || {}),
    },
    workflow: {
      ...(defaults.workflow as Record<string, unknown>),
      ...((userChoices.workflow as Record<string, unknown>) || {}),
    },
    hooks: {
      ...(defaults.hooks as Record<string, unknown>),
      ...((userChoices.hooks as Record<string, unknown>) || {}),
    },
    agent_skills: {
      ...((defaults.agent_skills as Record<string, unknown>) || {}),
      ...((userChoices.agent_skills as Record<string, unknown>) || {}),
    },
    features: {
      ...((defaults.features as Record<string, unknown>) || {}),
      ...((userChoices.features as Record<string, unknown>) || {}),
    },
  };

  await writeFile(paths.config, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return { data: { created: true, path: paths.config } };
};

// ─── configEnsureSection ──────────────────────────────────────────────────

/**
 * Idempotently ensure a top-level section exists in config.json.
 *
 * If the section key doesn't exist, creates it as an empty object.
 * If it already exists, preserves its contents.
 *
 * @param args - args[0]=sectionName
 * @param projectDir - Project root directory
 * @returns QueryResult with { ensured: true, section }
 */
export const configEnsureSection: QueryHandler = async (args, projectDir) => {
  const sectionName = args[0];
  if (!sectionName) {
    throw new GSDError('Usage: config-ensure-section <section>', ErrorClassification.Validation);
  }

  const paths = planningPaths(projectDir);
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(paths.config, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Start with empty config
  }

  if (!(sectionName in config)) {
    config[sectionName] = {};
  }

  await writeFile(paths.config, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return { data: { ensured: true, section: sectionName } };
};
