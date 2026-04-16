/**
 * Canonical registry commands exercised by `golden.integration.test.ts` (subprocess vs SDK).
 * Keep in sync with `registry.dispatch(...)` calls in that file — prefer dotted canonicals.
 */
export const GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS = new Set<string>([
  'generate-slug',
  'frontmatter.get',
  'config-get',
  'find-phase',
  'roadmap.analyze',
  'progress.json',
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
]);
