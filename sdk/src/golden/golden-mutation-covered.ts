/**
 * Canonical commands with subprocess JSON parity in a dedicated mutation integration suite.
 * Populated when `mutation-subprocess.integration.test.ts` (or equivalent) lands; until then
 * mutation coverage outside `golden.integration.test.ts` is described in `golden-policy.ts`
 * via `MUTATION_DEFERRED_REASON`.
 */
export const GOLDEN_MUTATION_SUBPROCESS_COVERED: string[] = [];
