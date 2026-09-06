import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { loadPrestige } from "@/lib/prestige-service";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * The frame belongs to the whole app, so the stars are read once, here.
   * It is decoration, though, and decoration must never be able to take a page
   * down: if this lookup fails the app renders without it.
   */
  let stars = 0;
  try {
    const session = await auth();
    if (session?.user?.id) stars = (await loadPrestige(session.user.id)).stars;
  } catch {
    stars = 0;
  }

  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        {children}
        <PrestigeFrame stars={stars} />
      </body>
    </html>
  );
}
