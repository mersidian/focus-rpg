import { useSyncExternalStore } from "react";

/** Nothing here ever changes after the first client render, so nothing subscribes. */
const never = () => () => {};

/**
 * A value the server cannot know, read without a round trip through state.
 *
 * The pattern this replaces is `useState(fallback)` plus an effect that calls
 * `setState(read())` on mount — which works, and costs a second render of the
 * whole subtree every time, and is what `react-hooks/set-state-in-effect`
 * exists to point at. `useSyncExternalStore` is React's own answer: it renders
 * `server` during hydration so the markup matches, then swaps to `read()`
 * without a mismatch and without an effect.
 *
 * `read` must return a primitive, or the same reference each time. React
 * compares snapshots with Object.is and will re-render forever on a fresh
 * object — which is why the two callers here return a string and a boolean.
 */
export function useClientValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(never, read, () => server);
}
