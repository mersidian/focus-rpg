/**
 * Puts back the abandons that `settle-lost-pages` turned into half-XP sessions.
 *
 *   npm run db:restore-lost-pages -- --apply
 *
 * For a few days a desktop page that went quiet finished its session at half
 * XP ("lacked focus"), and a script re-settled eight old abandons that way. The
 * author then set the rule that stands: "make it ratio of finish of started make
 * sense, if i lost heartbeat is abandon. unless lost connection and can make
 * request to change that is not my fault." So those sessions are abandons
 * again — and, as abandons that count, they carry the −30 and count against
 * the completion ratio. Any of them that was really a dropped connection can be
 * cleared from the log with "My connection dropped", which refunds the −30.
 *
 * A row is found by `unfocused_at`, which only the half-XP rule ever wrote. Each
 * goes back to `abandoned` / `heartbeat_lost`, ended two minutes after its last
 * ping (the moment the old rule judged it), at −30. The XP it was paid comes
 * back off, and the −30 goes on, in ONE transaction per user with the backup of
 * the game_state row it replaces, guarded on its version — a re-run finds
 * nothing left. `sessions_abandoned` moves with them so the cache agrees with
 * `db:recompute` before it is run.
 *
 * Afterwards `npm run db:push` can drop `unfocused_at`, which nothing reads now.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { ABANDON_XP_PENALTY, HEARTBEAT_GRACE_MS } from "../src/lib/constants.ts";

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const hasColumn = await sql`select 1 from information_schema.columns
  where table_name = 'focus_session' and column_name = 'unfocused_at'`;
if (hasColumn.length === 0) {
  console.log("No unfocused_at column — nothing was ever settled at half, or it is already restored.");
  process.exit(0);
}

const rows = await sql`
  select id, user_id, planned_minutes, started_at, unfocused_at, xp_awarded
  from focus_session
  where unfocused_at is not null
  order by started_at`;

if (rows.length === 0) {
  console.log("Nothing to restore — no session is still marked as lacking focus.");
  process.exit(0);
}

const byUser = new Map();
for (const row of rows) {
  if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
  byUser.get(row.user_id).push(row);
  console.log(
    `  ${row.started_at.toISOString().slice(0, 16).replace("T", " ")}  ${row.planned_minutes} min, ` +
      `paid +${row.xp_awarded} at half -> abandoned, lost heartbeat, -${ABANDON_XP_PENALTY}`,
  );
}
for (const [userId, list] of byUser) {
  const delta = -list.reduce((n, r) => n + r.xp_awarded + ABANDON_XP_PENALTY, 0);
  console.log(`\n${userId.slice(0, 8)}: ${delta} XP across ${list.length} session(s), +${list.length} abandoned`);
}

if (!apply) {
  console.log("\nDry run. Pass --apply to write it.");
  process.exit(0);
}

for (const [userId, list] of byUser) {
  const delta = -list.reduce((n, r) => n + r.xp_awarded + ABANDON_XP_PENALTY, 0);
  const [prev] = await sql`select * from game_state where user_id = ${userId}`;
  if (!prev) {
    console.error(`${userId.slice(0, 8)}: no game_state row; skipped.`);
    continue;
  }
  const results = await sql.transaction([
    // Floored at zero like every other XP write; the level ratchets regardless.
    sql`update game_state
           set xp = greatest(0, xp + ${delta}),
               sessions_abandoned = sessions_abandoned + ${list.length},
               version = version + 1, updated_at = now()
         where user_id = ${userId} and version = ${prev.version}
        returning xp, version`,
    sql`insert into game_state_backup (id, user_id, version, device_id, payload, reason)
        values (${randomUUID()}, ${userId}, ${prev.version}, ${prev.device_id},
                ${JSON.stringify(prev)}::jsonb, 'restore:lost-page-abandons')`,
    ...list.map(
      (r) => sql`update focus_session
           set status = 'abandoned', abandon_reason = 'heartbeat_lost',
               ended_at = ${new Date(r.unfocused_at.getTime() + HEARTBEAT_GRACE_MS)},
               xp_awarded = ${-ABANDON_XP_PENALTY}, base_xp = 0,
               reported_at = null, unfocused_at = null, updated_at = now()
         where id = ${r.id} and unfocused_at is not null`,
    ),
  ]);
  if (!results[0]?.length) {
    console.error(`${userId.slice(0, 8)}: another write won the race; nothing changed. Re-run.`);
    continue;
  }
  console.log(
    `${userId.slice(0, 8)}: xp ${prev.xp} -> ${results[0][0].xp} (v${results[0][0].version}), ` +
      `${list.length} session(s) restored as abandons`,
  );
}

console.log("\nRun db:recompute to confirm no drift, then db:push to drop unfocused_at.");
