/**
 * What a session's character is doing.
 *
 * The type lives here rather than in `activity-service` because the client picks
 * an activity and the server resolves it, and the service is `server-only`. A
 * shared vocabulary word does not belong inside the thing that acts on it.
 */
export type Activity =
  | { kind: "gathering"; skill: string; tier: number }
  | { kind: "combat"; biome: number; area: number }
  | { kind: "boss"; biome: number; role: "mid" | "lord" };

export function activityKey(activity: Activity): string {
  if (activity.kind === "gathering") return `g:${activity.skill}:${activity.tier}`;
  if (activity.kind === "boss") return `b:${activity.biome}:${activity.role}`;
  return `c:${activity.biome}:${activity.area}`;
}
