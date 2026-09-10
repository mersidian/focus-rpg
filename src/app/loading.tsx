import { Spinner } from "@/components/Spinner";

/**
 * The fallback for every route without a nearer one, and the only thing that
 * covers the wait while a section's own layout resolves — `game/loading.tsx`
 * lives inside the game layout, so it cannot show until that layout has
 * already finished its own queries.
 *
 * Centred and without navigation, because at this point the app does not yet
 * know which page is arriving.
 */
export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex items-center gap-3">
        <Spinner className="size-5 text-dim" />
        <p className="text-lead text-dim">Loading</p>
      </div>
    </main>
  );
}
