# Stack Research

**Domain:** SDK-First Migration — CLI argument parsing, typed state queries, build tooling
**Researched:** 2026-04-07
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:util` parseArgs | Node.js 20+ built-in | CLI argument parsing for `gsd-sdk query` | Already used in `sdk/src/cli.ts`. Zero dependencies. Supports subcommands via `allowPositionals`, typed options, strict mode. Sufficient for `gsd-sdk query <command> [args] [--flags]` pattern. |
| `node:fs/promises` | Node.js 20+ built-in | Async file reads for state queries (STATE.md, ROADMAP.md, config.json) | Already used throughout SDK (config.ts, gsd-tools.ts, cli.ts). All state files are local filesystem. |
| `node:path` | Node.js 20+ built-in | Path resolution for `.planning/` directory structure | Already used. Cross-platform path handling for Windows/Linux/macOS. |
| TypeScript 5.7 | ^5.7.0 | Typed state query interfaces, discriminated unions for query results | Already in devDependencies. Strict mode enabled. ES2022 target matches existing config. |
| Vitest | ^3.1.1 (SDK), ^4.1.2 (root) | Unit tests for query handlers, CLI argument parsing, JSON output | Already configured with unit/integration project split. No changes needed. |
| esbuild | 0.24.0 | Bundle CLI entry point if needed for single-file distribution | Already used in `scripts/build-hooks.js`. Available but likely unnecessary — `tsc` output works directly. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` execFile | Built-in | Temporary bridge: SDK wraps gsd-tools.cjs calls during migration | Phase 1 only — scaffolding while rewriting each command as native TypeScript. Already used in `sdk/src/gsd-tools.ts`. Remove as each command is rewritten. |
| `node:os` homedir | Built-in | Resolve global GSD installation paths | Already used. Needed for `resolveGsdToolsPath` fallback chain. |
| `node:url` fileURLToPath | Built-in | Convert `import.meta.url` to filesystem paths for package.json version reads | Already used in cli.ts. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest `--project unit` | Fast unit test runs for query handlers | Existing setup. No config changes needed. Each query command gets its own `.test.ts` file. |
| `tsc --build` | TypeScript compilation to `dist/` | Existing `npm run build` script. Output goes to `sdk/dist/`, including `cli.js` which is the bin entry point. |
| `npm link` | Local testing of `gsd-sdk query` CLI during development | Run `cd sdk && npm link` to make `gsd-sdk` available globally for manual testing. |

## No New Dependencies Required

The SDK-first migration requires **zero new npm packages**. Every capability needed is already available:

1. **CLI parsing**: `node:util` parseArgs (already used in cli.ts)
2. **File I/O**: `node:fs/promises` (already used everywhere)
3. **JSON output**: `JSON.stringify()` — native
4. **Path handling**: `node:path` (already used)
5. **Process management**: `node:child_process` execFile (already used for gsd-tools bridge)
6. **Testing**: Vitest (already configured)
7. **Building**: `tsc` (already configured)

This is consistent with the project's design philosophy: the SDK uses only Node.js built-ins in core, with `@anthropic-ai/claude-agent-sdk` and `ws` as the only runtime dependencies.

## CLI Architecture for `gsd-sdk query`

### Argument Parsing Pattern

Extend the existing `parseCliArgs()` in `cli.ts` to handle the `query` subcommand:

```typescript
// Pattern: gsd-sdk query <command> [args...] [--project-dir <dir>] [--raw] [--pick <field>]
// Examples:
//   gsd-sdk query state load
//   gsd-sdk query find-phase 3
//   gsd-sdk query resolve-model planner
//   gsd-sdk query roadmap analyze --pick phases
//   gsd-sdk query config get model_profile

const { values, positionals } = parseArgs({
  args: argv,
  options: {
    'project-dir': { type: 'string', default: process.cwd() },
    raw: { type: 'boolean', default: false },
    pick: { type: 'string' },
  },
  allowPositionals: true,
  strict: false,  // Allow unknown flags to pass through to subcommands
});

// positionals[0] = 'query'
// positionals[1] = command (e.g., 'state', 'find-phase')
// positionals[2+] = command-specific args
```

**Why `strict: false` for query subcommand:** Some gsd-tools commands accept their own flags (e.g., `--files`, `--force`, `--no-verify`). Using `strict: false` lets unknown flags pass through to command handlers. The alternative (enumerating every possible flag) is fragile and blocks extensibility. Validate at the command handler level instead.

### JSON Output Pattern

All query commands output structured JSON to stdout. Use a consistent output wrapper:

```typescript
// Result type for all query commands
interface QueryResult<T = unknown> {
  ok: boolean;
  data: T;        // Command-specific typed payload
  error?: string; // Only present when ok === false
}

// --pick extracts a nested field: --pick "phases[0].name"
// --raw outputs data directly without the wrapper
```

**Why this pattern:** Agents parse stdout from bash calls. Structured JSON with an `ok` field lets agents detect errors without parsing stderr. The `--pick` flag reduces output for agents that only need one field (saves context window tokens). The `--raw` flag provides backwards compatibility with gsd-tools.cjs string output.

### Exit Code Semantics

| Code | Meaning | When |
|------|---------|------|
| 0 | Success | Query returned valid result |
| 1 | General error | Unhandled exception, unknown command |
| 10 | Validation error | Bad arguments, missing required params |
| 11 | State error | Missing .planning/, corrupt config, phase not found |

**Why separate 10/11:** Agents can distinguish "you called it wrong" (fix the bash command) from "project state is broken" (need human intervention or repair). Maps to the error classification taxonomy in questions.md Q3.

## TypeScript Patterns for Typed State Queries

### Command Registry Pattern

```typescript
// Each query command is a typed function with explicit I/O
interface QueryCommand<TArgs, TResult> {
  name: string;
  description: string;
  parse: (positionals: string[], flags: Record<string, unknown>) => TArgs;
  execute: (args: TArgs, ctx: QueryContext) => Promise<TResult>;
}

interface QueryContext {
  projectDir: string;
  planningDir: string;  // projectDir + '/.planning'
}
```

**Why a registry:** Enables `gsd-sdk query --help` to auto-generate command lists. Each command is independently testable. New commands are added by registering a new `QueryCommand` — no modification to cli.ts routing logic.

### Discriminated Union for Results

Use TypeScript discriminated unions for command-specific return types:

```typescript
type StateLoadResult = { type: 'state-load'; milestone: string; phase: string; status: string };
type FindPhaseResult = { type: 'find-phase'; path: string; exists: boolean; planCount: number };
type ResolveModelResult = { type: 'resolve-model'; model: string; profile: string; agent: string };
```

**Why discriminated unions:** The `type` field acts as a tag for runtime checks. Agents parsing JSON can verify they got the expected response type. TypeScript narrows the type automatically in switch statements.

## Build Tooling — No Changes Needed

The existing build pipeline handles CLI production:

1. **Compilation**: `tsc` compiles `src/cli.ts` to `dist/cli.js` (already configured)
2. **Bin entry**: `package.json` already declares `"bin": { "gsd-sdk": "./dist/cli.js" }` 
3. **Shebang**: `cli.ts` already has `#!/usr/bin/env node`
4. **Distribution**: `package.json` `"files": ["dist", "prompts"]` already includes the compiled output

No esbuild bundling needed for the CLI. The `tsc` output is sufficient because:
- The SDK has only 2 runtime deps (`@anthropic-ai/claude-agent-sdk`, `ws`)
- Query commands don't need the Agent SDK — they're pure state reads
- Node.js 20+ handles ESM imports natively
- The `dist/` directory is small enough that bundling adds complexity without benefit

## Testing Infrastructure — No Changes Needed

### Unit Tests for Query Commands

Each query command gets a colocated test file following existing patterns:

```
sdk/src/query-state.ts          → sdk/src/query-state.test.ts
sdk/src/query-roadmap.ts        → sdk/src/query-roadmap.test.ts
sdk/src/query-phase.ts          → sdk/src/query-phase.test.ts
```

Test pattern (matches existing cli.test.ts and config.test.ts):

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('queryState', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `query-state-test-${Date.now()}`);
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads STATE.md frontmatter as typed object', async () => {
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v3.0\nphase: 1\n---\n');
    const result = await queryState({ projectDir: tmpDir });
    expect(result.milestone).toBe('v3.0');
  });
});
```

**Why no test infrastructure changes:** Vitest's existing unit project config (`include: ['src/**/*.test.ts']`) already picks up new test files. The tmp directory pattern for filesystem tests is already established in `cli.test.ts`. No additional mocking libraries needed — state queries read files and return JSON.

### Integration Tests for CLI End-to-End

For testing the actual `gsd-sdk query` CLI invocation:

```typescript
// sdk/src/query-cli.integration.test.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

it('gsd-sdk query state load returns JSON', async () => {
  const { stdout } = await exec('node', ['dist/cli.js', 'query', 'state', 'load', '--project-dir', tmpDir]);
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
});
```

Integration tests use the existing `integration` project config with 120s timeout. Run via `npm run test:integration`.

## Node.js APIs Needed — Already Available

| API | Module | Usage | Already Used? |
|-----|--------|-------|---------------|
| `readFile` | `node:fs/promises` | Read STATE.md, ROADMAP.md, config.json, REQUIREMENTS.md | Yes (config.ts, gsd-tools.ts) |
| `writeFile` | `node:fs/promises` | State mutations (STATE.md updates, config writes) | Yes (init-runner.ts) |
| `readdir` | `node:fs/promises` | List phase directories, scan for plan files | No — add when needed |
| `stat` / `access` | `node:fs/promises` | Check file/directory existence | No — add when needed |
| `existsSync` | `node:fs` | Synchronous path existence checks (path resolution) | Yes (gsd-tools.ts) |
| `parseArgs` | `node:util` | CLI argument parsing | Yes (cli.ts) |
| `execFile` | `node:child_process` | Bridge to gsd-tools.cjs during migration | Yes (gsd-tools.ts) |
| `join`, `resolve`, `dirname`, `basename` | `node:path` | Path construction for .planning/ structure | Yes (throughout) |
| `homedir` | `node:os` | Global installation path fallback | Yes (gsd-tools.ts, index.ts) |

**New APIs to introduce:**
- `readdir` — needed to list phase directories (`ls .planning/phases/`) and scan for plan files. Currently delegated to gsd-tools.cjs. Use `readdir` with `withFileTypes: true` for efficient directory scanning.
- `stat` — needed for file existence checks without try/catch on readFile. Cleaner than the current `existsSync` pattern for async code.
- `glob` (Node.js 22+ via `node:fs`) — NOT recommended. Stick with `readdir` + filter for Node.js 20 compatibility.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node:util` parseArgs | `commander` (npm) | Never for this project. parseArgs handles subcommands, flags, and positionals. Commander adds 50KB+ and a dependency for no benefit. |
| `node:util` parseArgs | `yargs` (npm) | Never. Same reasoning — the project's philosophy is zero unnecessary deps. |
| `JSON.stringify` | `yaml` (npm) for YAML output | Never. Agents consume JSON. YAML output adds parser complexity for no consumer benefit. |
| `tsc` compilation | `esbuild` single-file bundle | Only if the CLI needs to run without `node_modules/` (e.g., npx one-shot). Current distribution via npm install handles deps fine. |
| `readdir` + filter | `fast-glob` (npm) | Never. File scanning is limited to `.planning/` which has <100 files. Glob library overhead is unjustified. |
| `process.exitCode = N` | `process.exit(N)` | Never. `process.exitCode` lets async cleanup finish. Already the pattern used in cli.ts. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Commander, yargs, meow | Unnecessary dependency for a CLI with 10-15 subcommands. parseArgs handles this. | `node:util` parseArgs |
| `chalk`, `kleur` | Query output is JSON consumed by agents, not humans reading colored terminal output | Plain JSON to stdout, errors to stderr |
| `ora`, `listr` | No spinners/progress bars — CLI calls are synchronous state reads returning in <100ms | Direct JSON output |
| `inquirer`, `prompts` | Query commands are non-interactive. Input comes from args, output goes to stdout | parseArgs for input, JSON.stringify for output |
| `jest` | Project already uses Vitest. Don't introduce a second test runner. | Vitest with existing project config |
| `node:fs` glob (Node 22+) | Breaks Node.js 20 compatibility requirement (`"engines": { "node": ">=20" }`) | `readdir` with `withFileTypes: true` |
| `zod` for runtime validation | Config validation is already handled by `loadConfig()` merge-with-defaults pattern. Adding zod for state queries is over-engineering for file reads that return typed interfaces. | TypeScript interfaces + manual validation in parse functions |

## Markdown Parsing for State Files

STATE.md and ROADMAP.md use YAML frontmatter. The current gsd-tools.cjs parses this with hand-rolled regex. For the SDK migration:

| Approach | Recommendation |
|----------|---------------|
| Hand-rolled YAML frontmatter parser | **Use this.** STATE.md frontmatter is simple key-value pairs. A 20-line regex parser is sufficient and avoids a `js-yaml` dependency. |
| `js-yaml` npm package | **Only if** frontmatter grows to include nested objects, arrays, or multi-line values. Currently it doesn't. |
| `gray-matter` npm package | **Avoid.** Pulls in `js-yaml` + extras. Over-kill for extracting 5-6 key-value pairs from frontmatter. |

Recommended frontmatter parser pattern (already proven in plan-parser.ts):

```typescript
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      result[key.trim()] = rest.join(':').trim();
    }
  }
  return result;
}
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Node.js 20+ | `node:util` parseArgs | parseArgs is stable since Node 18.11. No compatibility risk. |
| TypeScript 5.7 | ES2022 target | `using` declarations available if needed for resource cleanup. |
| Vitest 3.1+ | TypeScript 5.7 | Full ESM support. No config changes needed for new test files. |
| `@anthropic-ai/claude-agent-sdk` 0.2.84 | Node.js 20+ | Not used by query commands (they're pure state reads), but coexists in the same package. |

## Migration-Specific Patterns

### Temporary Wrapper Strategy

During migration, some query commands will delegate to gsd-tools.cjs internally before being rewritten:

```typescript
// Phase 1: Wrapper (ships immediately, agents can migrate)
async function queryRoadmapAnalyze(ctx: QueryContext): Promise<RoadmapAnalysis> {
  const tools = new GSDTools({ projectDir: ctx.projectDir });
  return tools.roadmapAnalyze();  // delegates to gsd-tools.cjs
}

// Phase 2: Rewrite (typed, tested, no subprocess)
async function queryRoadmapAnalyze(ctx: QueryContext): Promise<RoadmapAnalysis> {
  const roadmapPath = join(ctx.planningDir, 'ROADMAP.md');
  const content = await readFile(roadmapPath, 'utf-8');
  return parseRoadmap(content);  // Pure TypeScript, no child_process
}
```

### File Organization

New files follow existing SDK conventions:

```
sdk/src/
  cli.ts              ← Extend with 'query' subcommand routing
  query-registry.ts   ← Command registry + dispatch
  query-state.ts      ← state load, state json, state get, state update
  query-phase.ts      ← find-phase, phase-plan-index, phase add/remove/complete
  query-roadmap.ts    ← roadmap analyze, roadmap get-phase
  query-config.ts     ← config get, config set, resolve-model
  query-util.ts       ← generate-slug, current-timestamp, verify-path-exists
  query-*.test.ts     ← Colocated unit tests
```

## Sources

- `sdk/src/cli.ts` — Existing parseArgs usage pattern, bin entry point, USAGE string (HIGH confidence)
- `sdk/src/gsd-tools.ts` — Current bridge pattern, GSDTools class, typed methods (HIGH confidence)
- `sdk/package.json` — Current dependencies, bin config, engine requirements (HIGH confidence)
- `sdk/tsconfig.json` — Compiler options, module resolution, output config (HIGH confidence)
- `get-shit-done/bin/gsd-tools.cjs` lines 1-80 — Full command surface area to migrate (HIGH confidence)
- `.planning/notes/sdk-first-architecture.md` — Architecture decision, no-permanent-wrappers principle (HIGH confidence)
- Node.js 20 docs `node:util` parseArgs — Stable API, full subcommand support (HIGH confidence)

---
*Stack research for: SDK-First Migration CLI and tooling*
*Researched: 2026-04-07*
