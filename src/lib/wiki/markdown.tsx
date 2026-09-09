/**
 * Turning parsed markdown into the app's own typography.
 *
 * The parsing is `parse.ts`, which is pure and tested. This file is the part
 * that knows about the app: the type scale, the rules, and what a relative
 * link between two documents in this repo should point at.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { DOC_BY_FILE } from "./docs";
import { parseBlocks, type Block, type Inline } from "./parse";

const HEADING_CLASS: Record<number, string> = {
  1: "mt-0 text-head font-medium tracking-tight sm:text-title",
  2: "mt-14 border-b border-rule pb-2 text-lead text-text",
  3: "mt-10 text-lead text-text",
  4: "mt-8 text-field text-dim",
  5: "mt-6 text-body text-dim",
  6: "mt-6 text-body text-faint",
};

const LINK_CLASS = "underline decoration-rule underline-offset-2 hover:decoration-current";

/**
 * A relative link in these documents points at a file in the repo. If it is a
 * document the wiki itself carries, it becomes a wiki link; otherwise there is
 * nothing a browser could navigate to, so it renders as the path it is rather
 * than as a link that would 404.
 */
function link(span: Extract<Inline, { kind: "link" }>, key: string): ReactNode {
  if (/^https?:\/\//.test(span.href)) {
    return (
      <a
        key={key}
        href={span.href}
        target="_blank"
        rel="noreferrer"
        className={LINK_CLASS}
        style={{ color: "var(--tier)" }}
      >
        {span.text}
      </a>
    );
  }
  const doc = DOC_BY_FILE.get(span.href.replace(/^\.\//, ""));
  if (doc) {
    return (
      <Link key={key} href={`/wiki/doc/${doc.slug}`} className={LINK_CLASS} style={{ color: "var(--tier)" }}>
        {span.text}
      </Link>
    );
  }
  return (
    <code key={key} className="rounded bg-lift px-1 py-[1px] text-[0.92em] text-faint">
      {span.text}
    </code>
  );
}

function spans(list: Inline[], keyBase: string): ReactNode[] {
  return list.map((span, n) => {
    const key = `${keyBase}-${n}`;
    switch (span.kind) {
      case "text":
        return span.text;
      case "code":
        return (
          <code key={key} className="rounded bg-lift px-1 py-[1px] text-[0.92em] text-dim">
            {span.text}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-medium text-text">
            {span.text}
          </strong>
        );
      case "em":
        return (
          <em key={key} className="italic">
            {span.text}
          </em>
        );
      case "link":
        return link(span, key);
    }
  });
}

function block(b: Block, key: number): ReactNode {
  switch (b.kind) {
    case "heading": {
      const Tag = `h${b.depth}` as "h1";
      return (
        <Tag key={key} className={HEADING_CLASS[b.depth] ?? HEADING_CLASS[6]}>
          {spans(b.spans, `h${key}`)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="mt-4 text-body leading-relaxed text-faint">
          {spans(b.spans, `p${key}`)}
        </p>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="mt-6 border-l-2 pl-4 text-body leading-relaxed text-dim"
          style={{ borderColor: "var(--tier)" }}
        >
          {spans(b.spans, `q${key}`)}
        </blockquote>
      );
    case "rule":
      return <hr key={key} className="mt-12 border-0 border-t border-rule" />;
    case "code":
      return (
        <pre
          key={key}
          className="mt-6 overflow-x-auto rounded border border-rule bg-lift p-4 text-note leading-relaxed text-dim"
        >
          <code>{b.text}</code>
        </pre>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List key={key} className="mt-4 space-y-2 text-body leading-relaxed text-faint">
          {b.items.map((item, n) => (
            <li
              key={n}
              className="relative pl-4"
              style={{ marginLeft: `${item.depth * 1.1}rem` }}
            >
              <span aria-hidden className="absolute left-0 text-faint">
                {b.ordered ? `${n + 1}.` : "·"}
              </span>
              {spans(item.spans, `li${key}-${n}`)}
            </li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div key={key} className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                {b.head.map((cell, n) => (
                  <th
                    key={n}
                    className="border-b border-rule pb-2 pr-4 text-left font-medium text-dim last:pr-0"
                  >
                    {spans(cell, `th${key}-${n}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, n) => (
                    <td
                      key={n}
                      className="border-b border-rule py-2 pr-4 align-top text-faint last:pr-0"
                    >
                      {spans(cell, `td${key}-${r}-${n}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ source }: { source: string }) {
  return <div>{parseBlocks(source).map(block)}</div>;
}
