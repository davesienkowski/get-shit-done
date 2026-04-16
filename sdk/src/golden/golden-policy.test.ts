/**
 * Ensures every canonical `createRegistry()` command is either:
 * - Listed in `GOLDEN_PARITY_INTEGRATION_COVERED` (subprocess golden in `golden.integration.test.ts` and/or
 *   `read-only-parity.integration.test.ts`), or
 * - Documented in `GOLDEN_PARITY_EXCEPTIONS` (see `QUERY-HANDLERS.md` § Golden registry coverage matrix).
 */
import { describe, it, expect } from 'vitest';
import { getCanonicalRegistryCommands } from './registry-canonical-commands.js';
import {
  GOLDEN_PARITY_INTEGRATION_COVERED,
  GOLDEN_PARITY_EXCEPTIONS,
  verifyGoldenPolicyComplete,
} from './golden-policy.js';

describe('Golden registry policy', () => {
  it('every canonical command is covered or has a documented exception', () => {
    verifyGoldenPolicyComplete();
  });

  it('covered set only contains real registry commands', () => {
    const canon = new Set(getCanonicalRegistryCommands());
    for (const c of GOLDEN_PARITY_INTEGRATION_COVERED) {
      expect(canon.has(c), `Stale entry in GOLDEN_PARITY_INTEGRATION_COVERED: ${c}`).toBe(true);
    }
  });

  it('exception keys are real registry commands', () => {
    const canon = new Set(getCanonicalRegistryCommands());
    for (const c of Object.keys(GOLDEN_PARITY_EXCEPTIONS)) {
      expect(canon.has(c), `Unknown key in GOLDEN_PARITY_EXCEPTIONS: ${c}`).toBe(true);
    }
  });

});
