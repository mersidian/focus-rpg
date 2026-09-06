import type { MetadataRoute } from "next";

/**
 * Installing to the home screen is not a nicety here. On iOS the Notification
 * API does not exist at all in a browser tab — only in an installed app — so a
 * session that ends while the phone is in a pocket can be announced no other
 * way (§3, and §11's Phase 4 gate).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Focus RPG",
    short_name: "Focus RPG",
    description: "Focused minutes, banked.",
    start_url: "/",
    display: "standalone",
    background_color: "#141a2b",
    theme_color: "#141a2b",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
