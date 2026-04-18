# SDK Technology Stack

**Analysis Date:** 2026-04-07
**Scope:** `sdk/` directory — the `@gsd-build/sdk` package

## Languages

**Primary:**
- TypeScript 5.7.0 — all source code in `sdk/src/*.ts`, compiles to ES2022
- No JavaScript in source; only compiled output in `sdk/dist/`

**Runtime:**
- CommonJS not used in SDK source. ESM exclusively (`"type": "module"` in `sdk/package.json`)
- `.js` extension required on all imports (NodeNext module resolution)

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced by `engines` in `sdk/package.json`)
- Tested on Linux, macOS, Windows

**Package Manager:**
- npm (inferred from `sdk/node_modules/.package-lock.json`)
- Lockfile: `sdk/package-lock.json` — lockfileVersion 3

## Frameworks

**Testing:**
- Vitest 3.1.1 — unit and integration test runner
- Config: `sdk/vitest.config.ts` (not present in sdk/ — uses root `vitest.config.ts`)
- Test projects: `unit` (standard timeout) and `integration` (120s timeout)
- Test file naming: `*.test.ts` (unit), `*.integration.test.ts` (integration)

**Build:**
- TypeScript compiler `tsc` — sole build tool (`"build": "tsc"` in `sdk/package.json`)
- No esbuild, rollup, or bundler in SDK itself (those are root-level tools)
- Output: `sdk/dist/` directory, ES2022 modules with declaration maps and source maps

## TypeScript Configuration

**File:** `sdk/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

Key implications:
- `strict: true` — strict null checks, no implicit any
- `NodeNext` module resolution — requires `.js` extension on all relative imports
- `declaration: true` + `declarationMap: true` — full type export for consumers
- Test files excluded from compilation (`src/**/*.test.ts`, `src/**/*.integration.test.ts`)

## npm Package

**Name:** `@gsd-build/sdk`
**Version:** 0.1.0
**Main entry:** `dist/index.js`
**Types:** `dist/index.d.ts`
**Binary:** `gsd-sdk` → `dist/cli.js`
**Published files:** `dist/`, `prompts/`
**Exports map:**
```json
{
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
}
```

## Key Dependencies

**Runtime (2 dependencies):**

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.84 | Core agent execution — provides `query()` function, all SDK message types (`SDKMessage`, `SDKResultSuccess`, etc.) |
| `ws` | ^8.20.0 | WebSocket server for `WSTransport` — broadcasts GSD events to external consumers |

**Dev Dependencies (4 packages):**

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | ^22.0.0 | Node.js type definitions |
| `@types/ws` | ^8.18.1 | WebSocket type definitions |
| `typescript` | ^5.7.0 | TypeScript compiler |
| `vitest` | ^3.1.1 | Test runner |

## Build Scripts

All scripts in `sdk/package.json`:

```bash
npm run build          # tsc — compile TypeScript to dist/
npm run prepublishOnly # npm run build — auto-builds before npm publish
npm test               # vitest run — run all tests
npm run test:unit      # vitest run --project unit
npm run test:integration  # vitest run --project integration
```

## Configuration

**Project configuration:**
- No `.env` file required
- Runtime config loaded from `.planning/config.json` in the target project directory
- `sdk/src/config.ts` exports `loadConfig(projectDir)` and `CONFIG_DEFAULTS`

**Config defaults (from `sdk/src/config.ts`):**
- `model_profile: 'balanced'` → resolves to `claude-sonnet-4-6`
- `parallelization: true`
- `workflow.research: true`, `workflow.plan_check: true`, `workflow.verifier: true`
- `workflow.auto_advance: false`, `workflow.skip_discuss: false`
- `workflow.max_discuss_passes: 3`

**Model profile resolution (from `sdk/src/session-runner.ts`):**
```typescript
const profileMap: Record<string, string> = {
  balanced: 'claude-sonnet-4-6',
  quality: 'claude-opus-4-6',
  speed: 'claude-haiku-4-5',
};
```

## Module Structure (Source)

All source files in `sdk/src/`:

| File | Role |
|------|------|
| `index.ts` | Public API entry point — exports `GSD` class and all named exports |
| `types.ts` | All shared type definitions, enums (`PhaseType`, `GSDEventType`, `PhaseStepType`) |
| `cli.ts` | CLI entry point (`gsd-sdk` binary) — commands: `run`, `auto`, `init` |
| `session-runner.ts` | Calls `query()` from Agent SDK, processes message streams |
| `phase-runner.ts` | State machine: discuss → research → plan → execute → verify → advance |
| `init-runner.ts` | New project bootstrap workflow (7 sequential steps, 4 parallel research sessions) |
| `plan-parser.ts` | YAML frontmatter + XML task extraction from PLAN.md files |
| `config.ts` | Loads `.planning/config.json` with 3-level deep merge against defaults |
| `gsd-tools.ts` | Shells out to `gsd-tools.cjs` via `execFile` for all state operations |
| `event-stream.ts` | `GSDEventStream` class — maps SDK messages to typed GSD events, transport management |
| `context-engine.ts` | Resolves `.planning/` files per phase type with truncation |
| `context-truncation.ts` | Pure functions: markdown truncation and milestone extraction |
| `prompt-builder.ts` | Assembles executor prompts from `ParsedPlan` |
| `phase-prompt.ts` | `PromptFactory` — reads workflow/agent files from disk, builds full prompts |
| `prompt-sanitizer.ts` | Strips interactive CLI patterns from prompts (for headless use) |
| `tool-scoping.ts` | Maps phase types to allowed tool sets |
| `research-gate.ts` | Validates RESEARCH.md for unresolved open questions |
| `logger.ts` | `GSDLogger` — structured JSON logger to stderr |
| `cli-transport.ts` | `CLITransport` — renders events as ANSI-colored stdout |
| `ws-transport.ts` | `WSTransport` — broadcasts events as JSON over WebSocket |

## Prompts Directory

`sdk/prompts/` contains headless-adapted versions of GSD agent/workflow files:

```
sdk/prompts/
├── agents/          # Headless agent definitions (8 agents)
│   ├── gsd-executor.md
│   ├── gsd-phase-researcher.md
│   ├── gsd-plan-checker.md
│   ├── gsd-planner.md
│   ├── gsd-project-researcher.md
│   ├── gsd-research-synthesizer.md
│   ├── gsd-roadmapper.md
│   └── gsd-verifier.md
├── workflows/       # Headless workflow definitions (5 workflows)
│   ├── discuss-phase.md
│   ├── execute-plan.md
│   ├── plan-phase.md
│   ├── research-phase.md
│   └── verify-phase.md
└── templates/       # Project templates for init workflow
```

**Fallback chain for all prompt/workflow files:**
1. `sdk/prompts/{path}` — SDK-packaged headless versions (preferred)
2. `~/.claude/get-shit-done/{path}` — GSD-1 originals on disk

## What Is Not Present

- No database driver — all state goes through `gsd-tools.cjs`
- No HTTP client — no direct Anthropic API calls; uses Agent SDK abstraction
- No file watcher — stateless execution model
- No external search SDK — search tool availability is passed via `allowedTools` list
- No authentication handling — handled by Agent SDK / Claude Code runtime
- No `milestone-runner.ts` source file — the milestone runner logic lives in `GSD.run()` in `index.ts` (the `milestone-runner.test.ts` test file exists but tests the `GSD` class directly)

---

*Stack analysis: 2026-04-07*
