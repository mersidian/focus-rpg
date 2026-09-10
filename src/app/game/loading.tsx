import { Spinner } from "@/components/Spinner";

/**
 * Sits inside `game/layout.tsx`, so both navigation rows stay put and only the
 * screen below them is replaced. Moving between game pages then reads as one
 * page thinking, rather than the whole app blinking out.
 *
 * The padding matches `Screen` in GameUi so the spinner lands where the title
 * it is standing in for would have.
 */
export default function GameLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14 sm:px-10">
      <div className="flex items-center gap-3">
        <Spinner className="size-5 text-dim" />
        <p className="text-lead text-dim">Loading</p>
      </div>
      <p className="mt-3 max-w-prose text-body leading-relaxed text-faint">
        Every game screen is read fresh from the database, and the database sleeps when it has
        been idle. The first one after a quiet spell takes a few seconds.
      </p>
    </main>
  );
}
