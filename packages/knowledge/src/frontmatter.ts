/**
 * @agi-system/knowledge - Minimal Markdown frontmatter parser
 *
 * Zero dependencies on purpose (same policy as @agi-system/cognition): the knowledge
 * layer must load in a sandbox with no network and no install step.
 *
 * Supported syntax:
 * ---
 * key: value
 * list_key: a, b, c            # comma separated
 * list_key: ["a, still a", b]  # strict JSON array (commas inside quotes are safe)
 * ---
 * Body markdown...
 *
 * Keys `pipeline`, `concepts`, `terms`, `aliases` and any `*_list` key are always parsed
 * as lists.
 */

export interface ParsedDocument {
  data: Record<string, string | string[]>;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedDocument {
  const text = raw.replace(/^\uFEFF/, '');
  const data: Record<string, string | string[]> = {};

  if (!text.startsWith('---')) return { data, body: text.trim() };

  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data, body: text.trim() };

  const header = text.slice(3, end).replace(/^\r?\n/, '');
  const body = text.slice(end + 4).replace(/^\r?\n/, '');

  for (const line of header.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;

    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    if (!key) continue;

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      // Prefer strict JSON (allows commas inside quoted strings), fall back to comma split
      try {
        const parsed = JSON.parse(value) as unknown;
        data[key] = Array.isArray(parsed) ? parsed.map((item) => String(item)) : splitList(value.slice(1, -1));
      } catch {
        data[key] = splitList(value.slice(1, -1));
      }
    } else if (key.endsWith('_list') || key === 'pipeline' || key === 'concepts' || key === 'terms' || key === 'aliases') {
      data[key] = splitList(value);
    } else {
      data[key] = value;
    }
  }

  return { data, body: body.trim() };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter((item) => item.length > 0);
}

export function str(data: Record<string, string | string[]>, key: string, fallback = ''): string {
  const value = data[key];
  if (Array.isArray(value)) return value.join(', ');
  return value ?? fallback;
}

export function list(data: Record<string, string | string[]>, key: string): string[] {
  const value = data[key];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return splitList(value);
  return [];
}

export function num(data: Record<string, string | string[]>, key: string, fallback: number): number {
  const parsed = Number(str(data, key, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}
