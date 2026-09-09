/**
 * A markdown parser for exactly the markdown in this repo.
 *
 * Not a general one, and deliberately not a dependency. The wiki renders four
 * documents that live in this repo and are written by hand — headings, tables,
 * lists, blockquotes, fenced blocks and four inline forms. That is a closed
 * set, so a hundred lines buys the same result as a parser with a plugin
 * ecosystem, and nothing has to be kept up to date.
 *
 * Pure, and free of JSX, for the same reason `session-engine` is free of a
 * database: it is the half that can be wrong, so it is the half that has to be
 * testable. Turning these blocks into elements is `markdown.tsx`, and deciding
 * what a link points at is its job too — this file only reads text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string };

export type ListItem = { depth: number; spans: Inline[] };

export type Block =
  | { kind: "heading"; depth: number; spans: Inline[] }
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "quote"; spans: Inline[] }
  | { kind: "rule" }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] };

/* ---------------------------------- inline --------------------------------- */

type InlineRule = { re: RegExp; make: (m: RegExpMatchArray) => Inline };

/**
 * Order matters twice over: code comes first so nothing inside a backtick span
 * is reinterpreted, and strong precedes em so `**x**` is not read as an italic
 * asterisk wrapping `*x*`.
 */
const INLINE_RULES: InlineRule[] = [
  { re: /`([^`]+)`/, make: (m) => ({ kind: "code", text: m[1] }) },
  { re: /\[([^\]]+)\]\(([^)]+)\)/, make: (m) => ({ kind: "link", text: m[1], href: m[2] }) },
  { re: /\*\*([^*]+)\*\*/, make: (m) => ({ kind: "strong", text: m[1] }) },
  { re: /\*([^*\n]+)\*/, make: (m) => ({ kind: "em", text: m[1] }) },
];

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest.length > 0) {
    let best: { rule: InlineRule; m: RegExpMatchArray; at: number } | null = null;
    for (const rule of INLINE_RULES) {
      const m = rest.match(rule.re);
      if (!m || m.index === undefined) continue;
      // Strictly less-than, so an earlier rule wins a tie at the same index.
      if (best === null || m.index < best.at) best = { rule, m, at: m.index };
    }
    if (best === null) {
      if (rest.length > 0) out.push({ kind: "text", text: rest });
      break;
    }
    if (best.at > 0) out.push({ kind: "text", text: rest.slice(0, best.at) });
    out.push(best.rule.make(best.m));
    rest = rest.slice(best.at + best.m[0].length);
  }

  return out;
}

/* ---------------------------------- blocks --------------------------------- */

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*]\s+(.*)$/;
const ORDERED = /^(\s*)\d+\.\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^-{3,}$/;
const TABLE_ROW = /^\|(.*)\|\s*$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|\s*$/;

function cells(line: string): string[] {
  const inner = line.match(TABLE_ROW)?.[1] ?? "";
  return inner.split("|").map((c) => c.trim());
}

/** True when a line begins a block of its own, so a paragraph must stop. */
function starts(line: string): boolean {
  return (
    HEADING.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    RULE.test(line.trim()) ||
    TABLE_ROW.test(line) ||
    line.trimStart().startsWith("```")
  );
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code. The fence language is ignored: none of these blocks are
    // syntax-highlighted, they are diagrams and shell snippets.
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const head = cells(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i]) && !TABLE_DIVIDER.test(lines[i])) {
        rows.push(cells(lines[i]).map(parseInline));
        i++;
      }
      blocks.push({ kind: "table", head, rows });
      continue;
    }

    if (RULE.test(line.trim())) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({
        kind: "heading",
        depth: Math.min(heading[1].length, 6),
        spans: parseInline(heading[2]),
      });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(QUOTE);
        if (!m) break;
        body.push(m[1]);
        i++;
      }
      blocks.push({ kind: "quote", spans: parseInline(body.join(" ").trim()) });
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const items: ListItem[] = [];
      const raw: { depth: number; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(BULLET) ?? lines[i].match(ORDERED);
        if (m) {
          raw.push({ depth: Math.floor(m[1].length / 2), text: m[2] });
          i++;
          continue;
        }
        // A plain indented line continues the item above rather than starting a
        // paragraph, which is how these documents wrap their longer bullets.
        if (/^\s{2,}\S/.test(lines[i]) && raw.length > 0) {
          raw[raw.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      for (const item of raw) items.push({ depth: item.depth, spans: parseInline(item.text) });
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !starts(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", spans: parseInline(para.join(" ")) });
  }

  return blocks;
}
