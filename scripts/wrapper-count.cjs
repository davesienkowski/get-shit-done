#!/usr/bin/env node
'use strict';

/**
 * Wrapper-count metric script — counts remaining GSDTools bridge calls in SDK source.
 *
 * Scans all `.ts` files in `sdk/src/` (excluding test files) for:
 * - `this.exec(` and `this.execRaw(` patterns (actual bridge calls)
 * - Files importing or referencing `GSDTools` class (excluding the definition file)
 *
 * Outputs structured JSON to stdout for CI tracking of migration progress.
 *
 * Usage: node scripts/wrapper-count.cjs
 */

const { readdirSync, readFileSync, statSync } = require('fs');
const { join, relative } = require('path');

const SDK_SRC = join(__dirname, '..', 'sdk', 'src');
const BRIDGE_PATTERN = /this\.(exec|execRaw)\s*\(/g;
const IMPORT_PATTERN = /GSDTools/;

/**
 * Recursively walk a directory and collect `.ts` files,
 * excluding test and integration test files.
 */
function walkTs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTs(full, files);
    } else if (
      full.endsWith('.ts') &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.integration.test.ts')
    ) {
      files.push(full);
    }
  }
  return files;
}

const files = walkTs(SDK_SRC);
const bridgeCalls = { total: 0, by_file: {} };
const gsdToolsImports = { total: 0, files: [] };

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const relPath = relative(join(__dirname, '..'), filePath).replace(/\\/g, '/');

  // Count bridge calls (this.exec and this.execRaw)
  const matches = content.match(BRIDGE_PATTERN);
  const count = matches ? matches.length : 0;
  if (count > 0) {
    bridgeCalls.total += count;
    bridgeCalls.by_file[relPath] = count;
  }

  // Count GSDTools imports (skip gsd-tools.ts itself — that's the definition)
  if (!filePath.endsWith('gsd-tools.ts') && IMPORT_PATTERN.test(content)) {
    gsdToolsImports.total++;
    gsdToolsImports.files.push(relPath);
  }
}

const result = {
  bridge_calls: bridgeCalls,
  gsd_tools_imports: gsdToolsImports,
  summary: `${bridgeCalls.total} bridge calls in ${Object.keys(bridgeCalls.by_file).length} file(s), ${gsdToolsImports.total} files importing GSDTools`,
};

process.stdout.write(JSON.stringify(result, null, 2));
