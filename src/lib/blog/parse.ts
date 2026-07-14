import { Marked } from "marked";
import GithubSlugger from "github-slugger";
import type { TocItem } from "./types";

/**
 * Markdown parser tuned for RRLabs blog content.
 * - GFM (tables, task lists, strikethrough) via marked defaults
 * - Heading anchors for TOC linking
 * - Lazy-loaded, captioned images
 * - Admonition blocks: ::: note | tip | warning | info | success | danger
 * - Code blocks tagged with language classes for CSS-based styling
 */

const admonitionTypes = new Set(["note", "tip", "warning", "info", "success", "danger"]);

/** Preprocess `:::type\n...\n:::` blocks into styled HTML. */
function preprocessAdmonitions(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inBlock = false;
  let type = "note";
  let buffer: string[] = [];

  for (const line of lines) {
    const openMatch = line.match(/^:::\s*(\w+)\s*(.*)$/);
    const closeMatch = line.trim() === ":::";

    if (!inBlock && openMatch && admonitionTypes.has(openMatch[1].toLowerCase())) {
      inBlock = true;
      type = openMatch[1].toLowerCase();
      buffer = [];
      continue;
    }
    if (inBlock && closeMatch) {
      const inner = buffer.join("\n");
      out.push(
        `<div class="admonition admonition-${type}"><div class="admonition-title">${type.toUpperCase()}</div>\n\n${inner}\n\n</div>`,
      );
      inBlock = false;
      buffer = [];
      continue;
    }
    if (inBlock) buffer.push(line);
    else out.push(line);
  }
  if (inBlock) out.push(buffer.join("\n"));
  return out.join("\n");
}

function buildMarked() {
  const slugger = new GithubSlugger();
  const m = new Marked({
    gfm: true,
    breaks: false,
    async: false,
  });

  m.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = tokens.map((t) => ("text" in t ? (t.text as string) : "")).join("");
        const id = slugger.slug(plain);
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Anchor">#</a> ${text}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        const t = title ? ` title="${escapeAttr(title)}"` : "";
        const alt = escapeAttr(text ?? "");
        const captionHtml = title ? `<figcaption>${escapeAttr(title)}</figcaption>` : "";
        return `<figure class="blog-figure"><img src="${escapeAttr(href)}" alt="${alt}"${t} loading="lazy" decoding="async" />${captionHtml}</figure>`;
      },
      code({ text, lang }) {
        const language = (lang ?? "").split(/\s+/)[0] || "text";
        const escaped = escapeHtml(text);
        return `<pre class="code-block language-${language}"><code class="language-${language}">${escaped}</code></pre>\n`;
      },
      table({ header, rows }) {
        const head = header
          .map(
            (cell) =>
              `<th${cell.align ? ` style="text-align:${cell.align}"` : ""}>${this.parser.parseInline(cell.tokens)}</th>`,
          )
          .join("");
        const body = rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td${cell.align ? ` style="text-align:${cell.align}"` : ""}>${this.parser.parseInline(cell.tokens)}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const isExternal = /^https?:\/\//i.test(href);
        const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
        const t = title ? ` title="${escapeAttr(title)}"` : "";
        return `<a href="${escapeAttr(href)}"${t}${extra}>${text}</a>`;
      },
    },
  });

  return m;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function parseMarkdown(source: string): { html: string; plain: string } {
  const preprocessed = preprocessAdmonitions(source);
  const marked = buildMarked();
  const html = marked.parse(preprocessed) as string;
  const plain = source
    .replace(/[#>*_`~\[\]\(\)\!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { html, plain };
}

export function calculateReadingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function extractToc(source: string): TocItem[] {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  const lines = source.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (m) {
      const level = m[1].length;
      if (level < 2 || level > 4) continue; // Skip H1 (title) and very deep headings.
      const text = m[2].replace(/[`*_]/g, "");
      const id = slugger.slug(text);
      toc.push({ id, text, level });
    }
  }
  return toc;
}
