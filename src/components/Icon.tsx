import type { ReactNode } from "react";

/**
 * The nineteen marks the two navigation rows need, and nothing else.
 *
 * Drawn here rather than pulled from a package: an icon set is a dependency
 * that ships hundreds of glyphs to render nineteen, and every one of these is
 * four or five primitives. They inherit `currentColor` and the stroke, so the
 * accent rules in globals.css reach them without a single extra class — a
 * current link's icon turns --tier because its text does.
 *
 * No icon carries meaning on its own here. Every one sits beside its label,
 * so these are for scanning a row you already know, not for reading a row you
 * do not.
 */
const MARKS = {
  /* — the app row — */
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 1.8" />
      <path d="M9.5 2.5h5" />
      <path d="M12 2.5V6" />
    </>
  ),
  character: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20.5c0-3.7 3.1-6.2 7-6.2s7 2.5 7 6.2" />
    </>
  ),
  streak: (
    <path d="M12 21a6 6 0 0 0 6-6c0-4-3.1-5.6-4.2-9-1.9 1.9-2.9 3.6-2.9 5.6 0 0-.9-.9-1.4-2.3C8.1 11.2 6 12.8 6 15a6 6 0 0 0 6 6Z" />
  ),
  achievements: (
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
  ),
  projects: (
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h3.8l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
  ),
  dashboard: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-7" />
      <path d="M12 20.5v-13" />
      <path d="M17.5 20.5v-4.5" />
    </>
  ),
  log: (
    <>
      <path d="M4 6.5h1.5" />
      <path d="M4 12h1.5" />
      <path d="M4 17.5h1.5" />
      <path d="M9 6.5h11" />
      <path d="M9 12h11" />
      <path d="M9 17.5h11" />
    </>
  ),
  game: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  wiki: (
    <>
      <path d="M12 6.6C10.4 5.1 8.1 4.5 4 4.5v13c4.1 0 6.4.6 8 2 1.6-1.4 3.9-2 8-2v-13c-4.1 0-6.4.6-8 2.1Z" />
      <path d="M12 6.6V19.5" />
    </>
  ),

  /* — the game row — */
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  skills: (
    <>
      <path d="M3.5 17 9 11.5l3.5 3.5L20.5 7" />
      <path d="M15.5 7h5v5" />
    </>
  ),
  areas: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8Z" />
    </>
  ),
  equipment: (
    <path d="m12 3.2 7.2 2.6v5.5c0 4.3-3 7.6-7.2 9.2-4.2-1.6-7.2-4.9-7.2-9.2V5.8Z" />
  ),
  bank: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 7.2v1.6" />
      <path d="M12 15.2v1.6" />
      <path d="M7.2 12h1.6" />
      <path d="M15.2 12h1.6" />
    </>
  ),
  collection: (
    <>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M4.8 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11.4a1.5 1.5 0 0 0 1.5-1.5v-10" />
      <path d="M10 12.5h4" />
    </>
  ),
  crafting: (
    <>
      <path d="m14.8 4 5.2 5.2-2.6 2.6-5.2-5.2Z" />
      <path d="m12 9.4-7.6 7.6a2.2 2.2 0 0 0 3.1 3.1l7.6-7.6" />
    </>
  ),
  farm: (
    <>
      <path d="M12 20.5v-7.2" />
      <path d="M12 13.3C12 9.8 9.2 7 5.7 7c0 3.5 2.8 6.3 6.3 6.3Z" />
      <path d="M12 13.3c0-4 3.3-7.3 7.3-7.3 0 4-3.3 7.3-7.3 7.3Z" />
    </>
  ),
  slaying: (
    <>
      <path d="M12 2.5 14.6 6v9.5H9.4V6Z" />
      <path d="M8 15.5h8" />
      <path d="M12 15.5v5" />
      <path d="M10 20.5h4" />
    </>
  ),
  shop: (
    <>
      <path d="M4.8 7.5h14.4l-1.1 12a1.5 1.5 0 0 1-1.5 1.4H7.4a1.5 1.5 0 0 1-1.5-1.4Z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof MARKS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      // The label beside it is the accessible name; the mark is decoration.
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {MARKS[name]}
    </svg>
  );
}
