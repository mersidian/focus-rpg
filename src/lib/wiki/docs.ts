/**
 * The documents the wiki carries.
 *
 * Registry only, and deliberately free of `node:fs` — the markdown renderer
 * needs this map to turn a relative link between documents into a wiki link,
 * and it should not drag a filesystem import into its module graph to get it.
 * Reading is `read.ts`.
 */

/**
 * No blurb here may contain a number.
 *
 * This registry is the one part of the wiki that cannot be generated — it names
 * the documents — and it is therefore the one part that can go stale. It did:
 * V2's blurb read "21 skills, ~326 items … Designed, not built" for days after
 * V2 was 22 skills, 8,568 items and built. Twice before that, a hand-typed
 * figure in `v2.ts` drifted the same way, which is why that file computes
 * everything now.
 *
 * So the rule is a shape rather than a reminder: blurbs say what a document is
 * *about*, the page shows the figures from `v2Figures()`, and a test asserts no
 * blurb contains a digit. Prose cannot drift if it makes no claims that can.
 *
 * The rule is absolute even where a figure is frozen. V1's 131 achievements
 * cannot change — a test holds them at 131 — but exempting "the ones that are
 * safe" is how the habit dies, and the page prints them from the modules
 * regardless.
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
      "The shipped game: the timer, the named level ladder, the achievements, streaks that freeze rather than break, projects and prestige. Closed.",
    standing: "shipped",
  },
  {
    slug: "spec-v2",
    file: "SPEC-V2.md",
    title: "V2 Spec",
    blurb:
      "The skill economy: gathering and combat as sessions, crafting paid with fuel, four styles across ten slots, refinement, bosses and Slaying.",
    standing: "shipped",
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
  /** Unused today. Kept for the next spec that gets written before it is built. */
  designed: "Designed, not built",
  standing: "Standing rules",
};
