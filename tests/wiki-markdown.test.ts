import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBlocks, parseInline, type Block, type Inline } from "../src/lib/wiki/parse.ts";
import { WIKI_DOCS } from "../src/lib/wiki/docs.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const texts = (spans: Inline[]) => spans.map((s) => ("text" in s ? s.text : "")).join("");
const kinds = (blocks: Block[]) => blocks.map((b) => b.kind);

/* ---------------------------------- inline --------------------------------- */

test("code spans are read before anything inside them", () => {
  const spans = parseInline("set `a **b** c` now");
  assert.deepEqual(spans, [
    { kind: "text", text: "set " },
    { kind: "code", text: "a **b** c" },
    { kind: "text", text: " now" },
  ]);
});

test("strong wins over em at the same position, so ** is never read as *", () => {
  assert.deepEqual(parseInline("**bold**"), [{ kind: "strong", text: "bold" }]);
  assert.deepEqual(parseInline("*just italic*"), [{ kind: "em", text: "just italic" }]);
});

test("links keep their text and href apart", () => {
  assert.deepEqual(parseInline("see [V1](SPEC-V1.md) for it"), [
    { kind: "text", text: "see " },
    { kind: "link", text: "V1", href: "SPEC-V1.md" },
    { kind: "text", text: " for it" },
  ]);
});

test("an unmatched marker stays literal rather than eating the rest of the line", () => {
  assert.deepEqual(parseInline("a ** b"), [{ kind: "text", text: "a ** b" }]);
});

/* ---------------------------------- blocks --------------------------------- */

test("headings carry their depth, and six is as deep as it goes", () => {
  // Seven hashes is not a seventh level, it is a paragraph that starts with
  // hashes — which is what CommonMark says too.
  const blocks = parseBlocks("# One\n\n### Three\n\n###### Six\n\n####### Seven");
  assert.deepEqual(kinds(blocks), ["heading", "heading", "heading", "paragraph"]);
  const depths = blocks.map((b) => (b.kind === "heading" ? b.depth : -1));
  assert.deepEqual(depths, [1, 3, 6, -1]);
});

test("a table is read as a table, header row included", () => {
  const blocks = parseBlocks("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "table");
  if (blocks[0].kind !== "table") return;
  assert.deepEqual(blocks[0].head.map(texts), ["A", "B"]);
  assert.deepEqual(
    blocks[0].rows.map((r) => r.map(texts)),
    [
      ["1", "2"],
      ["3", "4"],
    ],
  );
});

test("a table with an empty first header cell keeps the empty column", () => {
  // SPEC-V2's currency table opens with "| | Earned from | Spent on |".
  const blocks = parseBlocks("| | Earned from |\n|---|---|\n| **XP** | minutes |");
  assert.equal(blocks[0].kind, "table");
  if (blocks[0].kind !== "table") return;
  assert.equal(blocks[0].head.length, 2);
  assert.equal(texts(blocks[0].head[0]), "");
});

test("an alignment divider is still a divider", () => {
  const blocks = parseBlocks("| A | B |\n|:--|--:|\n| 1 | 2 |");
  assert.equal(blocks[0].kind, "table");
});

test("a horizontal rule is not mistaken for a table divider", () => {
  assert.deepEqual(kinds(parseBlocks("text\n\n---\n\nmore")), ["paragraph", "rule", "paragraph"]);
});

test("a fenced block keeps its lines verbatim, diagram characters and all", () => {
  const blocks = parseBlocks("```\n  a ──→ b\n  c\n```");
  assert.equal(blocks[0].kind, "code");
  if (blocks[0].kind !== "code") return;
  assert.equal(blocks[0].text, "  a ──→ b\n  c");
});

test("consecutive quote lines become one blockquote", () => {
  const blocks = parseBlocks("> one\n> two\n\nafter");
  assert.deepEqual(kinds(blocks), ["quote", "paragraph"]);
  assert.equal(blocks[0].kind === "quote" ? texts(blocks[0].spans) : "", "one two");
});

test("nested bullets keep their depth", () => {
  const blocks = parseBlocks("- top\n  - under\n- top again");
  assert.equal(blocks[0].kind, "list");
  if (blocks[0].kind !== "list") return;
  assert.equal(blocks[0].ordered, false);
  assert.deepEqual(
    blocks[0].items.map((i) => i.depth),
    [0, 1, 0],
  );
});

test("an ordered list is ordered", () => {
  const blocks = parseBlocks("1. first\n2. second");
  assert.equal(blocks[0].kind, "list");
  if (blocks[0].kind !== "list") return;
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].items.length, 2);
});

test("an indented wrap continues the bullet above rather than starting a paragraph", () => {
  const blocks = parseBlocks("- a bullet that\n  wraps onto a second line\n- next");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "list");
  if (blocks[0].kind !== "list") return;
  assert.equal(texts(blocks[0].items[0].spans), "a bullet that wraps onto a second line");
});

/* ----------------------------- the real documents -------------------------- */

for (const doc of WIKI_DOCS) {
  test(`${doc.file} parses, and nothing is left half-read`, () => {
    const blocks = parseBlocks(read(doc.file));
    assert.ok(blocks.length > 10, "document produced almost no blocks");

    // Every marker the parser claims to understand must have been consumed. A
    // stray "**" or a paragraph opening with a pipe means a construct in the
    // real document fell through to prose.
    const walk = (spans: Inline[], where: string) => {
      for (const span of spans) {
        if (span.kind !== "text") continue;
        assert.ok(!span.text.includes("**"), `unread bold in ${doc.file} ${where}: ${span.text}`);
        assert.ok(
          !span.text.trimStart().startsWith("|"),
          `unread table in ${doc.file} ${where}: ${span.text}`,
        );
      }
    };

    for (const b of blocks) {
      if (b.kind === "paragraph" || b.kind === "heading" || b.kind === "quote") {
        walk(b.spans, b.kind);
      }
      if (b.kind === "list") for (const item of b.items) walk(item.spans, "list item");
      if (b.kind === "table") {
        for (const cell of b.head) walk(cell, "table head");
        for (const row of b.rows) for (const cell of row) walk(cell, "table row");
      }
    }
  });
}

test("both specs still open with a first-level heading", () => {
  for (const file of ["SPEC-V1.md", "SPEC-V2.md"]) {
    const first = parseBlocks(read(file))[0];
    assert.equal(first.kind, "heading", `${file} does not open with a heading`);
    assert.equal(first.kind === "heading" ? first.depth : -1, 1);
  }
});

test("V1's level table is present and has all twenty tiers", () => {
  const blocks = parseBlocks(read("SPEC-V1.md"));
  const tables = blocks.filter((b) => b.kind === "table");
  const ladder = tables.find(
    (t) => t.kind === "table" && texts(t.head[0]).toLowerCase() === "levels",
  );
  assert.ok(ladder, "no table headed 'Levels' in SPEC-V1.md");
  assert.equal(ladder.kind === "table" ? ladder.rows.length : 0, 20);
});

test("links between the wiki's own documents resolve to documents it carries", () => {
  const files = new Set(WIKI_DOCS.map((d) => d.file));
  for (const doc of WIKI_DOCS) {
    for (const b of parseBlocks(read(doc.file))) {
      const spans = b.kind === "paragraph" || b.kind === "heading" || b.kind === "quote" ? b.spans : [];
      for (const span of spans) {
        if (span.kind !== "link") continue;
        if (!span.href.endsWith(".md")) continue;
        assert.ok(
          files.has(span.href.replace(/^\.\//, "")),
          `${doc.file} links to ${span.href}, which the wiki does not carry`,
        );
      }
    }
  }
});
