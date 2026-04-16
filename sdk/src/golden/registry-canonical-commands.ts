/**
 * Enumerate one canonical dispatch string per registered handler (aliases collapse).
 * Used by golden coverage policy tests — keep in sync with `createRegistry()`.
 */
import { createRegistry } from '../query/index.js';
import type { QueryHandler } from '../query/utils.js';

/**
 * Prefer dotted forms (`state.load`) over space aliases (`state load`) and
 * legacy kebab duplicates (`summary-extract` vs `summary.extract`).
 */
export function pickCanonicalCommandName(names: string[]): string {
  const unique = [...new Set(names)];
  const dotted = unique.filter((n) => n.includes('.') && !n.includes(' '));
  if (dotted.length) return dotted.sort()[0]!;
  const noSpace = unique.filter((n) => !n.includes(' '));
  if (noSpace.length) return noSpace.sort()[0]!;
  return unique.sort()[0]!;
}

/**
 * One canonical command string per unique handler function in the registry.
 */
export function getCanonicalRegistryCommands(): string[] {
  const registry = createRegistry();
  const byHandler = new Map<QueryHandler, string[]>();
  for (const cmd of registry.commands().sort()) {
    const h = registry.getHandler(cmd);
    if (!h) continue;
    const arr = byHandler.get(h) ?? [];
    arr.push(cmd);
    byHandler.set(h, arr);
  }
  const canon: string[] = [];
  for (const names of byHandler.values()) {
    canon.push(pickCanonicalCommandName(names));
  }
  return canon.sort((a, b) => a.localeCompare(b));
}
