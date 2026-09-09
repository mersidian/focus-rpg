/**
 * The documents the wiki carries.
 *
 * Registry only, and deliberately free of `node:fs` — the markdown renderer
 * needs this map to turn a relative link between documents into a wiki link,
 * and it should not drag a filesystem import into its module graph to get it.
 * Reading is `read.ts`.
 */

export type WikiDoc = {
  slug: string;
  /** Path relative to the repository root. */
  file: string;
  title: string;
  /** What the document is for, in one line, shown on the index. */
  blurb: string;
  /** Whether it describes what runs or what is only designed. */
  standing: "shipped" | "designed" | "standing";
};

export const WIKI_DOCS: WikiDoc[] = [
  {
    slug: "spec-v1",
    file: "SPEC-V1.md",
    title: "V1 Spec",
    blurb:
      "The shipped game: timer, the 100-level ladder, 131 achievements, streaks, projects, prestige. Closed.",
    standing: "shipped",
  },
  {
    slug: "spec-v2",
    file: "SPEC-V2.md",
    title: "V2 Spec",
    blurb:
      "21 skills, ~326 items, crafting chains, ten equipment slots and monster combat. Designed, not built.",
    standing: "designed",
  },
  {
    slug: "invariants",
    file: "CLAUDE.md",
    title: "Invariants",
    blurb:
      "What must stay true no matter what gets built next, and the checks that run before anything is pushed.",
    standing: "standing",
  },
  {
    slug: "build-notes",
    file: "README.md",
    title: "Build notes",
    blurb:
      "Where each spec item actually lives, and the decisions the spec left open argued out one at a time.",
    standing: "shipped",
  },
];

export const DOC_BY_SLUG = new Map(WIKI_DOCS.map((d) => [d.slug, d]));
export const DOC_BY_FILE = new Map(WIKI_DOCS.map((d) => [d.file, d]));

export const STANDING_LABEL: Record<WikiDoc["standing"], string> = {
  shipped: "Built and running",
  designed: "Designed, not built",
  standing: "Standing rules",
};
