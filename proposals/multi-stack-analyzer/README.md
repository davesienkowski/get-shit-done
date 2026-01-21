# Multi-Stack Analyzer Enhancement Proposal

## Overview

This proposal extends `/gsd:analyze-codebase` to support **35+ programming languages and frameworks**, enabling GSD to work effectively with polyglot and enterprise codebases. Currently limited to JavaScript/TypeScript, this enhancement unlocks cross-stack dependency tracking and intelligent analysis for diverse tech stacks.

## Problem Statement

The current analyzer is hardcoded for JS/TS with fixed globs (`**/*.{js,ts,jsx,tsx}`), export patterns (ES6/CommonJS), and naming conventions (camelCase). Real-world production systems—like Trinity Health MSOW Symplr (PowerShell + .NET + Oracle SQL)—cannot be indexed, blocking GSD's intelligence features.

## Solution: Multi-Stack Detection & Analysis

- **Stack Auto-Detection**: Marker files and directory patterns identify project stacks (Node.js, .NET, Python, Go, Rust, PHP, PowerShell, etc.)
- **Stack-Specific Patterns**: Language-aware entity extraction using naming conventions, export patterns, and dependency markers
- **Cross-Stack Mapping**: Track dependencies across languages (e.g., PowerShell → SQL, Blazor → PowerShell module)
- **Extensible Architecture**: YAML configuration for adding new stacks without code changes

## Directory Structure

```
multi-stack-analyzer/
├── README.md                              (this file)
├── github-issue-multi-stack-analyzer.md   (GitHub issue spec)
├── pull-request-multi-stack-analyzer.md   (PR submission document)
├── gsd-analyzer-enhancements.md           (Detailed enhancement docs)
├── gsd-philosophy-alignment.md            (Alignment with GSD principles)
├── multi-stack-adaptation.md              (Stack adaptation framework)
│
├── implementation/
│   ├── analyze-codebase-v2.md             (V2 algorithm & design)
│   ├── analyzer-context-optimization.md   (Context & performance tuning)
│   ├── entity-template-v2.md              (Entity extraction templates)
│   ├── detect-stacks.js                   (Stack detection script)
│   └── stack-profiles.yaml                (35+ stack configurations)
│
└── research/
    ├── START-HERE.md                      (Research entry point)
    ├── 00-START-HERE.md                   (Detailed research guide)
    ├── FINDINGS.md                        (Key research findings)
    ├── INDEX.md                           (Complete research index)
    ├── MANIFEST.md                        (Research deliverables)
    ├── research-dependencies.md           (Dependency analysis)
    ├── research-hooks.md                  (Hook patterns)
    ├── OPTIMIZATION-GUIDE.md              (Performance optimization)
    └── [11 additional research documents]
```

## Quick Start

### Key Documents

- **GitHub Issue**: [github-issue-multi-stack-analyzer.md](github-issue-multi-stack-analyzer.md) — Spec for implementation
- **Pull Request**: [pull-request-multi-stack-analyzer.md](pull-request-multi-stack-analyzer.md) — PR submission with acceptance criteria
- **Implementation Guide**: [implementation/analyze-codebase-v2.md](implementation/analyze-codebase-v2.md) — Algorithm & design
- **Stack Profiles**: [implementation/stack-profiles.yaml](implementation/stack-profiles.yaml) — 35+ language configurations

### How to Test

Run the stack detection script to analyze a polyglot codebase:

```bash
# Test on Trinity Health MSOW Symplr codebase (PowerShell + .NET + SQL)
node implementation/detect-stacks.js /path/to/symplr/

# Run on any project
node implementation/detect-stacks.js /path/to/your/project/
```

**Output**: Detected stacks, file counts by language, marker files, and recommended entity extraction patterns.

### Example Output

```yaml
detected_stacks:
  - name: powershell
    confidence: 95%
    marker_files: [SymplrExtract.psd1, *.psm1]
    file_count: 84

  - name: dotnet
    confidence: 95%
    marker_files: [MSOW-Symplr-Dashboard.csproj]
    file_count: 160

  - name: sql
    confidence: 90%
    marker_files: ["*.sql"]
    file_count: 26
```

## Status

**Ready for review** — All research complete, implementation spec finalized, acceptance criteria defined.

### Next Steps

1. **Review PR**: [pull-request-multi-stack-analyzer.md](pull-request-multi-stack-analyzer.md)
2. **Test Script**: Run `detect-stacks.js` on your codebase
3. **Feedback**: Submit implementation changes via PR against GSD repository

## Supported Stacks (35+)

JavaScript/TypeScript, Python, Go, Rust, C#/.NET, Java, PHP, Ruby, Kotlin, Swift, C++, C, Objective-C, R, MATLAB, PowerShell, Bash, SQL, Oracle, PostgreSQL, MySQL, Lua, Groovy, Scala, Clojure, Elixir, Erlang, Julia, Haskell, F#, and more.

## References

- Trinity Health MSOW Symplr: Production system driving this enhancement
- GSD Analyzer: Current `/gsd:analyze-codebase` command
- Research: `/research/` directory contains 15+ investigation documents
