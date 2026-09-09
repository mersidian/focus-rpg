import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import type { CSSProperties } from "react";
import { auth } from "@/lib/auth";
import { loadPrestige } from "@/lib/prestige-service";
import { loadState } from "@/lib/game-state";
import { describeLevel } from "@/lib/levels";
import { tierAccent, tierAction } from "@/lib/format";
import { PrestigeFrame } from "@/components/PrestigeFrame";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Focus RPG",
  description: "Focused minutes, banked.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Focus RPG",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#151a28",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** What the app looks like before it knows whose app it is. */
const DEFAULT_TIER = { hue: 250, intensity: 0.1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * The frame and the accent belong to the whole app, so both are read once,
   * here. They are decoration, though, and decoration must never be able to
   * take a page down: if this lookup fails the app renders in the default hue
   * without a frame.
   *
   * Reading the accent server-side is also what stops the timer flashing. It
   * was the one page that never set --tier in a wrapper, so a Mythic's app
   * painted Drifter blue until GameProvider's effect ran and corrected it.
   * Seven pages used to set it themselves; setting it on the body deletes all
   * seven and covers the pages that never did.
   */
  let stars = 0;
  let tier = DEFAULT_TIER;
  try {
    const session = await auth();
    if (session?.user?.id) {
      stars = (await loadPrestige(session.user.id)).stars;
      tier = describeLevel((await loadState(session.user.id)).level);
    }
  } catch {
    stars = 0;
    tier = DEFAULT_TIER;
  }

  const accent = {
    "--tier": tierAccent(tier.hue, tier.intensity),
    "--tier-deep": tierAccent(tier.hue, tier.intensity, 0.42),
    "--action": tierAction(tier.hue, tier.intensity),
  } as CSSProperties;

  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh" style={accent}>
        {children}
        <PrestigeFrame stars={stars} />
      </body>
    </html>
  );
}
