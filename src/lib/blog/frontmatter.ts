/**
 * Browser-safe YAML frontmatter parser.
 * Avoids gray-matter (which pulls Node Buffer, broken in the browser bundle).
 * Supports a pragmatic subset: string / number / boolean scalars, ISO dates
 * kept as strings, inline arrays [a, b], and block arrays with `- item` lines.
 */

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

function stripQuotes(v: string): string {
  const s = v.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function coerce(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  // Inline array: [a, "b", c]
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((s) => coerce(stripQuotes(s.trim())));
  }
  // Number (but not dates like 2026-01-02)
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return stripQuotes(v);
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const src = raw.replace(/^\uFEFF/, "");
  if (!src.startsWith("---")) return { data: {}, content: src };

  const lines = src.split(/\r?\n/);
  // First line should be ---
  if (lines[0].trim() !== "---") return { data: {}, content: src };

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return { data: {}, content: src };

  const fmLines = lines.slice(1, endIdx);
  const content = lines.slice(endIdx + 1).join("\n").replace(/^\n+/, "");

  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let blockArray: string[] | null = null;

  for (const line of fmLines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // Block-array item: "  - value"
    const arrayItem = line.match(/^\s*-\s+(.*)$/);
    if (arrayItem && currentKey && blockArray) {
      blockArray.push(coerce(arrayItem[1]) as string);
      continue;
    }

    // Commit any pending block array before a new key
    if (currentKey && blockArray) {
      data[currentKey] = blockArray;
      blockArray = null;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2];

    if (val.trim() === "") {
      // Expect a block array to follow
      currentKey = key;
      blockArray = [];
      continue;
    }

    data[key] = coerce(val);
    currentKey = key;
    blockArray = null;
  }

  if (currentKey && blockArray) {
    data[currentKey] = blockArray;
  }

  return { data, content };
}
