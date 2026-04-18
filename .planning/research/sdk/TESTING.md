# SDK Testing Patterns

**Analysis Date:** 2026-04-07
**Scope:** `sdk/src/` — all `*.test.ts` and `*.integration.test.ts` files

---

## Test Framework

**Runner:** Vitest 3.1.1 (SDK's own `devDependencies`)

**Config:** `vitest.config.ts` at repo root defines two named projects:
```typescript
// vitest.config.ts (repo root)
{
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: './sdk',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          root: './sdk',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 120_000,  // 2 minutes per test
        },
      },
    ],
  },
}
```

**Assertion library:** Vitest's built-in `expect` (Chai-compatible)

**Run Commands:**
```bash
# From repo root:
npm test                        # Run all tests (both projects)
npm run test:unit               # Unit tests only (fast, no external deps)
npm run test:integration        # Integration tests only (requires gsd-tools.cjs)
npm run test:coverage           # Run with coverage (uses c8)

# From sdk/ directory:
npx vitest run                  # All tests
npx vitest run --project unit   # Unit only
npx vitest run --project integration  # Integration only
```

---

## Test File Organization

**Location:** Co-located with source in `sdk/src/`

**Naming conventions:**
- Unit tests: `{module-name}.test.ts` (mirrors source file name)
- Integration tests: `{module-name}.integration.test.ts`
- E2E tests: `{name}.integration.test.ts` (e.g. `e2e.integration.test.ts`, `lifecycle-e2e.integration.test.ts`)
- Type-only tests: `{module-name}-types.test.ts` (e.g. `phase-runner-types.test.ts`)
- Contract/sanitization tests: `assembled-prompts.test.ts`, `headless-prompts.test.ts`

**Current test files:**
```
sdk/src/
├── assembled-prompts.test.ts     # Contract: assembled prompts contain no interactive patterns
├── cli-transport.test.ts         # CLITransport event formatting
├── cli.test.ts                   # CLI entry point
├── config.test.ts                # loadConfig() deep merge and validation
├── context-engine.test.ts        # ContextEngine file resolution per phase type
├── context-truncation.test.ts    # truncateMarkdown() + extractCurrentMilestone()
├── e2e.integration.test.ts       # Full SDK pipeline (requires `claude` CLI)
├── event-stream.test.ts          # GSDEventStream SDKMessage → GSDEvent mapping
├── gsd-tools.test.ts             # GSDTools exec/execRaw with real child processes
├── headless-prompts.test.ts      # Raw .md agent files contain no interactive patterns
├── init-e2e.integration.test.ts  # InitRunner E2E (requires `claude` CLI)
├── init-runner.test.ts           # InitRunner step orchestration
├── lifecycle-e2e.integration.test.ts  # Phase lifecycle E2E (requires `claude` CLI)
├── logger.test.ts                # GSDLogger output, filtering, context
├── milestone-runner.test.ts      # GSD.run() milestone orchestration
├── phase-prompt.test.ts          # PromptFactory.buildPrompt()
├── phase-runner-types.test.ts    # Type shape validation for phase lifecycle types
├── phase-runner.integration.test.ts  # PhaseRunner against real gsd-tools.cjs
├── phase-runner.test.ts          # PhaseRunner state machine (mocked deps)
├── plan-parser.test.ts           # parsePlan() / parseTasks() / extractFrontmatter()
├── prompt-builder.test.ts        # buildExecutorPrompt() / parseAgentTools()
├── prompt-sanitizer.test.ts      # sanitizePrompt() interactive pattern removal
├── research-gate.test.ts         # checkResearchGate() logic
├── tool-scoping.test.ts          # getToolsForPhase() per PhaseType
└── ws-transport.test.ts          # WSTransport WebSocket event broadcasting
```

---

## Test Structure

**Suite organization:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ModuleName', () => {
  // ─── Setup ──────────────────────────────────────────────────────────────
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Happy path ──────────────────────────────────────────────────────────
  describe('happy path', () => {
    it('describes expected behavior', async () => {
      // ...
    });
  });

  // ─── Negative tests ──────────────────────────────────────────────────────
  describe('error cases', () => {
    it('throws on malformed input', async () => {
      await expect(someOperation()).rejects.toThrow(/error pattern/);
    });
  });
});
```

**Section separators in test files** use the same `// ─── Section Name ──...` pattern as source files.

**Nested `describe` blocks** group related test scenarios:
- `describe('exec()', ...)`, `describe('typed methods', ...)`, `describe('integration', ...)`
- `describe('happy path — full lifecycle', ...)`, `describe('config-driven step skipping', ...)`
- `describe('error handling', ...)`, `describe('human gate callbacks', ...)`

---

## Mocking

**Framework:** `vi.mock()` from Vitest (Vitest's built-in mock system)

**Module mocking at the top of file** before imports:
```typescript
// Mock heavy dependencies before importing the unit under test
vi.mock('./session-runner.js', () => ({
  runPhaseStepSession: vi.fn(),
  runPlanSession: vi.fn(),
}));

vi.mock('./config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({ model_profile: 'test-model' }),
  CONFIG_DEFAULTS: {},
}));

// Import mocked function for typed access
import { runPhaseStepSession } from './session-runner.js';
const mockRunPhaseStepSession = vi.mocked(runPhaseStepSession);
```

**Interface-based partial mocks** using `as any` for complex classes:
```typescript
// In phase-runner.test.ts — makeDeps()
{
  tools: {
    initPhaseOp: vi.fn().mockResolvedValue(makePhaseOp()),
    phaseComplete: vi.fn().mockResolvedValue(undefined),
    phasePlanIndex: vi.fn().mockResolvedValue(makePlanIndex(1)),
    // ... only methods actually called by PhaseRunner
  } as any,
  promptFactory: {
    buildPrompt: vi.fn().mockResolvedValue('test prompt'),
    loadAgentDef: vi.fn().mockResolvedValue(undefined),
  } as any,
}
```

**`vi.clearAllMocks()` in `beforeEach`** — called before every test to prevent state leakage:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockRunPhaseStepSession.mockResolvedValue(makePlanResult());
});
```

**What to mock:**
- `session-runner.js` — always mocked in unit tests to avoid real Claude CLI calls
- `config.js` — mocked in milestone and init tests to return test configs
- `phase-runner.js` — mocked in milestone-runner tests
- `event-stream.js`, `context-engine.js`, `phase-prompt.js` — mocked as needed

**What NOT to mock (unit test exceptions):**
- `gsd-tools.test.ts` — uses real Node child processes with custom test scripts
- `config.test.ts` — uses real filesystem (tmpdir + writeFile)
- `context-engine.test.ts` — uses real filesystem
- `logger.test.ts` — uses real `Writable` stream (BufferStream class)
- `event-stream.test.ts` — tests real SDKMessage → GSDEvent mapping, no mocks

---

## Fixtures and Factories

**Factory functions for test data** — all in the same test file, named `make*`:
```typescript
// sdk/src/phase-runner.test.ts

function makePhaseOp(overrides: Partial<PhaseOpInfo> = {}): PhaseOpInfo {
  return {
    phase_found: true,
    phase_dir: '/tmp/project/.planning/phases/01-auth',
    phase_number: '1',
    phase_name: 'Authentication',
    // ... all required fields
    ...overrides,
  };
}

function makePlanResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    success: true,
    sessionId: 'sess-123',
    totalCostUsd: 0.01,
    durationMs: 1000,
    usage: makeUsage(),
    numTurns: 5,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<GSDConfig> = {}): GSDConfig {
  return {
    ...structuredClone(CONFIG_DEFAULTS),
    ...overrides,
    workflow: {
      ...CONFIG_DEFAULTS.workflow,
      ...(overrides.workflow ?? {}),
    },
  } as GSDConfig;
}

function makeDeps(overrides: Partial<PhaseRunnerDeps> = {}): PhaseRunnerDeps {
  return {
    projectDir: '/tmp/project',
    tools: { initPhaseOp: vi.fn(), ... } as any,
    // ...
    ...overrides,
  };
}
```

**Pattern:** Every factory accepts `Partial<T>` and returns a fully-populated object with sensible defaults. Overrides spread at the end.

**Inline fixtures in test files** — string literals for small plan documents:
```typescript
const FULL_PLAN = `---
phase: 03-features
plan: 01
...
---
<objective>...</objective>
<tasks>...</tasks>
`;
```

**Disk-based test fixtures:** `sdk/test-fixtures/sample-plan.md` — used by E2E tests that need a real PLAN.md file on disk.

**createScript() helper** in `gsd-tools.test.ts` — creates temporary Node.js scripts that stub gsd-tools behavior:
```typescript
async function createScript(name: string, code: string): Promise<string> {
  const scriptPath = join(fixtureDir, name);
  await writeFile(scriptPath, code, { mode: 0o755 });
  return scriptPath;
}
// Usage:
const scriptPath = await createScript('echo-json.cjs', `process.stdout.write(JSON.stringify({ ok: true }));`);
```

**Filesystem-backed test helpers:**
```typescript
async function createTempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'gsd-ctx-'));
}

async function createPlanningDir(projectDir: string, files: Record<string, string>): Promise<void> {
  const planningDir = join(projectDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(planningDir, filename), content, 'utf-8');
  }
}
```

---

## Test Types

### Unit Tests (`*.test.ts`)

**Fast, isolated, no external process requirements.**

- `config.test.ts` — `loadConfig()` merge logic; uses real tmpdir filesystem (170 lines)
- `logger.test.ts` — `GSDLogger` output, level filtering, context setters; uses `BufferStream` custom Writable (150 lines)
- `event-stream.test.ts` — all SDKMessage → GSDEvent mappings, cost tracking, transport management (661 lines)
- `gsd-tools.test.ts` — `GSDTools.exec()`/`execRaw()` with real child processes; creates tiny Node stubs via `createScript()` (404 lines)
- `plan-parser.test.ts` — YAML frontmatter + XML task parsing (528 lines)
- `phase-runner.test.ts` — PhaseRunner state machine with mocked deps; largest test file at 2286 lines
- `context-engine.test.ts` — file resolution per phase type; uses real tmpdir (295 lines)
- `milestone-runner.test.ts` — `GSD.run()` milestone orchestration, all deps mocked (416 lines)
- `init-runner.test.ts` — InitRunner step sequencing and event emission (783 lines)

### Integration Tests (`*.integration.test.ts`)

**Require `gsd-tools.cjs` on disk. Skip gracefully when unavailable via `describe.skipIf(!gsdToolsAvailable)`.**

- `phase-runner.integration.test.ts` — PhaseRunner against real `gsd-tools.cjs`; creates real `.planning/` on disk (377 lines)
  - Wave/phasePlanIndex integration tests included in same file
- `e2e.integration.test.ts` — Full `GSD.executePlan()` pipeline; requires `claude` CLI (178 lines)
  - Guarded: `describe.skipIf(!cliAvailable)` after `execSync('which claude')`
- `lifecycle-e2e.integration.test.ts` — Phase lifecycle E2E; requires `claude` CLI (258 lines)
- `init-e2e.integration.test.ts` — InitRunner E2E; requires `claude` CLI (136 lines)

**Integration test timeout:** 120,000ms (2 minutes) per test, set in Vitest project config. Individual long tests set explicit `{ timeout: 300_000 }` (5 minutes).

---

## Async Testing Patterns

**Standard async/await:**
```typescript
it('loads valid config', async () => {
  await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify(userConfig));
  const config = await loadConfig(tmpDir);
  expect(config.model_profile).toBe('fast');
});
```

**Async error testing:**
```typescript
// Using rejects.toThrow with regex matcher:
await expect(loadConfig(tmpDir)).rejects.toThrow(/Failed to parse config/);
await expect(tools.exec('state', ['load'])).rejects.toThrow(GSDToolsError);

// Using try/catch for property inspection:
try {
  await tools.exec('state', ['load']);
  expect.fail('Should have thrown');
} catch (err) {
  expect(err).toBeInstanceOf(GSDToolsError);
  const gsdErr = err as GSDToolsError;
  expect(gsdErr.command).toBe('state');
  expect(gsdErr.stderr).toContain('something went wrong');
}
```

**Collecting events from EventEmitter:**
```typescript
const events: GSDEvent[] = [];
eventStream.on('event', (e: GSDEvent) => events.push(e));
// ... run operation ...
const phaseStartEvents = events.filter(e => e.type === GSDEventType.PhaseStart);
expect(phaseStartEvents).toHaveLength(1);
```

**Getting mock call arguments:**
```typescript
function getEmittedEvents(deps: PhaseRunnerDeps): GSDEvent[] {
  const events: GSDEvent[] = [];
  const emitFn = deps.eventStream.emitEvent as ReturnType<typeof vi.fn>;
  for (const call of emitFn.mock.calls) {
    events.push(call[0] as GSDEvent);
  }
  return events;
}
```

---

## Temporary Directory Pattern

**Every test that touches the filesystem uses a unique tmpdir** with a timestamp + random suffix to prevent cross-test pollution:
```typescript
beforeEach(async () => {
  tmpDir = join(tmpdir(), `gsd-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
```

**`mkdtemp` used in integration tests** (OS-guaranteed unique name):
```typescript
tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sdk-phase-int-'));
```

---

## Coverage

**Tool:** `c8 11.0.0` (in root `devDependencies`)

**No enforced coverage threshold** — no `coverageThreshold` in vitest config.

**Run coverage:**
```bash
npm run test:coverage   # from repo root
```

---

## What's Well-Tested

- `PhaseRunner` state machine — exhaustive coverage of all config flags, step ordering, skip conditions, error propagation, human gate callbacks, wave execution, gap-closure retries (`sdk/src/phase-runner.test.ts`, 2286 lines)
- `GSDEventStream` — all 15+ SDKMessage subtypes mapped, cost tracking, transport delivery (`sdk/src/event-stream.test.ts`)
- `GSDTools` exec pipeline — JSON parsing, `@file:` prefix, timeout, error propagation via real child processes (`sdk/src/gsd-tools.test.ts`)
- `loadConfig()` — edge cases for missing/empty/invalid/partial config files, mutation protection
- `GSDLogger` — all levels, context fields, stream routing, runtime setter updates
- `plan-parser.ts` — comprehensive YAML + XML fixture coverage
- Prompt sanitization — `assembled-prompts.test.ts` is a contract test ensuring no interactive patterns survive the full assembly pipeline
- Type shape validation — `phase-runner-types.test.ts` tests TypeScript interface shapes at runtime

## What Lacks Coverage

- `sdk/src/session-runner.ts` — **no dedicated test file**. The `runPlanSession()` and `runPhaseStepSession()` functions are always mocked in other tests; actual `query()` call behavior is only covered by E2E tests that require the Claude CLI.
- `sdk/src/index.ts` (GSD class) — `executePlan()` method tested only in E2E. `run()` (milestone) is covered by `milestone-runner.test.ts` via mocks but not against real phases.
- `sdk/src/init-runner.ts` — prompt loading logic (file read paths) only partially covered; E2E tests that run the full init workflow require the Claude CLI.
- `sdk/src/ws-transport.ts` — covered by `ws-transport.test.ts` but WebSocket broadcast lifecycle is shallow.
- `sdk/src/cli.ts` — covered by `cli.test.ts` but mostly structural/argument parsing; actual SDK invocation path is not tested without the Claude CLI.

---

*Testing analysis: 2026-04-07*
