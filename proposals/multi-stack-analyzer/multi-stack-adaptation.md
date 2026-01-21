# Multi-Stack Adaptation for GSD Codebase Analyzer

This document describes how the standard GSD `/gsd:analyze-codebase` command was adapted for a PowerShell + .NET + SQL codebase (Healthcare Corp Provider Symplr integration).

## Context

The standard GSD codebase analyzer is designed for JavaScript/TypeScript projects with patterns like:
- **Glob patterns**: `**/*.{js,ts,jsx,tsx,mjs,cjs}`
- **Export detection**: ES6 exports (`export function`, `export default`), CommonJS (`module.exports`), TypeScript interfaces
- **Import detection**: ES6 imports (`import { } from`), `require()` calls
- **Naming conventions**: camelCase for functions/variables, PascalCase for classes/components

This codebase required adaptation across all these dimensions to handle three distinct technology stacks:
1. **PowerShell** - SymplrExtract module (v0.4.0)
2. **.NET 8 / C# / Blazor** - Provider-Symplr-Dashboard
3. **Oracle SQL** - Healthcare data extraction queries

---

## 1. File Discovery

### Standard GSD Patterns
```
**/*.{js,ts,jsx,tsx,mjs,cjs}
```

### Adapted Patterns

#### PowerShell Stack
```
**/*.ps1    # Script files
**/*.psm1   # Module files
**/*.psd1   # Module manifests
```

#### .NET Stack
```
**/*.cs     # C# source files
**/*.razor  # Blazor components
**/*.csproj # Project files (for dependency analysis)
```

#### SQL Stack
```
**/*.sql    # SQL query files
```

### Exclusion Patterns

**Standard GSD exclusions**:
- `node_modules/` - NPM dependencies

**Adapted exclusions** (additional):
- `bin/` - .NET build output
- `obj/` - .NET intermediate files
- `Archive/` - Archived R&D code
- `binTestBuild/` - PowerShell test build artifacts
- `Migrations/` - EF Core migrations (auto-generated)
- `*.Designer.cs` - Auto-generated designer files

The `node_modules/` exclusion was kept despite being irrelevant - it causes no harm and the analyzer handles non-existent paths gracefully.

---

## 2. Export/Import Detection

### PowerShell

**Exports detected via**:
1. **Function definitions**: `function Verb-Noun { ... }`
2. **Module manifest** (`*.psd1`): `FunctionsToExport = @('Invoke-SymplrExtract', ...)`
3. **Explicit exports**: `Export-ModuleMember -Function 'Verb-Noun'`

**Import patterns**:
1. **Module import**: `Import-Module SymplrExtract`
2. **Dot-sourcing**: `. $PSScriptRoot\Private\Utility.ps1`
3. **RequiredAssemblies in psd1**: External DLL dependencies

**Example entity export section**:
```markdown
## Exports

- `Invoke-SymplrExtract` - Orchestrates complete extraction process

### Parameters
- `-Environment` (Required): Production, Test, Development, Testing
- `-SkipDelivery`: Skip SFTP/Email, generate files locally only
- `-UseMockData`: Use mock data instead of Oracle connection
```

### C# / .NET

**Exports detected via**:
1. **Class declarations**: `public class AlertService : IAlertService`
2. **Interface implementations**: `IAlertService`, `IExtractService`
3. **Public method signatures**: `public async Task<List<Alert>> GetAlertsAsync()`

**Import patterns**:
1. **Using directives**: `using Provider_Symplr_Dashboard.Services;`
2. **DI registrations** in `Program.cs`: `builder.Services.AddScoped<IAlertService, AlertService>()`
3. **NuGet packages** in `.csproj`: `<PackageReference Include="..." />`

**Example entity export section**:
```markdown
## Exports

Implements `IAlertService`:
- `CreateAlertAsync(alert)` - Create new alert from threshold violation
- `GetAlertsAsync(environment, status)` - List alerts with filtering
- `AcknowledgeAlertAsync(id, acknowledgedBy)` - Mark alert as acknowledged
```

### SQL

**SQL files do not export functions** - they are query templates. Instead, document:
1. **Output columns**: The SELECT column list
2. **Parameters**: Bind variables (`:FACILITY_CODES`, `:ENVIRONMENT`)
3. **Business rules**: Filtering logic embedded in WHERE clauses

**Example entity export section**:
```markdown
## Exports

None (SQL query template, not a function)

### Output Columns
- PRACT_ID, FIRST_NAME, MIDDLE_NAME, LAST_NAME
- DEGREE, CREDENTIALS, NPI
- LANGUAGES (Q:% prefix filtered for Symplr subset)

### Key Business Rules
- Language filtering: Uses `LIKE 'Q:%'` prefix per business requirement
- Facility filtering: Parameterized :FACILITY_CODES whitelist
- Status filtering: CURRENT_STATUS = 'ACTIVE' only
```

---

## 3. Naming Convention Detection

### PowerShell Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Functions | `Verb-Noun` (approved verbs) | `Invoke-SymplrExtract`, `Get-SymplrConfiguration` |
| Module prefix | `Symplr` | `Test-SymplrExtract`, `Export-SymplrData` |
| Variables | `$PascalCase` | `$ModuleRoot`, `$ExtractionSessionId` |
| Scope prefixes | `$script:`, `$private:` | `$script:ModuleRoot` |
| Test files | `FunctionName.Tests.ps1` | `Invoke-SymplrExtract.Tests.ps1` |

**Approved verbs detected**: Get, Set, Test, Invoke, Export, Import, Initialize, Register, Unregister, Start, Send, Write

### C# / .NET Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Classes | PascalCase | `AlertService`, `ExtractHistoryDbContext` |
| Service suffix | `*Service` | `BaselineStorageService`, `ThresholdService` |
| Interface prefix | `I*` | `IAlertService`, `IExtractService` |
| Mock prefix | `Mock*` | `MockExtractService`, `MockFacilityService` |
| Async suffix | `*Async` | `GetAlertsAsync`, `CompareWithBaselineAsync` |
| Entity suffix | `*Entity` | `ExtractAlertEntity`, `ExtractBaselineEntity` |
| Controller suffix | `*Controller` | `ExtractController`, `AlertsController` |
| Hub suffix | `*Hub` | `ExtractMonitoringHub` |

### SQL Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Tables | `SCREAMING_SNAKE_CASE` | `PRACTITIONER`, `PRACTITIONER_FACILITIES` |
| Columns | `SCREAMING_SNAKE_CASE` | `PRACT_ID`, `CURRENT_STATUS` |
| Views | `V_` prefix | `V_PROVIDER_QUALIFIED_PRACT` |
| Aliases | Short uppercase | `P`, `PF`, `PL` |

---

## 4. Directory Pattern Recognition

### PowerShell Module Structure

```
SymplrExtract/
├── Public/              # Exported cmdlets (12 functions)
├── Private/             # Internal helper functions
│   ├── DataAccess/      # Oracle connectivity
│   ├── Delivery/        # SFTP, email, archive
│   ├── Utility/         # Logging, config helpers
│   └── ErrorHandling/   # Error management
├── Classes/             # PowerShell class definitions
├── Config/              # JSON configs per environment
├── Resources/SQL/       # Optimized extraction queries
├── Tests/
│   ├── Unit/            # Mocked dependency tests
│   ├── Integration/     # Real dependency tests
│   ├── Helpers/         # Test utilities
│   └── Mocks/           # Mock implementations
└── lib/                 # External assemblies (Oracle.ManagedDataAccess.dll)
```

**Key insight**: The Public/Private pattern is the PowerShell equivalent of `export`/internal in JS modules.

### .NET Blazor Structure

```
Provider-Symplr-Dashboard/
├── Services/            # Business logic (interfaces + implementations)
├── Models/              # EF Core entities and DTOs
├── Pages/               # Blazor page components
│   └── Dashboard/       # Grouped page sections
├── Components/          # Reusable Blazor components
├── Controllers/         # REST API endpoints
├── Hubs/                # SignalR real-time hubs
├── Data/                # EF Core DbContext
│   └── Migrations/      # Database migrations
├── Configuration/       # Strongly-typed settings
├── Shared/              # Layout components
└── Tests/               # xUnit test files
```

### SQL Query Structure

```
SELECTs/                 # Legacy production queries
TEST_Selects/            # Test environment queries
Helpful-Queries/         # Diagnostic and validation queries
SymplrExtract/Resources/SQL/  # Optimized module queries (primary)
```

---

## 5. Dependency Tracking

### PowerShell Dependencies

**External assemblies** (from `.psd1` RequiredAssemblies):
- `Oracle.ManagedDataAccess.dll` (23.26.0)

**Module dependencies**:
- `Posh-SSH` - SFTP delivery
- `CredentialManager` - Windows Credential Manager

**System dependencies**:
- Windows Credential Manager
- Windows Event Log
- Windows Task Scheduler

### .NET Dependencies

**NuGet packages** (from `.csproj`):
- `Microsoft.EntityFrameworkCore.Sqlite`
- `Oracle.ManagedDataAccess.Core`
- `Hangfire`
- `Hangfire.Storage.SQLite`

**Framework dependencies**:
- Blazor Server
- SignalR
- EF Core 8

**DI registration patterns** (from `Program.cs`):
```csharp
builder.Services.AddScoped<IExtractService, MockExtractService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddSingleton<IExtractStateManager, ExtractStateManager>();
```

### SQL Dependencies

**Schema objects referenced**:
- Tables: `PRACTITIONER`, `PRACTITIONER_FACILITIES`, `PRACTITIONER_LANGUAGES`, etc.
- Views: `V_PROVIDER_QUALIFIED_PRACT`
- Schema: `PROV`
- Database: `PPROV` (production), `TPROV` (test)

---

## 6. Entity Generation

### Standard GSD Entity Format

The standard format focuses on syntax: exports, imports, file type.

### Adapted Entity Format

The adapted format emphasizes **PURPOSE** over syntax:

```markdown
---
path: /full/path/to/file
type: module|service|util|component
updated: YYYY-MM-DD
status: active|deprecated
---

# Filename

## Purpose

[1-2 paragraphs explaining WHAT this does and WHY it exists]

## Exports

[What this file provides to other parts of the system]

### Parameters (PowerShell)
[Parameter documentation for cmdlets]

### Output Columns (SQL)
[Column list for query files]

### Key Business Rules (SQL)
[Domain logic embedded in queries]

## Dependencies

[What this file needs - using [[slug]] links for internal refs]

## Used By

[What consumes this file's exports]
```

### Cross-Stack Linking

Entity files use `[[slug]]` format for cross-references:
```markdown
## Dependencies

- [[symplrextract-public-get-symplrconfiguration-ps1]] - Load environment config
- [[provider-symplr-dashboard-data-extracthistorydbcontext-cs]] - Database persistence
```

This enables the graph database to track relationships across technology boundaries.

---

## 7. Conventions File Structure

The `conventions.json` file was restructured to handle multiple stacks:

```json
{
  "naming": {
    "powershell": { ... },
    "csharp": { ... },
    "sql": { ... }
  },
  "directories": {
    "powershell": { ... },
    "dotnet": { ... },
    "sql": { ... }
  },
  "patterns": {
    "dependency_injection": { ... },
    "service_abstraction": { ... },
    "async_pattern": { ... },
    "module_pattern": { ... }
  },
  "businessRules": {
    "board_certifications": { ... },
    "language_filtering": { ... },
    "facility_filtering": { ... },
    "npi_matching": { ... }
  }
}
```

**Key addition**: The `businessRules` section captures domain-specific logic that spans all three stacks (PowerShell orchestration, .NET UI, SQL queries).

---

## 8. Index File Structure

The `index.json` file was enhanced to describe multiple entrypoints:

```json
{
  "stacks": {
    "powershell": {
      "description": "SymplrExtract PowerShell Module v0.4.0",
      "version": "0.4.0",
      "entrypoint": "SymplrExtract/SymplrExtract.psd1"
    },
    "dotnet": {
      "description": "Provider-Symplr-Dashboard - .NET 8 Blazor Server",
      "framework": "net8.0",
      "entrypoint": "Provider-Symplr-Dashboard/Program.cs"
    },
    "sql": {
      "description": "Oracle SQL extraction queries",
      "database": "Oracle PPROV/TPROV"
    }
  },
  "dependencies": {
    "powershell": { "external": [...], "internal": [...] },
    "dotnet": { "nuget": [...], "frameworks": [...] }
  },
  "totalFiles": {
    "powershell": 84,
    "csharp": 160,
    "sql": 26,
    "total": 270
  }
}
```

---

## 9. Key Adaptations Summary

| Aspect | Standard GSD (JS/TS) | Adapted (PowerShell/.NET/SQL) |
|--------|---------------------|-------------------------------|
| File discovery | `*.{js,ts,tsx}` | `*.{ps1,psm1,psd1,cs,razor,sql}` |
| Exclusions | `node_modules/` | + `bin/`, `obj/`, `Archive/`, `Migrations/` |
| Export detection | `export`, `module.exports` | Function defs, interfaces, DI registrations |
| Import detection | `import`, `require` | Dot-sourcing, using, NuGet refs |
| Naming: Functions | camelCase | Verb-Noun (PS), PascalCase (C#) |
| Naming: Classes | PascalCase | PascalCase + suffixes (Service, Entity, Hub) |
| Entry points | `index.js`, `package.json` | `.psd1`, `Program.cs`, N/A for SQL |
| Dependency tracking | `package.json` | `.psd1`, `.csproj`, SQL schema refs |
| Business rules | N/A | `businessRules` section in conventions |

---

## 10. Lessons Learned

1. **Purpose over syntax**: For non-JS codebases, documenting WHY a file exists is more valuable than mechanical export/import lists.

2. **Domain knowledge matters**: Healthcare data rules (NPI matching, certification filtering, facility whitelists) span all three stacks and need explicit documentation.

3. **Cross-stack relationships**: PowerShell calls SQL, .NET calls PowerShell - the entity linking system must handle these boundaries.

4. **Test patterns vary**: Pester 5.x (PowerShell) and xUnit (.NET) have different conventions but both benefit from the same entity format.

5. **Build artifacts differ**: Each stack has its own "junk" directories that should be excluded.

6. **No single entry point**: Unlike JS apps with `index.js`, this codebase has multiple orchestration points that all need documentation.

---

## Appendix: File Counts

| Category | Count |
|----------|-------|
| PowerShell source files | 84 |
| C# source files | 160 |
| SQL query files | 26 |
| **Total analyzed** | **270** |
| Entity files generated | 10 (key files, not exhaustive) |

---

*Document created: 2026-01-20*
*Codebase: Healthcare Corp Provider Symplr Integration*
*GSD Version: Custom adaptation for multi-stack healthcare data system*
