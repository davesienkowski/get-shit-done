/**
 * GSD Tools Bridge — shells out to `gsd-tools.cjs` for state management.
 *
 * All `.planning/` state operations go through gsd-tools.cjs rather than
 * reimplementing 12K+ lines of logic.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex, RoadmapAnalysis } from './types.js';
import type { QueryResult } from './query/utils.js';

// ─── Error type ──────────────────────────────────────────────────────────────

export class GSDToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GSDToolsError';
  }
}

// ─── GSDTools class ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const BUNDLED_GSD_TOOLS_PATH = fileURLToPath(
  new URL('../../get-shit-done/bin/gsd-tools.cjs', import.meta.url),
);

export class GSDTools {
  private readonly projectDir: string;
  private readonly gsdToolsPath: string;
  private readonly timeoutMs: number;
  private readonly workstream?: string;

  constructor(opts: {
    projectDir: string;
    gsdToolsPath?: string;
    timeoutMs?: number;
    workstream?: string;
  }) {
    this.projectDir = opts.projectDir;
    this.gsdToolsPath =
      opts.gsdToolsPath ?? resolveGsdToolsPath(opts.projectDir);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.workstream = opts.workstream;
  }

  // ─── Core exec ───────────────────────────────────────────────────────────

  /**
   * Execute a gsd-tools command and return parsed JSON output.
   * Handles the `@file:` prefix pattern for large results.
   */
  async exec(command: string, args: string[] = []): Promise<unknown> {
    const wsArgs = this.workstream ? ['--ws', this.workstream] : [];
    const fullArgs = [this.gsdToolsPath, command, ...args, ...wsArgs];

    return new Promise<unknown>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        async (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';

          if (error) {
            // Distinguish timeout from other errors
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              reject(
                new GSDToolsError(
                  `gsd-tools timed out after ${this.timeoutMs}ms: ${command} ${args.join(' ')}`,
                  command,
                  args,
                  null,
                  stderrStr,
                ),
              );
              return;
            }

            reject(
              new GSDToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }

          const raw = stdout?.toString() ?? '';

          try {
            const parsed = await this.parseOutput(raw);
            resolve(parsed);
          } catch (parseErr) {
            reject(
              new GSDToolsError(
                `Failed to parse gsd-tools output for "${command}": ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${raw.slice(0, 500)}`,
                command,
                args,
                0,
                stderrStr,
              ),
            );
          }
        },
      );

      // Safety net: kill if child doesn't respond to timeout signal
      child.on('error', (err) => {
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  /**
   * Parse gsd-tools output, handling `@file:` prefix.
   */
  private async parseOutput(raw: string): Promise<unknown> {
    const trimmed = raw.trim();

    if (trimmed === '') {
      return null;
    }

    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
      const filePath = jsonStr.slice(6).trim();
      jsonStr = await readFile(filePath, 'utf-8');
    }

    return JSON.parse(jsonStr);
  }

  // ─── Raw exec (no JSON parsing) ───────────────────────────────────────

  /**
   * Execute a gsd-tools command and return raw stdout without JSON parsing.
   * Use for commands like `config-set` that return plain text, not JSON.
   */
  async execRaw(command: string, args: string[] = []): Promise<string> {
    const wsArgs = this.workstream ? ['--ws', this.workstream] : [];
    const fullArgs = [this.gsdToolsPath, command, ...args, ...wsArgs, '--raw'];

    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        fullArgs,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';
          if (error) {
            reject(
              new GSDToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }
          resolve((stdout?.toString() ?? '').trim());
        },
      );

      child.on('error', (err) => {
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  // ─── Typed convenience methods ─────────────────────────────────────────

  async stateLoad(): Promise<string> {
    return this.execRaw('state', ['load']);
  }

  async roadmapAnalyze(): Promise<RoadmapAnalysis> {
    return this.exec('roadmap', ['analyze']) as Promise<RoadmapAnalysis>;
  }

  async phaseComplete(phase: string): Promise<string> {
    return this.execRaw('phase', ['complete', phase]);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    const args = [message];
    if (files?.length) {
      args.push('--files', ...files);
    }
    return this.execRaw('commit', args);
  }

  async verifySummary(path: string): Promise<string> {
    return this.execRaw('verify-summary', [path]);
  }

  async initExecutePhase(phase: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phase]);
  }

  /**
   * Query phase state from gsd-tools.cjs `init phase-op`.
   * Returns a typed PhaseOpInfo describing what exists on disk for this phase.
   */
  async initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo> {
    const result = await this.exec('init', ['phase-op', phaseNumber]);
    return result as PhaseOpInfo;
  }

  /**
   * Get a config value from gsd-tools.cjs.
   */
  async configGet(key: string): Promise<string | null> {
    const result = await this.exec('config', ['get', key]);
    return result as string | null;
  }

  /**
   * Begin phase state tracking in gsd-tools.cjs.
   */
  async stateBeginPhase(phaseNumber: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phaseNumber]);
  }

  /**
   * Get the plan index for a phase, grouping plans into dependency waves.
   * Returns typed PhasePlanIndex with wave assignments and completion status.
   */
  async phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex> {
    const result = await this.exec('phase-plan-index', [phaseNumber]);
    return result as PhasePlanIndex;
  }

  /**
   * Query new-project init state from gsd-tools.cjs `init new-project`.
   * Returns project metadata, model configs, brownfield detection, etc.
   */
  async initNewProject(): Promise<InitNewProjectInfo> {
    const result = await this.exec('init', ['new-project']);
    return result as InitNewProjectInfo;
  }

  /**
   * Set a config value via gsd-tools.cjs `config-set`.
   * Handles type coercion (booleans, numbers, JSON) on the gsd-tools side.
   * Note: config-set returns `key=value` text, not JSON, so we use execRaw.
   */
  async configSet(key: string, value: string): Promise<string> {
    return this.execRaw('config-set', [key, value]);
  }
}

// ─── Path resolution ────────────────────────────────────────────────────────

/**
 * Resolve gsd-tools.cjs path.
 * Probe order: `GSD_TOOLS_PATH` (if set and exists) → SDK-bundled repo copy →
 * `project/.claude/get-shit-done/` → `~/.claude/get-shit-done/`.
 * Bundled is preferred over project-local so `gsd-sdk query` matches the checkout’s CLI.
 */
export function resolveGsdToolsPath(projectDir: string): string {
  const envPath = process.env.GSD_TOOLS_PATH?.trim();
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  // Prefer the SDK-bundled repo copy (current checkout) over a possibly stale
  // `project/.claude/get-shit-done/` install so `gsd-sdk query` passthrough matches
  // the same `gsd-tools.cjs` revision as this package.
  const candidates = [
    BUNDLED_GSD_TOOLS_PATH,
    join(projectDir, '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
    join(homedir(), '.claude', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[candidates.length - 1]!;
}

// ─── Query CLI passthrough (100% parity with gsd-tools argv) ────────────────

/**
 * Parse stdout from gsd-tools — JSON, optional `@file:` indirection (see GSDTools.parseOutput).
 */
async function parseGsdToolsStdout(raw: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  let jsonStr = trimmed;
  if (jsonStr.startsWith('@file:')) {
    const filePath = jsonStr.slice(6).trim();
    jsonStr = await readFile(filePath, 'utf-8');
  }
  return JSON.parse(jsonStr);
}

/**
 * Run `gsd-tools.cjs` with the same argv shape as the standalone CLI (`node gsd-tools.cjs <command> …`).
 * Used when `gsd-sdk query` has no registered native handler (longest-prefix match).
 * Attempts JSON parse; on failure returns `{ text: stdout }` for text/format outputs.
 */
export async function runGsdToolsQuery(
  tokens: string[],
  opts: { projectDir: string; workstream?: string; timeoutMs?: number },
): Promise<QueryResult> {
  if (tokens.length === 0) {
    throw new GSDToolsError('No command tokens for gsd-tools passthrough', '', [], null, '');
  }

  const gsdToolsPath = resolveGsdToolsPath(opts.projectDir);
  const wsArgs = opts.workstream ? ['--ws', opts.workstream] : [];
  const fullArgs = [gsdToolsPath, ...tokens, ...wsArgs];
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<QueryResult>((resolve, reject) => {
    execFile(
      process.execPath,
      fullArgs,
      {
        cwd: opts.projectDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env },
      },
      async (error, stdout, stderr) => {
        const stderrStr = stderr?.toString() ?? '';
        const outStr = stdout?.toString() ?? '';

        if (error) {
          if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
            reject(
              new GSDToolsError(
                `gsd-tools timed out after ${timeoutMs}ms: ${tokens.join(' ')}`,
                tokens[0] ?? '',
                tokens.slice(1),
                null,
                stderrStr,
              ),
            );
            return;
          }
          reject(
            new GSDToolsError(
              `gsd-tools exited with code ${error.code ?? 'unknown'}: ${tokens.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
              tokens[0] ?? '',
              tokens.slice(1),
              typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
              stderrStr,
            ),
          );
          return;
        }

        try {
          const data = await parseGsdToolsStdout(outStr);
          resolve({ data });
        } catch {
          resolve({ data: { text: outStr } });
        }
      },
    );
  });
}
