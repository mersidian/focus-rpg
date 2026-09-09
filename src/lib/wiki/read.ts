import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DOC_BY_SLUG, type WikiDoc } from "./docs";

/**
 * Documents are read from disk rather than imported, so the wiki never carries
 * a second copy of a spec that could fall behind the one people edit.
 *
 * They are read from `content/wiki`, not from the repository root, and the
 * difference matters to the bundler rather than to us: a path anchored to a
 * known subfolder can be traced into the deployment automatically, while one
 * built from the repository root cannot be analysed and drags the whole
 * project in behind it. `scripts/sync-wiki-docs.mjs` fills that folder before
 * every dev run and every build.
 */
const DOCS_DIR = "content/wiki";

export async function readDoc(slug: string): Promise<{ doc: WikiDoc; source: string } | null> {
  const doc = DOC_BY_SLUG.get(slug);
  if (!doc) return null;
  try {
    const source = await readFile(path.join(process.cwd(), DOCS_DIR, doc.file), "utf8");
    return { doc, source };
  } catch {
    return null;
  }
}
