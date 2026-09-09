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
 *
 * It also refolds `inventory_balance` from `inventory_entry`, which is the whole
 * reason the inventory is an append-only ledger (SPEC-V2.md §10.1). Grants are
 * derivable from sessions; SPENDS are decisions, so they are replayed in
 * sequence order rather than recomputed. A bug in a spend rule is fixed by
 * correcting the rule and replaying, never by hand-editing a quantity.
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

/* ------------------------------------------------- the inventory ledger */

const users = await sql`select distinct user_id from inventory_entry`;
if (users.length === 0) {
  console.log("no inventory ledger yet — nothing to refold");
}

for (const { user_id: userId } of users) {
  const rows = await sql`
    select item_id, delta, seq from inventory_entry
    where user_id = ${userId} order by seq asc`;

  const folded = new Map();
  let throughSeq = 0;
  for (const row of rows) {
    folded.set(row.item_id, (folded.get(row.item_id) ?? 0) + row.delta);
    if (row.seq > throughSeq) throughSeq = Number(row.seq);
  }

  const stored = await sql`
    select item_id, qty from inventory_balance where user_id = ${userId}`;
  const storedMap = new Map(stored.map((r) => [r.item_id, r.qty]));

  const drift = [];
  for (const [itemId, qty] of folded) {
    if ((storedMap.get(itemId) ?? 0) !== qty) drift.push([itemId, storedMap.get(itemId) ?? 0, qty]);
  }
  for (const [itemId, qty] of storedMap) {
    if (!folded.has(itemId) && qty !== 0) drift.push([itemId, qty, 0]);
  }

  const negative = [...folded.entries()].filter(([, qty]) => qty < 0);

  console.log(`user ${userId}`);
  console.log(`  ledger : ${rows.length} entries over ${folded.size} item types, through seq ${throughSeq}`);
  console.log(`  cache  : ${stored.length} rows, ${drift.length} disagree`);
  if (negative.length > 0) {
    // A negative fold means a spend was allowed that the grants never covered.
    // That is a rule bug, not a cache bug, and rewriting the cache would hide it.
    console.log(`  ERROR  : ${negative.length} item(s) fold to a negative balance:`);
    for (const [itemId, qty] of negative.slice(0, 10)) console.log(`             ${itemId} = ${qty}`);
    console.log("           the ledger itself is wrong; fix the spend rule before refolding");
    continue;
  }
  if (drift.length === 0) { console.log("  → already correct\n"); continue; }
  for (const [itemId, was, now] of drift.slice(0, 10)) {
    console.log(`           ${itemId}: ${was} -> ${now}`);
  }
  if (!apply) { console.log("  → would refold (re-run with --apply)\n"); continue; }

  await sql`delete from inventory_balance where user_id = ${userId}`;
  for (const [itemId, qty] of folded) {
    if (qty === 0) continue;
    await sql`
      insert into inventory_balance (user_id, item_id, qty, through_seq)
      values (${userId}, ${itemId}, ${qty}, ${throughSeq})`;
  }
  console.log("  → refolded\n");
}
