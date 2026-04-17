/**
 * Classifies commits in feat/2302-track-a-golden vs upstream/main by subject pattern,
 * then outputs per-track hash files and cherry-pick commands for building filtered branches.
 *
 * Replaces: scripts/build-2302-track-b-list.mjs + scripts/rebase-track-b-editor.mjs
 * (those depended on original commit hashes, which change on every rebase; this uses
 * subject patterns and remains valid across history rewrites.)
 *
 * Tracks covered here (C and D are already on their own branches):
 *   A — Golden/parity policy: sdk-scoped commits, query handler implementations, golden tests
 *   B — Registry and docs: docs-migration commits, CHANGELOG, workflow call-site updates
 *
 * Usage:
 *   node scripts/split-tracks.mjs [branch] [base]
 *   node scripts/split-tracks.mjs feat/2302-track-a-golden upstream/main
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = process.argv[2] ?? 'feat/2302-track-a-golden';
const BASE = process.argv[3] ?? 'upstream/main';

// ── Classification rules (first-match wins) ────────────────────────────────
//
// To adjust: edit the test() functions below. Run the script to preview
// the full classification table before rebuilding branches.

const RULES = [
  // Track A: type=sdk  (sdk(query):, sdk(config,query):, etc.)
  {
    track: 'A',
    test: (subject) => {
      const m = subject.match(/^([\w-]+)(?:\([^)]*\))?:/);
      return !!m && m[1] === 'sdk';
    },
  },
  // Track A: scope contains 'sdk'  (feat(sdk):, fix(sdk/query):, docs(sdk):, etc.)
  {
    track: 'A',
    test: (subject) => {
      const m = subject.match(/^\w[\w-]*\(([^)]+)\):/);
      return !!m && m[1].includes('sdk');
    },
  },
  // Track A: QUERY-HANDLERS.md references (cli-scoped but Track A content)
  {
    track: 'A',
    test: (subject) => /QUERY-HANDLERS/i.test(subject),
  },
  // Track B: everything else (docs migration, CHANGELOG, workflow call-site updates)
  { track: 'B', test: () => true },
];

function classify(subject) {
  for (const rule of RULES) {
    if (rule.test(subject)) return rule.track;
  }
  return 'B';
}

// ── Read commits ──────────────────────────────────────────────────────────
const rawLog = execSync(`git log --reverse --format="%H %s" ${BASE}..${BRANCH}`, {
  encoding: 'utf8',
  cwd: ROOT,
});

const commits = rawLog
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const i = line.indexOf(' ');
    return { hash: line.slice(0, i), subject: line.slice(i + 1) };
  });

// ── Classify ──────────────────────────────────────────────────────────────
const tracks = { A: [], B: [] };

const COL = 64;
console.log(`\nClassifying ${commits.length} commits (${BASE}..${BRANCH})\n`);
console.log(`Trk  ${'Hash'.padEnd(9)}  Subject`);
console.log(`───  ${'─────────'}  ${'─'.repeat(COL)}`);

for (const { hash, subject } of commits) {
  const track = classify(subject);
  tracks[track].push(hash);
  const abbrev = hash.slice(0, 9);
  const label = subject.length > COL ? subject.slice(0, COL - 3) + '...' : subject;
  console.log(` ${track}   ${abbrev}  ${label}`);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n── Summary ${'─'.repeat(70)}`);
console.log(`  Track A (golden/parity — sdk-scoped, handler implementations, tests): ${tracks.A.length} commits`);
console.log(`  Track B (registry docs — docs migration, CHANGELOG, workflow updates): ${tracks.B.length} commits`);
console.log(`  Track C (runner alignment):  already on feat/2302-track-c-runners`);
console.log(`  Track D (CJS deprecation):   already on feat/2302-track-d-cjs-deprecation`);

// ── Write hash files ──────────────────────────────────────────────────────
for (const [track, hashes] of Object.entries(tracks)) {
  const file = join(ROOT, `.git-2302-track-${track.toLowerCase()}.txt`);
  writeFileSync(file, hashes.join('\n') + '\n');
}
console.log(`\n── Written ${'─'.repeat(70)}`);
console.log('  .git-2302-track-a.txt  — Track A hashes (current, post-rebase)');
console.log('  .git-2302-track-b.txt  — Track B hashes (current, post-rebase)');

// ── Cherry-pick commands for building clean filtered branches ─────────────
const BRANCH_NAMES = {
  A: 'feat/2302-track-a-golden-clean',
  B: 'feat/2302-track-b-registry-docs',
};

console.log(`\n── To build clean filtered branches ${'─'.repeat(44)}`);
console.log('  Run these after reviewing the classification above.\n');

for (const [track, hashes] of Object.entries(tracks)) {
  if (hashes.length === 0) continue;
  const branch = BRANCH_NAMES[track];
  console.log(`  Track ${track} (${hashes.length} commits):`);
  console.log(`    git checkout -b ${branch} ${BASE}`);
  // Group into a single cherry-pick call
  const formatted = hashes.join(' \\\n      ');
  console.log(`    git cherry-pick \\\n      ${formatted}`);
  console.log();
}

console.log('  After both branches build clean, submit PRs in order:');
console.log('    1. Track B (docs migration — no implementation deps)');
console.log('    2. Track A (golden tests — references handlers Track B documents)');
console.log('    3. Track C (already on branch — runner alignment)');
console.log('    4. Track D (already on branch — CJS deprecation header)');
