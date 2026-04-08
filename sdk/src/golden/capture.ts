/**
 * Golden file capture — shells out to gsd-tools.cjs and returns parsed JSON.
 * Used by golden file integration tests to compare SDK output against legacy CJS output.
 *
 * TODO: Implement in GREEN phase.
 */

/**
 * Resolve the path to the bundled gsd-tools.cjs.
 */
export function resolveGsdToolsPath(): string {
  throw new Error('Not implemented');
}

/**
 * Capture the JSON output of a gsd-tools.cjs command.
 */
export async function captureGsdToolsOutput(
  _command: string,
  _args: string[],
  _projectDir: string,
): Promise<unknown> {
  throw new Error('Not implemented');
}
