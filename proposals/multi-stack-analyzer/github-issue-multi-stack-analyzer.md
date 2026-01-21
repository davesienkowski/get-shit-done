# feat: Add multi-stack support to /gsd:analyze-codebase (35+ languages)

## Problem

The current `/gsd:analyze-codebase` command only supports JavaScript/TypeScript codebases, with hardcoded:
- **Globs**: `**/*.{js,ts,jsx,tsx,mjs,cjs}`
- **Export patterns**: ES6 modules, CommonJS, TypeScript namespaces only
- **Naming conventions**: camelCase, PascalCase (JavaScript conventions)

This limits GSD's applicability to enterprise and brownfield projects, which are often **polyglot** (multiple languages/stacks). The current analyzer cannot index non-JS/TS codebases, blocking effective use of `/gsd:map-codebase` and `/gsd:query-intel` for these projects.

## Real-World Use Case

**Trinity Health MSOW Symplr Integration** (production healthcare system):
- **PowerShell module** (84 files) - Oracle data extraction, ODP.NET integration, Pester tests
- **.NET 8 Blazor Server** (160 files) - Dashboard UI, SignalR real-time monitoring, EF Core storage
- **Oracle SQL** (26 files) - Healthcare data extraction queries (demographics, certifications, education, locations)

**Current state**: `/gsd:analyze-codebase` cannot index this codebase because it skips all `.ps1`, `.cs`, `.razor`, and `.sql` files. The analyzer produces empty results, making GSD's intelligence features unavailable for this project.

**Expected behavior**: Analyzer should detect all three stacks, extract entities using stack-specific conventions, and enable cross-stack dependency tracking (e.g., PowerShell calling SQL queries, Blazor consuming PowerShell module).

## Proposed Solution

### 1. Stack Auto-Detection

Detect project stacks via **marker files** and **directory patterns**:

```yaml
# Stack detection rules (examples)
stacks:
  javascript:
    markers: [package.json, yarn.lock, pnpm-lock.yaml]
    directories: [node_modules/]

  typescript:
    markers: [tsconfig.json, package.json]
    directories: [node_modules/]

  dotnet:
    markers: ["*.csproj", "*.sln", "*.fsproj", "*.vbproj"]
    directories: [bin/, obj/]

  powershell:
    markers: ["*.psd1", "*.psm1"]
    directories: [Modules/]

  python:
    markers: [pyproject.toml, setup.py, requirements.txt, Pipfile]
    directories: [venv/, __pycache__/]

  go:
    markers: [go.mod, go.sum]
    directories: [vendor/]

  rust:
    markers: [Cargo.toml, Cargo.lock]
    directories: [target/]

  java:
    markers: [pom.xml, build.gradle, build.gradle.kts]
    directories: [target/, build/]
```

### 2. Stack-Specific Analyzer Profiles

Each stack gets a **YAML profile** defining:
- **File globs** (what to index)
- **Export patterns** (how entities are exported/defined)
- **Naming conventions** (camelCase, PascalCase, snake_case, kebab-case, etc.)
- **Entity types** (functions, classes, cmdlets, controllers, views, etc.)

**Example: PowerShell Profile**

```yaml
# .gsd/stacks/powershell.yml
name: PowerShell
file_extensions: [ps1, psm1, psd1]
globs:
  - "**/*.ps1"
  - "**/*.psm1"
  - "**/*.psd1"

entity_patterns:
  functions:
    - pattern: '^\s*function\s+([A-Z][a-z]+-[A-Z][a-z]+)'
      naming: PascalCase-Verb-Noun

  cmdlets:
    - pattern: '^\s*function\s+((?:Get|Set|New|Remove|Invoke|Test|Start|Stop|Register|Unregister)-\w+)'
      naming: Approved-Verb-Noun

  classes:
    - pattern: '^\s*class\s+(\w+)'
      naming: PascalCase

export_patterns:
  - pattern: 'Export-ModuleMember\s+-Function\s+(\w+(?:,\s*\w+)*)'
    type: explicit

  - pattern: 'FunctionsToExport\s*=\s*@\((.*?)\)'
    type: manifest

naming_conventions:
  - PascalCase
  - Verb-Noun (approved PowerShell verbs)

dependencies:
  imports:
    - pattern: 'Import-Module\s+([^\s]+)'
    - pattern: 'using\s+module\s+([^\s]+)'

  dot_sourcing:
    - pattern: '\.\s+([^\s]+\.ps1)'
```

**Example: C# / Blazor Profile**

```yaml
# .gsd/stacks/dotnet-blazor.yml
name: .NET (C# / Blazor)
file_extensions: [cs, razor, cshtml, csproj]
globs:
  - "**/*.cs"
  - "**/*.razor"
  - "**/*.cshtml"

entity_patterns:
  classes:
    - pattern: '^\s*(?:public|internal|private|protected)?\s*(?:static|sealed|abstract)?\s*class\s+(\w+)'
      naming: PascalCase

  interfaces:
    - pattern: '^\s*(?:public|internal)?\s*interface\s+(I\w+)'
      naming: IPascalCase

  methods:
    - pattern: '^\s*(?:public|private|protected|internal)?\s*(?:static|virtual|override|async)?\s*\w+\s+(\w+)\s*\('
      naming: PascalCase

  razor_components:
    - pattern: '@page\s+"([^"]+)"'
      type: route
    - pattern: '@inherits\s+(\w+)'
      type: base_component

export_patterns:
  - pattern: 'namespace\s+([\w.]+)'
    type: namespace

  - pattern: 'public\s+(?:class|interface|enum|struct)\s+(\w+)'
    type: public_type

naming_conventions:
  - PascalCase (classes, methods, properties)
  - IPascalCase (interfaces)
  - camelCase (private fields with _prefix)

dependencies:
  using_statements:
    - pattern: 'using\s+([\w.]+);'

  dependency_injection:
    - pattern: '@inject\s+(\w+)'
```

### 3. Supported Languages (35+)

| Tier | Languages | Status |
|------|-----------|--------|
| **Tier 1** (Full Support) | JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, C#, F#, PowerShell, Ruby, PHP | Complete entity extraction, dependency tracking, hotspot detection |
| **Tier 2** (Good Support) | Swift, Dart, Elixir, Scala, Objective-C, C, C++, Groovy, Perl, R | Entity extraction, basic dependency tracking |
| **Tier 3** (Basic Support) | Lua, Julia, Haskell, Clojure, OCaml, Erlang, Zig, Nim, Crystal, Racket | File indexing, pattern-based entity detection |
| **Infrastructure** | SQL, HCL (Terraform), YAML (K8s/Ansible), Dockerfile, Shell (bash/zsh), Makefile | Declarative entity extraction (tables, resources, targets) |

### 4. Framework-Specific Detection

Auto-detect frameworks and apply specialized patterns:

| Stack | Frameworks Detected |
|-------|---------------------|
| **JavaScript/TypeScript** | React, Vue, Angular, Svelte, Next.js, Nuxt, SvelteKit, Astro |
| **Python** | Django, Flask, FastAPI, Pyramid, Tornado, Celery |
| **Java/Kotlin** | Spring Boot, Micronaut, Quarkus, Vert.x, Android |
| **C#/.NET** | Blazor, ASP.NET Core, Entity Framework Core, SignalR, Hangfire |
| **Ruby** | Rails, Sinatra, Hanami |
| **PHP** | Laravel, Symfony, CodeIgniter, Slim |
| **Go** | Gin, Echo, Fiber, GORM |
| **Rust** | Actix, Rocket, Axum, Tokio |

**Framework detection examples**:
- **Blazor**: `.razor` files, `@page`, `@inject`, `SignalR` imports
- **Spring Boot**: `@RestController`, `@Service`, `@Repository` annotations
- **Django**: `models.py`, `views.py`, `urls.py`, `settings.py`

### 5. Multi-Stack Entity File Output

Entity files include **stack metadata**:

```markdown
# Entity: Invoke-SymplrExtract

**Type**: PowerShell Cmdlet
**Stack**: PowerShell
**Module**: SymplrExtract
**File**: SymplrExtract/Public/Invoke-SymplrExtract.ps1
**Exported**: Yes (via FunctionsToExport in .psd1)

## Signature
```powershell
function Invoke-SymplrExtract {
    [CmdletBinding()]
    param(
        [ValidateSet('Development','Testing','Test','Production')]
        [string]$Environment = 'Development',
        [switch]$ShowProgress
    )
}
```

## Dependencies
- **Calls**: Export-SymplrData (4 times), Invoke-SymplrDelivery
- **Imports**: Get-SymplrConfiguration
- **Dot-sources**: Private/DataAccess/Connect-OracleDatabase.ps1

## Used By
- MSOW-Symplr-Dashboard (C# Blazor) via ConfigurationSyncService.cs
- Windows Task Scheduler (RegisteredTask)
```

### 6. Cross-Stack Dependency Tracking

Track dependencies **across language boundaries**:

```yaml
# Example: PowerShell module called by C# service
cross_stack_dependencies:
  - source:
      stack: dotnet
      file: MSOW-Symplr-Dashboard/Services/ConfigurationSyncService.cs
      entity: SyncConfigurationAsync()

    target:
      stack: powershell
      file: SymplrExtract/Public/Invoke-SymplrExtract.ps1
      entity: Invoke-SymplrExtract

    mechanism: PowerShell.Create().AddCommand()

  - source:
      stack: powershell
      file: SymplrExtract/Private/DataAccess/Export-SymplrData.ps1
      entity: Export-SymplrData

    target:
      stack: sql
      file: SymplrExtract/Resources/SQL/Symplr_Provider_Demographics.sql
      entity: V_MSOW_SYMPLR_QUALIFIED_PRACT (view)

    mechanism: Get-Content + ExecuteReader()
```

### 7. Summary Metrics by Stack

```markdown
# Codebase Analysis Summary

## Detected Stacks
- **PowerShell** (SymplrExtract module)
- **.NET 8 Blazor Server** (MSOW-Symplr-Dashboard)
- **Oracle SQL** (Extraction queries)

## Metrics by Stack

| Stack | Files | Entities | Hotspots | Top Entity |
|-------|-------|----------|----------|------------|
| PowerShell | 84 | 47 cmdlets, 23 classes | 3 | Invoke-SymplrExtract (called by 12) |
| .NET Blazor | 160 | 40 services, 15 pages, 12 hubs | 5 | ExtractMonitoringHub (SignalR) |
| Oracle SQL | 26 | 4 queries, 18 views | 2 | V_MSOW_SYMPLR_QUALIFIED_PRACT |

## Cross-Stack Dependencies
- **C# → PowerShell**: ConfigurationSyncService calls Invoke-SymplrExtract
- **PowerShell → SQL**: Export-SymplrData executes Symplr_Provider_Demographics.sql
- **Blazor → SignalR Hub**: ExtractMonitor.razor connects to ExtractMonitoringHub
```

## Benefits

1. **Enterprise/Brownfield Support**: Aligns with GSD's philosophy of working with **real-world codebases**
2. **Backward Compatibility**: Existing JS/TS analysis unchanged (default stack profile)
3. **Extensibility**: Easy to add new languages via YAML profiles (no code changes)
4. **Polyglot Intelligence**: Cross-stack dependency tracking reveals system architecture
5. **Framework Awareness**: Auto-detects patterns (Blazor components, Spring controllers, Django views)

## Implementation Phases

### Phase 1: Stack Detection + Profile System
- [ ] Auto-detect stacks from marker files
- [ ] Load stack-specific YAML profiles
- [ ] Maintain backward compatibility for JS/TS

### Phase 2: Tier 1 Languages (10 languages)
- [ ] PowerShell (cmdlets, modules, Pester tests)
- [ ] C# / F# (.NET, Blazor, EF Core)
- [ ] Python (Django, Flask, FastAPI)
- [ ] Go (Gin, Echo, GORM)
- [ ] Rust (Actix, Rocket, Tokio)
- [ ] Java / Kotlin (Spring Boot, Android)
- [ ] Ruby (Rails, Sinatra)
- [ ] PHP (Laravel, Symfony)

### Phase 3: Tier 2-3 + Infrastructure (25+ languages)
- [ ] Swift, Dart, Elixir, Scala, C/C++
- [ ] Lua, Julia, Haskell, Clojure, OCaml
- [ ] SQL, Terraform, Dockerfile, Shell, Ansible

### Phase 4: Cross-Stack Dependencies
- [ ] Track inter-language calls (C# → PowerShell, Python → SQL)
- [ ] Detect framework integrations (Blazor + SignalR, Django + Celery)
- [ ] Visualize polyglot architecture

## Context Optimization

This enhancement follows GSD's established patterns for minimal context consumption:

### Token Budget

| Approach | Orchestrator | Per-Stack | Total (5 stacks) |
|----------|-------------|-----------|------------------|
| Naive | 5000+ | 1000+ | 10,000+ |
| Optimized | ~50 | ~200 (delegated) | ~1,050 |

### Applied Patterns

1. **Subagent Delegation** - Stack detection and analysis delegated to fresh-context subagents
2. **Lazy Profile Loading** - Only load profiles for detected stacks
3. **Wave Parallelization** - Analyze stacks in parallel, no accumulation
4. **Compact Summary** - summary.md stays <500 tokens even with multi-stack

### Hook Compatibility

| Hook | Status | Notes |
|------|--------|-------|
| gsd-intel-session.js | ✅ Compatible | summary.md format unchanged |
| gsd-intel-index.js | ✅ Compatible | Additive schema changes only |
| gsd-intel-prune.js | ✅ Compatible | Path-based, stack-agnostic |

### Breaking Changes

**None.** All changes are additive:
- New `stacks` field in index.json (optional)
- New `stack` field in entity frontmatter (optional)
- Existing JS/TS projects work identically

## Acceptance Criteria

- [ ] Existing JS/TS analysis produces identical output (backward compatible)
- [ ] Auto-detects all stacks present in codebase via marker files
- [ ] Uses stack-specific globs, export patterns, and naming conventions
- [ ] Entity files include stack metadata (language, framework, module)
- [ ] Summary shows per-stack metrics (files, entities, hotspots)
- [ ] Cross-stack dependencies tracked (e.g., C# calling PowerShell cmdlet)
- [ ] Supports at least 10 Tier 1 languages in initial release
- [ ] YAML profile system allows adding new languages without code changes

## Example: Expected Output for Trinity Health MSOW

```markdown
# /gsd:analyze-codebase Output (Multi-Stack)

## Detected Stacks
✓ PowerShell (SymplrExtract module v0.4.0)
✓ .NET 8 Blazor Server (MSOW-Symplr-Dashboard)
✓ Oracle SQL (Extraction queries)

## Entity Extraction

### PowerShell Entities (47 cmdlets)
- Invoke-SymplrExtract (main orchestrator)
- Export-SymplrData (4 dataset types)
- Invoke-SymplrDelivery (SFTP + email)
- Get/Set-SymplrConfiguration (JSON config)
- Test-SymplrExtract (8 validation checks)

### C# Blazor Entities (40 services, 15 pages)
- ExtractMonitoringHub (SignalR real-time)
- ConfigurationSyncService (PowerShell integration)
- BaselineStorageService (EF Core)
- ExtractMonitor.razor (dashboard page)

### SQL Entities (4 queries, 18 views)
- Symplr_Provider_Demographics.sql
- V_MSOW_SYMPLR_QUALIFIED_PRACT (master view)

## Cross-Stack Hotspots
1. **ConfigurationSyncService.cs** (C#) → **Invoke-SymplrExtract** (PowerShell)
2. **Export-SymplrData.ps1** (PowerShell) → **Symplr_Provider_Demographics.sql** (SQL)
3. **ExtractMonitor.razor** (Blazor) → **ExtractMonitoringHub.cs** (SignalR)
```

## Related Issues

- #XXX - Multi-language support for `/gsd:map-codebase`
- #XXX - Enterprise brownfield codebase patterns
- #XXX - Cross-stack refactoring support

---

**Labels**: `enhancement`, `analyze-codebase`, `multi-stack`, `enterprise`, `tier-1`
**Milestone**: GSD v2.1.0
**Priority**: High (blocks enterprise adoption)
