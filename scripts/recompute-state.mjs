/**
 * Rebuilds the parts of game_state that are derivable from the ledger.
 *
 *   node --env-file=.env.local scripts/recompute-state.mjs [--apply]
 *
 * Session counters, lifetime hours and the peak level are pure functions of the
 * session and prestige tables, so they are always rewritten to match.
 *
 * XP is not. Since Phase 2 it has three sources — sessions, achievement awards
 * and freeze purchases — and since Phase 4 a prestige resets it to zero without
 * touching the sessions that earned it. It is therefore reported but left
 * alone; pass --xp to rewrite it anyway, which is only correct for an account
 * that has never prestiged, bought a freeze, or unlocked an achievement.
 */
import { neon } from "@neondatabase/serverless";
import { levelForXp, describeLevel } from "../src/lib/levels.ts";

const apply = process.argv.includes("--apply");
const rewriteXp = process.argv.includes("--xp");
const sql = neon(process.env.DATABASE_URL);

for (const prev of await sql`select * from game_state`) {
  const [t] = await sql`
    select
      coalesce(sum(xp_awarded), 0)::int                                         as xp,
      count(*) filter (where status = 'completed')::int                         as completed,
      count(*) filter (where status = 'abandoned')::int                         as abandoned,
      coalesce(sum(planned_minutes) filter (where status = 'completed'), 0)::int as focused_minutes
    from focus_session
    where user_id = ${prev.user_id} and status in ('completed', 'abandoned')`;

  const [{ peak }] = await sql`
    select coalesce(max(level_at_reset), 0)::int as peak
    from prestige_cycle where user_id = ${prev.user_id}`;

  const sessionXp = Math.max(0, t.xp);
  const focusedMs = t.focused_minutes * 60_000;
  const peakLevel = Math.max(prev.peak_level ?? 1, prev.level, peak, levelForXp(prev.xp));
  const xp = rewriteXp ? sessionXp : prev.xp;
  const level = Math.max(prev.level, levelForXp(xp));

  const same =
    prev.xp === xp &&
    prev.level === level &&
    prev.peak_level === peakLevel &&
    Number(prev.lifetime_focused_ms) === focusedMs &&
    prev.sessions_completed === t.completed &&
    prev.sessions_abandoned === t.abandoned;

  console.log(`user ${prev.user_id}`);
  console.log(`  stored : ${prev.xp} XP, level ${prev.level} (${describeLevel(prev.level).fullTitle}), ` +
              `peak ${prev.peak_level ?? 1}, ${prev.sessions_completed} done / ${prev.sessions_abandoned} abandoned`);
  console.log(`  ledger : ${sessionXp} XP from sessions, peak ${peakLevel}, ` +
              `${t.completed} done / ${t.abandoned} abandoned`);
  if (!rewriteXp && prev.xp !== sessionXp) {
    console.log(`  note   : XP left alone — achievements, freeze purchases and prestige also move it`);
  }

  if (same) { console.log("  → already correct\n"); continue; }
  if (!apply) { console.log("  → would rewrite (re-run with --apply)\n"); continue; }

  await sql`
    insert into game_state_backup (id, user_id, version, device_id, payload, reason)
    values (${crypto.randomUUID()}, ${prev.user_id}, ${prev.version}, ${prev.device_id},
            ${JSON.stringify(prev)}::jsonb, 'recomputed-from-ledger')`;

  await sql`
    update game_state set
      xp = ${xp}, level = ${level}, peak_level = ${peakLevel},
      lifetime_focused_ms = ${focusedMs},
      sessions_completed = ${t.completed}, sessions_abandoned = ${t.abandoned},
      version = ${prev.version + 1}, updated_at = now()
    where user_id = ${prev.user_id} and version = ${prev.version}`;

  console.log("  → rewritten\n");
}
