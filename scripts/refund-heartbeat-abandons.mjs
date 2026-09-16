/**
 * Gives back the XP taken for abandons nobody chose.
 *
 *   node --env-file=.env.local scripts/refund-heartbeat-abandons.mjs [--apply]
 *
 * `heartbeat_lost` no longer carries the −30 (see `abandonPenalty`), and that
 * change is not retroactive on its own: the penalty was written into the
 * session row as `xp_awarded` and into `game_state.xp` at the moment it fired.
 * Rows already on the books still say a person gave up when they had not.
 *
 * Both have to move together. `db:recompute` rebuilds session counters by
 * reading these rows, so a refund that touched only the wallet would be undone
 * by the next rebuild, and one that touched only the rows would leave the
 * wallet short forever.
 *
 * So each user's whole correction goes in ONE transaction: the credit, the
 * backup of the row it replaced, and the zeroing of the sessions it is paying
 * for. That is what makes it safe to re-run — a half-applied refund is the one
 * outcome that would double-pay on the next attempt, and the first version of
 * this script proved it by doing exactly that.
 *
 * Deliberately not `db:recompute --xp`: that rebuilds XP from sessions alone
 * and would erase achievement awards and freeze purchases on any account that
 * has either.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const wrong = await sql`
  select user_id, id, started_at, xp_awarded
  from focus_session
  where status = 'abandoned'
    and abandon_reason = 'heartbeat_lost'
    and xp_awarded < 0
  order by started_at`;

if (wrong.length === 0) {
  console.log("Nothing to refund — no lost-heartbeat abandon is still carrying a penalty.");
  process.exit(0);
}

const byUser = new Map();
for (const row of wrong) {
  if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
  byUser.get(row.user_id).push(row);
  console.log(
    `  ${row.started_at.toISOString().slice(0, 16).replace("T", " ")}  ` +
      `${row.id.slice(0, 8)}  ${row.xp_awarded} XP`,
  );
}

for (const [userId, rows] of byUser) {
  const xp = rows.reduce((n, r) => n + -r.xp_awarded, 0);
  console.log(`\n${userId.slice(0, 8)}: +${xp} XP across ${rows.length} session(s)`);
}

if (!apply) {
  console.log("\nDry run. Pass --apply to write it.");
  process.exit(0);
}

for (const [userId, rows] of byUser) {
  const xp = rows.reduce((n, r) => n + -r.xp_awarded, 0);
  const ids = rows.map((r) => r.id);

  // The version guard is the same one `applyDelta` uses: if another device
  // wrote between the read and the transaction, nothing applies and the next
  // run picks it up — the sessions are still sitting there unzeroed.
  const [prev] = await sql`select * from game_state where user_id = ${userId}`;
  if (!prev) {
    console.error(`${userId.slice(0, 8)}: no game_state row; skipped.`);
    continue;
  }

  const [updated] = await sql.transaction([
    sql`update game_state
           set xp = xp + ${xp}, version = version + 1, updated_at = now()
         where user_id = ${userId} and version = ${prev.version}
        returning xp, version`,
    // Nothing is hard-deleted: the superseded row is kept, as every other write
    // to this table keeps it. The id is generated here because the column has
    // no database default — the application supplies it.
    sql`insert into game_state_backup (id, user_id, version, device_id, payload, reason)
        values (${randomUUID()}, ${userId}, ${prev.version}, ${prev.device_id},
                ${JSON.stringify(prev)}::jsonb, 'refund:heartbeat-abandon')`,
    sql`update focus_session
           set xp_awarded = 0, updated_at = now()
         where id = any(${ids})`,
  ]);

  if (!updated?.length) {
    console.error(`${userId.slice(0, 8)}: another write won the race; nothing changed. Re-run.`);
    continue;
  }
  console.log(
    `${userId.slice(0, 8)}: xp ${prev.xp} -> ${updated[0].xp} (v${updated[0].version}), ` +
      `${ids.length} session row(s) set to 0`,
  );
}

console.log("\nRun db:recompute to confirm no drift.");
