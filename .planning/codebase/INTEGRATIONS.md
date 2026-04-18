# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**Anthropic (Claude Agent SDK):**
- **Purpose:** Running agent sessions, tool use, and streaming results for plan execution.
- **SDK:** `@anthropic-ai/claude-agent-sdk` (see `sdk/package.json`).
- **Usage in code:** `sdk/src/session-runner.ts` imports `query` from `@anthropic-ai/claude-agent-sdk`; `sdk/src/event-stream.ts` consumes SDK message types.
- **Auth:** Standard Anthropic API credentials are expected to be available to the Agent SDK at runtime (environment as documented by Anthropic; do not commit secrets). The repo does not ship a `.env` template with live keys.

**Brave Search API:**
- **Purpose:** Optional web search for researcher-style flows (`sdk/src/query/websearch.ts`).
- **Endpoint:** HTTPS `https://api.search.brave.com/res/v1/web/search` via `fetch`.
- **Auth:** Header `X-Subscription-Token` from **`BRAVE_API_KEY`**. If unset, handlers return `{ available: false }` so callers can fall back to other tools.
- **Config surface:** Project flags `brave_search` in `sdk/src/config.ts` (`GSDConfig`); capability probing also checks env or files under the user home `.gsd/` directory in `sdk/src/query/config-mutation.ts` (pattern: `brave_api_key` file alongside env).

**Firecrawl:**
- **Purpose:** Optional crawling/search integration toggled in config (`firecrawl` in `sdk/src/config.ts`).
- **Auth:** **`FIRECRAWL_API_KEY`** or a key file in `~/.gsd/firecrawl_api_key` — detection in `sdk/src/query/init-complex.ts` and `sdk/src/query/config-mutation.ts`. Not a hard npm dependency of the SDK; integration is opt-in via environment and user files.

**Exa Search:**
- **Purpose:** Optional search provider (`exa_search` in `sdk/src/config.ts`).
- **Auth:** **`EXA_API_KEY`** or `~/.gsd/exa_api_key` — same detection pattern as Firecrawl in `sdk/src/query/init-complex.ts` and `sdk/src/query/config-mutation.ts`.

**HTTP client:**
- **Node.js global `fetch`** — Used for Brave Search in `sdk/src/query/websearch.ts` (requires a modern Node with undici/fetch).

## Data Storage

**Databases:**
- **None in core** — GSD persists workflow state as files under `.planning/` (markdown, JSON). No ORM or SQL driver is a dependency of `get-shit-done-cc` or `@gsd-build/sdk`.

**File storage:**
- **Local filesystem** — Project directory, `.planning/`, phase folders, logs paths resolved by query handlers and tools (e.g. `sdk/src/query/*.ts`, `sdk/src/gsd-tools.ts`).

**Caching:**
- Not applicable as a dedicated external cache service; any caching is in-process or file-based within the repo’s patterns.

## Authentication & Identity

**End-user / product auth:**
- **Not applicable** — This repository is a development workflow framework, not an application with login. Consumer projects may add their own auth; GSD does not ship OAuth or JWT libraries as SDK dependencies.

**API keys for AI and search:**
- **Environment variables** — `BRAVE_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY` where used (see `sdk/src/query/websearch.ts`, `sdk/src/query/config-mutation.ts`, `sdk/src/query/init-complex.ts`).
- **Optional file-based keys** — `~/.gsd/` filenames referenced in `sdk/src/query/config-mutation.ts` and `sdk/src/query/init-complex.ts` for users who prefer files over env vars.

**Anthropic API access:**
- Handled by the Agent SDK and host runtime; configure credentials per Anthropic’s documentation.

## Monitoring & Observability

**Error tracking:**
- No Sentry/Datadog SDK in `package.json` dependencies. Failures surface through CLI exit codes, `GSDToolsError` patterns in `sdk/src/gsd-tools.ts`, and structured logging where `GSDLogger` is used (`sdk/src/logger.ts`).

**Logs:**
- JSON-oriented logging optional via `GSDLogger`; workflows may direct output to `.planning/.logs/` (convention in project docs, not a network integration).

## CI/CD & Deployment

**CI pipeline:**
- **GitHub Actions** — `.github/workflows/test.yml` runs install and `npm run test:coverage` on push/PR to `main` and related branches.

**Hosting:**
- Not a deployed web service; distribution is **npm** packages (`get-shit-done-cc`, `@gsd-build/sdk`).

## Environment Configuration

**Commonly referenced variables (non-secret names only):**
- **`BRAVE_API_KEY`** — Brave Search (`sdk/src/query/websearch.ts`).
- **`FIRECRAWL_API_KEY`**, **`EXA_API_KEY`** — Optional search/crawl capabilities (`sdk/src/query/init-complex.ts`, `sdk/src/query/config-mutation.ts`).
- **`GSD_AGENTS_DIR`** — Override agents directory (`sdk/src/query/validate.ts`, `sdk/src/query/docs-init.ts`, `sdk/src/query/init.ts`).
- **`GSD_WORKSTREAM`**, **`GSD_PROJECT`** — Workstream/project context (`sdk/src/query/workspace.ts`).
- **`TEST_CONCURRENCY`** — Optional Node test runner tuning (`scripts/run-tests.cjs`).

**Secrets location:**
- Use environment variables or user-local files under `~/.gsd/` as implemented in query code — **never** commit real keys. Do not copy values into `.planning/codebase/` docs.

## Webhooks & Callbacks

**Incoming HTTP webhooks:**
- **None** — No Express/Fastify server or webhook routes ship with the core SDK; `WSTransport` in `sdk/src/ws-transport.ts` is a **local WebSocket** server for event streaming to clients, not inbound SaaS webhooks.

**Outgoing:**
- **Brave Search** — Outbound HTTPS only when `websearch` handler runs with a key set.
- **Agent SDK** — Outbound calls to Anthropic’s APIs via the official SDK when sessions run.

## Consumer-project hints (not runtime dependencies)

**Schema / ORM detection:**
- `sdk/src/query/schema-detect.ts` documents hints for **Supabase** migrations and CLI commands (e.g. `supabase db push`, `SUPABASE_ACCESS_TOKEN` mentioned in hints). This supports **downstream** repositories that use Supabase; it is not an npm dependency of GSD itself.

---

*Integration audit: 2026-04-17*
