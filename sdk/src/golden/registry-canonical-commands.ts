/**
 * Canonical dispatch strings for the query registry — one name per unique handler.
 * Prefer dotted commands (`state.load`) over space-delimited aliases (`state load`).
 */

import { createRegistry } from '../query/index.js';
import type { QueryHandler } from '../query/utils.js';

function pickCanonicalCommandName(names: string[]): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  const dotted = sorted.filter((n) => n.includes('.'));
  if (dotted.length > 0) {
    return dotted[0];
  }
  /** Prefer `audit-open` / `skill-manifest` over `audit open` / `skill manifest` (stable CLI tokens). */
  const hyphenNoSpace = sorted.filter((n) => n.includes('-') && !n.includes(' '));
  if (hyphenNoSpace.length > 0) {
    return hyphenNoSpace[0];
  }
  return sorted[0];
}

/** Every canonical command string returned by `createRegistry()` (deduped per handler). */
export function getCanonicalRegistryCommands(): string[] {
  const registry = createRegistry();
  const byHandler = new Map<QueryHandler, string[]>();
  for (const cmd of registry.commands()) {
    const h = registry.getHandler(cmd);
    if (!h) continue;
    let list = byHandler.get(h);
    if (!list) {
      list = [];
      byHandler.set(h, list);
    }
    list.push(cmd);
  }
  const out: string[] = [];
  for (const names of byHandler.values()) {
    out.push(pickCanonicalCommandName(names));
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Resolve a registered key (including aliases) to the canonical string for its handler. */
export function canonicalForDispatch(cmd: string): string {
  const registry = createRegistry();
  const h = registry.getHandler(cmd);
  if (!h) {
    throw new Error(`Unknown registry command: ${cmd}`);
  }
  const aliases = registry.commands().filter((c) => registry.getHandler(c) === h);
  return pickCanonicalCommandName(aliases);
}
