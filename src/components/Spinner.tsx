/**
 * A wait, shown.
 *
 * Neon sleeps when idle — error.tsx already says so — which means the first
 * navigation after a quiet spell can sit for seconds with the old page still
 * on screen and nothing to say it is working. This is the thing that says it.
 *
 * The ring stops under `prefers-reduced-motion`, because globals.css caps
 * every animation at one iteration. That is why nothing here relies on the
 * spin to carry the message: every place this appears puts the word "Loading"
 * beside it, or is an icon slot the user just clicked themselves.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={`spin ${className ?? ""}`}
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
