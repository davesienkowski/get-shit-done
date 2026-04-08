/**
 * GSD SDK — Public API for running GSD plans programmatically.
 *
 * The GSD class composes plan parsing, config loading, prompt building,
 * and session running into a single `executePlan()` call.
 *
 * @example
 * ```typescript
 * import { GSD } from '@gsd-build/sdk';
 *
 * const gsd = new GSD({ projectDir: '/path/to/project' });
 * const result = await gsd.executePlan('.planning/phases/01-auth/01-auth-01-PLAN.md');
 *
 * if (result.success) {
 *   console.log(`Plan completed in ${result.durationMs}ms, cost: $${result.totalCostUsd}`);
 * } else {
 *   console.error(`Plan failed: ${result.error?.messages.join(', ')}`);
 * }
 * ```
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

import type { GSDOptions, PlanResult, SessionOptions, GSDEvent, TransportHandler, PhaseRunnerOptions, PhaseRunnerResult, MilestoneRunnerOptions, MilestoneRunnerResult, RoadmapPhaseInfo, RoadmapAnalysis, PhaseOpInfo, PhasePlanIndex, InitNewProjectInfo } from './types.js';
import { GSDEventType } from './types.js';
import { parsePlan, parsePlanFile } from './plan-parser.js';
import { loadConfig } from './config.js';
import { runPlanSession } from './session-runner.js';
import { buildExecutorPrompt, parseAgentTools } from './prompt-builder.js';
import { GSDEventStream } from './event-stream.js';
import { PhaseRunner } from './phase-runner.js';
import type { PhaseRunnerTools } from './phase-runner.js';
import { ContextEngine } from './context-engine.js';
import { PromptFactory } from './phase-prompt.js';
import { roadmapAnalyze } from './query/roadmap.js';
import { initPhaseOp } from './query/init.js';
import { phasePlanIndex } from './query/phase.js';
import { phaseComplete } from './query/phase-lifecycle.js';

// ─── GSD class ───────────────────────────────────────────────────────────────

export class GSD {
  private readonly projectDir: string;
  private readonly defaultModel?: string;
  private readonly defaultMaxBudgetUsd: number;
  private readonly defaultMaxTurns: number;
  private readonly autoMode: boolean;
  readonly eventStream: GSDEventStream;

  constructor(options: GSDOptions) {
    this.projectDir = resolve(options.projectDir);
    this.defaultModel = options.model;
    this.defaultMaxBudgetUsd = options.maxBudgetUsd ?? 5.0;
    this.defaultMaxTurns = options.maxTurns ?? 50;
    this.autoMode = options.autoMode ?? false;
    this.eventStream = new GSDEventStream();
  }

  /**
   * Execute a single GSD plan file.
   *
   * Reads the plan from disk, parses it, loads project config,
   * optionally reads the agent definition, then runs a query() session.
   *
   * @param planPath - Path to the PLAN.md file (absolute or relative to projectDir)
   * @param options - Per-execution overrides
   * @returns PlanResult with cost, duration, success/error status
   */
  async executePlan(planPath: string, options?: SessionOptions): Promise<PlanResult> {
    // Resolve plan path relative to project dir
    const absolutePlanPath = resolve(this.projectDir, planPath);

    // Parse the plan
    const plan = await parsePlanFile(absolutePlanPath);

    // Load project config
    const config = await loadConfig(this.projectDir);

    // Try to load agent definition for tool restrictions
    const agentDef = await this.loadAgentDefinition();

    // Merge defaults with per-call options
    const sessionOptions: SessionOptions = {
      maxTurns: options?.maxTurns ?? this.defaultMaxTurns,
      maxBudgetUsd: options?.maxBudgetUsd ?? this.defaultMaxBudgetUsd,
      model: options?.model ?? this.defaultModel,
      cwd: options?.cwd ?? this.projectDir,
      allowedTools: options?.allowedTools,
    };

    return runPlanSession(plan, config, sessionOptions, agentDef, this.eventStream, {
      phase: undefined, // Phase context set by higher-level orchestrators
      planName: plan.frontmatter.plan,
    });
  }

  /**
   * Subscribe a simple handler to receive all GSD events.
   */
  onEvent(handler: (event: GSDEvent) => void): void {
    this.eventStream.on('event', handler);
  }

  /**
   * Subscribe a transport handler to receive all GSD events.
   * Transports provide structured onEvent/close lifecycle.
   */
  addTransport(handler: TransportHandler): void {
    this.eventStream.addTransport(handler);
  }

  /**
   * Create a PhaseRunnerTools implementation backed by native SDK functions.
   */
  createTools(): PhaseRunnerTools {
    const projectDir = this.projectDir;
    return {
      initPhaseOp: async (phaseNumber: string) => {
        const r = await initPhaseOp([phaseNumber], projectDir);
        return r.data as PhaseOpInfo;
      },
      phasePlanIndex: async (phaseNumber: string) => {
        const r = await phasePlanIndex([phaseNumber], projectDir);
        return r.data as PhasePlanIndex;
      },
      phaseComplete: async (phaseNumber: string) => {
        await phaseComplete([phaseNumber], projectDir);
      },
    };
  }

  /**
   * Create an InitRunnerTools implementation backed by native SDK functions.
   */
  createInitTools(): import('./init-runner.js').InitRunnerTools {
    const projectDir = this.projectDir;
    return {
      initNewProject: async () => {
        const { initNewProject: fn } = await import('./query/init-complex.js');
        const r = await fn([], projectDir);
        return r.data as InitNewProjectInfo;
      },
      configSet: async (key: string, value: string) => {
        const { configSet: fn } = await import('./query/config-mutation.js');
        const r = await fn([key, value], projectDir);
        return r.data;
      },
      commit: async (message: string, files?: string[]) => {
        const { commit: fn } = await import('./query/commit.js');
        const args = files ? [message, '--files', ...files] : [message];
        const r = await fn(args, projectDir);
        return r.data;
      },
    };
  }

  /**
   * Run a full phase lifecycle: discuss → research → plan → execute → verify → advance.
   *
   * Creates the necessary collaborators (PromptFactory, ContextEngine),
   * loads project config, instantiates a PhaseRunner, and delegates to `runner.run()`.
   *
   * @param phaseNumber - The phase number to execute (e.g. "01", "02")
   * @param options - Per-phase overrides for budget, turns, model, and callbacks
   * @returns PhaseRunnerResult with per-step results, overall success, cost, and timing
   */
  async runPhase(phaseNumber: string, options?: PhaseRunnerOptions): Promise<PhaseRunnerResult> {
    const tools = this.createTools();
    const promptFactory = new PromptFactory();
    const contextEngine = new ContextEngine(this.projectDir);
    const config = await loadConfig(this.projectDir);

    // Auto mode: force auto_advance on and skip_discuss off so self-discuss kicks in
    if (this.autoMode) {
      config.workflow.auto_advance = true;
      config.workflow.skip_discuss = false;
    }

    const runner = new PhaseRunner({
      projectDir: this.projectDir,
      tools,
      promptFactory,
      contextEngine,
      eventStream: this.eventStream,
      config,
    });

    return runner.run(phaseNumber, options);
  }

  /**
   * Run a full milestone: discover phases, execute each incomplete one in order,
   * re-discover after each completion to catch dynamically inserted phases.
   *
   * @param prompt - The user prompt describing the milestone goal
   * @param options - Per-milestone overrides for budget, turns, model, and callbacks
   * @returns MilestoneRunnerResult with per-phase results, overall success, cost, and timing
   */
  async run(prompt: string, options?: MilestoneRunnerOptions): Promise<MilestoneRunnerResult> {
    const startTime = Date.now();
    const phaseResults: PhaseRunnerResult[] = [];
    let success = true;

    // Discover initial phases via native SDK roadmap handler
    const initialResult = await roadmapAnalyze([], this.projectDir);
    const initialAnalysis = initialResult.data as RoadmapAnalysis;
    const incompletePhases = this.filterAndSortPhases(initialAnalysis.phases);

    // Emit MilestoneStart
    this.eventStream.emitEvent({
      type: GSDEventType.MilestoneStart,
      timestamp: new Date().toISOString(),
      sessionId: `milestone-${Date.now()}`,
      phaseCount: incompletePhases.length,
      prompt,
    });

    // Loop through phases, re-discovering after each completion
    let currentPhases = incompletePhases;

    while (currentPhases.length > 0) {
      const phase = currentPhases[0];

      try {
        const result = await this.runPhase(phase.number, options);
        phaseResults.push(result);

        if (!result.success) {
          success = false;
          break;
        }

        // Notify callback if present; stop if requested
        if (options?.onPhaseComplete) {
          const verdict = await options.onPhaseComplete(result, phase);
          if (verdict === 'stop') {
            break;
          }
        }

        // Re-discover phases to catch dynamically inserted ones
        const updatedResult = await roadmapAnalyze([], this.projectDir);
        const updatedAnalysis = updatedResult.data as RoadmapAnalysis;
        currentPhases = this.filterAndSortPhases(updatedAnalysis.phases);
      } catch (err) {
        // Phase threw an unexpected error — record as failure and stop
        phaseResults.push({
          phaseNumber: phase.number,
          phaseName: phase.phase_name,
          steps: [],
          success: false,
          totalCostUsd: 0,
          totalDurationMs: 0,
        });
        success = false;
        break;
      }
    }

    const totalCostUsd = phaseResults.reduce((sum, r) => sum + r.totalCostUsd, 0);
    const totalDurationMs = Date.now() - startTime;

    // Emit MilestoneComplete
    this.eventStream.emitEvent({
      type: GSDEventType.MilestoneComplete,
      timestamp: new Date().toISOString(),
      sessionId: `milestone-${Date.now()}`,
      success,
      totalCostUsd,
      totalDurationMs,
      phasesCompleted: phaseResults.filter(r => r.success).length,
    });

    return {
      success,
      phases: phaseResults,
      totalCostUsd,
      totalDurationMs,
    };
  }

  /**
   * Filter to incomplete phases and sort numerically.
   * Uses parseFloat to handle decimal phase numbers (e.g. '5.1').
   */
  private filterAndSortPhases(phases: RoadmapPhaseInfo[]): RoadmapPhaseInfo[] {
    return phases
      .filter(p => !p.roadmap_complete)
      .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
  }

  /**
   * Load the gsd-executor agent definition if available.
   * Falls back gracefully — returns undefined if not found.
   */
  private async loadAgentDefinition(): Promise<string | undefined> {
    const paths = [
      // Repo-local GSD installation
      join(this.projectDir, '.claude', 'get-shit-done', 'agents', 'gsd-executor.md'),
      // Repo-local agents directory
      join(this.projectDir, '.claude', 'agents', 'gsd-executor.md'),
      // Global home directory
      join(homedir(), '.claude', 'agents', 'gsd-executor.md'),
      join(this.projectDir, 'agents', 'gsd-executor.md'),
    ];

    for (const p of paths) {
      try {
        return await readFile(p, 'utf-8');
      } catch {
        // Not found at this path, try next
      }
    }

    return undefined;
  }
}

// ─── Re-exports for advanced usage ──────────────────────────────────────────

export { parsePlan, parsePlanFile } from './plan-parser.js';
export { loadConfig } from './config.js';
export type { GSDConfig } from './config.js';
// GSDTools bridge removed in v3.0 — all state management now uses native SDK handlers.
export { runPlanSession, runPhaseStepSession } from './session-runner.js';
export { buildExecutorPrompt, parseAgentTools } from './prompt-builder.js';
export * from './types.js';

// S02: Event stream, context, prompt, and logging modules
export { GSDEventStream } from './event-stream.js';
export type { EventStreamContext } from './event-stream.js';
export { ContextEngine, PHASE_FILE_MANIFEST } from './context-engine.js';
export type { FileSpec } from './context-engine.js';
export { truncateMarkdown, extractCurrentMilestone, DEFAULT_TRUNCATION_OPTIONS } from './context-truncation.js';
export type { TruncationOptions } from './context-truncation.js';
export { getToolsForPhase, PHASE_AGENT_MAP, PHASE_DEFAULT_TOOLS } from './tool-scoping.js';
export { checkResearchGate } from './research-gate.js';
export type { ResearchGateResult } from './research-gate.js';
export { PromptFactory, extractBlock, extractSteps, PHASE_WORKFLOW_MAP } from './phase-prompt.js';
export { GSDLogger } from './logger.js';
export type { LogLevel, LogEntry, GSDLoggerOptions } from './logger.js';

// S03: Phase lifecycle state machine
export { PhaseRunner, PhaseRunnerError } from './phase-runner.js';
export type { PhaseRunnerDeps, VerificationOutcome } from './phase-runner.js';

// S05: Transports
export { CLITransport } from './cli-transport.js';
export { WSTransport } from './ws-transport.js';
export type { WSTransportOptions } from './ws-transport.js';

// Init workflow
export { InitRunner } from './init-runner.js';
export type { InitRunnerDeps } from './init-runner.js';
export type { InitConfig, InitResult, InitStepResult, InitStepName } from './types.js';
