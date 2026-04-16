/**
 * Golden parity policy — every canonical registry command must be either:
 * - Listed in `GOLDEN_PARITY_INTEGRATION_COVERED` (subprocess CJS check under `sdk/src/golden/*integration*.test.ts`), or
 * - Documented in `GOLDEN_PARITY_EXCEPTIONS` with a stable rationale (mirrored in QUERY-HANDLERS.md § Golden registry coverage matrix).
 */
import { QUERY_MUTATION_COMMANDS } from '../query/index.js';
import { getCanonicalRegistryCommands } from './registry-canonical-commands.js';
import { GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS } from './golden-integration-covered.js';
import { readOnlyGoldenCanonicals } from './read-only-golden-rows.js';

/** True if this canonical command participates in mutation event wiring (see QUERY_MUTATION_COMMANDS). */
export function isMutationCanonicalCmd(canonical: string): boolean {
  const spaced = canonical.replace(/\./g, ' ');
  for (const m of QUERY_MUTATION_COMMANDS) {
    if (m === canonical || m === spaced) return true;
  }
  return false;
}

const MUTATION_DEFERRED_REASON =
  'Listed in QUERY_MUTATION_COMMANDS — mutates `.planning/`, git, or profile files. Subprocess golden vs gsd-tools.cjs is covered where a tmp fixture or `--dry-run` exists in golden.integration.test.ts; otherwise handler parity lives in sdk/src/query/*-mutation.test.ts, commit.test.ts, phase-lifecycle.test.ts, workstream.test.ts, intel.test.ts, profile.test.ts, template.test.ts, docs-init.ts, or uat.test.ts as applicable.';

const READ_HANDLER_ONLY_REASON = (cmd: string) =>
  `No ` +
  '`toEqual` subprocess row yet for this read-only command — handler parity is covered in sdk/src/query/*.test.ts / stubs.test.ts; add `captureGsdToolsOutput` + `registry.dispatch` in sdk/src/golden/ when JSON shapes are aligned (see QUERY-HANDLERS.md § Golden registry coverage matrix). Command: `' +
  cmd +
  '`.';

function buildIntegrationCoveredSet(): Set<string> {
  return new Set<string>([...GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS, ...readOnlyGoldenCanonicals()]);
}

/**
 * Canonical commands with an explicit subprocess JSON check vs gsd-tools.cjs
 * (golden.integration.test.ts + read-only-parity.integration.test.ts).
 */
export const GOLDEN_PARITY_INTEGRATION_COVERED = buildIntegrationCoveredSet();

export const GOLDEN_PARITY_EXCEPTIONS: Record<string, string> = buildGoldenParityExceptions();

function buildGoldenParityExceptions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of getCanonicalRegistryCommands()) {
    if (GOLDEN_PARITY_INTEGRATION_COVERED.has(c)) continue;
    if (isMutationCanonicalCmd(c)) {
      out[c] = MUTATION_DEFERRED_REASON;
    } else {
      out[c] = READ_HANDLER_ONLY_REASON(c);
    }
  }
  return out;
}

export function verifyGoldenPolicyComplete(): void {
  const canon = getCanonicalRegistryCommands();
  const missingException: string[] = [];
  for (const c of canon) {
    if (GOLDEN_PARITY_INTEGRATION_COVERED.has(c)) continue;
    if (!Object.prototype.hasOwnProperty.call(GOLDEN_PARITY_EXCEPTIONS, c)) missingException.push(c);
  }
  if (missingException.length) {
    throw new Error(`Missing GOLDEN_PARITY_EXCEPTIONS entry for:\n${missingException.join('\n')}`);
  }
  const stale: string[] = [];
  for (const c of GOLDEN_PARITY_INTEGRATION_COVERED) {
    if (!canon.includes(c)) stale.push(c);
  }
  if (stale.length) {
    throw new Error(`Stale GOLDEN_PARITY_INTEGRATION_COVERED entries:\n${stale.join('\n')}`);
  }
}
