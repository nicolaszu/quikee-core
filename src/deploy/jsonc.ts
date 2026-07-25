/**
 * Minimal JSONC reader for our own `wrangler.jsonc` (comments + trailing commas).
 * Scoped to config we control — not a general-purpose parser.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  let inString = false;
  let quote = '';
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inLine) {
      if (ch === '\n') {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i++;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += ch;
  }

  // Drop trailing commas before } or ].
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(out);
}
