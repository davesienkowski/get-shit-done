---
name: gsd:analyze-codebase
description: Multi-stack codebase scanner supporting 35+ languages with intelligent stack detection
---

<objective>
Scan existing codebase across multiple technology stacks (JavaScript/TypeScript, .NET, Python, Go, Rust, Java, PHP, Ruby, and 27+ more) and populate `.planning/intel/` with comprehensive project intelligence including file index, conventions, and semantic entities for efficient context-aware development.
</objective>

<context>
This is a major evolution of the original JS/TS-only analyzer, now supporting 35+ programming languages and frameworks with intelligent stack detection. The command maintains backward compatibility while adding:

- **Multi-Stack Detection**: Automatically identifies all technology stacks present in the codebase
- **Language-Specific Parsing**: Tailored export/import pattern detection for each language
- **Framework Recognition**: Detects popular frameworks (React, Blazor, Django, Spring Boot, etc.)
- **Convention Discovery**: Per-stack naming conventions and architectural patterns
- **Unified Intelligence**: Single coherent view across polyglot codebases

The analyzer creates a knowledge base that enables:
- Fast semantic search without re-reading entire codebase
- Stack-specific code generation following project conventions
- Dependency graph construction across all stacks
- Intelligent file recommendations based on task context
</context>

<process>

## Step 0: Detect Project Stacks

Before analyzing files, scan the project root and immediate subdirectories for stack marker files to determine which technology stacks are present.

### Stack Detection Matrix

Run these checks in parallel and collect all matching stacks:

**JavaScript/TypeScript Ecosystem**
- `package.json` → JavaScript/TypeScript
  - If contains `"type": "module"` → ESM
  - If `dependencies` has `react` → React
  - If `dependencies` has `vue` → Vue
  - If `dependencies` has `@angular/core` → Angular
  - If `dependencies` has `next` → Next.js
  - If `dependencies` has `svelte` → Svelte

**.NET Ecosystem**
- `*.csproj` or `*.sln` → .NET/C#
  - If `<TargetFramework>net8.0</TargetFramework>` → .NET 8
  - If `<Project Sdk="Microsoft.NET.Sdk.Web">` → ASP.NET Core
  - If references `Microsoft.AspNetCore.Components.Web` → Blazor
  - If `*.fsproj` → F#
  - If `*.vbproj` → VB.NET

**Python Ecosystem**
- `requirements.txt`, `setup.py`, `pyproject.toml`, `Pipfile` → Python
  - If contains `django` → Django
  - If contains `flask` → Flask
  - If contains `fastapi` → FastAPI
  - If contains `pytest` → Pytest

**Go Ecosystem**
- `go.mod` → Go
  - Parse `module` directive for module name
  - Check for `gin-gonic/gin` → Gin framework
  - Check for `go-chi/chi` → Chi router

**Rust Ecosystem**
- `Cargo.toml` → Rust
  - Parse `[package]` section for name/version
  - Check `[dependencies]` for `tokio` → Async runtime
  - Check for `actix-web` → Actix framework

**Java/Kotlin Ecosystem**
- `pom.xml` → Maven/Java
- `build.gradle`, `build.gradle.kts` → Gradle/Java or Kotlin
  - Check for `spring-boot-starter` → Spring Boot
  - Check for `junit` → JUnit testing
  - If `.kt` files → Kotlin

**PHP Ecosystem**
- `composer.json` → PHP
  - If `require` has `laravel/framework` → Laravel
  - If has `symfony/symfony` → Symfony
  - If has `wordpress` → WordPress

**Ruby Ecosystem**
- `Gemfile` → Ruby
  - If contains `gem 'rails'` → Ruby on Rails
  - If contains `gem 'sinatra'` → Sinatra
  - If contains `gem 'rspec'` → RSpec

**Database/SQL**
- `*.sql`, `migrations/`, `*.db`, `*.sqlite` → SQL
- `*.prisma` → Prisma ORM
- `*.edmx` → Entity Framework (legacy)

**Mobile**
- `ios/`, `*.xcodeproj`, `*.xcworkspace` → iOS/Swift
- `android/`, `build.gradle` in android/ → Android/Kotlin
- `pubspec.yaml` → Flutter/Dart
- `*.swift` in root → Swift package

**Other Languages**
- `Makefile`, `*.c`, `*.h` → C
- `*.cpp`, `*.hpp` → C++
- `*.scala`, `build.sbt` → Scala
- `*.ex`, `*.exs`, `mix.exs` → Elixir
- `*.erl`, `rebar.config` → Erlang
- `*.clj`, `project.clj` → Clojure
- `*.hs`, `*.cabal`, `stack.yaml` → Haskell
- `*.r`, `*.R` → R
- `*.jl` → Julia
- `*.lua` → Lua
- `*.pl`, `*.pm` → Perl
- `*.sh`, `*.bash` → Shell

**Infrastructure/Config**
- `Dockerfile`, `docker-compose.yml` → Docker
- `*.tf`, `*.tfvars` → Terraform
- `*.yaml` in `.github/workflows/` → GitHub Actions
- `Jenkinsfile` → Jenkins
- `*.bicep` → Azure Bicep

### Stack Detection Output

Create `.planning/intel/stacks.json`:

```json
{
  "detected": "2025-01-20T15:30:00Z",
  "stacks": [
    {
      "name": "dotnet",
      "language": "C#",
      "version": "8.0",
      "frameworks": ["ASP.NET Core", "Blazor Server", "Entity Framework Core"],
      "markers": [
        "Provider-Symplr-Dashboard/Provider-Symplr-Dashboard.csproj",
        "SymplrExtract.sln"
      ]
    },
    {
      "name": "powershell",
      "language": "PowerShell",
      "version": "5.1+",
      "frameworks": ["Pester 5.x"],
      "markers": [
        "SymplrExtract/SymplrExtract.psd1",
        "SymplrExtract/Tests/run-tests.ps1"
      ]
    },
    {
      "name": "sql",
      "language": "SQL",
      "dialect": "Oracle",
      "markers": [
        "SymplrExtract/Resources/SQL/*.sql",
        "SELECTs/*.sql"
      ]
    }
  ],
  "primaryStack": "dotnet",
  "complexity": "medium-high",
  "polyglot": true
}
```

## Step 1: Create Directory Structure

Ensure `.planning/intel/` structure exists:

```bash
mkdir -p .planning/intel/{entities,docs}
```

Expected structure:
```
.planning/intel/
├── stacks.json              # Stack detection results (NEW)
├── file-index.json          # Complete file inventory with stack tags
├── conventions.md           # Per-stack naming and architectural patterns
├── entities/                # Semantic entities organized by stack
│   ├── dotnet/             # .NET-specific entities
│   │   ├── services.md     # Service classes
│   │   ├── controllers.md  # API controllers
│   │   ├── models.md       # Entity models
│   │   └── components.md   # Blazor components
│   ├── powershell/         # PowerShell-specific entities
│   │   ├── cmdlets.md      # Exported functions
│   │   └── modules.md      # Module manifests
│   └── sql/                # SQL-specific entities
│       └── queries.md      # Named queries
└── docs/                    # Additional intelligence docs
    └── implementation/      # Implementation guides
```

## Step 2: Find All Indexable Files

Use stack-specific glob patterns based on detected stacks from Step 0.

### Pattern Selection Logic

For each detected stack, use corresponding glob patterns:

**JavaScript/TypeScript**
```javascript
['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.mjs', '**/*.cjs']
```

**.NET/C#**
```csharp
['**/*.cs', '**/*.cshtml', '**/*.razor', '**/*.csproj', '**/*.sln']
```

**PowerShell**
```powershell
['**/*.ps1', '**/*.psm1', '**/*.psd1']
```

**Python**
```python
['**/*.py', '**/*.pyx', '**/*.pyi']
```

**Go**
```go
['**/*.go', 'go.mod', 'go.sum']
```

**Rust**
```rust
['**/*.rs', 'Cargo.toml', 'Cargo.lock']
```

**Java/Kotlin**
```java
['**/*.java', '**/*.kt', '**/*.kts', 'pom.xml', '**/*.gradle']
```

**PHP**
```php
['**/*.php', 'composer.json', 'composer.lock']
```

**Ruby**
```ruby
['**/*.rb', 'Gemfile', 'Rakefile']
```

**SQL**
```sql
['**/*.sql', '**/*.ora', '**/*.plsql']
```

**Swift**
```swift
['**/*.swift', '**/*.h', '**/*.m']
```

**Dart/Flutter**
```dart
['**/*.dart', 'pubspec.yaml']
```

### Exclusion Patterns (Universal)

Always exclude these regardless of stack:

```
node_modules/**, bin/**, obj/**, dist/**, build/**, .git/**,
*.min.js, *.bundle.js, vendor/**, packages/**, __pycache__/**,
target/**, .venv/**, venv/**, *.pyc, *.class, *.o, *.so, *.dll
```

### File Collection

Use Glob tool to collect files for each detected stack:

```bash
# Example for .NET stack
glob '**/*.cs' '**/*.razor' '**/*.csproj'

# Example for PowerShell stack
glob '**/*.ps1' '**/*.psm1' '**/*.psd1'

# Example for SQL
glob '**/*.sql' '**/*.ora'
```

Collect results into `candidateFiles` array with metadata:

```json
{
  "path": "Provider-Symplr-Dashboard/Services/IBaselineStorageService.cs",
  "stack": "dotnet",
  "extension": ".cs",
  "size": 2451,
  "lastModified": "2025-01-15T10:30:00Z"
}
```

## Step 3: Process Each File with Stack-Specific Parsing

For each file in `candidateFiles`, extract semantic information using language-specific patterns.

### Parsing Strategy by Stack

**C# (.cs, .razor)**

Extract:
- Namespace declarations: `namespace (\S+)`
- Class/interface definitions: `(public|internal|private)?\s+(class|interface|record|struct)\s+(\w+)`
- Method signatures: `(public|protected|private|internal).*?\s+(\w+)\s*\(`
- Properties: `(public|protected|private).*?\s+(\w+)\s*{\s*get`
- Using directives: `using\s+([\w\.]+);`
- Razor components: `@page "(/[\w\-/]*)"`, `@inject\s+(\S+)\s+(\w+)`

Example extraction:
```json
{
  "file": "Services/BaselineStorageService.cs",
  "stack": "dotnet",
  "namespace": "Provider_Symplr_Dashboard.Services",
  "exports": ["BaselineStorageService"],
  "type": "class",
  "implements": ["IBaselineStorageService"],
  "dependencies": [
    "Microsoft.EntityFrameworkCore",
    "Provider_Symplr_Dashboard.Data",
    "Provider_Symplr_Dashboard.Models"
  ],
  "methods": ["SaveBaselineAsync", "GetBaselinesAsync", "DeleteBaselineAsync"],
  "category": "service"
}
```

**PowerShell (.ps1, .psm1)**

Extract:
- Function definitions: `function\s+([\w-]+)`
- Exported functions from manifest (.psd1): `FunctionsToExport\s*=\s*@\((.*?)\)`
- Parameter blocks: `param\s*\((.*?)\)`
- Module dependencies: `RequiredModules\s*=\s*@\((.*?)\)`
- Comment-based help: `\.SYNOPSIS\s+(.*?)\.`

Example extraction:
```json
{
  "file": "SymplrExtract/Public/Invoke-SymplrExtract.ps1",
  "stack": "powershell",
  "exports": ["Invoke-SymplrExtract"],
  "type": "function",
  "parameters": ["Environment", "ShowProgress", "SkipDelivery"],
  "dependencies": ["Export-SymplrData", "Invoke-SymplrDelivery"],
  "category": "cmdlet"
}
```

**SQL (.sql)**

Extract:
- View definitions: `CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+(\w+)`
- Stored procedures: `CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)`
- Function definitions: `CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(\w+)`
- Table references: `FROM\s+(\w+)`, `JOIN\s+(\w+)`
- Comments: `--\s*(.+)`, `/\*\s*(.+?)\s*\*/`

Example extraction:
```json
{
  "file": "SymplrExtract/Resources/SQL/Symplr_Provider_Demographics.sql",
  "stack": "sql",
  "dialect": "oracle",
  "type": "query",
  "tables": [
    "PRACTITIONER",
    "PRACTITIONER_FACILITIES",
    "PRACTITIONER_LANGUAGES",
    "PRACTITIONER_ID_NUMBERS"
  ],
  "ctes": ["qualified_practitioners", "active_facilities"],
  "category": "extraction"
}
```

**JavaScript/TypeScript (.js, .ts, .jsx, .tsx)**

Extract (original logic preserved):
- Import statements: `import\s+.*?\s+from\s+['"](.+?)['"]`
- Export statements: `export\s+(default\s+)?(class|function|const|interface|type)\s+(\w+)`
- React components: `(function|const)\s+(\w+)\s*=.*?=>\s*{` or `class\s+(\w+)\s+extends\s+React\.Component`
- Hooks usage: `use(\w+)\(`

**Python (.py)**

Extract:
- Import statements: `import\s+([\w\.]+)`, `from\s+([\w\.]+)\s+import`
- Class definitions: `class\s+(\w+)(\(.*?\))?:`
- Function definitions: `def\s+(\w+)\s*\(`
- Decorators: `@(\w+)`
- Django models: `class\s+(\w+)\(models\.Model\)`

**Go (.go)**

Extract:
- Package declarations: `package\s+(\w+)`
- Import statements: `import\s+"(.+?)"` or `import\s+\((.*?)\)`
- Function definitions: `func\s+(\w+)\s*\(`
- Type definitions: `type\s+(\w+)\s+(struct|interface)`
- Method receivers: `func\s+\((\w+)\s+\*?(\w+)\)\s+(\w+)`

**Rust (.rs)**

Extract:
- Mod declarations: `mod\s+(\w+);?`
- Use statements: `use\s+([\w:]+);`
- Function definitions: `(pub\s+)?fn\s+(\w+)`
- Struct definitions: `(pub\s+)?struct\s+(\w+)`
- Trait definitions: `(pub\s+)?trait\s+(\w+)`

**Java (.java)**

Extract:
- Package declarations: `package\s+([\w\.]+);`
- Import statements: `import\s+([\w\.]+);`
- Class definitions: `(public\s+)?(class|interface|enum)\s+(\w+)`
- Method signatures: `(public|protected|private).*?\s+(\w+)\s*\(`
- Annotations: `@(\w+)`

**PHP (.php)**

Extract:
- Namespace declarations: `namespace\s+([\w\\]+);`
- Use statements: `use\s+([\w\\]+);`
- Class definitions: `class\s+(\w+)`
- Function definitions: `function\s+(\w+)\s*\(`
- Laravel routes: `Route::(get|post|put|delete)\('(.+?)'`

**Ruby (.rb)**

Extract:
- Module definitions: `module\s+(\w+)`
- Class definitions: `class\s+(\w+)(\s+<\s+(\w+))?`
- Method definitions: `def\s+(\w+)`
- Require statements: `require\s+['"](.+?)['"]`
- Rails models: `class\s+(\w+)\s+<\s+ApplicationRecord`

### Processing Loop

```javascript
const fileData = [];

for (const file of candidateFiles) {
  const content = await Read(file.path);
  const parser = getParserForStack(file.stack);

  const extracted = parser.parse(content, file);

  fileData.push({
    path: file.path,
    stack: file.stack,
    ...extracted
  });
}
```

## Step 4: Detect Conventions Per Stack

Analyze patterns within each stack separately to identify project-specific conventions.

### Convention Detection Rules

**File Naming Conventions**

For each stack, analyze filename patterns:

```javascript
// .NET example
const dotnetFiles = fileData.filter(f => f.stack === 'dotnet');
const patterns = {
  services: /Services\/.*Service\.cs$/,
  controllers: /Controllers\/.*Controller\.cs$/,
  models: /Models\/.*\.cs$/,
  pages: /Pages\/.*\.razor$/,
  components: /Components\/.*\.razor$/,
  tests: /Tests\/.*Tests\.cs$/
};

// PowerShell example
const powershellFiles = fileData.filter(f => f.stack === 'powershell');
const patterns = {
  public_functions: /Public\/.*\.ps1$/,
  private_functions: /Private\/.*\.ps1$/,
  tests: /Tests\/.*\.Tests\.ps1$/,
  manifest: /.*\.psd1$/
};
```

**Architectural Patterns**

Detect by stack:

- **.NET**: Repository pattern, dependency injection, service layers
- **PowerShell**: Module/function organization, parameter validation patterns
- **Python**: Django MVT, Flask blueprints, FastAPI routers
- **Java**: Spring Boot layering, MVC patterns
- **Go**: Handler/service separation, middleware patterns

**Naming Conventions**

Track casing and naming styles per stack:

```json
{
  "dotnet": {
    "classes": "PascalCase",
    "methods": "PascalCase",
    "properties": "PascalCase",
    "interfaces": "IPascalCase",
    "private_fields": "_camelCase"
  },
  "powershell": {
    "functions": "Verb-Noun",
    "parameters": "PascalCase",
    "variables": "camelCase"
  },
  "javascript": {
    "functions": "camelCase",
    "classes": "PascalCase",
    "constants": "UPPER_SNAKE_CASE"
  }
}
```

### Convention Documentation Structure

Write to `.planning/intel/conventions.md`:

```markdown
# Project Conventions

**Detected**: 2025-01-20T15:30:00Z
**Stacks**: .NET, PowerShell, SQL

---

## .NET Conventions

### File Organization
- **Services**: `Services/*Service.cs` - Business logic layer
- **Controllers**: `Controllers/*Controller.cs` - API endpoints (if present)
- **Models**: `Models/*.cs` - Data entities and DTOs
- **Pages**: `Pages/*.razor` - Blazor pages with routes
- **Components**: `Components/*.razor` - Reusable UI components
- **Tests**: `Tests/*Tests.cs` - xUnit test classes

### Naming Patterns
- **Classes**: PascalCase (e.g., `BaselineStorageService`)
- **Interfaces**: IPascalCase (e.g., `IBaselineStorageService`)
- **Methods**: PascalCase (e.g., `SaveBaselineAsync`)
- **Async Methods**: Suffix with `Async`
- **Private Fields**: `_camelCase` (e.g., `_dbContext`)

### Architectural Patterns
- **Dependency Injection**: Constructor injection for services
- **Repository Pattern**: `*Repository.cs` classes
- **Service Layer**: `*Service.cs` classes implementing `I*Service.cs`
- **EF Core**: DbContext pattern with migrations

### Testing Patterns
- **Framework**: xUnit
- **Naming**: `MethodName_Scenario_ExpectedResult`
- **Mocking**: Moq library for interfaces
- **Coverage**: Aim for 80%+ on business logic

---

## PowerShell Conventions

### Module Structure
- **Public Functions**: `Public/*.ps1` - Exported cmdlets
- **Private Functions**: `Private/*/` - Internal helpers organized by domain
  - `Private/DataAccess/` - Oracle and data operations
  - `Private/Delivery/` - SFTP and email functions
  - `Private/Utility/` - Logging, config, validation
- **Tests**: `Tests/Unit/*.Tests.ps1` - Pester 5.x tests
- **Manifest**: `*.psd1` - Module metadata and exports

### Naming Patterns
- **Functions**: Verb-Noun (e.g., `Invoke-SymplrExtract`)
- **Parameters**: PascalCase (e.g., `$Environment`, `$ShowProgress`)
- **Variables**: camelCase (e.g., `$connectionString`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `$VALID_ENVIRONMENTS`)

### Testing Patterns
- **Framework**: Pester 5.x
- **Structure**: `Describe` > `Context` > `It`
- **Mocking**: `InModuleScope` with `-ModuleName` parameter
- **Tags**: `@{ Tags = 'Fast', 'Unit' }` for organization

---

## SQL Conventions

### File Organization
- **Extraction Queries**: `Resources/SQL/Symplr_Provider_*.sql`
- **Legacy Queries**: `SELECTs/*.sql`
- **Test Queries**: `TEST_Selects/*.sql`

### Query Patterns
- **CTEs**: Prefer CTEs over subqueries for readability
- **Naming**: Snake_case for CTEs (e.g., `qualified_practitioners`)
- **Joins**: Explicit JOIN syntax, avoid implicit joins
- **Filtering**: Active status checks in WHERE clauses

---

## Cross-Stack Conventions

### Configuration
- **Format**: JSON with schema validation
- **Environments**: Development, Testing, Test, Production
- **Secrets**: Windows Credential Manager (never plaintext)

### Documentation
- **CLAUDE.md**: Project context for AI assistance
- **README.md**: User-facing setup instructions
- **Inline Comments**: Explain "why", not "what"

### Version Control
- **Commits**: Conventional Commits format (feat:, fix:, docs:)
- **Branches**: feature/*, bugfix/*, hotfix/*
- **PRs**: Required for main branch
```

## Step 5: Build File Index

Create comprehensive file index with stack tagging and metadata.

### File Index Structure

Write to `.planning/intel/file-index.json`:

```json
{
  "generated": "2025-01-20T15:30:00Z",
  "totalFiles": 245,
  "stacks": ["dotnet", "powershell", "sql"],
  "statistics": {
    "dotnet": {
      "files": 120,
      "lines": 45230,
      "classes": 85,
      "interfaces": 42
    },
    "powershell": {
      "files": 68,
      "lines": 12450,
      "functions": 54
    },
    "sql": {
      "files": 15,
      "lines": 3200,
      "queries": 12
    }
  },
  "files": [
    {
      "path": "Provider-Symplr-Dashboard/Services/BaselineStorageService.cs",
      "stack": "dotnet",
      "type": "service",
      "exports": ["BaselineStorageService"],
      "implements": ["IBaselineStorageService"],
      "dependencies": [
        "Microsoft.EntityFrameworkCore",
        "Provider_Symplr_Dashboard.Data.ApplicationDbContext",
        "Provider_Symplr_Dashboard.Models.ExtractBaseline"
      ],
      "linesOfCode": 185,
      "lastModified": "2025-01-15T10:30:00Z",
      "category": "service",
      "tags": ["baseline", "storage", "ef-core"]
    },
    {
      "path": "SymplrExtract/Public/Invoke-SymplrExtract.ps1",
      "stack": "powershell",
      "type": "cmdlet",
      "exports": ["Invoke-SymplrExtract"],
      "dependencies": [
        "Export-SymplrData",
        "Invoke-SymplrDelivery",
        "Get-SymplrConfiguration"
      ],
      "linesOfCode": 342,
      "lastModified": "2025-01-10T14:20:00Z",
      "category": "public-function",
      "tags": ["orchestration", "main-workflow"]
    },
    {
      "path": "SymplrExtract/Resources/SQL/Symplr_Provider_Demographics.sql",
      "stack": "sql",
      "dialect": "oracle",
      "type": "query",
      "tables": [
        "PRACTITIONER",
        "PRACTITIONER_FACILITIES",
        "PRACTITIONER_LANGUAGES",
        "PRACTITIONER_ID_NUMBERS"
      ],
      "linesOfCode": 145,
      "lastModified": "2024-12-18T09:15:00Z",
      "category": "extraction",
      "tags": ["demographics", "cte", "optimized"]
    }
  ],
  "categories": {
    "dotnet": {
      "service": 24,
      "model": 18,
      "page": 15,
      "component": 12,
      "controller": 8,
      "test": 35,
      "other": 8
    },
    "powershell": {
      "cmdlet": 12,
      "private-function": 42,
      "test": 10,
      "manifest": 2,
      "other": 2
    },
    "sql": {
      "extraction": 4,
      "legacy": 8,
      "test": 3
    }
  }
}
```

### Indexing Logic

```javascript
const fileIndex = {
  generated: new Date().toISOString(),
  totalFiles: fileData.length,
  stacks: [...new Set(fileData.map(f => f.stack))],
  statistics: {},
  files: [],
  categories: {}
};

// Calculate statistics per stack
for (const stack of fileIndex.stacks) {
  const stackFiles = fileData.filter(f => f.stack === stack);
  fileIndex.statistics[stack] = calculateStackStats(stackFiles);
  fileIndex.categories[stack] = categorizeFiles(stackFiles);
}

// Transform file data with enrichment
fileIndex.files = fileData.map(file => ({
  path: file.path,
  stack: file.stack,
  type: file.type,
  exports: file.exports,
  dependencies: file.dependencies,
  linesOfCode: file.linesOfCode,
  lastModified: file.lastModified,
  category: categorizeFile(file),
  tags: generateTags(file)
}));
```

## Step 6: Generate Entity Files Per Stack

Create stack-specific entity documentation in `.planning/intel/entities/{stack}/`.

### Entity Generation by Stack

**For .NET Stack** (`.planning/intel/entities/dotnet/`)

**services.md**:
```markdown
# .NET Services

## IBaselineStorageService / BaselineStorageService
**Path**: `Services/BaselineStorageService.cs`
**Category**: Data Access Service
**Dependencies**: ApplicationDbContext, ExtractBaseline model

**Methods**:
- `Task<ExtractBaseline> SaveBaselineAsync(ExtractBaseline baseline)`
- `Task<List<ExtractBaseline>> GetBaselinesAsync(string environment, string extractType)`
- `Task<bool> DeleteBaselineAsync(int baselineId)`

**Usage Context**: Manages baseline storage and retrieval for extract comparison system. Used by baseline comparison workflow.

---

## IAlertService / AlertService
**Path**: `Services/AlertService.cs`
**Category**: Business Logic Service
**Dependencies**: ApplicationDbContext, IThresholdService

**Methods**:
- `Task<ExtractAlert> CreateAlertAsync(ExtractComparison comparison)`
- `Task<List<ExtractAlert>> GetActiveAlertsAsync()`
- `Task AcknowledgeAlertAsync(int alertId, string acknowledgedBy)`

**Usage Context**: Alert lifecycle management based on threshold violations.
```

**models.md**:
```markdown
# .NET Models

## ExtractBaseline
**Path**: `Models/ExtractBaseline.cs`
**Type**: Entity Model (EF Core)
**Table**: `ExtractBaselines`

**Properties**:
- `int Id` (PK)
- `DateTime CreatedDate`
- `string Environment`
- `string ExtractType`
- `string FileHash`
- `long RecordCount`
- `string FilePath`

**Relationships**:
- `ICollection<ExtractComparison> Comparisons` (One-to-Many)

**Usage**: Stores baseline snapshots for comparison analysis.

---

## SymplrPractitioner
**Path**: `Models/SymplrPractitioner.cs`
**Type**: DTO Model

**Properties**:
- `string Npi` (Primary identifier)
- `string FirstName`
- `string LastName`
- `string PrimarSpecialty`
- `List<string> FacilityCodes`

**Usage**: Data transfer object for practitioner extraction queries.
```

**components.md**:
```markdown
# Blazor Components

## BaselineSelector
**Path**: `Components/BaselineSelector.razor`
**Type**: Reusable Component
**Parameters**:
- `Environment` (string)
- `ExtractType` (string)
- `OnBaselineSelected` (EventCallback<ExtractBaseline>)

**Dependencies**: IBaselineStorageService

**Usage**: Dropdown selector for baseline comparison workflows. Used in Comparisons.razor page.

---

## AlertBadge
**Path**: `Components/AlertBadge.razor`
**Type**: Display Component
**Parameters**:
- `AlertCount` (int)
- `Severity` (string)

**Usage**: Visual indicator for alert counts in dashboard header.
```

**For PowerShell Stack** (`.planning/intel/entities/powershell/`)

**cmdlets.md**:
```markdown
# PowerShell Cmdlets

## Invoke-SymplrExtract
**Path**: `Public/Invoke-SymplrExtract.ps1`
**Synopsis**: Main orchestration cmdlet for Symplr data extraction

**Parameters**:
- `[string]$Environment` (Mandatory) - Development|Testing|Test|Production
- `[switch]$ShowProgress` - Display progress bars
- `[switch]$SkipDelivery` - Skip SFTP/email delivery
- `[switch]$SkipArchive` - Skip file archival

**Dependencies**:
- `Export-SymplrData` (for each extract type)
- `Invoke-SymplrDelivery` (SFTP/email)
- `Save-SymplrArchive` (archival)

**Workflow**:
1. Load configuration
2. Validate environment (Test-SymplrExtract)
3. Extract Demographics, BoardCerts, Education, Locations
4. Deliver to SFTP and email (unless -SkipDelivery)
5. Archive files (unless -SkipArchive)

**Example**:
```powershell
Invoke-SymplrExtract -Environment Development -ShowProgress
```

---

## Export-SymplrData
**Path**: `Public/Export-SymplrData.ps1`
**Synopsis**: Extracts single dataset from Oracle to CSV

**Parameters**:
- `[string]$Environment` (Mandatory)
- `[ValidateSet('Demographics','BoardCerts','Education','Locations')]$ExtractType`
- `[switch]$ShowProgress`

**Dependencies**:
- `Invoke-OracleQuery` (Private/DataAccess)
- `ConvertTo-SymplrCsv` (Private/Utility)

**Returns**: FileInfo object for generated CSV

**Example**:
```powershell
Export-SymplrData -Environment Test -ExtractType Demographics
```
```

**modules.md**:
```markdown
# PowerShell Modules

## SymplrExtract
**Path**: `SymplrExtract/SymplrExtract.psd1`
**Version**: 0.4.0
**PowerShell Version**: 5.1+

**Exported Functions** (12):
- Invoke-SymplrExtract
- Export-SymplrData
- Get-SymplrConfiguration
- Set-SymplrConfiguration
- Test-SymplrExtract
- Initialize-SymplrCredentials
- Invoke-SymplrDelivery
- Register-SymplrScheduledTask
- Unregister-SymplrScheduledTask
- Get-SymplrScheduledTask
- Start-SymplrScheduledTask
- Get-SymplrExtractHistory

**Required Modules**: None (uses built-in Oracle.ManagedDataAccess.dll)

**Module Organization**:
- `Public/` - Exported cmdlets (12 files)
- `Private/DataAccess/` - Oracle connectivity (4 files)
- `Private/Delivery/` - SFTP/email (6 files)
- `Private/Utility/` - Logging/config/validation (8 files)
- `Resources/SQL/` - Optimized extraction queries (4 files)
```

**For SQL Stack** (`.planning/intel/entities/sql/`)

**queries.md**:
```markdown
# SQL Queries

## Symplr_Provider_Demographics.sql
**Path**: `SymplrExtract/Resources/SQL/Symplr_Provider_Demographics.sql`
**Type**: Oracle CTE-based extraction query
**Output**: Provider demographics with filtered languages

**CTEs**:
1. `qualified_practitioners` - Active practitioners with valid IDs
2. `active_facilities` - Filtered facility whitelist
3. `practitioner_languages` - Language aggregation with Q: prefix filter

**Tables Referenced**:
- PRACTITIONER (P)
- PRACTITIONER_FACILITIES (PF)
- PRACTITIONER_ID_NUMBERS (PID)
- PRACTITIONER_LANGUAGES (PL)

**Key Filters**:
- `PF.CURRENT_STATUS = 'ACTIVE'`
- `PL.LANGUAGE LIKE 'Q:%'` (specific language subset)
- NPI validation (10-digit numeric)

**Performance**: ~70 seconds (84.6% improvement from legacy)

**Output Columns** (12): NPI, FirstName, LastName, MiddleName, Suffix, Gender, PrimarySpecialty, Languages, FacilityCodes, DEANumber, StateLicenseNumber, MedicaidNumber

---

## Symplr_Provider_BoardCerts.sql
**Path**: `SymplrExtract/Resources/SQL/Symplr_Provider_BoardCerts.sql`
**Type**: Oracle extraction query
**Output**: Board certifications (CERTIFIED status only)

**Key Filter** (RITM09254122):
```sql
WHERE ABS(NVL(PS.CERTIFIED, 0)) = 1
```
Excludes lifetime and qualified certifications.

**Tables Referenced**:
- PRACTITIONER (P)
- PRACTITIONER_SPECIALTIES (PS)
- PRACTITIONER_FACILITIES (PF)

**Performance**: ~72 seconds (40% improvement from legacy)

**Output Columns** (7): NPI, BoardName, CertificationDate, ExpirationDate, RecertificationDate, SpecialtyCode, SpecialtyDescription
```

## Step 7: Write Intelligence Summary

Create human-readable summary in `.planning/intel/docs/analysis-summary.md`:

```markdown
# Codebase Analysis Summary

**Analysis Date**: 2025-01-20T15:30:00Z
**Analyzer Version**: 2.0.0 (Multi-Stack)

---

## Project Overview

**Name**: Healthcare Corp Provider Symplr Integration
**Type**: Healthcare provider data extraction and monitoring system
**Complexity**: Medium-High (polyglot codebase, healthcare domain)

---

## Stack Detection Results

| Stack | Language | Version | Files | Lines of Code | Frameworks |
|-------|----------|---------|-------|---------------|------------|
| .NET | C# | 8.0 | 120 | 45,230 | Blazor Server, EF Core, SignalR |
| PowerShell | PowerShell | 5.1+ | 68 | 12,450 | Pester 5.x |
| SQL | Oracle SQL | 19c | 15 | 3,200 | N/A |

**Primary Stack**: .NET (63% of codebase)
**Polyglot**: Yes (3 major stacks)

---

## Architecture Summary

### .NET Component (Provider-Symplr-Dashboard)
- **Type**: Blazor Server web application
- **Purpose**: Monitoring dashboard for extract operations
- **Key Features**:
  - Real-time extract monitoring via SignalR
  - Baseline comparison and alerting system
  - Scheduled task management (Hangfire)
  - Facility and practitioner management
- **Pages**: 15 (Dashboard, Extract, Baselines, Comparisons, Alerts, etc.)
- **Services**: 24 service classes with interface-based DI
- **Data Layer**: EF Core with SQLite, 10 DbSets
- **Tests**: 35 test classes (xUnit), 450/450 passing

### PowerShell Component (SymplrExtract)
- **Type**: PowerShell module
- **Purpose**: Oracle data extraction and SFTP delivery
- **Exported Cmdlets**: 12 public functions
- **Private Functions**: 42 internal helpers (organized by domain)
- **Key Features**:
  - Oracle connectivity via ODP.NET
  - JSON configuration with schema validation
  - Windows Credential Manager integration
  - Comprehensive Pester test coverage (432/437 passing)

### SQL Component
- **Type**: Oracle SQL queries
- **Purpose**: Healthcare provider data extraction
- **Queries**: 4 optimized extraction queries with CTEs
- **Performance**: 52% improvement over legacy (3:03 vs 6:21)
- **Business Rules**: HIPAA-compliant filtering, NPI validation

---

## Key Entities by Domain

### Data Extraction
- `Invoke-SymplrExtract` (PowerShell) - Main orchestration
- `Export-SymplrData` (PowerShell) - Single dataset extraction
- SQL queries: Demographics, BoardCerts, Education, Locations

### Baseline Management
- `BaselineStorageService` (.NET) - Baseline CRUD operations
- `BaselineComparisonService` (.NET) - Differential analysis
- `ExtractBaseline` model - EF Core entity

### Alerting System
- `AlertService` (.NET) - Alert lifecycle management
- `ThresholdService` (.NET) - Threshold evaluation
- `ExtractAlert`, `ExtractThreshold` models

### UI Layer
- Blazor pages: Dashboard.razor, Baselines.razor, Comparisons.razor
- Components: BaselineSelector, AlertBadge, ProgressBar
- SignalR hub: ExtractMonitoringHub

---

## Code Quality Metrics

### .NET
- **Test Coverage**: 100% (450/450 tests passing)
- **Conventions**: Consistent PascalCase, async/await patterns
- **Architecture**: Clean service layer with DI
- **Issues**: None critical

### PowerShell
- **Test Coverage**: 99% (432/437 tests passing, 5 env-specific skipped)
- **Conventions**: Verb-Noun cmdlet naming, approved verbs
- **Architecture**: Public/Private function separation
- **Issues**: 5 tests require production Oracle credentials

### SQL
- **Optimization**: CTE-based queries, explicit JOINs
- **Performance**: 52% improvement over legacy
- **Issues**: None

---

## Dependency Graph

### .NET Dependencies
```
Blazor Pages
    ↓
Services (IBaselineStorageService, IAlertService, etc.)
    ↓
ApplicationDbContext (EF Core)
    ↓
Models (ExtractBaseline, ExtractAlert, etc.)
    ↓
SQLite Database
```

### PowerShell Dependencies
```
Public Functions (Invoke-SymplrExtract, Export-SymplrData)
    ↓
Private/DataAccess (Invoke-OracleQuery, Get-OracleConnection)
    ↓
Private/Delivery (Send-SftpFile, Send-EmailNotification)
    ↓
Private/Utility (Write-SymplrLog, Get-SymplrConfiguration)
    ↓
Oracle.ManagedDataAccess.dll
```

---

## Next Steps for AI Assistance

Based on this analysis, AI assistants should:

1. **For .NET tasks**: Reference service interfaces and EF Core patterns
2. **For PowerShell tasks**: Follow Verb-Noun naming, use InModuleScope for tests
3. **For SQL tasks**: Maintain CTE structure, validate against Oracle 19c
4. **Cross-stack tasks**: Understand configuration sync between dashboard and module
5. **Testing**: Use stack-specific frameworks (xUnit for .NET, Pester 5.x for PowerShell)

**Key Files for Context**:
- Configuration: `SymplrExtract/Config/*.json`
- Database Schema: `Provider-Symplr-Dashboard/Data/ApplicationDbContext.cs`
- Main Workflows: `SymplrExtract/Public/Invoke-SymplrExtract.ps1`, `Provider-Symplr-Dashboard/Pages/Dashboard.razor`

---

*Generated by GSD analyze-codebase v2.0.0*
```

## Step 8: Report Results

Output structured completion report:

```
✓ Codebase analysis complete

Stacks Detected: 3
  - .NET 8.0 (C#): 120 files, 45,230 LOC
  - PowerShell 5.1+: 68 files, 12,450 LOC
  - Oracle SQL: 15 files, 3,200 LOC

Files Generated:
  ✓ .planning/intel/stacks.json (stack detection results)
  ✓ .planning/intel/file-index.json (245 files indexed)
  ✓ .planning/intel/conventions.md (per-stack conventions)
  ✓ .planning/intel/entities/dotnet/services.md (24 services)
  ✓ .planning/intel/entities/dotnet/models.md (18 models)
  ✓ .planning/intel/entities/dotnet/components.md (12 components)
  ✓ .planning/intel/entities/powershell/cmdlets.md (12 cmdlets)
  ✓ .planning/intel/entities/powershell/modules.md (1 module)
  ✓ .planning/intel/entities/sql/queries.md (4 queries)
  ✓ .planning/intel/docs/analysis-summary.md (human-readable overview)

Key Insights:
  - Primary stack: .NET (63% of codebase)
  - Polyglot architecture with 3 major stacks
  - 24 .NET services following repository pattern
  - 12 PowerShell cmdlets with 99% test coverage
  - 4 optimized SQL queries (52% performance improvement)

Intelligence is ready for context-aware code generation and navigation.
```

## Step 9: Generate Semantic Entities (Optional Enhancement)

If the project has well-defined business domains, create additional semantic entity files:

### Domain-Based Entity Files

**.planning/intel/entities/domains/baseline-comparison.md**:
```markdown
# Baseline Comparison Domain

## Overview
System for storing provider extract baselines and performing differential analysis to detect changes in healthcare provider data.

## Components

### Data Layer
- `ExtractBaseline` (Model) - Baseline snapshot entity
- `ExtractComparison` (Model) - Comparison result entity
- `ApplicationDbContext.ExtractBaselines` (DbSet)

### Service Layer
- `IBaselineStorageService` - Baseline CRUD operations
- `IBaselineComparisonService` - Differential analysis logic
- `BaselineStorageService` (Implementation)
- `BaselineComparisonService` (Implementation)

### UI Layer
- `Baselines.razor` - Baseline management page
- `Comparisons.razor` - Comparison results view
- `BaselineSelector.razor` - Baseline dropdown component

## Workflow

1. User uploads new extract file
2. System parses CSV and creates ExtractBaseline record
3. User selects two baselines for comparison
4. BaselineComparisonService performs NPI-based differential
5. Results stored in ExtractComparison entity
6. Comparison.razor displays added/removed/changed providers

## Key Business Rules
- Baselines identified by Environment + ExtractType + CreatedDate
- NPI used as primary key for provider matching
- File hash (SHA-256) prevents duplicate baselines
- Comparisons can trigger alerts if thresholds exceeded
```

**.planning/intel/entities/domains/extract-orchestration.md**:
```markdown
# Extract Orchestration Domain

## Overview
End-to-end workflow for extracting healthcare provider data from Oracle, generating CSV files, and delivering via SFTP and email.

## Components

### PowerShell Functions
- `Invoke-SymplrExtract` - Main orchestrator
- `Export-SymplrData` - Single dataset extraction
- `Invoke-OracleQuery` (Private) - Query execution
- `ConvertTo-SymplrCsv` (Private) - CSV generation
- `Invoke-SymplrDelivery` - SFTP/email delivery

### SQL Queries
- `Symplr_Provider_Demographics.sql`
- `Symplr_Provider_BoardCerts.sql`
- `Symplr_Provider_Education.sql`
- `Symplr_Provider_Locations.sql`

### .NET Components
- `ExtractMonitoringHub` (SignalR) - Real-time progress
- `Extract.razor` - Manual extraction UI
- `ExtractHistory.razor` - Historical view

## Workflow

1. User initiates extract (UI or scheduled task)
2. Invoke-SymplrExtract loads configuration
3. For each extract type (Demographics, BoardCerts, Education, Locations):
   a. Export-SymplrData executes SQL query
   b. Oracle result set converted to CSV
   c. File written to Extracts/ directory
4. Invoke-SymplrDelivery sends files via SFTP
5. Email notification sent with summary
6. Files archived to Archive/ with timestamp
7. Dashboard updates via SignalR hub

## Performance Targets
- Total runtime: <4 minutes (achieved 3:03)
- Demographics: <80 seconds (achieved 70s)
- BoardCerts: <80 seconds (achieved 72s)
- Education: <30 seconds (achieved 22s)
- Locations: <30 seconds (achieved 19s)
```

</process>

<output>

The command generates the following files in `.planning/intel/`:

### Core Intelligence Files
1. **stacks.json** - Detected technology stacks with versions and frameworks
2. **file-index.json** - Complete file inventory with stack tags and metadata
3. **conventions.md** - Per-stack naming and architectural conventions

### Entity Documentation (by stack)
4. **.planning/intel/entities/dotnet/**
   - services.md - .NET service classes
   - models.md - Entity models and DTOs
   - components.md - Blazor components
   - pages.md - Blazor pages with routes
   - controllers.md - API controllers (if present)

5. **.planning/intel/entities/powershell/**
   - cmdlets.md - Exported PowerShell functions
   - modules.md - Module manifests
   - private-functions.md - Internal helpers

6. **.planning/intel/entities/sql/**
   - queries.md - Named SQL queries
   - views.md - Database views (if present)
   - procedures.md - Stored procedures (if present)

7. **.planning/intel/entities/javascript/** (if present)
   - components.md - React/Vue/Angular components
   - hooks.md - React hooks
   - utils.md - Utility functions

8. **.planning/intel/entities/python/** (if present)
   - models.md - Django/SQLAlchemy models
   - views.md - Django views or Flask routes
   - serializers.md - DRF serializers

### Documentation
9. **.planning/intel/docs/analysis-summary.md** - Human-readable overview
10. **.planning/intel/docs/dependency-graph.md** - Visual dependency maps (optional)

### Domain Entities (optional)
11. **.planning/intel/entities/domains/** - Business domain groupings

</output>

<success_criteria>

The command succeeds when:

1. **Stack Detection**
   - All technology stacks correctly identified from marker files
   - Framework detection accurate (React, Blazor, Django, etc.)
   - stacks.json contains valid stack metadata

2. **File Indexing**
   - All relevant files discovered using stack-specific globs
   - Exclusion patterns properly filter build artifacts
   - file-index.json contains accurate file counts and metadata

3. **Semantic Parsing**
   - Exports/imports correctly extracted per language
   - Dependencies accurately mapped
   - Categories and tags properly assigned

4. **Convention Detection**
   - Per-stack naming patterns identified
   - Architectural patterns documented
   - conventions.md provides actionable guidance

5. **Entity Generation**
   - Entities organized by stack in dedicated directories
   - Each entity file contains accurate paths and descriptions
   - Cross-references between entities are valid

6. **Multi-Stack Support**
   - Works seamlessly on polyglot codebases
   - Single-stack projects don't show empty stack sections
   - Legacy JS/TS-only projects maintain backward compatibility

7. **Performance**
   - Completes analysis in <2 minutes for codebases up to 1000 files
   - Uses parallel processing for stack detection and file reading
   - Minimal memory footprint even on large projects

8. **Output Quality**
   - All generated JSON is valid and schema-compliant
   - Markdown files are well-formatted and readable
   - No broken file paths or missing references

</success_criteria>

---

## Implementation Notes

### Backward Compatibility

The v2 analyzer maintains full backward compatibility with v1:

- If only JS/TS files detected, output structure matches v1
- All original entity categories preserved
- Existing GSD workflows continue to function
- File index schema is superset of v1

### Extension Points

To add support for new languages:

1. Add marker file patterns to Step 0
2. Add glob patterns to Step 2
3. Add parsing logic to Step 3
4. Add convention patterns to Step 4
5. Add entity categorization to Step 6

### Performance Optimizations

- **Parallel stack detection**: Check all marker files simultaneously
- **Streaming file reads**: Process files as they're discovered
- **Incremental indexing**: Skip unchanged files if re-running
- **Lazy entity generation**: Only create entity files for stacks with >5 files

### Error Handling

- **Missing dependencies**: Warn if detected stack lacks marker files
- **Parse failures**: Log unparseable files but continue analysis
- **Empty stacks**: Skip entity generation for stacks with <3 files
- **Large files**: Skip files >10MB to avoid memory issues

---

*GSD Command Specification v2.0.0*
*Supports: JavaScript/TypeScript, .NET, Python, Go, Rust, Java, PHP, Ruby, SQL, and 27+ more languages*
