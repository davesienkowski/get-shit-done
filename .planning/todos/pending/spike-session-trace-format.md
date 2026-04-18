---
title: Spike consolidated session trace format and .planning/.logs layout
date: 2026-04-08
priority: medium
---

## Goal

Define how **one consolidated trace per GSD `sessionId`** is stored under `.planning/` (e.g. `.planning/.logs/`), including:

- **Filename / rotation** convention tied to `sessionId`
- **Ordered append** semantics so `gsd-sdk query` and sub-steps interleave correctly
- **Dual output:** human-friendly terminal stream vs. structured file (NDJSON or similar)
- **Fields:** levels, correlation IDs, subcommand names, timestamps
- **Hook point** for **automatic Claude Code transcript** path/id (see seed `transcript-auto-discovery-hook.md`)

## Done when

- Written spike doc or ADR in-repo (or short section in a planning note) with a recommended format and **non-goals**
- List of **open dependencies** (Agent SDK events, CC transcript location API) for a follow-up phase
