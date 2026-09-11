import type { CSSProperties, ReactNode } from "react";

/**
 * Fifty-seven marks: nineteen for the two navigation rows, twenty-two for the
 * skills, and sixteen for the kinds of thing the shop sells.
 *
 * Drawn here rather than pulled from a package: an icon set is a dependency
 * that ships hundreds of glyphs to render forty-one, and every one of these is
 * two to four primitives. They inherit `currentColor` and the stroke, so the
 * accent rules in globals.css reach them without a single extra class — a
 * current link's icon turns --tier because its text does, and a skill's mark
 * takes the depth colour of the level beside it.
 *
 * No icon carries meaning on its own here. Every one sits beside its label,
 * so these are for scanning a list you already know, not for reading a list
 * you do not — which is the whole reason the skills page has them: twenty-two
 * rows of the same shape, where the label was the only thing that differed.
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
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  shop: (
    <>
      <path d="M4.8 7.5h14.4l-1.1 12a1.5 1.5 0 0 1-1.5 1.4H7.4a1.5 1.5 0 0 1-1.5-1.4Z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    </>
  ),

  /* — the twenty-two skills — */
  woodcutting: (
    <>
      <path d="m5 19.5 7.5-7.5" />
      <path d="M12.2 11.2c1.4-4.2 4.8-6.4 8-5.8.6 3.2-1.6 6.8-5.8 8.2Z" />
    </>
  ),
  fishing: (
    <>
      <path d="M17 12c-1.9 2.6-4.4 4.2-7 4.2S5 14.6 3.5 12C5 9.4 7.4 7.8 10 7.8s5.1 1.6 7 4.2Z" />
      <path d="m17 12 3.5-3v6Z" />
      <circle cx="7.4" cy="11.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  mining: (
    <>
      <path d="M3.5 10c2.6-3.7 5.4-5.5 8.5-5.5s5.9 1.8 8.5 5.5" />
      <path d="M12 7.5v13" />
    </>
  ),
  foraging: (
    <>
      <path d="M12 20.5V11" />
      <path d="M12 11c0-4 3.2-7.2 7.2-7.2 0 4-3.2 7.2-7.2 7.2Z" />
      <path d="M12 15c0-2.9-2.4-5.3-5.3-5.3 0 2.9 2.4 5.3 5.3 5.3Z" />
    </>
  ),
  hunting: (
    <>
      <ellipse cx="12" cy="16.2" rx="4.6" ry="3.7" />
      <circle cx="5.9" cy="10.2" r="2" />
      <circle cx="10.6" cy="7.3" r="2.1" />
      <circle cx="16.4" cy="8.6" r="2" />
    </>
  ),
  excavation: (
    <>
      <path d="M12 3.5v8" />
      <path d="M9.5 3.5h5" />
      <path d="M8.4 11.5h7.2l-1.4 6.2a2.2 2.2 0 0 1-4.4 0Z" />
    </>
  ),
  melee: (
    <>
      <path d="M12 2.5 14.6 6v9.5H9.4V6Z" />
      <path d="M8 15.5h8" />
      <path d="M12 15.5v5" />
      <path d="M10 20.5h4" />
    </>
  ),
  ranged: (
    <>
      <path d="M6 3.8a12.5 12.5 0 0 1 0 16.4" />
      <path d="M6 3.8v16.4" />
      <path d="M6 12h11.5" />
      <path d="m14.5 8.8 3.2 3.2-3.2 3.2" />
    </>
  ),
  magic: (
    <>
      <path d="M12 3.2 13.6 8l4.8 1.6L13.6 11.2 12 16l-1.6-4.8L5.6 9.6 10.4 8Z" />
      <path d="M17.8 15.4 18.6 17.6 20.8 18.4 18.6 19.2 17.8 21.4 17 19.2 14.8 18.4 17 17.6Z" />
    </>
  ),
  gunplay: (
    <>
      <path d="M3.5 8.5h13v5H9l-2-5" />
      <path d="M7 13.5 5 20.5" />
      <path d="M16.5 10.5h4" />
    </>
  ),
  firemaking: (
    <>
      <path d="M12 20.5a5 5 0 0 0 5-5c0-3.4-2.6-4.8-3.6-7.6-1.6 1.6-2.4 3-2.4 4.7 0 0-.8-.8-1.2-2C8.3 12 7 13.4 7 15.5a5 5 0 0 0 5 5Z" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  smelting: (
    <>
      <path d="M6 4.5h12l-1.5 6.5H7.5Z" />
      <path d="M7.5 11h9v6.5a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3Z" />
      <path d="M10.5 14.5h3" />
    </>
  ),
  smithing: (
    <>
      <path d="M4 9.5h11.5a4.5 4.5 0 0 0 4.5-4.5v3.5a5 5 0 0 1-5 5H8.5Z" />
      <path d="M9 13.5 7.5 20.5" />
      <path d="M5 20.5h7" />
    </>
  ),
  leatherworking: (
    <>
      <path d="M12 3.5c3.6 0 6.5 1.6 6.5 4.6 0 4.6-2.4 8.1-6.5 12.4C7.9 16.2 5.5 12.7 5.5 8.1c0-3 2.9-4.6 6.5-4.6Z" />
      <path d="M12 7.5v9" />
    </>
  ),
  fletching: (
    <>
      <path d="M4.5 19.5 19.5 4.5" />
      <path d="M4.5 19.5v-4l4 4Z" />
      <path d="M15 4.5h4.5V9" />
    </>
  ),
  tailoring: (
    <>
      <path d="M20 4 8.5 15.5" />
      <path d="M20 4l-1.6 4.4" />
      <circle cx="7" cy="17" r="3" />
      <path d="M7 14v6" />
    </>
  ),
  cooking: (
    <>
      <path d="M4.5 9.5h15v5a5 5 0 0 1-5 5h-5a5 5 0 0 1-5-5Z" />
      <path d="M19.5 11h1.5a1.8 1.8 0 0 1 0 3.6h-1.5" />
      <path d="M9 6.5V4" />
      <path d="M13 6.5V4" />
    </>
  ),
  alchemy: (
    <>
      <path d="M10 3.5v5.2L5.6 16.6A3 3 0 0 0 8.2 21h7.6a3 3 0 0 0 2.6-4.4L14 8.7V3.5" />
      <path d="M8.5 3.5h7" />
      <path d="M7.4 14.5h9.2" />
    </>
  ),
  runecrafting: (
    <>
      <path d="m12 3 7.4 4.3v8.4L12 20l-7.4-4.3V7.3Z" />
      <path d="M9.5 8.5v7l5-7v7" />
    </>
  ),
  jewelcrafting: (
    <>
      <path d="M8 3.5h8l4 5-8 12-8-12Z" />
      <path d="M4 8.5h16" />
      <path d="m8 3.5-2 5 6 12 6-12-2-5" />
    </>
  ),
  gunsmithing: (
    <>
      <path d="M9 3.5h6v6a3 3 0 0 1-6 0Z" />
      <path d="M9.4 12.5h5.2v6a1.6 1.6 0 0 1-1.6 1.6h-2a1.6 1.6 0 0 1-1.6-1.6Z" />
      <path d="M12 3.5v3" />
    </>
  ),

  /* — the kinds of thing the shop sells — */
  arrow: (
    <>
      <path d="M12 2.5v19" />
      <path d="m8.5 8 3.5-5.5 3.5 5.5" />
      <path d="M9 21.5c0-2.6 1.3-4.2 3-4.2s3 1.6 3 4.2" />
    </>
  ),
  bolt: (
    <>
      <path d="M12 8v13.5" />
      <path d="M9.3 2.5h5.4v5.4H9.3z" />
      <path d="m9.5 21.5 2.5-3 2.5 3" />
    </>
  ),
  dart: (
    <>
      <path d="m12 2.5 2.2 5.5h-4.4z" />
      <path d="M12 8v13.5" />
      <path d="M8 20.5 12 15l4 5.5" />
    </>
  ),
  rune: (
    <>
      <path d="M12 3 19 8v8l-7 5-7-5V8z" />
      <path d="M9.5 10h5" />
      <path d="M12 10v6" />
    </>
  ),
  cartridge: (
    <>
      <path d="M9 21h6a1 1 0 0 0 1-1V8H8v12a1 1 0 0 0 1 1Z" />
      <path d="M8 12h8" />
      <path d="M10 8V5a2 2 0 0 1 4 0v3" />
    </>
  ),
  shell: (
    <>
      <path d="M9 21h6a1 1 0 0 0 1-1V6H8v14a1 1 0 0 0 1 1Z" />
      <path d="M8 13h8" />
      <path d="M8 16h8" />
    </>
  ),
  ration: (
    <>
      <path d="M4.5 16c0-4.1 3.4-7.2 7.5-7.2s7.5 3.1 7.5 7.2v1.6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
      <path d="m9 11.5-1.6 3.2" />
      <path d="m13 10.8-1.6 3.2" />
      <path d="m17 11.5-1.6 3.2" />
    </>
  ),
  tonic: (
    <>
      <path d="M10 3h4" />
      <path d="M10.5 3v6.5L7 17.5a2 2 0 0 0 1.8 3h6.4a2 2 0 0 0 1.8-3l-3.5-8V3" />
      <path d="M8.6 15h6.8" />
    </>
  ),
  ward: (
    <>
      <path d="M12 3 19 5.8v6.4c0 4.1-2.9 7-7 8.8-4.1-1.8-7-4.7-7-8.8V5.8Z" />
      <path d="m9.2 12 2 2.2 3.6-4" />
    </>
  ),
  whetstone: (
    <>
      <path d="M3.5 13.8h17v4.4a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="m6 10.8 12-5" />
    </>
  ),
  temper: (
    <>
      <path d="M8 9.5h8v10.6a1.4 1.4 0 0 1-1.4 1.4H9.4A1.4 1.4 0 0 1 8 20.1z" />
      <path d="M6.8 6.5h10.4v3H6.8z" />
      <path d="M10.5 13.5h3" />
      <path d="M10.5 16.5h3" />
    </>
  ),
  flux: (
    <>
      <path d="m12 20.8-7-9.3 3-5h8l3 5z" />
      <path d="M8 6.5 12 20.8 16 6.5" />
      <path d="M5 11.5h14" />
    </>
  ),
  herbseed: (
    <>
      <path d="M12 21.5v-8.2" />
      <path d="M12 13.3C8.4 13.3 6.3 11.1 6.3 7.5c3.6 0 5.7 2.2 5.7 5.8Z" />
      <path d="M12 13.3c0-3.2 1.9-5.2 5.2-5.2 0 3.2-1.9 5.2-5.2 5.2Z" />
    </>
  ),
  fibreseed: (
    <>
      <path d="M7.5 4h9M7.5 20h9" />
      <path d="M9.5 4v16M14.5 4v16" />
      <path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  sapling: (
    <>
      <path d="M12 21v-5.5" />
      <path d="m12 3 4.5 7h-9Z" />
      <path d="m12 8.5 5 7H7Z" />
    </>
  ),
  stock: (
    <>
      <path d="M8.2 9.2C5.5 9.2 4 7.6 4 4.8c3 0 4.2 1.4 4.2 4.4Z" />
      <path d="M15.8 9.2c2.7 0 4.2-1.6 4.2-4.4-3 0-4.2 1.4-4.2 4.4Z" />
      <path d="M8.5 8.8h7a3 3 0 0 1 3 3v2.4a6.5 6.5 0 0 1-13 0v-2.4a3 3 0 0 1 3-3Z" />
      <path d="M10.5 19.5h3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof MARKS;

export function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  /** For the depth colour, which is computed per row rather than per class. */
  style?: CSSProperties;
}) {
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
      style={style}
    >
      {MARKS[name]}
    </svg>
  );
}
