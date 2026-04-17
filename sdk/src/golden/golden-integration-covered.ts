/**
 * Canonical registry keys exercised by `golden.integration.test.ts` subprocess parity checks.
 * Keep in sync when adding `registry.dispatch(...)` cases there.
 */

import { canonicalForDispatch } from './registry-canonical-commands.js';

const DISPATCH_IN_GOLDEN_INTEGRATION_FILE: string[] = [
  'generate-slug',
  'frontmatter.get',
  'config-get',
  'find-phase',
  'roadmap.analyze',
  'progress',
  'frontmatter.validate',
  'template.select',
  'config-set',
  'current-timestamp',
  'verify.plan-structure',
  'validate.consistency',
  'init.execute-phase',
  'init.plan-phase',
  'init.quick',
  'init.resume',
  'init.verify-work',
  'verify.phase-completeness',
  'state.validate',
  'state.sync',
  'detect-custom-files',
  'docs-init',
  'intel.update',
];

export const GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS: string[] = Array.from(
  new Set(DISPATCH_IN_GOLDEN_INTEGRATION_FILE.map((c) => canonicalForDispatch(c))),
).sort((a, b) => a.localeCompare(b));
