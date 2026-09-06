/**
 * Node resolves ESM specifiers literally; the app is written for a bundler and
 * omits file extensions. This hook fills them in so the source can be tested
 * unchanged.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = pathToFileURL(path.resolve(import.meta.dirname, "..") + "/").href;

export async function resolve(specifier, context, next) {
  // `server-only` is a build-time guard for Next; outside it there is nothing
  // to guard, so it resolves to an empty module.
  if (specifier === "server-only") {
    return { url: "data:text/javascript,", shortCircuit: true };
  }
  const mapped = specifier.startsWith("@/") ? new URL("src/" + specifier.slice(2), root).href : specifier;
  try {
    return await next(mapped, context);
  } catch (error) {
    const recoverable = ["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"];
    if (!recoverable.includes(error?.code)) throw error;
    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      try {
        return await next(mapped + suffix, context);
      } catch {
        // try the next candidate
      }
    }
    throw error;
  }
}
