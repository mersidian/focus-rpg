/**
 * Renders the app icon to the PNG sizes a home-screen install needs.
 *
 *   node scripts/make-icons.mjs
 *
 * There is no artist on this project (SPEC §8), so the mark is the interface's
 * own vocabulary rather than an illustration: the session progress rail, bent
 * into a ring and left three-quarters full, on the app's indigo ground.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GROUND = "#141a2b";
const TIER = "#7fb7ae";

const icon = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 112 : 0}" fill="${GROUND}"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#2b3245" stroke-width="26"/>
  <path d="M 256 106 A 150 150 0 1 1 106 256"
        fill="none" stroke="${TIER}" stroke-width="26" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="26" fill="${TIER}"/>
</svg>`;

for (const [name, size, pad] of [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["icon-maskable-512.png", 512, false],
  ["apple-touch-icon.png", 180, true],
]) {
  const png = await sharp(Buffer.from(icon(512, pad))).resize(size, size).png().toBuffer();
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`  ${name.padEnd(24)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
