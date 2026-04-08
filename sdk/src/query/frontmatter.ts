/**
 * Frontmatter parser and query handler.
 *
 * Ported from get-shit-done/bin/lib/frontmatter.cjs and state.cjs.
 * Provides YAML frontmatter extraction from .planning/ artifacts.
 *
 * @example
 * ```typescript
 * import { extractFrontmatter, frontmatterGet } from './frontmatter.js';
 *
 * const fm = extractFrontmatter('---\nphase: 10\nplan: 01\n---\nbody');
 * // { phase: '10', plan: '01' }
 *
 * const result = await frontmatterGet(['STATE.md'], '/project');
 * // { data: { gsd_state_version: '1.0', milestone: 'v3.0', ... } }
 * ```
 */

import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

// ─── splitInlineArray ───────────────────────────────────────────────────────

/**
 * Quote-aware CSV splitting for inline YAML arrays.
 *
 * Handles both single and double quotes, preserving commas inside quotes.
 *
 * @param body - The content inside brackets, e.g. 'a, "b, c", d'
 * @returns Array of trimmed values
 */
export function splitInlineArray(body: string): string[] {
  const items: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ',') {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) items.push(trimmed);
  return items;
}

// ─── extractFrontmatter ─────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from file content.
 *
 * Full stack-based parser supporting:
 * - Simple key: value pairs
 * - Nested objects via indentation
 * - Inline arrays: key: [a, b, c]
 * - Dash arrays with auto-conversion from empty objects
 * - Multiple stacked blocks (uses the LAST match)
 * - CRLF line endings
 * - Quoted value stripping
 *
 * @param content - File content potentially containing frontmatter
 * @returns Parsed frontmatter as a record, or empty object if none found
 */
export function extractFrontmatter(content: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  // Find ALL frontmatter blocks. Use the LAST one (corruption recovery).
  const allBlocks = [...content.matchAll(/(?:^|\n)\s*---\r?\n([\s\S]+?)\r?\n---/g)];
  const match = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
  if (!match) return frontmatter;

  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);

  // Stack to track nested objects: [{obj, key, indent}]
  const stack: Array<{ obj: Record<string, unknown> | unknown[]; key: string | null; indent: number }> = [
    { obj: frontmatter, key: null, indent: -1 },
  ];

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;

    // Calculate indentation (number of leading spaces)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack back to appropriate level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Check for key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Key with no value or opening bracket -- could be nested object or array
        (current.obj as Record<string, unknown>)[key] = value === '[' ? [] : {};
        current.key = null;
        // Push new context for potential nested content
        stack.push({ obj: (current.obj as Record<string, unknown>)[key] as Record<string, unknown>, key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: key: [a, b, c]
        (current.obj as Record<string, unknown>)[key] = splitInlineArray(value.slice(1, -1));
        current.key = null;
      } else {
        // Simple key: value -- strip surrounding quotes
        (current.obj as Record<string, unknown>)[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, '');

      // If current context is an empty object, convert to array
      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        // Find the key in parent that points to this object and convert it
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent && !Array.isArray(parent.obj)) {
          for (const k of Object.keys(parent.obj as Record<string, unknown>)) {
            if ((parent.obj as Record<string, unknown>)[k] === current.obj) {
              (parent.obj as Record<string, unknown>)[k] = [itemValue];
              current.obj = (parent.obj as Record<string, unknown>)[k] as unknown[];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }

  return frontmatter;
}

// ─── stripFrontmatter ───────────────────────────────────────────────────────

/**
 * Strip all frontmatter blocks from the start of content.
 *
 * Handles CRLF line endings and multiple stacked blocks (corruption recovery).
 * Greedy: keeps stripping ---...--- blocks separated by optional whitespace.
 *
 * @param content - File content with potential frontmatter
 * @returns Content with frontmatter removed
 */
export function stripFrontmatter(content: string): string {
  let result = content;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stripped = result.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\s*/, '');
    if (stripped === result) break;
    result = stripped;
  }
  return result;
}

// ─── frontmatterGet ─────────────────────────────────────────────────────────

/**
 * Query handler for frontmatter.get command.
 *
 * Reads a file, extracts frontmatter, and optionally returns a single field.
 * Rejects null bytes in path (security: path traversal guard).
 *
 * @param args - args[0]: file path, args[1]: optional field name
 * @param projectDir - Project root directory
 * @returns QueryResult with parsed frontmatter or single field value
 */
export const frontmatterGet: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError('file path required', ErrorClassification.Validation);
  }

  // Path traversal guard: reject null bytes
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  const fullPath = isAbsolute(filePath) ? filePath : join(projectDir, filePath);

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  const fm = extractFrontmatter(content);
  const field = args[1];

  if (field) {
    const value = fm[field];
    if (value === undefined) {
      return { data: { error: 'Field not found', field } };
    }
    return { data: { [field]: value } };
  }

  return { data: fm };
};
