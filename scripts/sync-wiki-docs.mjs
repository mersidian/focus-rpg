/**
 * Copy the documents the wiki renders into a folder the bundler can reason
 * about.
 *
 * The wiki reads its documents from disk rather than importing them, so that
 * there is only ever one copy of a spec and it is the one people edit. But a
 * path built from the repository root cannot be analysed statically, and the
 * bundler responds by tracing the entire project into the server bundle. Told
 * to trace four named files instead, it also matches every README.md in
 * node_modules, because "./README.md" is not the anchored pattern it looks
 * like.
 *
 * A statically scoped subfolder is the remedy the bundler itself suggests:
 * `content/wiki/<file>` traces cleanly and needs no configuration at all. The
 * folder is generated, gitignored, and refreshed before every dev run and
 * every build, so it cannot fall behind the originals.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "content", "wiki");

const docs = (await readdir(process.cwd(), { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name);

await mkdir(OUT, { recursive: true });
for (const name of docs) {
  await copyFile(path.join(process.cwd(), name), path.join(OUT, name));
}

console.log(`wiki: synced ${docs.length} document${docs.length === 1 ? "" : "s"} → content/wiki`);
