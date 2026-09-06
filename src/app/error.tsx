"use client";

import { useEffect } from "react";

/**
 * A page that could not load. Almost always the database was briefly
 * unreachable — Neon sleeps when idle — so the useful thing to offer is another
 * try rather than an apology.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-10">
      <div className="mx-auto w-full max-w-md">
        <h1 className="display text-4xl sm:text-5xl">That did not load</h1>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-dim">
          The database was not reachable just then. Nothing was lost — your sessions live on
          the server, not in this page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-sm border border-rule px-6 py-3 text-[15px] text-text transition-colors hover:border-dim"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
