/**
 * Golden file capture — shells out to gsd-tools.cjs and returns parsed JSON.
 * Used by golden file integration tests to compare SDK output against legacy CJS output.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * Resolve the path to the bundled gsd-tools.cjs (repo-relative from this module).
 */
export function resolveGsdToolsPath(): string {
  return fileURLToPath(
    new URL('../../../get-shit-done/bin/gsd-tools.cjs', import.meta.url),
  );
}

/**
 * Capture the JSON output of a gsd-tools.cjs command.
 *
 * @param command - The gsd-tools command to run (e.g., 'generate-slug')
 * @param args - Arguments to pass after the command
 * @param projectDir - Working directory for the command
 * @returns Parsed JSON output from gsd-tools.cjs stdout
 */
export async function captureGsdToolsStdout(
  command: string,
  args: string[],
  projectDir: string,
): Promise<string> {
  const gsdToolsPath = resolveGsdToolsPath();
  const { stdout } = await execFileAsync(
    process.execPath,
    [gsdToolsPath, command, ...args],
    { cwd: projectDir, timeout: 10_000 },
  );
  return stdout.trim();
}

export async function captureGsdToolsOutput(
  command: string,
  args: string[],
  projectDir: string,
): Promise<unknown> {
  const raw = await captureGsdToolsStdout(command, args, projectDir);
  return JSON.parse(raw);
}
