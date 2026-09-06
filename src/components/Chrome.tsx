"use client";

import { useGame } from "./GameProvider";

/**
 * Navigation disappears for the length of a session and until the report is
 * logged. During those two states the page has exactly one job.
 */
export function Chrome({
  nav,
  children,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  const { snapshot } = useGame();
  const focused = Boolean(snapshot.active || snapshot.awaitingReport);
  return (
    <>
      {!focused && nav}
      {children}
    </>
  );
}
