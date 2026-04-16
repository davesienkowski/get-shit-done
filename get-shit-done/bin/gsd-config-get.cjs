#!/usr/bin/env node
/**
 * Loud wrapper for `gsd-sdk query config-get` — does not swallow SDK/query failures (#2309).
 *
 * Usage:
 *   node gsd-config-get.cjs <key.path> [<default>] [--raw]
 *
 * - If the key is missing or config.json is absent, prints <default> (or empty) and exits 0.
 * - If gsd-sdk is missing, too old (no `query`), or another hard failure occurs, prints to stderr and exits 1.
 *
 * @example
 * DISCUSS_MODE=$(node "$HOME/.claude/get-shit-done/bin/gsd-config-get.cjs" workflow.discuss_mode discuss)
 */

const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let raw = false;
const pos = [];
for (const a of args) {
  if (a === '--raw') {
    raw = true;
  } else {
    pos.push(a);
  }
}

const key = pos[0];
const defaultVal = pos.length > 1 ? pos.slice(1).join(' ') : '';

if (!key) {
  console.error('Usage: gsd-config-get.cjs <key.path> [<default>] [--raw]');
  process.exit(1);
}

const qargs = ['query', 'config-get', key];
if (raw) {
  qargs.push('--raw');
}

const result = spawnSync('gsd-sdk', qargs, {
  encoding: 'utf8',
  shell: true,
});

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error(
      'GSD: gsd-sdk is not on PATH. Install @gsd-build/sdk (see docs/manual-update.md).',
    );
    process.exit(1);
  }
  console.error(`GSD: failed to spawn gsd-sdk: ${result.error.message}`);
  process.exit(1);
}

const out = (result.stdout || '').trimEnd();
const err = (result.stderr || '').trim();

if (result.status === 0) {
  if (out.length > 0) {
    process.stdout.write(out + '\n');
  }
  process.exit(0);
}

const combined = `${err}\n${out}`.trim();

if (/Key not found:/.test(combined) || /No config\.json/.test(combined)) {
  process.stdout.write(String(defaultVal) + '\n');
  process.exit(0);
}

if (
  /Expected "gsd-sdk run"/.test(combined) ||
  /requires a command/.test(combined) ||
  /Unknown command:/.test(combined)
) {
  console.error(
    'GSD: gsd-sdk does not support `query` (too old) or failed before config-get. Upgrade @gsd-build/sdk (see docs/manual-update.md).',
  );
  if (combined) {
    console.error(combined);
  }
  process.exit(1);
}

console.error('GSD: gsd-sdk query config-get failed.');
if (combined) {
  console.error(combined);
}
process.exit(1);
