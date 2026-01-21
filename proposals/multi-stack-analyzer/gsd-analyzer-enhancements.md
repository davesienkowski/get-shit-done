# GSD Analyzer Enhancements - Technical Specification

## Executive Summary

This document specifies multi-stack enhancements to GSD's `/gsd:analyze-codebase` command. The current analyzer hardcodes JavaScript/TypeScript patterns, limiting its effectiveness on polyglot projects. This proposal introduces stack detection, profile-based configuration, and language-specific pattern recognition while maintaining full backward compatibility.

## Current State Analysis

### Hardcoded Limitations (from actual analyzer code)

**Step 2: File Discovery**
```javascript
// Current hardcoded pattern
const files = await glob('**/*.{js,ts,jsx,tsx,mjs,cjs}');
```

**Step 3: Export Detection**
```javascript
// Only detects ES6/CommonJS/TypeScript patterns
const exportPatterns = [
  /export\s+(default\s+)?(class|function|const|let|var|interface|type|enum)\s+(\w+)/g,
  /module\.exports\s*=\s*(\w+)/g,
  /exports\.(\w+)\s*=/g
];
```

**Step 4: Naming Convention Detection**
```javascript
// Only recognizes JS/TS conventions
if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
```

**Directory Pattern Recognition**
```javascript
// Web framework focused
const webPatterns = ['components', 'hooks', 'services', 'utils', 'lib'];
```

### Impact on Polyglot Projects

**Healthcare Corp Provider Symplr Project Example:**
- **PowerShell Module**: 12 cmdlets in `SymplrExtract/Public/*.ps1` - Not detected
- **.NET Blazor**: 40 services in `Provider-Symplr-Dashboard/Services/*.cs` - Not detected
- **Oracle SQL**: 4 optimized queries in `Resources/SQL/*.sql` - Not detected
- **Pester Tests**: 432 tests in `Tests/Unit/*.Tests.ps1` - Not detected

Only detects: Documentation files and batch scripts (not useful for codebase intelligence).

## Proposed Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      GSD Analyze Codebase                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Step 0: NEW         │
                │   Stack Detection     │
                │   - Marker files      │
                │   - Framework detect  │
                │   - Confidence score  │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   Step 0.5: NEW       │
                │   Load Stack Profiles │
                │   - YAML configs      │
                │   - Merge patterns    │
                │   - Set defaults      │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
│ Step 2: File   │ │ Step 3: Export │ │ Step 4: Naming │
│ Discovery      │ │ Detection      │ │ Conventions    │
│ (Dynamic Glob) │ │ (Stack Aware)  │ │ (Stack Aware)  │
└────────────────┘ └────────────────┘ └────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Steps 5-7:          │
                │   Intelligence Output │
                │   (Multi-Stack JSON)  │
                └───────────────────────┘
```

### 1. Stack Detection Layer (New)

#### Marker File Detection

```yaml
# Stack detection rules (priority order)
marker_files:
  # .NET (Highest confidence)
  - pattern: "*.csproj"
    stack: "dotnet"
    confidence: 0.95
  - pattern: "*.sln"
    stack: "dotnet"
    confidence: 0.90

  # PowerShell
  - pattern: "*.psd1"
    stack: "powershell"
    confidence: 0.95
  - pattern: "*.psm1"
    stack: "powershell"
    confidence: 0.85

  # Node.js/JavaScript
  - pattern: "package.json"
    stack: "javascript"
    confidence: 0.95
  - pattern: "tsconfig.json"
    stack: "typescript"
    confidence: 0.95

  # Python
  - pattern: "setup.py"
    stack: "python"
    confidence: 0.90
  - pattern: "pyproject.toml"
    stack: "python"
    confidence: 0.95
  - pattern: "requirements.txt"
    stack: "python"
    confidence: 0.75

  # Go
  - pattern: "go.mod"
    stack: "go"
    confidence: 0.95

  # Rust
  - pattern: "Cargo.toml"
    stack: "rust"
    confidence: 0.95

  # Java
  - pattern: "pom.xml"
    stack: "java"
    confidence: 0.90
  - pattern: "build.gradle"
    stack: "java"
    confidence: 0.85

  # Ruby
  - pattern: "Gemfile"
    stack: "ruby"
    confidence: 0.90

  # PHP
  - pattern: "composer.json"
    stack: "php"
    confidence: 0.90

  # SQL/Database
  - pattern: "**/*.sql"
    stack: "sql"
    confidence: 0.60
    requires_count: 3  # Need 3+ SQL files

  # Infrastructure
  - pattern: "Dockerfile"
    stack: "docker"
    confidence: 0.80
  - pattern: "terraform.tfvars"
    stack: "terraform"
    confidence: 0.85
```

#### Detection Algorithm

```javascript
async function detectStacks(projectRoot) {
  const stacks = new Map(); // stack -> confidence
  const markerRules = loadMarkerRules();

  for (const rule of markerRules) {
    const matches = await glob(rule.pattern, {
      cwd: projectRoot,
      onlyFiles: true,
      deep: rule.maxDepth || 5
    });

    if (matches.length > 0) {
      // Check minimum file count threshold
      if (rule.requires_count && matches.length < rule.requires_count) {
        continue;
      }

      // Accumulate confidence scores
      const currentScore = stacks.get(rule.stack) || 0;
      stacks.set(rule.stack, Math.max(currentScore, rule.confidence));
    }
  }

  // Filter by minimum confidence threshold
  const detectedStacks = Array.from(stacks.entries())
    .filter(([_, confidence]) => confidence >= 0.60)
    .map(([stack, confidence]) => ({ stack, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  return detectedStacks;
}
```

#### Framework Detection Within Stacks

```yaml
# Framework extensions (applied after stack detection)
framework_markers:
  dotnet:
    - pattern: "**/Components/*.razor"
      framework: "blazor"
      adds_patterns: ["**/*.razor", "**/*.razor.cs"]
    - pattern: "**/Controllers/*Controller.cs"
      framework: "aspnetcore-mvc"
      adds_patterns: ["**/Controllers/*.cs", "**/Views/*.cshtml"]
    - pattern: "**/wwwroot/**"
      framework: "aspnetcore-web"

  javascript:
    - pattern: "next.config.js"
      framework: "nextjs"
      adds_patterns: ["pages/**/*.{js,jsx,ts,tsx}", "app/**/*.{js,jsx,ts,tsx}"]
    - pattern: "remix.config.js"
      framework: "remix"
    - pattern: "vite.config.js"
      framework: "vite"

  python:
    - pattern: "manage.py"
      framework: "django"
      adds_patterns: ["**/migrations/*.py", "**/admin.py", "**/views.py"]
    - pattern: "app.py"
      framework: "flask"
    - pattern: "main.py"
      framework: "fastapi"

  powershell:
    - pattern: "*.psd1"
      framework: "module"
      adds_patterns: ["Public/*.ps1", "Private/*.ps1", "Resources/**"]
    - pattern: "**/*.Tests.ps1"
      framework: "pester"
```

### 2. Stack Profiles System (New)

#### Profile Schema

```yaml
# profiles/dotnet.yml
stack: dotnet
version: "1.0"
priority: 10  # Higher = analyzed first

file_patterns:
  include:
    - "**/*.cs"
    - "**/*.csproj"
    - "**/*.razor"
    - "**/*.razor.cs"
    - "**/*.cshtml"
  exclude:
    - "**/bin/**"
    - "**/obj/**"
    - "**/publish/**"
    - "**/*.Designer.cs"
    - "**/*.g.cs"
    - "**/*.g.i.cs"

export_patterns:
  # C# classes, interfaces, enums
  - pattern: '^\s*public\s+(sealed\s+)?(class|interface|enum|struct|record)\s+(\w+)'
    type: "class"
    capture_group: 3
  # Public methods
  - pattern: '^\s*public\s+(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\('
    type: "method"
    capture_group: 2
  # Public properties
  - pattern: '^\s*public\s+(?:static\s+)?(?:virtual\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\{\s*get'
    type: "property"
    capture_group: 2
  # Dependency injection (ASP.NET Core pattern)
  - pattern: 'services\.Add(\w+)<(\w+)>'
    type: "service_registration"
    capture_group: 2

import_patterns:
  # Using statements
  - pattern: '^\s*using\s+([\w\.]+);'
    capture_group: 1
  # Namespace references in code
  - pattern: ':\s*I?(\w+)(?:<|,|\s*{)'
    type: "interface_impl"
    capture_group: 1

naming_conventions:
  class: "PascalCase"
  method: "PascalCase"
  property: "PascalCase"
  field_private: "camelCase_or_underscore"
  parameter: "camelCase"
  constant: "PascalCase"
  interface: "IPascalCase"  # Must start with 'I'

directory_patterns:
  semantic:
    - pattern: "Controllers"
      purpose: "mvc_controllers"
    - pattern: "Services"
      purpose: "business_logic"
    - pattern: "Models"
      purpose: "data_models"
    - pattern: "Components"
      purpose: "ui_components"
    - pattern: "Pages"
      purpose: "razor_pages"
    - pattern: "Data"
      purpose: "data_access"
    - pattern: "Migrations"
      purpose: "ef_migrations"
    - pattern: "Hubs"
      purpose: "signalr_hubs"

test_patterns:
  file_suffixes:
    - ".Tests.cs"
    - ".Test.cs"
    - "Tests.cs"
  frameworks:
    - "xUnit"
    - "NUnit"
    - "MSTest"
  marker_patterns:
    - '[Fact]'
    - '[Theory]'
    - '[Test]'
    - '[TestMethod]'
```

```yaml
# profiles/powershell.yml
stack: powershell
version: "1.0"
priority: 8

file_patterns:
  include:
    - "**/*.ps1"
    - "**/*.psm1"
    - "**/*.psd1"
  exclude:
    - "**/Tests/**"
    - "**/*.Tests.ps1"

export_patterns:
  # Function definitions
  - pattern: '^\s*function\s+([\w-]+)'
    type: "function"
    capture_group: 1
  # Advanced functions with CmdletBinding
  - pattern: '\[CmdletBinding\(\)\][\s\S]*?function\s+([\w-]+)'
    type: "cmdlet"
    capture_group: 1
  # Module manifest exports
  - pattern: 'FunctionsToExport\s*=\s*@\((.*?)\)'
    type: "module_export"
    capture_group: 1

import_patterns:
  # Module imports
  - pattern: 'Import-Module\s+([^\s]+)'
    capture_group: 1
  # Dot sourcing
  - pattern: '\.\s+([^\s]+\.ps1)'
    capture_group: 1

naming_conventions:
  function: "Verb-Noun"  # PowerShell approved verbs
  cmdlet: "Verb-Noun"
  variable: "PascalCase"
  parameter: "PascalCase"
  script: "Verb-Noun.ps1"

directory_patterns:
  semantic:
    - pattern: "Public"
      purpose: "exported_functions"
    - pattern: "Private"
      purpose: "internal_functions"
    - pattern: "Tests"
      purpose: "pester_tests"
    - pattern: "Resources"
      purpose: "data_files"
    - pattern: "Config"
      purpose: "configuration"

test_patterns:
  file_suffixes:
    - ".Tests.ps1"
    - ".Test.ps1"
  frameworks:
    - "Pester"
  marker_patterns:
    - 'Describe\s+'
    - 'Context\s+'
    - 'It\s+'
```

```yaml
# profiles/sql.yml
stack: sql
version: "1.0"
priority: 5

file_patterns:
  include:
    - "**/*.sql"
    - "**/*.ddl"
    - "**/*.dml"
  exclude:
    - "**/migrations/**"
    - "**/seed/**"

export_patterns:
  # CREATE statements
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|INDEX|SEQUENCE)\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)'
    type: "db_object"
    capture_group: 2
  # Package definitions (Oracle)
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE\s+(?:BODY\s+)?([^\s]+)'
    type: "package"
    capture_group: 1

import_patterns:
  # FROM clauses
  - pattern: 'FROM\s+([^\s,()]+)'
    capture_group: 1
  # JOIN clauses
  - pattern: 'JOIN\s+([^\s,()]+)'
    capture_group: 1

naming_conventions:
  table: "UPPER_SNAKE_CASE_or_PascalCase"
  view: "V_UPPER_SNAKE_CASE"
  procedure: "UPPER_SNAKE_CASE"
  function: "UPPER_SNAKE_CASE"

directory_patterns:
  semantic:
    - pattern: "SELECTs"
      purpose: "queries"
    - pattern: "Procedures"
      purpose: "stored_procedures"
    - pattern: "Views"
      purpose: "database_views"
    - pattern: "Migrations"
      purpose: "schema_changes"

test_patterns:
  file_suffixes:
    - "_test.sql"
    - "_spec.sql"
  frameworks:
    - "pgTAP"
    - "utPLSQL"
```

### 3. Modified Analysis Pipeline

#### Step 0: Stack Detection (NEW)

```javascript
async function analyzeCodebase_Step0_DetectStacks(projectRoot) {
  console.log('Step 0: Detecting language stacks...');

  // Detect primary stacks via marker files
  const detectedStacks = await detectStacks(projectRoot);

  if (detectedStacks.length === 0) {
    console.warn('No stacks detected, falling back to JS/TS defaults');
    return [{ stack: 'javascript', confidence: 0.50 }];
  }

  console.log('Detected stacks:');
  detectedStacks.forEach(s => {
    console.log(`  - ${s.stack} (confidence: ${(s.confidence * 100).toFixed(0)}%)`);
  });

  // Load stack profiles
  const profiles = [];
  for (const { stack, confidence } of detectedStacks) {
    const profile = await loadStackProfile(stack);
    if (profile) {
      profile.confidence = confidence;
      profiles.push(profile);
    }
  }

  // Detect frameworks within each stack
  for (const profile of profiles) {
    const frameworks = await detectFrameworks(projectRoot, profile);
    if (frameworks.length > 0) {
      console.log(`  Frameworks for ${profile.stack}:`, frameworks.join(', '));
      profile.frameworks = frameworks;

      // Merge framework-specific patterns
      mergeFrameworkPatterns(profile, frameworks);
    }
  }

  return profiles;
}
```

#### Step 0.5: Load Stack Profiles (NEW)

```javascript
async function loadStackProfile(stackName) {
  const profilePath = path.join(__dirname, 'profiles', `${stackName}.yml`);

  if (!fs.existsSync(profilePath)) {
    console.warn(`No profile found for ${stackName}, using defaults`);
    return null;
  }

  const yaml = require('yaml');
  const profileContent = fs.readFileSync(profilePath, 'utf8');
  const profile = yaml.parse(profileContent);

  // Validate profile schema
  validateStackProfile(profile);

  return profile;
}

function validateStackProfile(profile) {
  const required = ['stack', 'file_patterns', 'export_patterns', 'naming_conventions'];
  for (const field of required) {
    if (!profile[field]) {
      throw new Error(`Stack profile missing required field: ${field}`);
    }
  }
}

function mergeFrameworkPatterns(profile, frameworks) {
  const frameworkMarkers = loadFrameworkMarkers();

  for (const framework of frameworks) {
    const marker = frameworkMarkers[profile.stack]?.find(m => m.framework === framework);
    if (marker?.adds_patterns) {
      profile.file_patterns.include.push(...marker.adds_patterns);
    }
  }
}
```

#### Step 2: Dynamic File Discovery (MODIFIED)

**Before (Hardcoded):**
```javascript
const files = await glob('**/*.{js,ts,jsx,tsx,mjs,cjs}', {
  cwd: projectRoot,
  ignore: ['node_modules/**', 'dist/**', 'build/**']
});
```

**After (Stack-Aware):**
```javascript
async function analyzeCodebase_Step2_DiscoverFiles(projectRoot, stackProfiles) {
  console.log('Step 2: Discovering files across stacks...');

  const filesByStack = new Map();

  for (const profile of stackProfiles) {
    console.log(`  Scanning ${profile.stack} files...`);

    // Build glob patterns from profile
    const patterns = profile.file_patterns.include;
    const ignore = [
      ...(profile.file_patterns.exclude || []),
      'node_modules/**',
      '.git/**'
    ];

    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        ignore,
        onlyFiles: true,
        absolute: true
      });
      files.push(...matches);
    }

    // Deduplicate
    const uniqueFiles = [...new Set(files)];
    console.log(`  Found ${uniqueFiles.length} ${profile.stack} files`);

    filesByStack.set(profile.stack, uniqueFiles);
  }

  return filesByStack;
}
```

#### Step 3: Stack-Specific Export Detection (MODIFIED)

**Before (JS/TS only):**
```javascript
function extractExports(fileContent) {
  const exports = [];

  // ES6 exports
  const es6Pattern = /export\s+(default\s+)?(class|function|const)\s+(\w+)/g;
  let match;
  while ((match = es6Pattern.exec(fileContent)) !== null) {
    exports.push({ name: match[3], type: match[2] });
  }

  return exports;
}
```

**After (Stack-Aware):**
```javascript
async function analyzeCodebase_Step3_ExtractExports(filesByStack, stackProfiles) {
  console.log('Step 3: Extracting exports per stack...');

  const exportsByStack = new Map();

  for (const profile of stackProfiles) {
    const files = filesByStack.get(profile.stack) || [];
    const stackExports = [];

    console.log(`  Analyzing ${files.length} ${profile.stack} files...`);

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileExports = extractExportsForStack(content, filePath, profile);

      if (fileExports.length > 0) {
        stackExports.push({
          file: path.relative(projectRoot, filePath),
          exports: fileExports
        });
      }
    }

    console.log(`  Found ${stackExports.length} files with exports`);
    exportsByStack.set(profile.stack, stackExports);
  }

  return exportsByStack;
}

function extractExportsForStack(content, filePath, profile) {
  const exports = [];

  for (const pattern of profile.export_patterns) {
    const regex = new RegExp(pattern.pattern, 'gm');
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[pattern.capture_group];
      if (name && name.length > 0) {
        exports.push({
          name,
          type: pattern.type,
          line: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }

  return exports;
}
```

#### Step 4: Stack-Aware Naming Convention Detection (MODIFIED)

**Before (JS/TS only):**
```javascript
function detectNamingConvention(name) {
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return 'camelCase';
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'UPPER_SNAKE_CASE';
  return 'unknown';
}
```

**After (Stack-Aware):**
```javascript
async function analyzeCodebase_Step4_AnalyzeConventions(exportsByStack, stackProfiles) {
  console.log('Step 4: Analyzing naming conventions per stack...');

  const conventionsByStack = new Map();

  for (const profile of stackProfiles) {
    const stackExports = exportsByStack.get(profile.stack) || [];
    const conventions = analyzeNamingConventionsForStack(stackExports, profile);

    console.log(`  ${profile.stack} conventions:`,
      Object.entries(conventions).map(([k, v]) => `${k}=${v}`).join(', '));

    conventionsByStack.set(profile.stack, conventions);
  }

  return conventionsByStack;
}

function analyzeNamingConventionsForStack(stackExports, profile) {
  const conventions = {};
  const expectedConventions = profile.naming_conventions;

  // Group exports by type
  const exportsByType = {};
  for (const fileData of stackExports) {
    for (const exp of fileData.exports) {
      if (!exportsByType[exp.type]) exportsByType[exp.type] = [];
      exportsByType[exp.type].push(exp.name);
    }
  }

  // Check each type against expected convention
  for (const [type, names] of Object.entries(exportsByType)) {
    const expectedConvention = expectedConventions[type];
    if (!expectedConvention) continue;

    // Sample first 10 names
    const sample = names.slice(0, 10);
    const detected = detectConvention(sample, expectedConvention);

    conventions[type] = {
      expected: expectedConvention,
      detected,
      compliance: detected === expectedConvention ? 'compliant' : 'non-compliant',
      sample_count: sample.length
    };
  }

  return conventions;
}

function detectConvention(names, expected) {
  const conventionTests = {
    'PascalCase': (n) => /^[A-Z][a-zA-Z0-9]*$/.test(n),
    'camelCase': (n) => /^[a-z][a-zA-Z0-9]*$/.test(n),
    'UPPER_SNAKE_CASE': (n) => /^[A-Z][A-Z0-9_]*$/.test(n),
    'lower_snake_case': (n) => /^[a-z][a-z0-9_]*$/.test(n),
    'kebab-case': (n) => /^[a-z][a-z0-9-]*$/.test(n),
    'Verb-Noun': (n) => /^[A-Z][a-z]+-[A-Z][a-z]+/.test(n),
    'IPascalCase': (n) => /^I[A-Z][a-zA-Z0-9]*$/.test(n)
  };

  const test = conventionTests[expected];
  if (!test) return 'unknown';

  const matches = names.filter(test).length;
  const compliance = matches / names.length;

  return compliance >= 0.8 ? expected : 'mixed';
}
```

### Output Format Changes

#### Multi-Stack Intelligence JSON

```json
{
  "project": {
    "root": "/projects/healthcare-integration",
    "analyzed_at": "2025-01-20T10:30:00Z",
    "analyzer_version": "2.0.0"
  },
  "stacks_detected": [
    {
      "stack": "powershell",
      "confidence": 0.95,
      "frameworks": ["module", "pester"],
      "file_count": 127,
      "priority": 8
    },
    {
      "stack": "dotnet",
      "confidence": 0.95,
      "frameworks": ["blazor", "aspnetcore-web"],
      "file_count": 450,
      "priority": 10
    },
    {
      "stack": "sql",
      "confidence": 0.60,
      "frameworks": [],
      "file_count": 12,
      "priority": 5
    }
  ],
  "intelligence_by_stack": {
    "powershell": {
      "file_index": [
        {
          "path": "SymplrExtract/Public/Invoke-SymplrExtract.ps1",
          "size_bytes": 8924,
          "exports": [
            {
              "name": "Invoke-SymplrExtract",
              "type": "cmdlet",
              "line": 45
            }
          ],
          "imports": [
            "Write-SymplrLog",
            "Get-SymplrConfiguration"
          ]
        }
      ],
      "exported_symbols": {
        "cmdlets": [
          "Invoke-SymplrExtract",
          "Export-SymplrData",
          "Get-SymplrConfiguration",
          "Set-SymplrConfiguration",
          "Test-SymplrExtract",
          "Initialize-SymplrCredentials",
          "Invoke-SymplrDelivery"
        ],
        "functions": [
          "Write-SymplrLog",
          "Get-OracleConnection",
          "Invoke-OracleQuery"
        ]
      },
      "naming_conventions": {
        "cmdlet": {
          "expected": "Verb-Noun",
          "detected": "Verb-Noun",
          "compliance": "compliant"
        }
      },
      "directory_structure": {
        "semantic_patterns": [
          {
            "path": "SymplrExtract/Public",
            "purpose": "exported_functions",
            "file_count": 12
          },
          {
            "path": "SymplrExtract/Private",
            "purpose": "internal_functions",
            "file_count": 28
          },
          {
            "path": "SymplrExtract/Tests",
            "purpose": "pester_tests",
            "file_count": 87
          }
        ]
      }
    },
    "dotnet": {
      "file_index": [
        {
          "path": "Provider-Symplr-Dashboard/Services/BaselineStorageService.cs",
          "size_bytes": 15672,
          "exports": [
            {
              "name": "BaselineStorageService",
              "type": "class",
              "line": 12
            },
            {
              "name": "StoreBaselineAsync",
              "type": "method",
              "line": 45
            }
          ],
          "imports": [
            "Microsoft.EntityFrameworkCore",
            "Provider_Symplr_Dashboard.Data"
          ]
        }
      ],
      "exported_symbols": {
        "services": [
          "BaselineStorageService",
          "BaselineComparisonService",
          "AlertService",
          "ThresholdService"
        ],
        "components": [
          "ExtractMonitor",
          "FacilityManager",
          "BaselineViewer"
        ]
      },
      "naming_conventions": {
        "class": {
          "expected": "PascalCase",
          "detected": "PascalCase",
          "compliance": "compliant"
        },
        "interface": {
          "expected": "IPascalCase",
          "detected": "IPascalCase",
          "compliance": "compliant"
        }
      },
      "directory_structure": {
        "semantic_patterns": [
          {
            "path": "Provider-Symplr-Dashboard/Services",
            "purpose": "business_logic",
            "file_count": 40
          },
          {
            "path": "Provider-Symplr-Dashboard/Components",
            "purpose": "ui_components",
            "file_count": 15
          }
        ]
      }
    },
    "sql": {
      "file_index": [
        {
          "path": "SymplrExtract/Resources/SQL/Demographics.sql",
          "size_bytes": 12543,
          "exports": [
            {
              "name": "V_PROVIDER_QUALIFIED_PRACT",
              "type": "db_object",
              "line": 8
            }
          ],
          "imports": [
            "PRACTITIONER",
            "PRACTITIONER_FACILITIES",
            "PRACTITIONER_LANGUAGES"
          ]
        }
      ],
      "exported_symbols": {
        "views": [
          "V_PROVIDER_QUALIFIED_PRACT"
        ]
      },
      "naming_conventions": {
        "view": {
          "expected": "V_UPPER_SNAKE_CASE",
          "detected": "V_UPPER_SNAKE_CASE",
          "compliance": "compliant"
        }
      }
    }
  },
  "cross_stack_dependencies": [
    {
      "from_stack": "dotnet",
      "to_stack": "powershell",
      "dependency_type": "process_invocation",
      "details": "ConfigurationSyncService invokes PowerShell scripts"
    },
    {
      "from_stack": "powershell",
      "to_stack": "sql",
      "dependency_type": "query_execution",
      "details": "SymplrExtract executes SQL queries via ODP.NET"
    }
  ]
}
```

## Backward Compatibility

### Zero Breaking Changes Guarantee

**Single-Stack JS/TS Projects:**
```javascript
// Existing behavior preserved exactly
const stacks = await detectStacks(projectRoot);
// Returns: [{ stack: 'javascript', confidence: 0.95 }]

const profile = await loadStackProfile('javascript');
// Loads existing JS patterns (unchanged)

// All subsequent steps function identically to current implementation
```

**Output Format:**
```json
// Old format (still supported)
{
  "files": [...],
  "exports": [...],
  "conventions": {...}
}

// New format (additive only)
{
  "stacks_detected": [{...}],
  "intelligence_by_stack": {
    "javascript": {
      "file_index": [...],  // Same as old "files"
      "exported_symbols": {...},  // Same as old "exports"
      "naming_conventions": {...}  // Same as old "conventions"
    }
  }
}
```

### Migration Path for Existing Projects

**Phase 1**: Detection runs, single stack detected → Output identical to v1.0
**Phase 2**: Multi-stack detection enabled → New output format with backward-compatible fields
**Phase 3**: Consumers migrate to new format at their own pace

## Performance Considerations

### Stack Detection Overhead

```
Benchmark: Healthcare Corp Provider Symplr Project (1,589 files)

Step 0: Stack Detection
  - Marker file scan: 15 glob patterns × 5ms = 75ms
  - Profile loading: 3 YAML files × 10ms = 30ms
  - Framework detection: 8 patterns × 5ms = 40ms
  Total: 145ms (~2% of total analysis time)

Step 2: File Discovery (before optimization)
  - Old: 1 glob pattern → 1,589 files in 250ms
  - New: 3 stacks × average 3 patterns = 9 globs → 1,589 files in 450ms
  Overhead: 200ms (+80%, but acceptable)

Step 3-4: Export/Convention Analysis
  - Old: 1 pass over 1,589 files
  - New: 3 passes over subset of files (450 PS, 127 CS, 12 SQL)
  Net: Similar performance (parallelizable)

Total Overhead: ~350ms for polyglot projects (<5% impact)
```

### Optimization Strategies

1. **Parallel Stack Analysis**: Process each stack in separate worker thread
2. **Lazy Profile Loading**: Only load profiles for detected stacks
3. **Incremental Analysis**: Cache results per stack, only re-analyze changed files
4. **Smart Glob Ordering**: Prioritize high-yield patterns first

### Memory Profile

```
Baseline (JS/TS only): ~50MB for 1,500 files
Multi-stack (3 stacks): ~65MB for 1,500 files
Overhead: 30% increase (acceptable for 3x language support)
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal**: Stack detection + profile system infrastructure

- [ ] Create `profiles/` directory with schema definition
- [ ] Implement `detectStacks()` with marker file rules
- [ ] Implement `loadStackProfile()` with YAML parsing
- [ ] Add unit tests for detection algorithm
- [ ] Validate backward compatibility on pure JS/TS projects

**Deliverables**:
- `lib/stack-detection.js` (300 LOC)
- `lib/profile-loader.js` (150 LOC)
- `profiles/javascript.yml` (reference implementation)
- Test suite (50 test cases)

### Phase 2: Tier 1 Languages (Week 2-3)
**Goal**: Support top 10 enterprise languages

**Priority Order**:
1. **JavaScript/TypeScript** (baseline, already working)
2. **Python** (Django, Flask, FastAPI patterns)
3. **Java** (Spring, Maven, Gradle patterns)
4. **C#/.NET** (Blazor, ASP.NET Core, EF Core patterns)
5. **Go** (modules, packages)
6. **Rust** (crates, modules)
7. **PowerShell** (modules, Pester)
8. **Ruby** (Rails, Gems)
9. **PHP** (Laravel, Composer)
10. **SQL** (Oracle, PostgreSQL, MySQL patterns)

**Per-Language Tasks**:
- [ ] Create stack profile YAML (50-100 LOC each)
- [ ] Define export/import patterns (10-20 regex patterns)
- [ ] Define naming conventions (5-10 rules)
- [ ] Add framework detection markers
- [ ] Write language-specific tests (10 test cases per language)

**Deliverables**:
- 9 new profile files (`profiles/*.yml`)
- Updated `analyzeCodebase_Step2-4` functions
- 90 additional test cases
- Documentation per language

### Phase 3: Tier 2-3 Languages + Infrastructure (Week 4)
**Goal**: Comprehensive coverage for all common enterprise scenarios

**Languages**:
- Swift, Kotlin, Scala, Clojure, Elixir, Haskell, Dart
- Shell scripts (Bash, Zsh)
- Markup/Config (YAML, JSON, TOML, XML)

**Infrastructure as Code**:
- Docker (Dockerfile, docker-compose.yml)
- Terraform (*.tf, *.tfvars)
- Kubernetes (*.yaml manifests)
- Ansible (playbooks, roles)

**Deliverables**:
- 15 additional profile files
- Infrastructure-specific pattern detection
- Cross-stack dependency tracking

### Phase 4: Advanced Features (Week 5)
**Goal**: Cross-stack intelligence and optimization

**Features**:
- [ ] Cross-stack dependency graph generation
- [ ] Multi-stack architecture visualization
- [ ] Performance optimization (parallel analysis)
- [ ] Incremental analysis (cache previous results)
- [ ] Export to multiple formats (JSON, YAML, GraphQL schema)

**Deliverables**:
- `lib/dependency-tracker.js`
- `lib/architecture-visualizer.js`
- Performance benchmarks
- Documentation for advanced features

## Testing Strategy

### Unit Tests (Per Phase)

```javascript
// Phase 1: Stack Detection
describe('detectStacks', () => {
  it('detects PowerShell module from .psd1 file', async () => {
    const stacks = await detectStacks('./test-fixtures/powershell-module');
    expect(stacks).toContainEqual({
      stack: 'powershell',
      confidence: expect.any(Number)
    });
  });

  it('detects multiple stacks in polyglot project', async () => {
    const stacks = await detectStacks('./test-fixtures/polyglot');
    expect(stacks.length).toBeGreaterThan(1);
  });

  it('falls back to JS/TS when no markers found', async () => {
    const stacks = await detectStacks('./test-fixtures/empty');
    expect(stacks).toContainEqual({ stack: 'javascript', confidence: 0.50 });
  });
});

// Phase 2: Profile Loading
describe('loadStackProfile', () => {
  it('loads valid YAML profile', async () => {
    const profile = await loadStackProfile('dotnet');
    expect(profile.stack).toBe('dotnet');
    expect(profile.file_patterns).toBeDefined();
  });

  it('throws error on invalid profile schema', async () => {
    await expect(loadStackProfile('invalid')).rejects.toThrow();
  });
});

// Phase 2: Export Detection
describe('extractExportsForStack', () => {
  it('detects C# class exports', () => {
    const content = 'public class MyService { }';
    const profile = { export_patterns: [/* dotnet patterns */] };
    const exports = extractExportsForStack(content, 'test.cs', profile);
    expect(exports).toContainEqual({ name: 'MyService', type: 'class' });
  });

  it('detects PowerShell function exports', () => {
    const content = 'function Invoke-MyCommand { }';
    const profile = { export_patterns: [/* powershell patterns */] };
    const exports = extractExportsForStack(content, 'test.ps1', profile);
    expect(exports).toContainEqual({ name: 'Invoke-MyCommand', type: 'function' });
  });
});
```

### Integration Tests

```javascript
describe('Full Pipeline - Polyglot Project', () => {
  it('analyzes Healthcare Corp Provider Symplr project', async () => {
    const result = await analyzeCodebase('/projects/healthcare-integration');

    // Verify all 3 stacks detected
    expect(result.stacks_detected).toHaveLength(3);
    expect(result.stacks_detected.map(s => s.stack)).toContain('powershell');
    expect(result.stacks_detected.map(s => s.stack)).toContain('dotnet');
    expect(result.stacks_detected.map(s => s.stack)).toContain('sql');

    // Verify PowerShell exports
    const psIntel = result.intelligence_by_stack.powershell;
    expect(psIntel.exported_symbols.cmdlets).toContain('Invoke-SymplrExtract');

    // Verify .NET exports
    const dotnetIntel = result.intelligence_by_stack.dotnet;
    expect(dotnetIntel.exported_symbols.services).toContain('BaselineStorageService');

    // Verify SQL exports
    const sqlIntel = result.intelligence_by_stack.sql;
    expect(sqlIntel.exported_symbols.views).toContain('V_PROVIDER_QUALIFIED_PRACT');
  });
});
```

### Regression Tests

```javascript
describe('Backward Compatibility', () => {
  it('produces identical output for pure JS/TS projects', async () => {
    const legacyResult = await analyzeCodebase_v1('./test-fixtures/js-only');
    const newResult = await analyzeCodebase_v2('./test-fixtures/js-only');

    // Output should be structurally equivalent
    expect(newResult.intelligence_by_stack.javascript.file_index)
      .toEqual(legacyResult.files);
  });
});
```

## Documentation Requirements

### User-Facing Documentation

1. **Migration Guide**: How to upgrade from v1.0 to v2.0
2. **Stack Profile Reference**: Complete YAML schema documentation
3. **Language Support Matrix**: Which languages/frameworks are supported
4. **Custom Profile Creation**: How to add support for new languages
5. **Performance Tuning**: Optimization strategies for large projects

### Developer Documentation

1. **Architecture Decision Records**: Why YAML profiles over hardcoded logic
2. **Pattern Design Guide**: How to write effective export/import patterns
3. **Testing Conventions**: How to add tests for new language support
4. **Contribution Guide**: Steps to submit new language profiles

## Success Metrics

### Quantitative Goals

- **Language Coverage**: Support 15+ languages by end of Phase 3
- **Performance**: <5% overhead for polyglot projects vs single-stack
- **Accuracy**: >95% precision on export detection per language
- **Backward Compatibility**: 100% output equivalence for JS/TS projects

### Qualitative Goals

- **Ease of Extension**: Non-developers can add new language profiles
- **Clear Error Messages**: Helpful diagnostics when profiles are invalid
- **Progressive Enhancement**: Graceful degradation when profiles missing

## Risk Mitigation

### Technical Risks

**Risk**: Regex patterns too complex or unmaintainable
**Mitigation**: Use AST parsing for Tier 1 languages (e.g., `@babel/parser` for JS, `tree-sitter` for others)

**Risk**: YAML profile system too rigid
**Mitigation**: Support JavaScript/TypeScript profile files as alternative (`.js` profiles with full programmatic control)

**Risk**: Performance regression on large codebases
**Mitigation**: Implement incremental analysis with caching; benchmark on 10,000+ file projects

### Adoption Risks

**Risk**: Breaking changes for existing GSD users
**Mitigation**: Strict backward compatibility testing; phased rollout with opt-in flag

**Risk**: Incomplete language support confuses users
**Mitigation**: Clear documentation on supported languages; fallback to generic analysis

## Appendix A: Complete Pattern Examples

### PowerShell Export Patterns

```yaml
export_patterns:
  # Standard functions
  - pattern: '^\s*function\s+([\w-]+)'
    type: "function"
    capture_group: 1

  # Advanced functions (CmdletBinding)
  - pattern: '\[CmdletBinding\(\)\][\s\S]{0,200}function\s+([\w-]+)'
    type: "cmdlet"
    capture_group: 1

  # Parameter-decorated functions
  - pattern: '\[Parameter\([\s\S]*?\)\][\s\S]{0,500}function\s+([\w-]+)'
    type: "cmdlet"
    capture_group: 1

  # Module manifest exports (FunctionsToExport)
  - pattern: "FunctionsToExport\\s*=\\s*@\\(['\"]([\\w-]+)['\"]"
    type: "module_export"
    capture_group: 1

  # Aliases
  - pattern: 'Set-Alias\s+-Name\s+(\w+)'
    type: "alias"
    capture_group: 1
```

### C#/.NET Export Patterns

```yaml
export_patterns:
  # Classes, interfaces, enums, structs, records
  - pattern: '^\s*public\s+(?:sealed\s+|abstract\s+|static\s+)?(class|interface|enum|struct|record)\s+(\w+)'
    type: "type_declaration"
    capture_group: 2

  # Public methods
  - pattern: '^\s*public\s+(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:sealed\s+)?(\w+(?:<[\w\s,<>]+>)?)\s+(\w+)\s*\('
    type: "method"
    capture_group: 2

  # Public properties
  - pattern: '^\s*public\s+(?:static\s+)?(?:virtual\s+)?(\w+(?:<[\w\s,<>]+>)?)\s+(\w+)\s*\{\s*(?:get|set)'
    type: "property"
    capture_group: 2

  # Events
  - pattern: '^\s*public\s+event\s+(\w+)\s+(\w+)'
    type: "event"
    capture_group: 2

  # ASP.NET Core DI registrations
  - pattern: 'services\.Add(\w+)<(\w+)>'
    type: "service_registration"
    capture_group: 2

  # Controller actions
  - pattern: '\[Http(Get|Post|Put|Delete|Patch)\][\s\S]{0,100}public\s+.*\s+(\w+)\s*\('
    type: "controller_action"
    capture_group: 2
```

### Python Export Patterns

```yaml
export_patterns:
  # Function definitions
  - pattern: '^\s*def\s+(\w+)\s*\('
    type: "function"
    capture_group: 1

  # Class definitions
  - pattern: '^\s*class\s+(\w+)'
    type: "class"
    capture_group: 1

  # Async functions
  - pattern: '^\s*async\s+def\s+(\w+)\s*\('
    type: "async_function"
    capture_group: 1

  # __all__ exports
  - pattern: "__all__\\s*=\\s*\\[['\"]([\\w_]+)['\"]"
    type: "module_export"
    capture_group: 1

  # Django views
  - pattern: '^\s*def\s+(\w+)\s*\(\s*request'
    type: "django_view"
    capture_group: 1

  # Django models
  - pattern: '^\s*class\s+(\w+)\s*\(\s*models\.Model'
    type: "django_model"
    capture_group: 1
```

### SQL Export Patterns

```yaml
export_patterns:
  # CREATE TABLE
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)'
    type: "table"
    capture_group: 1

  # CREATE VIEW
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)'
    type: "view"
    capture_group: 1

  # CREATE PROCEDURE
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([^\s(]+)'
    type: "procedure"
    capture_group: 1

  # CREATE FUNCTION
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)'
    type: "function"
    capture_group: 1

  # CREATE TRIGGER
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)'
    type: "trigger"
    capture_group: 1

  # Oracle packages
  - pattern: 'CREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE\s+(?:BODY\s+)?([^\s]+)'
    type: "package"
    capture_group: 1
```

## Appendix B: Framework Detection Matrix

| Stack | Framework | Marker Files | Added Patterns |
|-------|-----------|--------------|----------------|
| dotnet | Blazor | `**/*.razor` | `**/*.razor`, `**/*.razor.cs`, `Components/**` |
| dotnet | ASP.NET MVC | `Controllers/*Controller.cs` | `Controllers/*.cs`, `Views/*.cshtml` |
| dotnet | EF Core | `Migrations/*.cs` | `Data/*.cs`, `Models/*.cs` |
| javascript | Next.js | `next.config.js` | `pages/**/*.{js,jsx,ts,tsx}`, `app/**` |
| javascript | React | `package.json` (react dep) | `components/**`, `hooks/**` |
| javascript | Vue | `package.json` (vue dep) | `*.vue`, `components/**/*.vue` |
| python | Django | `manage.py` | `**/migrations/*.py`, `**/admin.py`, `**/views.py` |
| python | Flask | `app.py` | `routes/*.py`, `templates/*.html` |
| powershell | Module | `*.psd1` | `Public/*.ps1`, `Private/*.ps1` |
| powershell | Pester | `*.Tests.ps1` | `Tests/**/*.Tests.ps1` |

---

**Document Version**: 1.0
**Last Updated**: 2025-01-20
**Author**: AI-Assisted Technical Specification
**Status**: Draft for Review

**Next Steps**:
1. Review with GSD maintainers
2. Create GitHub issue for tracking
3. Implement Phase 1 (stack detection infrastructure)
4. Solicit community feedback on language priorities
