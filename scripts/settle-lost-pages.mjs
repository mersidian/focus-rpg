/**
 * Re-settles the sessions a quiet page used to end, under the rule that
 * replaced it.
 *
 *   node --env-file=.env.local --experimental-strip-types \
 *        --import ./tests/register.mjs scripts/settle-lost-pages.mjs [--apply]
 *
 * A desktop page quiet for more than two minutes used to abandon the session on
 * the spot and pay nothing, however much of it was done. The author's rule is
 * now "if it lacked focus, do not count to total but count as streak with half
 * of xp": the session finishes on time, pays half, keeps the day and is left
 * out of every total. That is not retroactive on its own — the old rows still
 * say `abandoned` and paid zero.
 *
 * So each one becomes what it would have been: completed at its planned end,
 * `unfocused_at` set to its last ping, paying half of what it would have paid —
 * the length, the prestige stars and the chain it was started into, all read
 * through the same pure rules the live path uses. No project and no report:
 * nobody logged it, and inventing an answer for them would be worse than none.
 *
 * Each user's correction is ONE transaction — the XP, the backup of the
 * game_state row it replaces, and the session rows — guarded on the game_state
 * version, so a half-applied run is impossible and a re-run finds nothing left.
 * `sessions_completed` and `lifetime_focused_ms` are not touched, because a
 * session that lacked focus counts toward no total; `db:recompute` applies the
 * same rule, so it agrees.
 *
 * The Freeze Meter is not credited. It takes a fifth of earned XP, and these
 * sessions were never reported; the streak day itself is unaffected, since the
 * streak walk counts completed sessions per day and these now are.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { UNFOCUSED_XP_MULTIPLIER, XP_BY_LENGTH } from "../src/lib/constants.ts";
import { chainMultiplier, linksBefore } from "../src/lib/chain.ts";
import { xpMultiplier } from "../src/lib/prestige.ts";

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const lost = await sql`
  select id, user_id, planned_minutes, started_at, paused_ms, last_heartbeat_at
  from focus_session
  where status = 'abandoned' and abandon_reason = 'heartbeat_lost' and xp_awarded <= 0
  order by started_at`;

if (lost.length === 0) {
  console.log("Nothing to settle — no session is still ended by a quiet page.");
  process.exit(0);
}

const byUser = new Map();
for (const row of lost) {
  const [{ stars }] = await sql`
    select coalesce((select stars from prestige_state where user_id = ${row.user_id}), 0)::int as stars`;
  const history = (
    await sql`select status, started_at, ended_at from focus_session
              where user_id = ${row.user_id} and id <> ${row.id}
                and status in ('completed', 'abandoned') and ended_at is not null
                and started_at < ${row.started_at}
              order by ended_at desc limit 12`
  ).map((h) => ({ status: h.status, startedAt: h.started_at.getTime(), endedAt: h.ended_at.getTime() }));
  const links = linksBefore(history, row.started_at.getTime());
  const full =
    (XP_BY_LENGTH[row.planned_minutes] ?? row.planned_minutes) *
    xpMultiplier(stars) *
    chainMultiplier(links, row.planned_minutes);
  const xp = Math.round(full * UNFOCUSED_XP_MULTIPLIER);
  const endedAt = new Date(row.started_at.getTime() + row.planned_minutes * 60_000 + row.paused_ms);

  if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
  byUser.get(row.user_id).push({ ...row, xp, endedAt });
  console.log(
    `  ${row.started_at.toISOString().slice(0, 16).replace("T", " ")}  ${row.planned_minutes} min, ` +
      `last ping ${row.last_heartbeat_at.toISOString().slice(11, 16)} -> completed, ` +
      `lacked focus, +${xp} XP (half of ${Math.round(full)})`,
  );
}

if (!apply) {
  console.log("\nDry run. Pass --apply to write it.");
  process.exit(0);
}

for (const [userId, rows] of byUser) {
  const xp = rows.reduce((n, r) => n + r.xp, 0);
  const [prev] = await sql`select * from game_state where user_id = ${userId}`;
  if (!prev) {
    console.error(`${userId.slice(0, 8)}: no game_state row; skipped.`);
    continue;
  }

  const results = await sql.transaction([
    sql`update game_state
           set xp = xp + ${xp}, version = version + 1, updated_at = now()
         where user_id = ${userId} and version = ${prev.version}
        returning xp, version`,
    sql`insert into game_state_backup (id, user_id, version, device_id, payload, reason)
        values (${randomUUID()}, ${userId}, ${prev.version}, ${prev.device_id},
                ${JSON.stringify(prev)}::jsonb, 'settle:lost-page')`,
    ...rows.map(
      (r) => sql`update focus_session
           set status = 'completed', abandon_reason = null, ended_at = ${r.endedAt},
               unfocused_at = last_heartbeat_at, xp_awarded = ${r.xp}, base_xp = ${r.xp},
               reported_at = now(), updated_at = now()
         where id = ${r.id} and status = 'abandoned' and abandon_reason = 'heartbeat_lost'`,
    ),
  ]);

  const updated = results[0];
  if (!updated?.length) {
    console.error(`${userId.slice(0, 8)}: another write won the race; nothing changed. Re-run.`);
    continue;
  }
  console.log(
    `${userId.slice(0, 8)}: xp ${prev.xp} -> ${updated[0].xp} (v${updated[0].version}), ` +
      `${rows.length} session(s) settled`,
  );
}

console.log("\nRun db:recompute to confirm no drift.");
